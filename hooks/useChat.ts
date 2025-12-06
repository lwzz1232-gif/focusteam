import { useState, useEffect } from 'react';
import { db } from '../utils/firebaseConfig';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { ChatMessage } from '../types';

export const useChat = (sessionId: string, userId: string, userName: string) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) return;

    const q = query(
      collection(db, 'sessions', sessionId, 'messages'),
      orderBy('timestamp', 'asc')
    );

    const unsubscribe = onSnapshot(q, 
      (snapshot) => {
        const msgs = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            sessionId,
            senderId: data.senderId === userId ? 'me' : data.senderId,
            senderName: data.senderId === userId ? userName : 'Partner',
            text: data.text,
            timestamp: data.timestamp?.toMillis() || Date.now()
          };
        });
        setMessages(msgs);
      },
      (err) => {
        console.error("Chat Error:", err);
        setError("Failed to load chat.");
      }
    );

    return () => unsubscribe();
  }, [sessionId, userId]);

  const sendMessage = async (text: string) => {
    if (!sessionId) return;
    try {
        await addDoc(collection(db, 'sessions', sessionId, 'messages'), {
            senderId: userId,
            senderName: userName,
            text: text,
            timestamp: serverTimestamp()
        });
    } catch (err) {
        console.error("Send Error:", err);
        setError("Failed to send message.");
    }
  };

  return { messages, sendMessage, error };
};