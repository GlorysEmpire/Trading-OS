import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import { createServer as createViteServer } from "vite";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "10mb" }));

// Lazy GoogleGenAI client initialization
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

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// AI Assistant endpoint
app.post("/api/ai/chat", async (req, res) => {
  try {
    const { prompt, context } = req.body;
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
});

// AI Trade Critique endpoint
app.post("/api/ai/analyze-trade", async (req, res) => {
  try {
    const { trade, rules } = req.body;
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
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Trading OS server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
