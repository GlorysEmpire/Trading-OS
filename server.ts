import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import {
  checkRateLimit,
  getGenAIClient,
  logServerError,
  requireAuthenticatedUser,
  validateAnalyzeInput,
  validateChatInput,
} from "./api/_lib/ai";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "1mb" }));

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// AI Assistant endpoint
app.post("/api/ai/chat", async (req, res) => {
  const auth = await requireAuthenticatedUser(req.headers as Record<string, string | string[] | undefined>);
  if (auth.ok === false) return res.status(auth.status).json({ error: auth.message });
  if (!checkRateLimit(auth.userId)) {
    return res.status(429).json({ error: "Too many AI requests. Please wait a moment and try again." });
  }
  const validated = validateChatInput(req.body);
  if ("error" in validated) return res.status(400).json({ error: validated.error });
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
});

// AI Trade Critique endpoint
app.post("/api/ai/analyze-trade", async (req, res) => {
  const auth = await requireAuthenticatedUser(req.headers as Record<string, string | string[] | undefined>);
  if (auth.ok === false) return res.status(auth.status).json({ error: auth.message });
  if (!checkRateLimit(auth.userId)) {
    return res.status(429).json({ error: "Too many AI requests. Please wait a moment and try again." });
  }
  const validated = validateAnalyzeInput(req.body);
  if ("error" in validated) return res.status(400).json({ error: validated.error });
  const { trade, rules } = validated as { trade: Record<string, any>; rules: unknown };

  try {
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
2. Execution Model & Grade verification using only the active rules supplied with this request.
3. Risk & Management using only the active rules supplied with this request. State when evidence is missing.
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
