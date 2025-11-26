// backend/ecoInsights.js
import Groq from "groq-sdk";

const SYSTEM_PROMPT = `
You are an environmental analyst. ONLY explain and advise based on provided product fields.
NEVER invent or change numeric metrics. Output STRICT JSON:

{
  "sentiment": {"label":"positive|neutral|negative","score":0-1},
  "themes": ["short bullets or compact phrases"],
  "highlights": ["positive aspects"],
  "risks": ["risks or concerns"],
  "actions": ["actionable next steps"],
  "reasoning": "2-4 concise sentences.",
  "confidence": 0-1,
  "recommendation": {
    "verdict": "Recommended | Consider with caveats | Not recommended",
    "explanation": "1-2 sentences justifying the verdict with explicit reference to eco_score/factors",
    "confidence": 0-1,
    "tags": ["short labels e.g. 'Lower emissions','Improve energy use'"]
  }
}

Guidance:
- If eco_score >= 75 → likely "Recommended".
- If 60–74 → "Consider with caveats" and name 1–2 improvement areas.
- If < 60 → "Not recommended" with 1–2 reasons.
Always refer to concrete fields (eco_score, carbon_footprint, water_consumption, energy_usage, recyclability).
Return STRICT JSON only (no prose, no code fences).
`;

// Extract first JSON object from a string
function extractJsonObject(text) {
  if (!text) throw new Error("Empty LLM response");
  const cleaned = text.replace(/```json|```/gi, "").trim();
  try { return JSON.parse(cleaned); } catch (_) {}
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("No JSON object found in LLM response");
  }
  return JSON.parse(cleaned.slice(start, end + 1));
}

export async function getEcoInsights(product, notes = "") {
  const card = {
    name: product?.ProductName || product?.name || "Unknown",
    category: product?.Category ?? null,
    eco_score: product?.eco_score ?? null,
    carbon_footprint: product?.carbon_footprint ?? null,
    water_consumption: product?.water_consumption ?? null,
    energy_usage: product?.energy_usage ?? null,
    waste_pollution: product?.waste_pollution ?? null,
    chemical_usage: product?.chemical_usage ?? null,
    recyclability: product?.recyclability ?? null,
    sustainability_level: product?.sustainability_level ?? null,
    environmental_impact: product?.environmental_impact ?? null,
    notes: notes || ""
  };

  console.log("Calling Groq for:", card.name, "| eco_score:", card.eco_score);

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY is missing");

  let content = "";
  try {
    const groq = new Groq({ apiKey });
    const resp = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      temperature: 0.2,
      max_tokens: 400,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Product:\n${JSON.stringify(card, null, 2)}\n\nReturn STRICT JSON only.` }
      ]
    });
    content = resp?.choices?.[0]?.message?.content || "";
    if (!content) throw new Error("Empty content from Groq");
  } catch (apiErr) {
    // Bubble up detailed info so the router can return it
    const err = new Error(apiErr?.message || "Groq API error");
    err.code = apiErr?.code || null;
    err.status = apiErr?.status || null;
    throw err;
  }

  try {
    return extractJsonObject(content);
  } catch (parseErr) {
    console.error("LLM JSON parse error. Raw content:\n", content);
    throw new Error("LLM returned non-JSON");
  }
}