// backend/api/chatbotRouter.js — Groq + cached product digest (MongoDB) + soft guardrails
import express from "express";
import Groq from "groq-sdk";
import { MongoClient } from "mongodb";

export const chatbotRouter = express.Router();

const GROQ_API_KEY = process.env.GROQ_API_KEY || "";
const MONGODB_URL = process.env.MONGODB_URL || "";
const DATABASE_NAME = process.env.DATABASE_NAME || "signup_db";

// ---------- config ----------
const DIGEST_MAX_CHARS = 12000;      // keep system message small enough for context window
const DIGEST_TTL_MS = 10 * 60 * 1000; // 10 minutes (rebuild after this age)
const DIGEST_SAMPLE_FALLBACK = 50;   // if DB is huge, we sample some products
const FIELDS = {
    ProductName: 1,
    Category: 1,
    eco_score: 1,
    eco_letter: 1,
    sustainability_level: 1,
    environmental_impact: 1,
    carbon_footprint: 1,
    water_consumption: 1,
    energy_usage: 1,
    chemical_usage: 1,
    recyclability: 1,
    ingredients: 1
};

// ---------- singletons ----------
const groq = new Groq({ apiKey: GROQ_API_KEY });
let _mongo, _db;

// lazy connect
async function getDb() {
    if (_db) return _db;
    if (!MONGODB_URL) throw new Error("MONGODB_URL missing");
    _mongo = new MongoClient(MONGODB_URL, {
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000
    });
    await _mongo.connect();
    _db = _mongo.db(DATABASE_NAME);
    return _db;
}

// ---------- product digest cache ----------
let productDigestCache = {
    text: "",
    builtAt: 0,
    count: 0,
};

async function buildProductDigest({ force = false } = {}) {
    // serve cached if fresh
    const now = Date.now();
    if (!force && productDigestCache.text && now - productDigestCache.builtAt < DIGEST_TTL_MS) {
        return productDigestCache;
    }

    try {
        const db = await getDb();
        const coll = db.collection("products");

        // We prefer newest products first for relevance.
        // If there are many, we sample to protect token budget.
        const total = await coll.estimatedDocumentCount();

        let cursor;
        if (total <= 500) {
            cursor = coll.find({}, { projection: FIELDS }).sort({ created_at: -1 });
        } else {
            // sample to control size (Mongo $sample is easy)
            cursor = coll.aggregate([
                { $sample: { size: Math.min(DIGEST_SAMPLE_FALLBACK, 300) } },
                { $project: FIELDS }
            ]);
        }

        const docs = await cursor.toArray();

        // turn docs into compact bullet lines until we hit max chars
        let out = [];
        let used = 0;

        for (const d of docs) {
            const ings = Array.isArray(d.ingredients) ? d.ingredients.join(", ") : (d.ingredients || "");
            const line =
                `• ${d.ProductName ?? "Unnamed"} (${d.Category ?? "Uncategorized"})` +
                ` — eco:${d.eco_score ?? "?"}${d.eco_letter ? "(" + d.eco_letter + ")" : ""}` +
                ` | sustain:${d.sustainability_level ?? "?"}` +
                ` | impact:${d.environmental_impact ?? "?"}` +
                ` | recycl:${d.recyclability ?? "?"}` +
                ` | energy:${d.energy_usage ?? "?"}` +
                ` | water:${d.water_consumption ?? "?"}` +
                ` | carbon:${d.carbon_footprint ?? "?"}` +
                (ings ? ` | ingredients:${ings}` : "");

            if (used + line.length + 1 > DIGEST_MAX_CHARS) break;
            out.push(line);
            used += line.length + 1;
        }

        const text = out.join("\n");
        productDigestCache = { text, builtAt: now, count: docs.length };
        return productDigestCache;
    } catch (err) {
        console.error("[digest] build error:", err?.message || err);
        // keep prior cache if any; otherwise empty
        if (!productDigestCache.text) productDigestCache = { text: "", builtAt: Date.now(), count: 0 };
        return productDigestCache;
    }
}

// ---------- prompts ----------
function systemPrompt(digestText = "") {
    return `You are EcoBrand, a friendly sustainability assistant for an eco product app.
Focus areas: eco-friendly products, environmental health, recyclability, life-cycle impacts, carbon footprint, water consumption, energy usage, chemical usage, waste/pollution, and sustainability levels.

Use the following database digest when a product name appears (data may be partial; avoid inventing values). If a product isn't found, answer generally and invite the user to search/add it in the app.

Database digest:
${digestText || "(no records or digest unavailable)"} 

Soft guardrails: If the user goes off-topic, give a brief helpful answer (1–2 sentences) then suggest a related eco angle. Keep answers concise (2–6 sentences).`;
}

// ---------- routes ----------
// Ping (optionally warm the digest)
chatbotRouter.get("/chatbot/ping", async (req, res) => {
    try {
        // if ?warm=1 or ?warm=true, build/refresh digest in the background
        if (String(req.query.warm || "").toLowerCase() === "1" ||
            String(req.query.warm || "").toLowerCase() === "true") {
            await buildProductDigest({ force: false });
        }

        res.json({
            ok: true,
            groqKeyPresent: Boolean(GROQ_API_KEY),
            digestReady: Boolean(productDigestCache.text),
            digestCount: productDigestCache.count,
            digestAgeSec: productDigestCache.builtAt
                ? Math.round((Date.now() - productDigestCache.builtAt) / 1000)
                : null
        });
    } catch (e) {
        console.error("/chatbot/ping error:", e?.message || e);
        res.json({
            ok: false,
            groqKeyPresent: Boolean(GROQ_API_KEY),
            digestReady: Boolean(productDigestCache.text),
            digestCount: productDigestCache.count
        });
    }
});

// Pre-build digest when the site loads (frontend calls this once on load) (accepts GET or POST to avoid 404s)
chatbotRouter.all("/chatbot/bootstrap", async (_req, res) => {
  try {
    await buildProductDigest({ force: false });
    res.json({ ok: true, digestCount: productDigestCache.count });
  } catch (e) {
    console.error("/chatbot/bootstrap error:", e?.message || e);
    res.json({ ok: false, digestCount: productDigestCache.count });
  }
});

// Manual refresh endpoint (optional: for admin)
chatbotRouter.post("/chatbot/refresh-context", async (_req, res) => {
    try {
        await buildProductDigest({ force: true });
        res.json({ ok: true, digestCount: productDigestCache.count });
    } catch (e) {
        console.error("/chatbot/refresh-context error:", e?.message || e);
        res.json({ ok: false, digestCount: productDigestCache.count });
    }
});

// Main ask
chatbotRouter.post("/chatbot/ask", async (req, res) => {
    try {
        const message = (req.body?.message || "").trim();
        if (!message) {
            return res.status(200).json({ success: true, reply: "Please type a question." });
        }

        // build or serve cached digest (never throws to the client)
        await buildProductDigest({ force: false });

        // If GROQ key is missing, graceful message (no 500s)
        if (!GROQ_API_KEY) {
            return res.status(200).json({
                success: true,
                reply:
                    "I can guide you on eco-scores, recyclability, energy/water use, and carbon footprint. (Groq key isn’t configured, so replies are limited.)"
            });
        }

        const messages = [
            { role: "system", content: systemPrompt(productDigestCache.text) },
            { role: "user", content: message }
        ];

        let reply = "";
        try {
            const completion = await groq.chat.completions.create({
                model: "llama-3.1-8b-instant",
                temperature: 0.4,
                max_tokens: 600,
                messages
            });
            reply =
                completion?.choices?.[0]?.message?.content?.trim() ||
                "I don’t have a confident answer. Try asking about a product’s eco-score, recyclability, energy or water use, or carbon footprint.";
        } catch (llmErr) {
            console.error("Groq API error:", llmErr?.response?.data || llmErr.message || llmErr);
            reply =
                "I hit a snag while generating a reply. Please try again. You can also ask about eco-scores, recyclability, sustainability levels, ingredients, energy or water use, and carbon footprint.";
        }

        return res.status(200).json({ success: true, reply });
    } catch (err) {
        console.error("chatbot/ask unexpected error:", err);
        return res.status(200).json({
            success: false,
            reply:
                "Something went wrong on my end, but you can still ask about eco-friendly products, recyclability, energy/water use, and carbon footprint."
        });
    }
});

// Put this at the very bottom of backend/api/chatbotRouter.js
chatbotRouter.get("/chatbot/which", (req, res) => {
  res.json({
    where: "backend/api/chatbotRouter.js",
    hasDigest: typeof buildProductDigest === "function",
  });
});