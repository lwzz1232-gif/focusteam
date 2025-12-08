import { useEffect, useRef, useState } from 'react';
import { db } from '../utils/firebaseConfig';
import { collection, doc, onSnapshot, updateDoc, addDoc, getDoc, setDoc } from 'firebase/firestore';

const SERVERS = {
  iceServers: [
    { urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'] },
  ],
  iceCandidatePoolSize: 10,
};

export const useWebRTC = (sessionId: string, userId: string, isInitiator: boolean) => {
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'new' | 'checking' | 'connected' | 'failed' | 'disconnected' | 'closed'>('new');
  
  const pc = useRef<RTCPeerConnection | null>(null);
  
  // We track the stream in a Ref too, to ensure we clean up the EXACT stream we created
  // even if state updates haven't processed yet.
  const localStreamRef = useRef<MediaStream | null>(null); 

  useEffect(() => {
    if (!sessionId) return;

    let unsubscribes: (() => void)[] = [];
    let isMounted = true;

    const setupConnection = async () => {
      console.log(`[WEBRTC] Initializing. Role: ${isInitiator ? 'Caller' : 'Callee'}`);

      // 1. Initialize PeerConnection
      pc.current = new RTCPeerConnection(SERVERS);

      pc.current.oniceconnectionstatechange = () => {
          console.log(`[WEBRTC] Connection State: ${pc.current?.iceConnectionState}`);
          if (isMounted && pc.current) {
              setConnectionStatus(pc.current.iceConnectionState);
          }
      };

      // 2. Handle Remote Stream
      pc.current.ontrack = (event) => {
        console.log('[WEBRTC] Received Remote Track');
        event.streams[0].getTracks().forEach((track) => {
            // Only update if it's a new stream to prevent flickering
            setRemoteStream(prev => {
                if (prev?.id === event.streams[0].id) return prev;
                return event.streams[0];
            });
        });
      };

      // 3. Handle Local Media (Camera/Mic)
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        
        if (!isMounted) {
            // Component unmounted while we were waiting for camera. Stop it immediately.
            stream.getTracks().forEach(t => t.stop());
            return;
        }

        console.log('[WEBRTC] Local Media Acquired');
        localStreamRef.current = stream; // Save to ref for cleanup
        setLocalStream(stream);          // Save to state for UI

        // Add tracks to PC
        stream.getTracks().forEach((track) => {
           if (pc.current) {
             pc.current.addTrack(track, stream);
           }
        });
      } catch (err) {
        console.error("[WEBRTC] Media Access Error:", err);
        return; 
      }

      // 4. Handle ICE Candidates (Sending to Firestore)
      const sessionRef = doc(db, 'sessions', sessionId);
      const callerCandidatesCol = collection(sessionRef, 'callerCandidates');
      const calleeCandidatesCol = collection(sessionRef, 'calleeCandidates');

      pc.current.onicecandidate = (event) => {
        if (event.candidate) {
          const targetCol = isInitiator ? callerCandidatesCol : calleeCandidatesCol;
          addDoc(targetCol, event.candidate.toJSON()).catch(e => console.error("Candidate Error", e));
        }
      };

      // 5. Signaling Logic (Offer / Answer)
      if (isInitiator) {
        // --- CALLER ---
        console.log('[WEBRTC] Creating Offer...');
        const offer = await pc.current.createOffer();
        await pc.current.setLocalDescription(offer);
        
        await updateDoc(sessionRef, { 
            offer: { type: offer.type, sdp: offer.sdp } 
        });

        // Listen for Answer
        const unsubSession = onSnapshot(sessionRef, async (snapshot) => {
          const data = snapshot.data();
          if (!pc.current?.currentRemoteDescription && data?.answer) {
            console.log('[WEBRTC] Received Answer');
            const answer = new RTCSessionDescription(data.answer);
            await pc.current.setRemoteDescription(answer);
          }
        });
        unsubscribes.push(unsubSession);

        // Listen for Callee Candidates
        const unsubCandidates = onSnapshot(calleeCandidatesCol, (snapshot) => {
          snapshot.docChanges().forEach((change) => {
            if (change.type === 'added' && pc.current) {
              const candidate = new RTCIceCandidate(change.doc.data());
              pc.current.addIceCandidate(candidate).catch(e => console.warn("ICE Add Fail", e));
            }
          });
        });
        unsubscribes.push(unsubCandidates);

      } else {
        // --- CALLEE ---
        console.log('[WEBRTC] Waiting for Offer...');
        
        // Listen for Offer
        const unsubSession = onSnapshot(sessionRef, async (snapshot) => {
          const data = snapshot.data();
          if (!pc.current?.currentRemoteDescription && data?.offer) {
            console.log('[WEBRTC] Received Offer, Sending Answer');
            const offer = new RTCSessionDescription(data.offer);
            await pc.current.setRemoteDescription(offer);

            const answer = await pc.current.createAnswer();
            await pc.current.setLocalDescription(answer);
            
            await updateDoc(sessionRef, { 
                answer: { type: answer.type, sdp: answer.sdp } 
            });
          }
        });
        unsubscribes.push(unsubSession);

        // Listen for Caller Candidates
        const unsubCandidates = onSnapshot(callerCandidatesCol, (snapshot) => {
          snapshot.docChanges().forEach((change) => {
            if (change.type === 'added' && pc.current) {
              const candidate = new RTCIceCandidate(change.doc.data());
              pc.current.addIceCandidate(candidate).catch(e => console.warn("ICE Add Fail", e));
            }
          });
        });
        unsubscribes.push(unsubCandidates);
      }
    };

    setupConnection();

    // CLEANUP FUNCTION
    return () => {
      isMounted = false;
      console.log('[WEBRTC] Cleaning up connection');
      
      unsubscribes.forEach(fn => fn());
      
      if (pc.current) {
          pc.current.close();
          pc.current = null;
      }
      
      // Stop the specific stream stored in REF to avoid closure staleness
      if (localStreamRef.current) {
          localStreamRef.current.getTracks().forEach(t => t.stop());
          localStreamRef.current = null;
      }
    };
  }, [sessionId, isInitiator]);

  return { localStream, remoteStream, connectionStatus };
};
