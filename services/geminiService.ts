import { SessionType } from "../types";

const FALLBACK_ICEBREAKER = "What is your main goal for this session?";

export const generateIcebreaker = async (sessionType: SessionType): Promise<string> => {
  try {
    const response = await fetch('/api/generate-icebreaker', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sessionType }),
    });

    if (!response.ok) {
      // Log the server's error response for debugging
      const errorData = await response.json();
      console.error("API Error:", errorData.error || `HTTP status ${response.status}`);
      return FALLBACK_ICEBREAKER;
    }

    const data = await response.json();
    return data.icebreaker || FALLBACK_ICEBREAKER;

  } catch (error) {
    console.error("Network or Client-side Error:", error);
    return FALLBACK_ICEBREAKER;
  }
};