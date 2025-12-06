import { GoogleGenAI } from "@google/genai";
import { SessionType } from "../types";

// Helper to safely get env vars in Vite
const getEnv = (key: string) => {
  if (typeof import.meta !== 'undefined' && (import.meta as any).env) {
    return (import.meta as any).env[key];
  }
  return '';
};

// Use NEXT_PUBLIC_GEMINI_API_KEY for client-side access in Vite
const apiKey = getEnv('NEXT_PUBLIC_GEMINI_API_KEY');

let ai: GoogleGenAI | null = null;
if (apiKey) {
    ai = new GoogleGenAI({ apiKey: apiKey });
} else {
    console.warn("Gemini API Key missing. Icebreakers will be simulated.");
}

export const generateIcebreaker = async (sessionType: SessionType): Promise<string> => {
  if (!ai) {
      return "What is your main goal for this session?";
  }

  try {
    const model = "gemini-2.5-flash";
    const prompt = `Generate a single, fun, short, and engaging icebreaker question for two people who are about to start a "${sessionType}" session. 
    Keep it under 20 words. Do not include quotes.`;

    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
    });

    return response.text.trim();
  } catch (error) {
    console.error("Gemini AI Error:", error);
    return "What is your main goal for this session?"; // Fallback
  }
};