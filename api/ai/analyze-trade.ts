import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  checkRateLimit,
  getGenAIClient,
  logServerError,
  requireAuthenticatedUser,
  validateAnalyzeInput,
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

  const validated = validateAnalyzeInput(req.body);
  if ("error" in validated) {
    return res.status(400).json({ error: validated.error });
  }
  const { trade, rules } = validated;

  try {
    const ai = getGenAIClient();

    if (!ai) {
      const t = trade as Record<string, any>;
      return res.json({
        critique: `Rule-based Process Evaluation for ${t?.asset || "Asset"} (${t?.direction || "LONG"}):
• Planned R: ${t?.plannedR || "N/A"}R | Realized: ${t?.realizedR || "0"}R
• Process Score: ${t?.processScore?.score || 0}/5
• Key Takeaway: Focus on strict adherence to the 5 process checks (Session, Grade, Risk, Management, Structure) regardless of PnL outcome.`,
      });
    }

    const systemInstruction = `You are the Trading OS Risk & Process Auditor.
Analyze the provided trade record against the trader's active Trading HQ rules.
Critique:
1. Process Integrity vs Outcome (Is it Good Process + Loss or Bad Process + Win?)
2. Execution Model & Grade verification (A+ >=5R or structural >=3R, B+ >=3R)
3. Risk & Management (Did they adhere to 1% risk, no re-entry, no adding, scratch counts as loss?)
4. Wyckoff & Structure accuracy (Reminder: AR = Automatic Reaction, never an entry trigger)
5. Actionable takeaway for tomorrow's session.
Keep it concise, rigorous, and direct.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: `Audit this trade:\n${JSON.stringify(trade, null, 2)}\n\nActive Rules:\n${JSON.stringify(rules, null, 2)}`,
      config: {
        systemInstruction,
        temperature: 0.2,
      },
    });

    return res.json({ critique: response.text });
  } catch (error) {
    logServerError("ai/analyze-trade", error);
    return res.status(500).json({ error: "Trade analysis encountered an error. Please try again shortly." });
  }
}
