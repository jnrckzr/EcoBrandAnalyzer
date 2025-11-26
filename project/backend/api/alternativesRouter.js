// alternativesRouter.js
import express from "express";
import { MongoClient, ObjectId } from "mongodb";

export const alternativesRouter = express.Router();

const MONGODB_URL = process.env.MONGODB_URL;
const DATABASE_NAME = process.env.DATABASE_NAME || "signup_db";

let _mongoClient = null;
let _db = null;

async function getDb() {
  if (_db) return _db;
  if (!MONGODB_URL) throw new Error("MONGODB_URL is not configured");
  _mongoClient = new MongoClient(MONGODB_URL, { ignoreUndefined: true });
  await _mongoClient.connect();
  _db = _mongoClient.db(DATABASE_NAME);
  return _db;
}

// ---------- scoring (same as frontend heuristic) ----------
function computeEcoScore(p) {
  if (p && p.eco_score != null && p.eco_score !== "") {
    const val = parseInt(p.eco_score);
    return Number.isNaN(val) ? 0 : val;
  }
  const carbonVal = parseFloat(p?.carbon_footprint) || 0;
  const waterVal  = parseFloat(p?.water_consumption) || 0;
  const energyVal = parseFloat(p?.energy_usage) || 0;

  const carbon = Math.max(0, 1 - carbonVal / 3.0);
  const water  = Math.max(0, 1 - waterVal  / 15.0);
  const energy = Math.max(0, 1 - energyVal / 12.0);

  const rec = (p?.recyclability || "").toLowerCase();
  const recycle =
    rec.includes("high")   ? 1   :
    rec.includes("medium") ? 0.6 :
    rec.includes("compost")? 0.9 : 0.3;

  return Math.round((0.35*carbon + 0.20*water + 0.25*energy + 0.20*recycle) * 100);
}

function toAltProduct(doc) {
  return {
    id: doc._id?.toString(),
    ProductName: doc.ProductName,
    Category: doc.Category,
    ProductImageURL: doc.ProductImageURL || doc.image || "",
    eco_score: computeEcoScore(doc),
    sustainability_level: doc.sustainability_level || doc.sustainability || null,
    recyclability: doc.recyclability || null,
  };
}

// ---------- name/brand token helpers ----------
const STOP = new Set(["the","and","with","for","from","by","new","series","model","edition","speaker","pack","set","size","color","case","cover","brand","motif","pattern"]);
function tokens(name) {
  return (name || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s\-]/g, " ")
    .split(/\s+/)
    .filter(t => t && t.length >= 2 && !STOP.has(t));
}

// naive brand: first word with a capital letter in original string
function guessBrand(name) {
  if (!name) return null;
  const m = name.trim().match(/^([A-Z][A-Za-z0-9\-]+)/);
  return m ? m[1].toLowerCase() : null;
}

function isRelated(baseDoc, candDoc) {
  const baseCat = (baseDoc.Category || "").toLowerCase().trim();
  const candCat = (candDoc.Category || "").toLowerCase().trim();

  // 1) exact same category
  if (baseCat && candCat && baseCat === candCat) return true;

  // 2) keyword overlap (e.g., lamp ↔ lamp, samsung ↔ samsung, a55 ↔ a55)
  const bt = new Set(tokens(baseDoc.ProductName));
  const ct = new Set(tokens(candDoc.ProductName));
  let overlap = 0;
  for (const t of ct) if (bt.has(t)) { overlap++; if (overlap >= 1) break; }
  if (overlap >= 1) return true;

  // 3) same inferred brand (first leading capital word)
  const bb = guessBrand(baseDoc.ProductName);
  const cb = guessBrand(candDoc.ProductName);
  if (bb && cb && bb === cb) return true;

  return false;
}

// ---------- main route ----------
alternativesRouter.get("/alternatives", async (req, res) => {
  try {
    const { productId, productName } = req.query;
    const count = Math.min(parseInt(req.query.count) || 4, 8);

    if (!productId && !productName) {
      return res.status(400).json({ success: false, message: "productId or productName is required" });
    }

    const db = await getDb();
    const Products = db.collection("products");

    // 1) find base product
    let base;
    if (productId) {
      try {
        base = await Products.findOne({ _id: new ObjectId(productId) });
      } catch {/* ignore invalid ObjectId */}
    }
    if (!base && productName) {
      base = await Products.findOne({ ProductName: { $regex: `^${productName}$`, $options: "i" } });
    }
    if (!base) return res.status(404).json({ success: false, message: "Base product not found" });

    const baseEco = computeEcoScore(base);

    // 2) fetch candidates (exclude base, project needed fields)
    const candidates = await Products.find(
      { _id: { $ne: base._id } },
      {
        projection: {
          ProductName: 1, Category: 1, eco_score: 1,
          sustainability_level: 1, recyclability: 1,
          carbon_footprint: 1, water_consumption: 1, energy_usage: 1,
          ProductImageURL: 1
        }
      }
    ).toArray();

    // 3) PRIORITY A: related + better eco
    const relatedBetter = [];
    const relatedAny   = [];
    const globalBest   = [];

    for (const doc of candidates) {
      const eco = computeEcoScore(doc);
      doc.__eco = eco;

      if (isRelated(base, doc)) {
        if (eco > baseEco) relatedBetter.push(doc);
        relatedAny.push(doc); // keep for fallback B
      } else {
        globalBest.push(doc); // keep for last fallback
      }
    }

    relatedBetter.sort((a,b) => b.__eco - a.__eco);
    relatedAny.sort((a,b) => b.__eco - a.__eco);
    globalBest.sort((a,b) => b.__eco - a.__eco);

    const out = [];

    // A) related AND better
    for (const d of relatedBetter) {
      out.push(toAltProduct(d));
      if (out.length >= count) break;
    }

    // B) related (even if not better) – still sorted high→low
    if (out.length < count) {
      for (const d of relatedAny) {
        // skip ones already included
        if (out.some(x => x.id === d._id.toString())) continue;
        out.push(toAltProduct(d));
        if (out.length >= count) break;
      }
    }

    // C) last resort – global best (kept from the original code path)
    if (out.length < count) {
      for (const d of globalBest) {
        if (out.some(x => x.id === d._id.toString())) continue;
        out.push(toAltProduct(d));
        if (out.length >= count) break;
      }
    }

    return res.json({ success: true, alternatives: out });
  } catch (err) {
    console.error("[alternatives] error", err);
    return res.status(500).json({ success: false, message: "Server error fetching alternatives" });
  }
});