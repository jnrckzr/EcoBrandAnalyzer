// Groq-backed chatbot with graceful fallbacks and soft topic steering

const Groq = require("groq-sdk");
const mongoose = require("mongoose");

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || "" });

// --- Minimal product accessor (no schema file required) ---
let ProductModel;
try {
  ProductModel = mongoose.model("products");
} catch (e) {
  const productSchema = new mongoose.Schema(
    {
      ProductName: String,
      Category: String,
      eco_score: Number,
      eco_letter: String,
      sustainability_level: String,
      environmental_impact: String,
      carbon_footprint: String,
      water_consumption: String,
      energy_usage: String,
      chemical_usage: String,
      recyclability: String,
      ingredients: [String],
    },
    { collection: "products", strict: false }
  );
  ProductModel = mongoose.model("products", productSchema);
}

async function fetchProductContext(limit = 30) {
  try {
    if (mongoose.connection.readyState === 0 && process.env.MONGO_URI) {
      await mongoose.connect(process.env.MONGO_URI, { dbName: "signup_db" });
    }
    const docs = await ProductModel
      .find({}, {
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
        ingredients: 1,
      })
      .limit(limit)
      .lean();

    return (docs || []).map(d => {
      const ings = Array.isArray(d.ingredients) ? d.ingredients.join(", ") : "";
      return `• ${d.ProductName} (${d.Category}) — eco_score: ${d.eco_score}, letter: ${d.eco_letter}, sustain: ${d.sustainability_level}; impact: ${d.environmental_impact}; recyclability: ${d.recyclability}; energy: ${d.energy_usage}; water: ${d.water_consumption}; carbon: ${d.carbon_footprint}; ingredients: ${ings}`;
    }).join("\n");
  } catch {
    return "";
  }
}

function systemPrompt(productDigest = "") {
  return `You are EcoBrand, a helpful assistant for an eco product app.
Focus areas: eco-friendly products, environmental health, recyclability, life-cycle impacts, carbon footprint, water consumption, energy usage, chemical usage, and materials/ingredients.
Soft guardrails: You can answer general questions, but *always* steer the discussion back to sustainability and the product context when relevant.
If the user asks off-topic, give a brief helpful answer (1–2 sentences) *then* suggest an eco angle to explore.

When the user mentions a product that appears in the database digest below, use those facts. If the product is not found, answer generally and invite the user to add it.

Database digest (bullet points may be partial and not exhaustive):
${productDigest || "(no records available)"}\n`;
}

exports.ask = async (req, res) => {
  try {
    const userText = (req.body && req.body.message ? String(req.body.message) : "").trim();
    if (!userText) {
      return res.status(200).json({ success: true, reply: "Please type a question." });
    }

    const productDigest = await fetchProductContext();
    const messages = [
      { role: "system", content: systemPrompt(productDigest) },
      { role: "user", content: userText },
    ];

    // If GROQ_API_KEY is missing, return a graceful local message
    if (!process.env.GROQ_API_KEY) {
      return res.status(200).json({
        success: true,
        reply:
          "I’m set up to use Groq for answers but the API key is missing. Still, here’s a suggestion: try asking about a product’s eco-score, recyclability, or ingredients so I can guide you using the app’s data.",
      });
    }

    const completion = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages,
      temperature: 0.4,
      max_tokens: 600,
    });

    const reply =
      completion?.choices?.[0]?.message?.content?.trim() ||
      "I don’t have a confident answer. Try asking about eco-scores, recyclability, ingredients, energy usage, or carbon footprint.";

    return res.status(200).json({ success: true, reply });
  } catch (err) {
    console.error("Chatbot error:", err?.response?.data || err.message || err);
    // Never 500 to the client; respond gracefully
    return res.status(200).json({
      success: false,
      reply:
        "I ran into an issue answering that. Please try again in a moment, or ask about eco-scores, recyclability, ingredients, energy usage, or carbon footprint.",
    });
  }
};