import type { VercelRequest, VercelResponse } from "@vercel/node";
import { GoogleGenAI } from "@google/genai";

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
    const { trade, rules } = req.body ?? {};
    const ai = getGenAIClient();

    if (!ai) {
      return res.json({
        critique: `Rule-based Process Evaluation for ${trade?.asset || "Asset"} (${trade?.direction || "LONG"}):
• Planned R: ${trade?.plannedR || "N/A"}R | Realized: ${trade?.realizedR || "0"}R
• Process Score: ${trade?.processScore?.score || 0}/5
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
  } catch (error: any) {
    console.error("Trade analysis error:", error);
    return res.status(500).json({ error: error?.message });
  }
}
