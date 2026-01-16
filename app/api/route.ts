import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';

const MODEL_CONFIG = {
  generationConfig: {
    temperature: 0.9,
    topP: 1,
    topK: 1,
    maxOutputTokens: 2048,
  },
  safetySettings: [
    {
      category: HarmCategory.HARM_CATEGORY_HARASSMENT,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
  ],
};

export async function POST(req: Request) {
  try {
    const { sessionType } = await req.json();
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'API key not found' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-pro', ...MODEL_CONFIG });

    const prompt = `Generate a single, fun, short, and engaging icebreaker question for two people about to start a "${sessionType}" session. Keep it under 20 words. Do not include quotes.`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    return new Response(JSON.stringify({ icebreaker: text.trim() }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('API Error:', error);
    return new Response(JSON.stringify({ error: 'Failed to generate icebreaker' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
