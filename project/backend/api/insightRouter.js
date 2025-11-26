// backend/api/insightRouter.js
import express from "express";
import Groq from "groq-sdk";
import { getEcoInsights } from "../ecoInsights.js";

export const insightsRouter = express.Router();

// Quick health check (no LLM)
insightsRouter.get("/eco/ping", (_req, res) => {
  res.json({
    ok: true,
    groqKeyPresent: !!process.env.GROQ_API_KEY,
    env: "server"
  });
});

// Minimal LLM test (rules out product payload issues)
insightsRouter.get("/eco/test", async (_req, res) => {
  try {
    if (!process.env.GROQ_API_KEY) throw new Error("GROQ_API_KEY missing");
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const r = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      temperature: 0,
      max_tokens: 40,
      messages: [
        { role: "system", content: "Return only valid JSON: {\"ok\":true}" },
        { role: "user", content: "Reply now." }
      ]
    });
    res.json({ ok: true, raw: r.choices?.[0]?.message?.content || "" });
  } catch (e) {
    res.status(500).json({
      ok: false,
      message: e?.message || String(e),
      code: e?.code || null,
      status: e?.status || null
    });
  }
});

// Main insights endpoint
insightsRouter.post("/eco/insights", async (req, res) => {
  try {
    const product = req.body?.product;
    const freeText = req.body?.freeText || "";
    console.log("[/eco/insights] keys:", Object.keys(req.body || {}));
    console.log("[/eco/insights] product:", product?.ProductName || product?.name, "| category:", product?.Category);

    if (!product) {
      return res.status(400).json({ success: false, error: "Missing product in body" });
    }

    const insights = await getEcoInsights(product, freeText);
    return res.json({ success: true, insights });
  } catch (err) {
    console.error("LLM insights error:", err);
    res.status(500).json({
      success: false,
      error: err?.message || String(err),
      code: err?.code || null,
      status: err?.status || null
    });
  }
});