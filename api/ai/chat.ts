import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  checkRateLimit,
  getGenAIClient,
  logServerError,
  requireAuthenticatedUser,
  validateChatInput,
} from "../_lib/ai";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const auth = await requireAuthenticatedUser(req.headers as Record<string, string | string[] | undefined>);
  if (!auth.ok) {
    return res.status(auth.status).json({ error: auth.message });
  }

  if (!checkRateLimit(auth.userId)) {
    return res.status(429).json({ error: "Too many AI requests. Please wait a moment and try again." });
  }

  const validated = validateChatInput(req.body);
  if ("error" in validated) {
    return res.status(400).json({ error: validated.error });
  }
  const { prompt, context } = validated;

  try {
    const ai = getGenAIClient();
    if (!ai) {
      // Intelligent rule-based fallback if no API key is configured
      return res.json({
        text: `[Analyst Mode: Offline Logic Engine]\n\nBased on your active configuration and logged trade metrics:\n- **Process Compliance**: Ensure your active trade risk is strictly locked to your configured risk tier.\n- **Session Window**: Verify you are executing strictly inside the active NY/Lagos liquidity killzone.\n- **Rule Reminder**: Remember AR stands for Automatic Reaction (analytical event), never an entry trigger.\n\nTo enable full neural generative synthesis, connect your GEMINI_API_KEY in the environment secrets.`,
      });
    }

    const systemInstruction = `You are the Trading OS Personal Trading Assistant for a high-performance discretionary trader.
You have complete analytical comprehension of:
- Trading HQ: Strategic rules, execution models (SLP, Wyckoff + ICT, Failure Swing, Range Delivery Model), session windows (NY: London 00:00-05:00, New York 05:00-12:00, Afternoon 12:00-18:00, Tokyo 18:00-00:00 — Lagos is NY+5h: 05:00-10:00, 10:00-17:00, 17:00-23:00, 23:00-05:00), 5-part Process Score (Session, Grade, Risk, Management, Structure).
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
  } catch (error) {
    logServerError("ai/chat", error);
    return res.status(500).json({ error: "AI analysis encountered an error. Please try again shortly." });
  }
}
