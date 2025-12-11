import { useEffect, useRef, useState } from 'react';
import { db } from '../utils/firebaseConfig';
import { collection, doc, onSnapshot, updateDoc, addDoc } from 'firebase/firestore';

// FIX 1: Use ALL Google STUN servers (Redundancy)
const SERVERS = {
  iceServers: [
    { 
      urls: [
        'stun:stun1.l.google.com:19302',
        'stun:stun2.l.google.com:19302',
        'stun:stun3.l.google.com:19302',
        'stun:stun4.l.google.com:19302',

//maybe could be deleted keep in mind this is overloaded
          'stun:openrelay.metered.ca:80',
        'turn:openrelay.metered.ca:80',
        'turn:openrelay.metered.ca:443',
        'turn:openrelay.metered.ca:3478'
      ] 
    },
  ],
  iceCandidatePoolSize: 10,
};

export const useWebRTC = (sessionId: string, userId: string, isInitiator: boolean) => {
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'new' | 'checking' | 'connected' | 'failed' | 'disconnected' | 'closed'>('new');
  
  const pc = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  
  // FIX 2: The Buffer Queue (This prevents the "Remote Description" error)
  const candidateQueue = useRef<RTCIceCandidateInit[]>([]);

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
            setRemoteStream(prev => {
                if (prev?.id === event.streams[0].id) return prev;
                return event.streams[0];
            });
        });
      };

      // 3. Handle Local Media
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        
        if (!isMounted) {
            stream.getTracks().forEach(t => t.stop());
            return;
        }

        console.log('[WEBRTC] Local Media Acquired');
        localStreamRef.current = stream;
        setLocalStream(stream);

        stream.getTracks().forEach((track) => {
           if (pc.current) {
             pc.current.addTrack(track, stream);
           }
        });
      } catch (err) {
        console.error("[WEBRTC] Media Access Error:", err);
        return; 
      }

      // 4. Handle Local Candidates (Sending to YOUR specific collections)
      const sessionRef = doc(db, 'sessions', sessionId);
      const callerCandidatesCol = collection(sessionRef, 'callerCandidates');
      const calleeCandidatesCol = collection(sessionRef, 'calleeCandidates');

      pc.current.onicecandidate = (event) => {
        if (event.candidate) {
          // Keep your exact logic here
          const targetCol = isInitiator ? callerCandidatesCol : calleeCandidatesCol;
          addDoc(targetCol, event.candidate.toJSON()).catch(e => console.error("Candidate Error", e));
        }
      };

      // Helper to process buffered candidates
      const processCandidateQueue = async () => {
          if (!pc.current || candidateQueue.current.length === 0) return;
          console.log(`[WEBRTC] Flushing ${candidateQueue.current.length} buffered candidates`);
          for (const candidate of candidateQueue.current) {
              try {
                  await pc.current.addIceCandidate(new RTCIceCandidate(candidate));
              } catch (e) {
                  console.error("Buffered ICE Error", e);
              }
          }
          candidateQueue.current = [];
      };

      // Helper to handle incoming candidates (With Buffering)
      const handleIncomingCandidate = (change: any) => {
          if (change.type === 'added' && pc.current) {
              const candidateData = change.doc.data();
              // If we are ready, add it. If not, queue it.
              if (pc.current.remoteDescription && pc.current.remoteDescription.type) {
                  const candidate = new RTCIceCandidate(candidateData);
                  pc.current.addIceCandidate(candidate).catch(e => console.warn("ICE Add Fail", e));
              } else {
                  candidateQueue.current.push(candidateData);
              }
          }
      };

      // 5. Signaling Logic
      if (isInitiator) {
        // --- CALLER ---
        console.log('[WEBRTC] Creating Offer...');
        // FIX 3: Ice Restart enabled here
        const offer = await pc.current.createOffer({ iceRestart: true });
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
            // Process any candidates that arrived early
            processCandidateQueue();
          }
        });
        unsubscribes.push(unsubSession);

        // Listen for Callee Candidates
        const unsubCandidates = onSnapshot(calleeCandidatesCol, (snapshot) => {
          snapshot.docChanges().forEach(handleIncomingCandidate);
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
            
            // Process any candidates that arrived early
            processCandidateQueue();

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
          snapshot.docChanges().forEach(handleIncomingCandidate);
        });
        unsubscribes.push(unsubCandidates);
      }
    };

    setupConnection();

    return () => {
      isMounted = false;
      console.log('[WEBRTC] Cleaning up connection');
      unsubscribes.forEach(fn => fn());
      if (pc.current) {
          pc.current.close();
          pc.current = null;
      }
      if (localStreamRef.current) {
          localStreamRef.current.getTracks().forEach(t => t.stop());
          localStreamRef.current = null;
      }
    };
  }, [sessionId, isInitiator]);

  return { localStream, remoteStream, connectionStatus };
};
