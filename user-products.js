// user-products.js
document.addEventListener("DOMContentLoaded", async () => {
  // --- Elements ---
  const displayUserNameSpan = document.getElementById("displayUserName");
  const topBarUserNameSpan = document.getElementById("topBarUserName");

  const productSearchForm = document.getElementById("productSearchForm");
  const productQueryInput = document.getElementById("productQuery");
  const productListEl = document.getElementById("productList");
  const noProductsMessageEl = document.getElementById("noProductsMessage");
  const newProductBtn = document.querySelector(".new");
  const signOutBtn = document.querySelector(".signout");

  const homepageSearchInput =
    document.querySelector('input[placeholder="Ask EcoBrand"]') ||
    document.querySelector(".product-input") ||
    document.querySelector('input[type="text"]');
  const homepageSearchButton =
    document.querySelector(".submit-button") ||
    document.querySelector('button[type="submit"]') ||
    document.querySelector(".search-btn");

  const breadcrumbProductElement = document.getElementById("breadcrumb-product");
  const productNameElement = document.getElementById("product-name");
  const productCategoryElement = document.getElementById("product-category");
  const analysisDateElement = document.getElementById("analysis-date");
  const productImageElement = document.getElementById("product-main-image");

  const overallScoreEl = document.getElementById("overall-score");
  const sustainabilityLevelEl = document.getElementById("sustainability-level");
  const concernLevelEl = document.getElementById("concern-level");
  const ecoscoreValueEl = document.getElementById("ecoscore-value");

  const insightsListEl = document.getElementById("insights-list");
  const freeTextInput = document.getElementById("freeTextInput");
  const analyzeTextBtn = document.getElementById("analyzeTextBtn");

  // Ingredients
  const productIngredientsList = document.getElementById("product-ingredients");
  const noIngredientsEl = document.getElementById("no-ingredients");

  // NEW: Recommendation elements
  const recCard = document.getElementById("recommendation-card");
  const recVerdictEl = document.getElementById("rec-verdict");
  const recExplainEl = document.getElementById("rec-explain");
  const recConfidenceEl = document.getElementById("rec-confidence");
  const recTagsEl = document.getElementById("rec-tags");

  // NEW: Alternative products container
  const alternativeContainer = document.getElementById("alternative-products-container");

  // --- Auth (best-effort) ---
  (async () => {
    try {
      const resp = await fetch("/api/user-data");
      if (resp.ok) {
        const data = await resp.json();
        if (data.username) {
          if (displayUserNameSpan)
            displayUserNameSpan.textContent = data.username + "!";
          if (topBarUserNameSpan) topBarUserNameSpan.textContent = data.username;
        }
      }
    } catch { }
  })();

  // --- History (UPDATED to store objects {name, id}) ---
  function renderProductList() {
    if (!productListEl || !noProductsMessageEl) return;
    const products = JSON.parse(localStorage.getItem("Products")) || [];
    productListEl.innerHTML = "";
    if (products.length === 0) {
      noProductsMessageEl.style.display = "block";
      return;
    }
    noProductsMessageEl.style.display = "none";

    products.forEach((product) => {
      const li = document.createElement("li");
      li.textContent = product.name;
      li.classList.add("history-item");
      li.addEventListener("click", () => loadProductDetails(product.name));
      productListEl.appendChild(li);
    });
  }

  function addProductToHistory(name, id = null) {
    if (!name || !name.trim()) return;
    let list = JSON.parse(localStorage.getItem("Products")) || [];
    const trimmed = name.trim();
    const newItem = { name: trimmed, id };

    list = list.filter((p) => p.name !== trimmed);
    list.unshift(newItem);
    list = list.slice(0, 12);
    localStorage.setItem("Products", JSON.stringify(list));
    renderProductList();
  }

  function loadProductDetails(name) {
    if (!name) return;
    window.location.href = `user-products.html?query=${encodeURIComponent(
      name
    )}`;
  }

  function handleSearch(query) {
    if (!query || !query.trim()) {
      showPopup("The product is not available nor analyze");
      return;
    }
    const q = query.trim();
    // Navigate to search results page for multi-product searches
    window.location.href = `search-results.html?query=${encodeURIComponent(q)}`;
  }

  if (homepageSearchButton && homepageSearchInput) {
    homepageSearchButton.addEventListener("click", (e) => {
      e.preventDefault();
      handleSearch(homepageSearchInput.value);
    });
    homepageSearchInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleSearch(homepageSearchInput.value);
      }
    });
  }
  if (productSearchForm && productQueryInput) {
    productSearchForm.addEventListener("submit", (e) => {
      e.preventDefault();
      handleSearch(productQueryInput.value);
    });
  }
  if (newProductBtn)
    newProductBtn.addEventListener(
      "click",
      () => (window.location.href = "homepage.html")
    );
  if (signOutBtn) signOutBtn.addEventListener("click", () => alert("Signed out"));

  // --- NLP Core (lightweight) ---
  const STOPWORDS = new Set(
    (
      "a,an,and,are,as,at,be,by,for,from,has,have,he,in,is,its,it,of,on,that,the,to,was,were,will,with,not,about,into,over,after,than,then,this,those,these,very,more,most,less,least,so,if,or,also,can,just,too,but,do,did,does,done,had,should,would,could,may,might,our,us,we,you,your,yours,they,them,their,theirs,i,me,my,mine"
    ).split(",")
  );
  const SENTI_LEX = {
    love: 2,
    great: 2,
    positive: 2,
    gentle: 1,
    safe: 1,
    safer: 1,
    fast: 1,
    sturdy: 1,
    recycled: 1,
    "eco-friendly": 2,
    neutral: 0,
    okay: 0,
    ok: 0,
    wasteful: -2,
    flimsy: -1,
    "too much": -1,
    bad: -2,
    poor: -2,
    issue: -1,
  };

  function tokenize(text) {
    return (text || "")
      .toLowerCase()
      .replace(/[\u2019']/g, "")
      .replace(/[^a-z0-9\s\-]/g, " ")
      .split(/\s+/)
      .filter(Boolean);
  }

  function removeStopwords(tokens) {
    return tokens.filter((t) => !STOPWORDS.has(t) && t.length > 2);
  }

  function scoreSentiment(tokens) {
    let score = 0;
    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i];
      const bi = i < tokens.length - 1 ? `${t} ${tokens[i + 1]}` : "";
      if (SENTI_LEX[bi] !== undefined) score += SENTI_LEX[bi];
      if (SENTI_LEX[t] !== undefined) score += SENTI_LEX[t];
    }
    const label = score > 1 ? "positive" : score < -1 ? "negative" : "neutral";
    return { score, label };
  }

  function topKeywords(docs, k = 6) {
    const df = new Map();
    const tfs = [];
    docs.forEach((doc) => {
      const tokens = removeStopwords(tokenize(doc));
      const tf = new Map();
      tokens.forEach((t) => tf.set(t, (tf.get(t) || 0) + 1));
      tfs.push(tf);
      [...new Set(tokens)].forEach((t) => df.set(t, (df.get(t) || 0) + 1));
    });
    const N = docs.length || 1;
    const scores = new Map();
    tfs.forEach((tf) => {
      tf.forEach((f, t) => {
        const idf = Math.log(1 + N / (1 + (df.get(t) || 1)));
        scores.set(t, (scores.get(t) || 0) + f * idf);
      });
    });
    return [...scores.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, k)
      .map(([t]) => t);
  }

  function summarize(text, maxSentences = 2) {
    const sentences = (text || "")
      .split(/(?<=[.!?])\s+/)
      .filter((s) => s.trim().length > 0);
    if (sentences.length <= maxSentences) return sentences;
    const allTokens = removeStopwords(tokenize(text));
    const freq = new Map();
    allTokens.forEach((t) => freq.set(t, (freq.get(t) || 0) + 1));
    const scores = sentences.map((s) => {
      const toks = removeStopwords(tokenize(s));
      const score = toks.reduce((acc, t) => acc + (freq.get(t) || 0), 0);
      return { s, score };
    });
    return scores
      .sort((a, b) => b.score - a.score)
      .slice(0, maxSentences)
      .map((x) => x.s);
  }

  // --- Popup helper ---
  function showPopup(message) {
    const overlay = document.createElement("div");
    overlay.style.cssText =
      "position:fixed;inset:0;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;z-index:9999;";
    const modal = document.createElement("div");
    modal.style.cssText =
      "background:#1a1d23;color:#fff;border:1px solid rgba(255,255,255,.15);border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,.35);padding:16px 18px;max-width:420px;width:92%;text-align:center;";
    modal.innerHTML = `
        <div style="font-weight:700;margin-bottom:6px;">Notice</div>
        <div style="margin-bottom:12px;">${message}</div>
        <button style="padding:8px 12px;border-radius:8px;border:1px solid rgba(0,0,0,.2);background:#3be585;color:#002314;font-weight:700;cursor:pointer;">OK</button>
      `;
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    modal
      .querySelector("button")
      .addEventListener("click", () => overlay.remove());
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) overlay.remove();
    });
  }

  // --- Eco scoring (Client-side fallback) ---
  function computeEcoScore(p) {
    const w = { carbon: 0.35, water: 0.2, energy: 0.25, recycle: 0.2 };
    const carbonVal = parseFloat(p.carbon_footprint) || 0;
    const waterVal = parseFloat(p.water_consumption) || 0;
    const energyVal = parseFloat(p.energy_usage) || 0;

    const carbon = Math.max(0, 1 - carbonVal / 3.0);
    const water = Math.max(0, 1 - waterVal / 15.0);
    const energy = Math.max(0, 1 - energyVal / 12.0);

    const recycle = (p.recyclability || "").toLowerCase().includes("high")
      ? 1
      : (p.recyclability || "").toLowerCase().includes("medium")
        ? 0.6
        : (p.recyclability || "").toLowerCase().includes("compost")
          ? 0.9
          : 0.3;

    const raw =
      w.carbon * carbon + w.water * water + w.energy * energy + w.recycle * recycle;
    return Math.round(raw * 100);
  }

  function levelFromScore(s) {
    if (s >= 75) return { sustain: "High", concern: "Low" };
    if (s >= 50) return { sustain: "Medium", concern: "Moderate" };
    return { sustain: "Low", concern: "High" };
  }

  function renderEcoScore(score) {
    const s = parseInt(score) || 0;

    if (overallScoreEl) overallScoreEl.textContent = String(s);
    if (ecoscoreValueEl) ecoscoreValueEl.textContent = String(s);
    const { sustain, concern } = levelFromScore(s);
    if (sustainabilityLevelEl) sustainabilityLevelEl.textContent = sustain;
    if (concernLevelEl) concernLevelEl.textContent = concern;
    const circle = document.querySelector(".score-circle");
    const deg = Math.max(0, Math.min(360, Math.round(360 * (s / 100))));
    if (circle) {
      circle.style.setProperty("--deg", `${deg}deg`);
      const value = circle.querySelector(".stat-value");
      if (value)
        value.style.color = s >= 60 ? "#00d084" : s >= 40 ? "#ffd166" : "#ff6a6a";
    }
  }

  // --- Rendering ---
  function displayData(data) {
    const map = [
      { id: "carbon-footprint-value", key: "carbon_footprint", unit: " kg CO₂e" },
      { id: "water-consumption-value", key: "water_consumption", unit: " liters" },
      { id: "energy-usage-value", key: "energy_usage", unit: " kWh" },
      { id: "waste-pollution-value", key: "waste_pollution", unit: "" },
      { id: "chemical-usage-value", key: "chemical_usage", unit: "" },
      { id: "recyclability-value", key: "recyclability", unit: "" },
    ];
    map.forEach((m) => {
      const el = document.getElementById(m.id);
      if (!el) return;
      let v =
        data?.[m.key] ||
        data?.factors?.[m.key.replace(/_(\w)/g, (match, p1) => p1.toUpperCase())];

      if (
        m.key === "carbon_footprint" ||
        m.key === "water_consumption" ||
        m.key === "energy_usage"
      ) {
        v = parseFloat(v);
        v = isNaN(v) ? null : v.toFixed(2);
      }

      el.textContent = v === null || v === undefined || v === "" ? "N/A" : `${v}${m.unit}`;
    });
  }

  function generateInsights(p) {
    const corpus = p.reviews || [];
    const allText = corpus.join(" ");
    const toks = removeStopwords(tokenize(allText));
    const senti = scoreSentiment(toks);
    const keywords = topKeywords(corpus, 6);
    const highlights = summarize(allText, 2);

    const recs = [];
    const carbon = parseFloat(p.carbon_footprint) || 0;
    const water = parseFloat(p.water_consumption) || 0;
    const energy = parseFloat(p.energy_usage) || 0;

    if (carbon > 1.5) recs.push("Prioritize lower-emission materials or suppliers");
    if (water > 10) recs.push("Adopt water-efficient processes or closed-loop rinsing");
    if (energy > 5) recs.push("Increase renewable energy share in manufacturing");
    if ((p.recyclability || "").toLowerCase().includes("low"))
      recs.push("Redesign packaging for recyclability or mono-materials");
    if (recs.length === 0)
      recs.push("Maintain current practices and publish a short impact report");

    return [
      {
        title: "Customer sentiment",
        body: `Overall sentiment is ${senti.label} (${senti.score}).`,
        badge: senti.label,
      },
      { title: "Emerging keywords", body: `Top themes: ${keywords.join(", ")}.`, chips: keywords },
      { title: "Highlights", body: highlights.join(" ") },
      { title: "Action ideas", body: recs.join("; ") + "." },
    ];
  }

  function renderInsights(items) {
    if (!insightsListEl) return;
    insightsListEl.innerHTML = "";

    const ICONS = {
      "Customer sentiment": "😊",
      "Free-text sentiment": "🗣️",
      "Emerging keywords": "🔎",
      Keywords: "🔎",
      Highlights: "✨",
      Risks: "⚠️",
      "Action ideas": "🧭",
      Reasoning: "🧠",
      AI: "🤖",
    };

    items.forEach((it) => {
      const li = document.createElement("li");
      li.className = `insight-card ${it.badge ? it.badge : ""}`;

      // Build body: turn long semicolon-separated strings into bullets
      let bodyHtml = "";
      if (it.body && it.body.includes(";")) {
        const parts = it.body
          .split(";")
          .map((s) => s.trim())
          .filter(Boolean);
        bodyHtml = `<ul class="insight-bullets">${parts
          .map((p) => `<li>${p.replace(/\.*$/, ".")}</li>`)
          .join("")}</ul>`;
      } else {
        bodyHtml = `<p class="insight-body">${it.body || ""}</p>`;
      }

      // Chips (keywords/themes)
      const chips =
        it.chips && it.chips.length
          ? `<div class="chips">${it.chips
            .map((c) => `<span class="chip">${c}</span>`)
            .join("")}</div>`
          : "";

      // Badge (sentiment label)
      const badge = it.badge ? `<span class="badge ${it.badge}">${it.badge}</span>` : "";

      const icon = ICONS[it.title] || "💡";
      li.innerHTML = `
        <div class="insight-head">
          <div class="insight-icon">${icon}</div>
          <div class="insight-title">${it.title}</div>
          ${badge}
        </div>
        ${bodyHtml}
        <div class="insight-meta">${chips}</div>
      `;

      insightsListEl.appendChild(li);
    });

    if (items.length === 0) {
      const li = document.createElement("li");
      li.className = "insight-card neutral";
      li.innerHTML = `
        <div class="insight-head">
          <div class="insight-icon">🤖</div>
          <div class="insight-title">AI</div>
          <span class="badge neutral">neutral</span>
        </div>
        <p class="insight-body muted">No insights available</p>
      `;
      insightsListEl.appendChild(li);
    }
  }

  // Ingredients chips
  function renderIngredients(ingredients) {
    if (!productIngredientsList || !noIngredientsEl) return;
    productIngredientsList.innerHTML = "";

    const list = Array.isArray(ingredients)
      ? ingredients
      : typeof ingredients === "string"
        ? ingredients
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
        : [];

    if (!list.length) {
      noIngredientsEl.style.display = "block";
      productIngredientsList.style.display = "none";
      return;
    }

    noIngredientsEl.style.display = "none";
    productIngredientsList.style.display = "flex";

    list.forEach((item) => {
      const li = document.createElement("li");
      li.className = "chip";
      li.textContent = item;
      productIngredientsList.appendChild(li);
    });
  }

  // === Recommendation helpers (GLOBAL within this module) ===
  function localRecommendation(product) {
    let s;
    if (product._eco != null) s = parseInt(product._eco);
    else if (product.eco_score != null) s = parseInt(product.eco_score);
    else s = computeEcoScore(product);

    const carbon = parseFloat(product.carbon_footprint) || 0;
    const water = parseFloat(product.water_consumption) || 0;
    const energy = parseFloat(product.energy_usage) || 0;
    const recycl = (product.recyclability || "").toLowerCase();

    let verdict = "Consider with caveats";
    let klass = "caveat";
    if (s >= 75) {
      verdict = "Recommended";
      klass = "recommended";
    } else if (s < 60) {
      verdict = "Not recommended";
      klass = "notrec";
    }

    const reasons = [];
    if (carbon <= 1.5) reasons.push("low carbon footprint");
    if (water <= 10) reasons.push("low water consumption");
    if (energy <= 5) reasons.push("low energy use");
    if (recycl.includes("high") || recycl.includes("compost"))
      reasons.push("good end-of-life profile");

    if (s < 60) reasons.push("impact metrics need improvement");
    if (s >= 60 && s < 75)
      reasons.push("acceptable impact with improvement areas");

    const explain = `Eco-score ${s}. ${reasons.length ? "Notable points: " + reasons.join(", ") + "." : ""
      }`;

    const tags = [];
    if (carbon > 1.5) tags.push("Lower emissions");
    if (water > 10) tags.push("Reduce water use");
    if (energy > 5) tags.push("Improve energy efficiency");
    if (!recycl || recycl.includes("low")) tags.push("Redesign for recyclability");

    return { verdict, className: klass, explanation: explain, confidence: null, tags };
  }

  function renderRecommendation(rec) {
    if (!recCard) return;
    const { verdict, className, explanation, confidence, tags } = rec || {};

    recVerdictEl.className = `rec-verdict-pill ${className || "neutral"}`;
    recVerdictEl.textContent = verdict || "Analysis unavailable";
    recExplainEl.textContent = explanation || "No explanation provided.";

    // ✅ Only show confidence when it's a real number
    if (typeof confidence === "number" && !Number.isNaN(confidence)) {
      recConfidenceEl.style.display = "inline";
      recConfidenceEl.textContent = `Confidence: ${Math.round(confidence * 100)}%`;
    } else {
      recConfidenceEl.style.display = "none";
      recConfidenceEl.textContent = "";
    }

    recTagsEl.innerHTML =
      tags && tags.length
        ? tags.map(t => `<span class="chip">${t}</span>`).join("")
        : "";
  }

  // === Alternative products rendering ===
  /**
   * Render a list of alternative products into the alternative products container.
   * Each product card links back to its own summary page when clicked.
   * @param {Array<Object>} list
   */
  function renderAltProducts(list) {
    if (!alternativeContainer) return;
    alternativeContainer.innerHTML = "";
    if (!Array.isArray(list) || list.length === 0) {
      const p = document.createElement("p");
      p.className = "muted";
      p.textContent = "No alternative products found.";
      alternativeContainer.appendChild(p);
      return;
    }
    list.forEach(prod => {
      const card = document.createElement("div");
      card.className = "alt-product-card";
      card.addEventListener("click", () => {
        // Navigate to the selected product using its name
        if (prod.ProductName) {
          window.location.href = `user-products.html?query=${encodeURIComponent(prod.ProductName)}`;
        }
      });
      const imgHtml = prod.ProductImageURL
        ? `<img src="${prod.ProductImageURL}" alt="${prod.ProductName}"/>`
        : "";
      card.innerHTML = `
        <div class="alt-product-image">${imgHtml}</div>
        <div class="alt-product-name" title="${prod.ProductName}">${prod.ProductName || "Unnamed"}</div>
        <div class="alt-product-meta">
          <span class="eco-score">${prod.eco_score != null ? prod.eco_score : "—"}</span>
          <span class="sustain-level">${prod.sustainability_level || ""}</span>
        </div>
      `;
      alternativeContainer.appendChild(card);
    });
  }

  /**
   * Fetch alternative products from the backend API using either the product's
   * ID or name, then render the results. If the API call fails or returns
   * nothing, the list will be cleared and a placeholder will be shown.
   *
   * @param {object} baseProduct The currently displayed product.
   */
  async function loadAlternatives(baseProduct) {
    if (!alternativeContainer) return;
    if (!baseProduct) {
      renderAltProducts([]);
      return;
    }
    // Show loading placeholder
    alternativeContainer.innerHTML = "<p class=\"muted\">Loading alternatives…</p>";
    try {
      const id = baseProduct._id || baseProduct.id;
      const name = baseProduct.ProductName;
      const qs = id
        ? `productId=${encodeURIComponent(id)}`
        : `productName=${encodeURIComponent(name)}`;
      const url = `/api/alternatives?${qs}&count=4`;
      const resp = await fetch(url);
      const data = await resp.json();
      if (resp.ok && data?.success && Array.isArray(data.alternatives)) {
        renderAltProducts(data.alternatives);
      } else {
        renderAltProducts([]);
      }
    } catch (e) {
      console.error("Failed to load alternatives", e);
      renderAltProducts([]);
    }
  }


  function normalizeRecommendationFromLLM(r) {
    const raw = (r?.verdict || "").toLowerCase();
    let cls = "neutral";
    if (raw.includes("not")) cls = "notrec";
    else if (raw.includes("caveat") || raw.includes("consider")) cls = "caveat";
    else if (raw.includes("recommend")) cls = "recommended";
    return {
      verdict: r?.verdict || "Recommendation",
      className: cls,
      explanation: r?.explanation || r?.reason || "—",
      confidence: typeof r?.confidence === "number" ? r.confidence : null,
      tags: Array.isArray(r?.tags) ? r.tags : [],
    };
  }

  function insightsToItems(ins) {
    return [
      {
        title: "Customer sentiment",
        body: `Overall sentiment is ${ins.sentiment.label} (${Math.round(
          ins.sentiment.score * 100
        )}%).`,
        badge: ins.sentiment.label,
      },
      { title: "Emerging keywords", body: `Top themes: ${ins.themes.join(", ")}`, chips: ins.themes },
      { title: "Highlights", body: ins.highlights.join(" ") },
      ...(ins.risks.length ? [{ title: "Risks", body: ins.risks.join("; ") + "." }] : []),
      { title: "Action ideas", body: ins.actions.join("; ") + "." },
      { title: "Reasoning", body: ins.reasoning },
    ];
  }

  // --- Data loading with fallback ---
  async function fetchAPIProduct(query) {
    try {
      if (query) {
        const r = await fetch(
          `/api/search-products?query=${encodeURIComponent(query)}`
        );
        if (!r.ok) return null;
        const data = await r.json();
        if (data?.success && Array.isArray(data.products) && data.products.length) {
          return data.products[0];
        }
        return null;
      } else {
        const r = await fetch("/api/environmental_impact");
        if (!r.ok) return null;
        const data = await r.json();
        if (data?.success && Array.isArray(data.products) && data.products.length) {
          return data.products[0];
        }
        return null;
      }
    } catch (e) {
      console.error("Error fetching product:", e);
      return null;
    }
  }

  // === MAIN RENDER ===
  async function displayProduct(p) {
    window.CURRENT_PRODUCT = p;

    if (!productNameElement) return;
    if (!p) {
      productNameElement.textContent = "Product not found";
      if (productCategoryElement) productCategoryElement.textContent = "No data available";
      if (analysisDateElement) analysisDateElement.textContent = "";
      if (breadcrumbProductElement) breadcrumbProductElement.textContent = "Error";
      if (productImageElement) {
        productImageElement.src = "";
        productImageElement.alt = "No image";
      }
      renderIngredients([]);
      renderRecommendation({
        verdict: "Analysis unavailable",
        className: "neutral",
        explanation: "No product selected.",
      });

      // Clear alternatives when no product is found
      loadAlternatives(null);
      return;
    }

    productNameElement.textContent = p.ProductName;
    if (productCategoryElement) productCategoryElement.textContent = p.Category;
    if (analysisDateElement) {
      const dateSource = p.AnalysisDate || p.analysis_date;
      const d = new Date(dateSource);
      analysisDateElement.textContent = isNaN(d.getTime())
        ? dateSource || "N/A"
        : d.toLocaleDateString();
    }
    if (breadcrumbProductElement) breadcrumbProductElement.textContent = p.ProductName;
    if (productImageElement) {
      productImageElement.src = p.ProductImageURL || "";
      productImageElement.alt = p.ProductName;
    }

    renderIngredients(p.ingredients || p.Ingredients || []);
    displayData(p);

    const rawScore =
      p._eco != null ? p._eco : p.eco_score != null ? p.eco_score : null;
    const score = rawScore != null ? parseInt(rawScore) : computeEcoScore(p);
    renderEcoScore(score);

    // 1) Show fast local verdict
    renderRecommendation(localRecommendation(p));

    // 2) Show local insights immediately
    renderInsights(generateInsights(p));

    // 2.5) Load alternative products based on current product. We trigger this
    // early so the UI begins loading alternatives while LLM insights are
    // still processing.
    loadAlternatives(p);

    // 3) Try to upgrade with LLM (silently overwrite if available)
    try {
      const r = await fetch("/api/eco/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product: p, freeText: "" }),
      });
      if (r.ok) {
        const data = await r.json();
        if (data?.success && data.insights) {
          if (data.insights.recommendation) {
            renderRecommendation(
              normalizeRecommendationFromLLM(data.insights.recommendation)
            );
          }
          const items = insightsToItems(data.insights);
          renderInsights(items);
        }
      }
    } catch (e) {
      // keep local
    }

    // Ensure alternatives load even if LLM call throws or finishes after
    // above call. If loadAlternatives was already called earlier it will
    // simply re-render or be ignored.
    loadAlternatives(p);
  }

  async function loadProducts() {
    const urlParams = new URLSearchParams(window.location.search);
    const query = urlParams.get("query");

    const product = await fetchAPIProduct(query);

    if (!product) {
      displayProduct(null);
      showPopup("The product is not available nor analyze");
      if (analyzeTextBtn) analyzeTextBtn.disabled = true;
      if (insightsListEl) {
        insightsListEl.innerHTML = "";
        const li = document.createElement("li");
        li.className = "muted";
        li.textContent = "No insights available";
        insightsListEl.appendChild(li);
      }
      return;
    }

    if (analyzeTextBtn) analyzeTextBtn.disabled = false;
    await displayProduct(product);

    const productId = product._id || product.id || null;
    if (query) addProductToHistory(query, productId);
    else addProductToHistory(product.ProductName, productId);
  }

  // Free text analyze (LLM first, fallback to local)
  if (analyzeTextBtn && freeTextInput) {
    analyzeTextBtn.addEventListener("click", async () => {
      if (analyzeTextBtn.disabled) return;

      const freeText = freeTextInput.value.trim();
      const product = window.CURRENT_PRODUCT;
      if (!product) return;

      try {
        const r = await fetch("/api/eco/insights", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ product, freeText }),
        });
        const data = await r.json();
        if (data?.success && data.insights) {
          const items = insightsToItems(data.insights);
          renderInsights(items);
          if (data.insights.recommendation) {
            renderRecommendation(
              normalizeRecommendationFromLLM(data.insights.recommendation)
            );
          }
          return;
        }
        throw new Error("LLM returned error");
      } catch (e) {
        // Fallback local
        const text = freeText || (product.reviews || []).join(" ");
        if (!text) {
          renderInsights([{ title: "AI", body: "No text to analyze." }]);
          return;
        }
        const toks = removeStopwords(tokenize(text));
        const senti = scoreSentiment(toks);
        const kws = topKeywords([text], 6);
        const sum = summarize(text, 2);
        const items = [
          {
            title: "Free-text sentiment",
            body: `Detected sentiment is ${senti.label} (${senti.score}).`,
            badge: senti.label,
          },
          { title: "Keywords", body: `Top terms: ${kws.join(", ")}.`, chips: kws },
          { title: "Summary", body: sum.join(" ") },
        ];
        renderInsights(items);
      }
    });
  }

  // Initialize
  const urlParams = new URLSearchParams(window.location.search);
  const queryParam = urlParams.get("query");
  if (queryParam) {
    if (productQueryInput) productQueryInput.value = queryParam;
    if (homepageSearchInput) homepageSearchInput.value = queryParam;
  }

  if (productNameElement) {
    await loadProducts();
  }
  renderProductList();
});