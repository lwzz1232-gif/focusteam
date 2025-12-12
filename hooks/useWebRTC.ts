import { useEffect, useRef, useState } from 'react';
import { db } from '../utils/firebaseConfig';
import { collection, doc, onSnapshot, updateDoc, addDoc } from 'firebase/firestore';

// --- ULTIMATE SERVER CONFIGURATION ---
const SERVERS = {
  iceServers: [
    // 1. GOOGLE STUN POOL (Maximum Redundancy)
    // We mix port 19302 (Google Standard) and 3478 (Industry Standard)
    { 
      urls: [
        'stun:stun1.l.google.com:19302',
        'stun:stun2.l.google.com:19302',
        'stun:stun1.l.google.com:3478',
        'stun:stun3.l.google.com:3478',
        'stun:stun4.l.google.com:19302',
      ] 
    },
    // 2. YOUR ORACLE TURN - Standard Port (The "Off-Road" Mode for 4G/5G)
    {
      urls: "turn:92.5.104.21:3478", 
      username: "focustwin",
      credential: "focustwin123", 
    },
    // 3. YOUR ORACLE TURN - Stealth Port (For Schools/Offices)
    {
      urls: "turn:92.5.104.21:443", 
      username: "focustwin",
      credential: "focustwin123", 
    }
  ],
  iceCandidatePoolSize: 10,
};

export const useWebRTC = (sessionId: string, userId: string, isInitiator: boolean) => {
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'new' | 'checking' | 'connected' | 'failed' | 'disconnected' | 'closed'>('new');
  
  const pc = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  
  // BUFFER QUEUE (Prevents "Remote Description" errors)
  const candidateQueue = useRef<RTCIceCandidateInit[]>([]);

  useEffect(() => {
    if (!sessionId) return;

    let unsubscribes: (() => void)[] = [];
    let isMounted = true;

    const setupConnection = async () => {
      console.log(`[WEBRTC] Initializing. Role: ${isInitiator ? 'Caller' : 'Callee'}`);

      // 1. Initialize PeerConnection with ULTIMATE servers
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

      // 4. Handle Local Candidates
      const sessionRef = doc(db, 'sessions', sessionId);
      const callerCandidatesCol = collection(sessionRef, 'callerCandidates');
      const calleeCandidatesCol = collection(sessionRef, 'calleeCandidates');

      pc.current.onicecandidate = (event) => {
        if (event.candidate) {
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

      // Helper to handle incoming candidates
      const handleIncomingCandidate = (change: any) => {
          if (change.type === 'added' && pc.current) {
              const candidateData = change.doc.data();
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
        const offer = await pc.current.createOffer({ iceRestart: true });
        await pc.current.setLocalDescription(offer);
        
        await updateDoc(sessionRef, { 
            offer: { type: offer.type, sdp: offer.sdp } 
        });

        const unsubSession = onSnapshot(sessionRef, async (snapshot) => {
          const data = snapshot.data();
          if (!pc.current?.currentRemoteDescription && data?.answer) {
            console.log('[WEBRTC] Received Answer');
            const answer = new RTCSessionDescription(data.answer);
            await pc.current.setRemoteDescription(answer);
            processCandidateQueue();
          }
        });
        unsubscribes.push(unsubSession);

        const unsubCandidates = onSnapshot(calleeCandidatesCol, (snapshot) => {
          snapshot.docChanges().forEach(handleIncomingCandidate);
        });
        unsubscribes.push(unsubCandidates);

      } else {
        // --- CALLEE ---
        console.log('[WEBRTC] Waiting for Offer...');
        
        const unsubSession = onSnapshot(sessionRef, async (snapshot) => {
          const data = snapshot.data();
          if (!pc.current?.currentRemoteDescription && data?.offer) {
            console.log('[WEBRTC] Received Offer, Sending Answer');
            const offer = new RTCSessionDescription(data.offer);
            await pc.current.setRemoteDescription(offer);
            
            processCandidateQueue();

            const answer = await pc.current.createAnswer();
            await pc.current.setLocalDescription(answer);
            
            await updateDoc(sessionRef, { 
                answer: { type: answer.type, sdp: answer.sdp } 
            });
          }
        });
        unsubscribes.push(unsubSession);

        const unsubCandidates = onSnapshot(callerCandidatesCol, (snapshot) => {
          snapshot.docChanges().forEach(handleIncomingCandidate);
        });
        unsubscribes.push(unsubCandidates);
      }
    };

    setupConnection();

    // CLEANUP
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
