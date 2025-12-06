
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
export const getNotifications = (userId: string): Notification[] => {
    // In a real app, you would fetch from Firestore 'notifications' collection
    return [];
};
export const markNotificationRead = (userId: string, noteId: string) => {};

// Admin Actions (Now handled directly in Admin.tsx, kept as safe no-ops)
export const mockBanUser = (userId: string, hours: number, reason: string) => {};
export const mockUnbanUser = (userId: string) => {};
export const mockSendBroadcast = (message: string) => {};
export const getBroadcast = () => null;
export const getSessionChat = (sessionId: string): ChatMessage[] => [];
