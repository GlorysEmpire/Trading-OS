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
  if (auth.ok === false) {
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
        text: `AI analysis is unavailable because no model provider is configured. Review the current Trading HQ and journal data in the app. AR remains an analytical Wyckoff event, never an entry trigger.`,
      });
    }

    const systemInstruction = `You are the Trading OS Personal Trading Assistant for a high-performance discretionary trader.
You have complete analytical comprehension of:
- Trading HQ: use only the active configuration included in Trader Context. If a rule or session is absent, say it is unknown.
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
