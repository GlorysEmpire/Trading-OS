import type { VercelRequest, VercelResponse } from "@vercel/node";
import { GoogleGenAI } from "@google/genai";

// Lazy GoogleGenAI client, reused across warm serverless invocations
// (same pattern as the local Express server in server.ts).
let genAIClient: GoogleGenAI | null = null;
function getGenAIClient(): GoogleGenAI | null {
  if (!process.env.GEMINI_API_KEY) {
    return null;
  }
  if (!genAIClient) {
    genAIClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return genAIClient;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { prompt, context } = req.body ?? {};
    if (!prompt) {
      return res.status(400).json({ error: "Missing prompt" });
    }

    const ai = getGenAIClient();
    if (!ai) {
      // Intelligent rule-based fallback if no API key is configured
      return res.json({
        text: `[Analyst Mode: Offline Logic Engine]\n\nBased on your active configuration and logged trade metrics:\n- **Process Compliance**: Ensure your active trade risk is strictly locked to your configured risk tier.\n- **Session Window**: Verify you are executing strictly inside the active NY/Lagos liquidity killzone.\n- **Rule Reminder**: Remember AR stands for Automatic Reaction (analytical event), never an entry trigger.\n\nTo enable full neural generative synthesis, connect your GEMINI_API_KEY in the environment secrets.`,
      });
    }

    const systemInstruction = `You are the Trading OS Personal Trading Assistant for a high-performance discretionary trader.
You have complete analytical comprehension of:
- Trading HQ: Strategic rules, execution models (SLP, Wyckoff + ICT, Failure Swing, Range Delivery Model), session windows (NY 01:00-05:00 & 07:00-11:00, Lagos 06:00-10:00 & 12:00-16:00), 5-part Process Score (Session, Grade, Risk, Management, Structure).
- Wyckoff Semantics: AR = Automatic Reaction (an analytical/event concept, NEVER an entry trigger, POI, or sequence rule). Never say "CHoCH -> AR -> POI".
- Philosophy: "context -> narrative -> evidence -> potential setup -> trader decision -> record -> review". You are an analyst and assistant, NEVER an autonomous trader or bot.
- Distinguish GOOD PROCESS + LOSS from BAD PROCESS + WIN.

Trader Context provided:
${context ? JSON.stringify(context, null, 2) : "No context provided"}

Provide clear, objective, professional, and dense feedback. Tone: Calm, disciplined, technical, like an elite prop firm risk officer and research partner.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt,
      config: {
        systemInstruction,
        temperature: 0.3,
      },
    });

    return res.json({ text: response.text || "No response generated." });
  } catch (error: any) {
    console.error("AI Chat Error:", error);
    return res.status(500).json({
      error: "AI analysis encountered an error.",
      details: error?.message || String(error),
    });
  }
}
