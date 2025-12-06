import { useState, useEffect, useRef } from 'react';
import { db } from '../utils/firebaseConfig';
import { 
  collection, doc, setDoc, deleteDoc, query, where, 
  onSnapshot, getDocs, writeBatch, serverTimestamp, Timestamp, getDoc, orderBy
} from 'firebase/firestore';
import { SessionConfig, User, Partner, SessionType } from '../types';
// How long before a queue entry is considered "stale" (e.g. user crashed)
const QUEUE_EXPIRATION_MS = 5 * 60 * 1000; // 5 Minutes

export const useMatchmaking = (user: User | null, onMatch: (partner: Partner) => void) => {
  const [status, setStatus] = useState<'IDLE' | 'SEARCHING' | 'MATCHED'>('IDLE');
  const [error, setError] = useState<string | null>(null);
  
  // Store config to use in polling interval
  const activeConfig = useRef<SessionConfig | null>(null);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  // 1. CLEANUP ON WINDOW CLOSE
  useEffect(() => {
    const handleBeforeUnload = () => {
        if (user && status === 'SEARCHING') {
            // Attempt best-effort delete (navigator.sendBeacon logic usually required here, 
            // but for SPA we try synchronous-like async)
            deleteDoc(doc(db, 'queue', user.id)).catch(console.error);
        }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [user, status]);

  const joinQueue = async (config: SessionConfig) => {
  if (!user) return;
  
  // First, check if user is already in an active session
  const existingSessionQuery = query(
    collection(db, 'sessions'),
    where('participants', 'array-contains', user.id),
    where('status', '==', 'active')
  );
  const existingSessions = await getDocs(existingSessionQuery);
  
  if (!existingSessions.empty) {
    setError("You're already in a session!");
    return;
  }
  
  setStatus('SEARCHING');
  setError(null);
  activeConfig.current = config;

  try {
    // Create/Update Queue Entry
  await setDoc(doc(db, 'queue', user.id), {
  userId: user.id,
  name: user.name,
  type: config.type,
  duration: config.duration,
  timestamp: serverTimestamp(),
  status: 'waiting' 
});
console.log("✅ Joined queue:", {
  userId: user.id,
  name: user.name,
  type: config.type,
  duration: config.duration
});
      // Trigger immediate match attempt
      attemptMatch(config);
    } catch (error: any) {
      console.error("Queue Join Error:", error);
      setError(error.message);
      setStatus('IDLE');
      activeConfig.current = null;
    }
  };

  const cancelSearch = async () => {
    if (!user) return;
    try {
        activeConfig.current = null;
        await deleteDoc(doc(db, 'queue', user.id));
        if (isMounted.current) {
            setStatus('IDLE');
            setError(null);
        }
    } catch (e) { console.error("Cancel Error", e); }
  };

const attemptMatch = async (config: SessionConfig) => {
    if (!user || !activeConfig.current) return;

    try {
        console.log("🔍 [MATCH] Starting search for:", {
            myId: user.id,
            myName: user.name,
            type: config.type,
            duration: config.duration
        });

        const q = query(
            collection(db, 'queue'),
            where('type', '==', config.type),
            where('duration', '==', config.duration)
        );

        const snapshot = await getDocs(q);
        
        console.log("📊 [MATCH] Raw query results:", snapshot.size, "total users");
        
        // Log ALL users in queue
        snapshot.docs.forEach(d => {
            console.log("  👤 Found:", {
                id: d.id,
                name: d.data().name,
                type: d.data().type,
                duration: d.data().duration,
                timestamp: d.data().timestamp
            });
        });

        // Filter in memory
        const now = Date.now();
        const validPartners = snapshot.docs.filter(d => {
            const data = d.data();
            
            console.log(`  🔎 Checking ${data.name}:`, {
                isMe: d.id === user.id,
                hasTimestamp: !!data.timestamp,
                age: data.timestamp ? `${Math.round((now - data.timestamp.toMillis()) / 1000)}s` : 'no timestamp'
            });
            
            // Not me
            if (d.id === user.id) {
                console.log("    ❌ Skipping: It's me");
                return false;
            }
            
            // Check timestamp exists
            if (!data.timestamp) {
                console.log("    ❌ Skipping: No timestamp");
                return false;
            }
            
            const createdAt = data.timestamp.toMillis();
            const age = now - createdAt;
            
            if (age > QUEUE_EXPIRATION_MS) {
                console.log(`    ❌ Skipping: Too old (${Math.round(age/1000)}s)`);
                return false;
            }

            console.log("    ✅ VALID PARTNER!");
            return true;
        });

        console.log("✅ [MATCH] Valid partners found:", validPartners.length);

        // Sort by oldest first (FIFO)
        validPartners.sort((a, b) => {
            const tA = a.data().timestamp?.toMillis() || 0;
            const tB = b.data().timestamp?.toMillis() || 0;
            return tA - tB;
        });

        const potentialMatch = validPartners[0];

        if (potentialMatch) {
            const partnerData = potentialMatch.data();
            console.log("🎯 [MATCH] Attempting match with:", partnerData.name);

            // Use batch with verification
            const batch = writeBatch(db);
            const myRef = doc(db, 'queue', user.id);
            const partnerRef = doc(db, 'queue', partnerData.userId);
            
            try {
                // Double-check both still exist
                const [myDoc, partnerDoc] = await Promise.all([
                    getDoc(myRef),
                    getDoc(partnerRef)
                ]);
                
                if (!myDoc.exists()) {
                    console.log("❌ [MATCH] My queue entry gone");
                    return;
                }
                
                if (!partnerDoc.exists()) {
                    console.log("❌ [MATCH] Partner queue entry gone");
                    return;
                }
                
                // Check if partner is already in a session
                const partnerSessionCheck = query(
                    collection(db, 'sessions'),
                    where('participants', 'array-contains', partnerData.userId),
                    where('status', '==', 'active')
                );
                const partnerSessions = await getDocs(partnerSessionCheck);
                
                if (!partnerSessions.empty) {
                    console.log("❌ [MATCH] Partner already in session");
                    return;
                }

                console.log("💾 [MATCH] Creating session...");

                // Create Session
                const newSessionRef = doc(collection(db, 'sessions'));
                batch.set(newSessionRef, {
                    user1: { id: user.id, name: user.name },
                    user2: { id: partnerData.userId, name: partnerData.name },
                    participants: [user.id, partnerData.userId],
                    config: config,
                    status: 'active',
                    createdAt: serverTimestamp()
                });

                // Remove both from queue
                batch.delete(myRef);
                batch.delete(partnerRef);

                await batch.commit();
                console.log("🎉 [MATCH] Match created successfully! Session ID:", newSessionRef.id);
                
            } catch (err) {
                console.error("❌ [MATCH] Batch commit error:", err);
            }
        } else {
            console.log("⏳ [MATCH] No valid partners yet, will retry in 3s");
        }
    } catch (e: any) {
        console.error("❌ [MATCH] Error in attemptMatch:", e);
        if (e.code === 'failed-precondition' || e.toString().includes('index')) {
            console.error("🔗 [INDEX] Missing Firestore Index!");
            setError(`Missing Firestore Index. Error: ${e.message}`);
            activeConfig.current = null;
        }
    }
  };
```

---

## **Now Test and Check Console**

1. **Open browser console** (F12) on BOTH devices
2. **Start searching** on both devices
3. **Look for these specific messages:**

You should see something like:
```
🔍 [MATCH] Starting search for: {myId: "abc", myName: "User1", type: "Study", duration: 30}
📊 [MATCH] Raw query results: 2 total users
  👤 Found: {id: "abc", name: "User1", type: "Study", duration: 30}
  👤 Found: {id: "xyz", name: "User2", type: "Study", duration: 30}
  🔎 Checking User1: {isMe: true, hasTimestamp: true, age: "5s"}
    ❌ Skipping: It's me
  🔎 Checking User2: {isMe: false, hasTimestamp: true, age: "3s"}
    ✅ VALID PARTNER!
✅ [MATCH] Valid partners found: 1
🎯 [MATCH] Attempting match with: User2
💾 [MATCH] Creating session...
🎉 [MATCH] Match created successfully! Session ID: abc123def
```

---

## **Common Issues to Look For:**

### **Issue 1: No Timestamp**
If you see:
```
❌ Skipping: No timestamp
```

**Fix:** The `serverTimestamp()` might not be working. Check the Firestore console and verify the `timestamp` field exists in queue documents.

---

### **Issue 2: Type/Duration Mismatch**
If query returns 0 users:
```
📊 [MATCH] Raw query results: 0 total users
```

Check in Firestore console:
- Field `type` is exactly `"Study"` (capital S)
- Field `duration` is number `30` (not string `"30"`)

---

### **Issue 3: Both Users Trying to Match Each Other Simultaneously**

If you see:
```
❌ [MATCH] Partner queue entry gone

  // POLLING LOOP
  // Retry matching every 3 seconds if we are still searching
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (status === 'SEARCHING') {
        interval = setInterval(() => {
            if (activeConfig.current) {
                attemptMatch(activeConfig.current);
            }
        }, 3000);
    }
    return () => clearInterval(interval);
  }, [status]);

  // SESSION LISTENER
  // Waits for a session to be created where I am a participant
  useEffect(() => {
    if (!user || status === 'MATCHED') return;

    const q = query(
      collection(db, 'sessions'),
      where('participants', 'array-contains', user.id),
      where('status', '==', 'active')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const session = change.doc.data();
          
          // Identify Partner
          const partnerInfo = session.user1.id === user.id ? session.user2 : session.user1;
          
          // Stop polling
          activeConfig.current = null;
          setStatus('MATCHED');
          
          // Trigger callback
          onMatch({
            id: partnerInfo.id,
            name: partnerInfo.name,
            type: SessionType.ANY
          });
        }
      });
    });

    return () => unsubscribe();
  }, [user, status]);

  return { status, joinQueue, cancelSearch, error };
};
