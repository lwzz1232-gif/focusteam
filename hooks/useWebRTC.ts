import { useEffect, useRef, useState } from 'react';
import { db } from '../utils/firebaseConfig';
import { collection, doc, onSnapshot, updateDoc, addDoc } from 'firebase/firestore';

// Free Public STUN Servers
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
  const unsubscribes = useRef<(() => void)[]>([]);
  
  // Queue for candidates arriving before remote description
  const candidateQueue = useRef<RTCIceCandidateInit[]>([]);

  useEffect(() => {
    if (!sessionId) return;

    const setupConnection = async () => {
      // 1. Initialize PeerConnection
      pc.current = new RTCPeerConnection(SERVERS);

      // Monitor Connection State
      pc.current.oniceconnectionstatechange = () => {
          if (pc.current) {
              console.log(`WebRTC ICE State: ${pc.current.iceConnectionState}`);
              setConnectionStatus(pc.current.iceConnectionState);
          }
      };

      // 2. Handle Local Media
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setLocalStream(stream);
        stream.getTracks().forEach((track) => {
           if (pc.current) pc.current.addTrack(track, stream);
        });
      } catch (err) {
        console.error("Media Access Error:", err);
        return; // Exit if no media
      }

      // 3. Handle Remote Stream
      pc.current.ontrack = (event) => {
        event.streams[0].getTracks().forEach(() => {
            setRemoteStream(prev => {
                // Prevent flicker
                if (prev?.id === event.streams[0].id) return prev;
                return event.streams[0];
            });
        });
      };

      // 4. Handle ICE Candidates (Sending)
      const sessionRef = doc(db, 'sessions', sessionId);
      const callerCandidatesCol = collection(sessionRef, 'callerCandidates');
      const calleeCandidatesCol = collection(sessionRef, 'calleeCandidates');

      pc.current.onicecandidate = (event) => {
        if (event.candidate) {
          const targetCol = isInitiator ? callerCandidatesCol : calleeCandidatesCol;
          addDoc(targetCol, event.candidate.toJSON());
        }
      };

      // 5. Signaling Logic
      if (isInitiator) {
        // Create Offer
        const offer = await pc.current.createOffer();
        await pc.current.setLocalDescription(offer);
        await updateDoc(sessionRef, { offer: { type: offer.type, sdp: offer.sdp } });

        // Listen for Answer
        const unsubSession = onSnapshot(sessionRef, async (snapshot) => {
          const data = snapshot.data();
          if (!pc.current?.currentRemoteDescription && data?.answer) {
            const answer = new RTCSessionDescription(data.answer);
            await pc.current.setRemoteDescription(answer);
            processCandidateQueue();
          }
        });
        unsubscribes.current.push(unsubSession);

        // Listen for Callee Candidates
        const unsubCandidates = onSnapshot(calleeCandidatesCol, (snapshot) => {
          snapshot.docChanges().forEach((change) => {
            if (change.type === 'added') {
              handleCandidate(change.doc.data());
            }
          });
        });
        unsubscribes.current.push(unsubCandidates);

      } else {
        // Listen for Offer
        const unsubSession = onSnapshot(sessionRef, async (snapshot) => {
          const data = snapshot.data();
          if (!pc.current?.currentRemoteDescription && data?.offer) {
            const offer = new RTCSessionDescription(data.offer);
            await pc.current.setRemoteDescription(offer);
            processCandidateQueue();

            const answer = await pc.current.createAnswer();
            await pc.current.setLocalDescription(answer);
            await updateDoc(sessionRef, { answer: { type: answer.type, sdp: answer.sdp } });
          }
        });
        unsubscribes.current.push(unsubSession);

        // Listen for Caller Candidates
        const unsubCandidates = onSnapshot(callerCandidatesCol, (snapshot) => {
          snapshot.docChanges().forEach((change) => {
            if (change.type === 'added') {
              handleCandidate(change.doc.data());
            }
          });
        });
        unsubscribes.current.push(unsubCandidates);
      }
    };

    // Helper: Buffer candidates if connection not ready
    const handleCandidate = async (candidateData: any) => {
        const candidate = new RTCIceCandidate(candidateData);
        if (pc.current && pc.current.remoteDescription) {
            try {
                await pc.current.addIceCandidate(candidate);
            } catch (e) { console.error("Error adding candidate", e); }
        } else {
            candidateQueue.current.push(candidateData);
        }
    };

    const processCandidateQueue = async () => {
        if (!pc.current) return;
        while (candidateQueue.current.length > 0) {
            const c = candidateQueue.current.shift();
            if (c) {
                try {
                    await pc.current.addIceCandidate(new RTCIceCandidate(c));
                } catch (e) { console.error("Error processing queued candidate", e); }
            }
        }
    };

    setupConnection();

    // CLEANUP
    return () => {
      unsubscribes.current.forEach(fn => fn());
      unsubscribes.current = [];
      
      if (pc.current) {
          pc.current.close();
          pc.current = null;
      }
      // Stop Camera
      if (localStream) {
          localStream.getTracks().forEach(t => t.stop());
      }
    };
  }, [sessionId, isInitiator]);

  return { localStream, remoteStream, connectionStatus };
};