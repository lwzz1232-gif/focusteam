
// This file is kept for compatibility with types and shared utilities.
// Most Admin logic has been moved to screens/Admin.tsx to use real Firestore data.

import { Report, SessionLog, BanRecord, User, ChatMessage, BanHistoryLog, Notification } from "../types";

export const getReports = (): Report[] => [];
export const getSessions = (): SessionLog[] => [];
export const getAllUsers = (): User[] => [];
export const checkBanStatus = (userId: string): BanRecord | null => null;
export const getBanHistory = (userId: string): BanHistoryLog[] => [];
export const getLiveStats = () => ({
    activeUsers: 0,
    activeSessions: 0,
    serverLoad: 'Firebase',
    totalHoursFocused: 0
});

// Notifications (Still useful for Layout)
import { db } from '../utils/firebaseConfig';
import { collection, query, getDocs, orderBy } from 'firebase/firestore';

export const getNotifications = async (userId: string): Promise<Notification[]> => {
    try {
      const q = query(
        collection(db, 'users', userId, 'notifications'),
        orderBy('timestamp', 'desc')
      );
      const snap = await getDocs(q);
      return snap.docs.map(d => ({
        ...d.data(),
        id: d.id
      } as Notification));
    } catch(e) {
      console.error("Failed to fetch notifications:", e);
      return [];
    }
};
export const markNotificationRead = (userId: string, noteId: string) => {};

// Admin Actions (Now handled directly in Admin.tsx, kept as safe no-ops)
export const mockBanUser = (userId: string, hours: number, reason: string) => {};
export const mockUnbanUser = (userId: string) => {};
export const mockSendBroadcast = (message: string) => {};
export const getBroadcast = () => null;
export const getSessionChat = (sessionId: string): ChatMessage[] => [];
