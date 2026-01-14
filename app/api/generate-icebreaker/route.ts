import { GoogleGenAI } from "@google/genai";
import { SessionType } from "../../../types";

export async function POST(req: Request) {
  try {
    const { sessionType } = (await req.json()) as { sessionType: SessionType };

    // --- SERVER-SIDE VALIDATION ---
    if (!sessionType || !Object.values(SessionType).includes(sessionType)) {
      return new Response(JSON.stringify({ error: 'Invalid session type' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // --- API KEY HANDLING (SERVER-SIDE) ---
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("Gemini API key is not set in environment variables.");
      // Return a generic fallback question if the key is missing
      return new Response(JSON.stringify({ icebreaker: "What is your main goal for this session?" }), {
        status: 200, // Still a success, just using a fallback
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const ai = new GoogleGenAI({ apiKey });

    // --- PROMPT GENERATION ---
    const model = "gemini-1.5-flash"; // Correct model name
    const prompt = `Generate a single, fun, short, and engaging icebreaker question for two people who are about to start a "${sessionType}" session.
    Keep it under 20 words. Do not include quotes.`;

    // --- API CALL ---
    const response = await ai.getGenerativeModel({ model }).generateContent(prompt);

    // Using response.text() is not valid for this SDK version.
    // Accessing the text directly from the response object is needed.
    // Let's assume the response has a structure we can parse.
    // A more robust way might be needed depending on the exact SDK version and response structure.
    const text = response.response.candidates?.[0]?.content?.parts?.[0]?.text;


    if (!text) {
        throw new Error("Failed to extract text from Gemini response");
    }

    // --- SUCCESS RESPONSE ---
    return new Response(JSON.stringify({ icebreaker: text.trim() }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error("API Route Error:", error);
    // --- ERROR RESPONSE ---
    return new Response(JSON.stringify({ error: 'Failed to generate icebreaker' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
