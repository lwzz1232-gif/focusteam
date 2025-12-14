
export enum Screen {
  LANDING = 'LANDING',
  SPLASH = 'SPLASH',
  LOGIN = 'LOGIN',
  DASHBOARD = 'DASHBOARD',
  MATCHING = 'MATCHING',
  NEGOTIATION = 'NEGOTIATION',
  SESSION = 'SESSION',
  ADMIN = 'ADMIN'
}

export enum SessionType {
  STUDY = 'Study',
  WORK = 'Work',
  READING = 'Reading',
  CODING = 'Coding',
  ANY = 'Any'
}

export enum SessionDuration {
  TEST = -1, // Dev mode: 30s phases
  MIN_30 = 30,
  HOUR_1 = 60,
  HOUR_2 = 120
}

export enum SessionMode {
  DEEP_WORK = 'Deep Work',
  POMODORO = 'Pomodoro' // 25m work / 5m break cycles
}

export enum SessionPhase {
  WAITING = 'WAITING',
  ICEBREAKER = 'ICEBREAKER', // Pre-talk
  FOCUS = 'FOCUS',           // Work
  BREAK = 'BREAK',           // Pomodoro Break
  DEBRIEF = 'DEBRIEF',       // Post-talk
  COMPLETED = 'COMPLETED'
}

export interface SessionConfig {
  type: SessionType;
  duration: SessionDuration;
  mode: SessionMode;
  preTalkMinutes: number;
  postTalkMinutes: number;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'user' | 'admin';
  emailVerified: boolean;
  avatar?: string;
  bannedUntil?: number; // timestamp
}

export interface Report {
  id: string;
  reporterId: string;
  reportedId: string;
  reason: string;
  timestamp: number;
}

export interface Partner {
  id: string;
  name: string;
  type: SessionType;
}

export interface SessionLog {
  id: string;
  user1: { id: string; name: string };
  user2: { id: string; name: string };
  startTime: number;
  duration: number; // minutes (Planned)
  actualDuration: number; // minutes (Actual time spent)
  type: SessionType;
  outcome: 'COMPLETED' | 'ABORTED';
  abortedBy?: string; // ID of the user who left early
  tasks?: TodoItem[]; // Snapshot of tasks at end of session
}

export interface BanRecord {
  until: number;
  reason: string;
}

export interface BanHistoryLog {
  id: string;
  userId: string;
  action: 'BAN' | 'UNBAN';
  reason?: string;
  timestamp: number;
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
}

export interface TodoItem {
  id: string;
  text: string;
  completed: boolean;
  ownerId: string; // 'me' or 'partner'
}

export interface Notification {
  id: string;
  text: string;
  timestamp: number;
  read: boolean;
  type: 'system' | 'info';
}
