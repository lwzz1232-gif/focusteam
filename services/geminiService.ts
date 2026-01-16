import { SessionType } from "../types";

export const generateIcebreaker = async (sessionType: SessionType): Promise<string> => {
  try {
    const response = await fetch('/api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionType }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.icebreaker;
  } catch (error) {
    console.error("Failed to generate icebreaker:", error);
    return "What is your main goal for this session?"; // Fallback
  }
};