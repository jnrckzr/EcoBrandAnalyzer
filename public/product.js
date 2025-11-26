/* products.js — products management with factors + CRUD + details (REVERSED SCORE FIELDS)
 * Admin inputs Eco Letter (A-E) to a new field 'eco_letter', and the numerical score is saved to the existing 'eco_score' field for display.
 */

(function () {
  const API_BASE_URL = window.location.origin.replace(/\/$/, '');
  const LS_KEY = 'ecobrand.products.v2.cache'; // Key is kept but not actively used for saving huge arrays

  // ---------- utils ----------
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const ready = (fn) => (document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', fn) : fn());
  const uid = () => 'P' + Math.random().toString(36).slice(2, 7).toUpperCase();

  // MODIFIED: loadCache now only checks, but does not rely on it
  const loadCache = () => { try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); } catch { return []; } };
  // MODIFIED: saveCache function is now empty to disable saving to localStorage
  const saveCache = (data) => { /* Disabled to prevent QuotaExceededError */ };

  // --- API Functions (Async) ---
  async function apiFetch(endpoint, method = 'GET', data = null) {
    const url = `${API_BASE_URL}${endpoint}`;
    const options = {
      method,
      headers: { 'Content-Type': 'application/json' }
    };
    if (data) options.body = JSON.stringify(data);

    const res = await fetch(url, options);

    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      const err = new Error(`API Error: ${res.status} - ${txt || res.statusText}`);
      err.status = res.status;
      err.body = txt;
      err.url = url;
      err.method = method;
      throw err;
    }

    if (res.status === 204) return null;                // no body
    const ct = (res.headers.get('content-type') || '').toLowerCase();
    if (ct.includes('application/json')) {
      const txt = await res.text();                     // avoid JSON parse error on empty
      return txt ? JSON.parse(txt) : null;
    }
    return null;
  }


  const getRandomInt = (min, max) => {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
  };

  // ---
  //  Eco Score calculation utilities
  //
  //  These functions implement a piecewise‑linear Life‑Cycle based eco score.
  //  Numeric inputs are normalized to a 0–100 scale based on best/worst practice bands.
  //  Categorical inputs map to discrete scores.  The final eco score is the
  //  weighted average of all available sub‑scores.  A letter grade is
  //  derived from the numeric score using the client’s A–E bands.

  // Linear interpolation between s1 and s2 for v between v1 and v2.
  function _lin(v, v1, v2, s1, s2) {
    if (v1 === v2) return s2;
    const ratio = (v - v1) / (v2 - v1);
    const interp = s1 + ratio * (s2 - s1);
    return Math.max(0, Math.min(100, interp));
  }

  // Parse a numeric value from a string; returns null if invalid.
  function _toNum(x) {
    if (x == null) return null;
    const n = parseFloat(String(x).replace(/[^0-9.\-]+/g, ''));
    return isNaN(n) ? null : n;
  }

  // Piecewise subscore for carbon footprint (kg CO₂e).
  function _subCarbon(kg) {
    if (kg == null) return null;
    if (kg <= 50) return 100;
    if (kg <= 100) return _lin(kg, 50, 100, 100, 60);
    if (kg <= 200) return _lin(kg, 100, 200, 60, 30);
    // taper to 0 by 400+
    return _lin(kg, 200, 400, 30, 0);
  }

  // Piecewise subscore for water consumption (liters).
  function _subWater(l) {
    if (l == null) return null;
    if (l <= 500) return 100;
    if (l <= 1500) return _lin(l, 500, 1500, 100, 50);
    if (l <= 3000) return _lin(l, 1500, 3000, 50, 20);
    // taper to 0 by 6000+
    return _lin(l, 3000, 6000, 20, 0);
  }

  // Piecewise subscore for energy usage (kWh).
  function _subEnergy(kwh) {
    if (kwh == null) return null;
    if (kwh <= 5) return 100;
    if (kwh <= 20) return _lin(kwh, 5, 20, 100, 50);
    if (kwh <= 50) return _lin(kwh, 20, 50, 50, 10);
    // taper to 0 by 100+
    return _lin(kwh, 50, 100, 10, 0);
  }

  // Map "low/medium/high/moderate" to a subscore (0–100) for waste & chemical & impact.
  function _mapLMH(str) {
    if (!str) return null;
    const s = String(str).toLowerCase();
    if (s.includes('low')) return 100;
    if (s.includes('high')) return 0;
    if (s.includes('medium') || s.includes('moderate') || s.includes('med')) return 60;
    return null;
  }

  // Map recyclability text (high/medium/low) to a subscore.
  function _mapRecyclability(str) {
    if (!str) return null;
    const s = String(str).toLowerCase();
    if (s.includes('high')) return 100;
    if (s.includes('medium')) return 60;
    if (s.includes('low')) return 20;
    return null;
  }

  // Map sustainability level (high/medium/low) to a subscore.
  function _mapSustainability(str) {
    if (!str) return null;
    const s = String(str).toLowerCase();
    if (s.includes('high')) return 100;
    if (s.includes('medium') || s.includes('moderate')) return 60;
    if (s.includes('low')) return 20;
    return null;
  }

  // --- Replace your existing computeEcoScore with this version ---
  function computeEcoScore(data) {
    // helpers (keep these near your other eco helpers if you prefer)
    const clamp95 = (n) => {
      const x = typeof n === 'number' ? n : parseFloat(n);
      if (Number.isNaN(x)) return null;
      // floor at 0, cap at 95, and round to 2 decimals
      return Math.max(0, Math.min(95, Math.round(x * 100) / 100));
    };
    const _toNum = (x) => {
      if (x == null) return null;
      const n = parseFloat(String(x).replace(/[^0-9.\-]+/g, ''));
      return isNaN(n) ? null : n;
    };
    const _lin = (v, v1, v2, s1, s2) => {
      if (v1 === v2) return s2;
      const ratio = (v - v1) / (v2 - v1);
      const interp = s1 + ratio * (s2 - s1);
      return Math.max(0, Math.min(100, interp));
    };
    const _subCarbon = (kg) => {
      if (kg == null) return null;
      if (kg <= 50) return 100;
      if (kg <= 100) return _lin(kg, 50, 100, 100, 60);
      if (kg <= 200) return _lin(kg, 100, 200, 60, 30);
      return _lin(kg, 200, 400, 30, 0); // taper to 0 by 400+
    };
    const _subWater = (l) => {
      if (l == null) return null;
      if (l <= 500) return 100;
      if (l <= 1500) return _lin(l, 500, 1500, 100, 50);
      if (l <= 3000) return _lin(l, 1500, 3000, 50, 20);
      return _lin(l, 3000, 6000, 20, 0); // taper to 0 by 6000+
    };
    const _subEnergy = (kwh) => {
      if (kwh == null) return null;
      if (kwh <= 5) return 100;
      if (kwh <= 20) return _lin(kwh, 5, 20, 100, 50);
      if (kwh <= 50) return _lin(kwh, 20, 50, 50, 10);
      return _lin(kwh, 50, 100, 10, 0); // taper to 0 by 100+
    };
    const _mapLMH = (str) => {
      if (!str) return null;
      const s = String(str).toLowerCase();
      if (s.includes('low')) return 100;
      if (s.includes('high')) return 0;
      if (s.includes('medium') || s.includes('moderate') || s.includes('med')) return 60;
      return null;
    };
    const _mapRecyclability = (str) => {
      if (!str) return null;
      const s = String(str).toLowerCase();
      if (s.includes('high')) return 100;
      if (s.includes('medium')) return 60;
      if (s.includes('low')) return 20;
      return null;
    };
    const _mapSustainability = (str) => {
      if (!str) return null;
      const s = String(str).toLowerCase();
      if (s.includes('high')) return 100;
      if (s.includes('medium') || s.includes('moderate')) return 60;
      if (s.includes('low')) return 20;
      return null;
    };
    // add near _mapLMH/_mapRecyclability/_mapSustainability
    function _mapChemical(str) {
      if (!str) return null;
      const s = String(str).toLowerCase();
      if (s.includes('minimal')) return 100;
      if (s.includes('moderate')) return 60;
      if (s.includes('severe') || s.includes('high')) return 0;
      return null;
    }

    // subscores
    const s_carbon = _subCarbon(_toNum(data.carbonFootprint));
    const s_water = _subWater(_toNum(data.waterConsumption));
    const s_energy = _subEnergy(_toNum(data.energyUsage));
    const s_waste = _mapLMH(data.wastePollution);
    const s_chem = _mapChemical(data.chemicalUsage);
    const s_recycl = _mapRecyclability(data.recyclability);
    const s_env = _mapLMH(data.environmentalImpact);
    const s_sus = _mapSustainability(data.sustainabilityLevel);

    // weights (drop if missing)
    let w_carbon = 30, w_energy = 20, w_water = 15, w_recycl = 10, w_waste = 10, w_chem = 10, w_env = 3, w_sus = 2;
    if (s_carbon == null) w_carbon = 0;
    if (s_energy == null) w_energy = 0;
    if (s_water == null) w_water = 0;
    if (s_recycl == null) w_recycl = 0;
    if (s_waste == null) w_waste = 0;
    if (s_chem == null) w_chem = 0;
    if (s_env == null) w_env = 0;
    if (s_sus == null) w_sus = 0;

    const totalW = w_carbon + w_energy + w_water + w_recycl + w_waste + w_chem + w_env + w_sus;
    if (!totalW) return { score: null, letter: null };

    const weighted =
      (s_carbon || 0) * w_carbon +
      (s_energy || 0) * w_energy +
      (s_water || 0) * w_water +
      (s_recycl || 0) * w_recycl +
      (s_waste || 0) * w_waste +
      (s_chem || 0) * w_chem +
      (s_env || 0) * w_env +
      (s_sus || 0) * w_sus;

    // raw score (0–100), then cap to 95.00
    const raw = Math.round((weighted / totalW) * 100) / 100;
    const score = clamp95(raw);

    // letter bands (your spec)
    let letter;
    if (score >= 90 && score <= 95) letter = 'A'; // 90–95 (cap ensures it never exceeds 95)
    else if (score >= 75) letter = 'B';    // 75–89
    else if (score >= 55) letter = 'C';    // 55–74
    else if (score >= 30) letter = 'D';    // 30–54
    else letter = 'E';    // 0–29

    return { score, letter };
  }

  // ---------- modal builders (standard) ----------
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.6);z-index:2000;padding:20px;';
  document.body.appendChild(overlay);

  const modalShell = (title, bodyHTML, footerHTML) => `
    <div class="ap-modal" style="
      width:100%; max-width:760px; background:#262626; color:#fff; border:1px solid #3a3a3a; 
      border-radius:10px; box-sizing:border-box; overflow:hidden;
    ">
      <div class="ap-modal__header" style="display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid #3a3a3a;">
        <h3 style="margin:0;font-size:18px;max-width:85%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${title}</h3>
        <button type="button" data-close style="background:#3a3a3a;color:#9ca3af;border:1px solid #4a4a4a;border-radius:6px;padding:6px 10px;cursor:pointer;">✕</button>
      </div>
      <div class="ap-modal__body" style="padding:16px 18px;width: 100%; height:400px; box-sizing:border-box; overflow-y: auto;">
        ${bodyHTML}
      </div>
      ${footerHTML ? `<div class="ap-modal__footer" style="display:flex;gap:10px;justify-content:flex-end;padding:12px 18px;border-top:1px solid #3a3a3a;box-sizing:border-box;">${footerHTML}</div>` : ''}
    </div>
  `;

  const openOverlay = (html) => {
    overlay.innerHTML = html;
    overlay.style.display = 'flex';
    overlay.addEventListener('click', overlayClickClose);
    $$('[data-close]', overlay).forEach(b => b.addEventListener('click', closeOverlay));
  };
  const closeOverlay = () => {
    overlay.removeEventListener('click', overlayClickClose);
    overlay.style.display = 'none';
    overlay.innerHTML = '';
  };
  const overlayClickClose = (e) => { if (e.target === overlay) closeOverlay(); };

  // ---------- Add/Edit Form Modal ----------
  let imageDataURL = '';
  let editId = null;

  const factorField = (id, label, placeholder = '', unit = '') => `
    <div class="ap-factor" style="
        display:grid; grid-template-columns:190px 1fr auto; align-items:center; gap:8px; margin:6px 0; box-sizing:border-box; max-width:100%;">
      <label for="${id}" style="margin:0;color:#9ca3af;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
        ${label || ''}
      </label>
      <input id="${id}" type="text" placeholder="${placeholder}"
        style="width:100%;box-sizing:border-box;background:#3a3a3a;color:#fff;border:1px solid #4a4a4a;border-radius:6px;padding:10px;">
      <span class="ap-unit" style="color:#9ca3af;font-size:12px;padding-left:4px;${unit ? '' : 'visibility:hidden;'}">
        ${unit || '-'}
      </span>
    </div>
  `;

  // put this below your existing factorField helper
  const selectField = (id, label, options) => `
  <div class="ap-factor" style="
      display:grid; grid-template-columns:190px 1fr auto; align-items:center; gap:8px; margin:6px 0; box-sizing:border-box; max-width:100%;">
    <label for="${id}" style="margin:0;color:#9ca3af;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
      ${label || ''}
    </label>
    <select id="${id}"
      style="width:100%;box-sizing:border-box;background:#3a3a3a;color:#fff;border:1px solid #4a4a4a;border-radius:6px;padding:10px;">
      ${options.map(o => `<option value="${o}">${o}</option>`).join('')}
    </select>
    <span class="ap-unit" style="visibility:hidden;">-</span>
  </div>
`;


  function openForm(product) {

    editId = product?.id || null;
    imageDataURL = product?.image || '';

    // Eco letter is no longer selected by the admin; it will be computed automatically.

    // NOTE: Ang form fields ay may default value (|| '') para hindi magpadala ng null/undefined
    // at masira ang database entry kapag nag-edit.
    const coreFields = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-bottom:12px;">
        <div>
          <label style="display:block;font-size:12px;color:#9ca3af;margin-bottom:6px;">Product Name</label>
          <input id="name" type="text" value="${product?.name || ''}" required style="width:100%;background:#3a3a3a;color:#fff;border:1px solid #4a4a4a;border-radius:6px;padding:10px;">
        </div>
        <div>
          <label style="display:block;font-size:12px;color:#9ca3af;margin-bottom:6px; margin-left:25px;">Category</label>
          <input id="category" type="text" value="${product?.category || ''}" required style="width:85%;background:#3a3a3a;color:#fff;border:1px solid #4a4a4a;border-radius:6px;padding:10px; margin-left:25px;">
        </div>
        <div>
          <label style="display:block;font-size:12px;color:#9ca3af;margin-bottom:6px;">Analysis Date</label>
          <input id="date" type="date" value="${product?.date || ''}" required style="width:100%;background:#3a3a3a;color:#fff;border:1px solid #4a4a4a;border-radius:6px;padding:10px;">
        </div>
        
        <!-- Eco Grade selection removed; eco score and letter are now computed automatically -->
        
        <div>
          <label style="display:block;font-size:12px;color:#9ca3af;margin-bottom:6px;">Sustainability Level</label>
          <select id="sustain" required style="width:100%;background:#3a3a3a;color:#fff;border:1px solid #4a4a4a;border-radius:6px;padding:10px;">
            ${['low', 'medium', 'high'].map(x => `<option ${product?.sustain === x ? 'selected' : ''}>${x}</option>`).join('')}
          </select>
        </div>
        
        <div>
          <label style="display:block;font-size:12px;color:#9ca3af;margin-bottom:6px;">Environmental Impact</label>
          <input id="impact" type="text" value="${product?.impact || ''}" required style="width:85%;background:#3a3a3a;color:#fff;border:1px solid #4a4a4a;border-radius:6px;padding:10px;" placeholder="e.g., low emissions, recyclable packaging">
        </div>
      </div>

        <div class="ap-field ap-col-2">
          <label for="ingredients">Ingredients</label>
          <textarea id="ingredients" name="ingredients"
            placeholder="MediaTek Helio G88, 6.72-inch 90Hz display, , 64MP main camera, 5000mAh battery"
            style="width:100%;min-height:72px;background:#3a3a3a;color:#fff;border:1px solid #4a4a4a;border-radius:6px;padding:10px;"></textarea>
          <small class="ap-hint" style="color:#9ca3af">SEPARATE EACH INGREDIENT WITH A COMMA.</small>
        </div>
        </br>
    `;

    const imgBlock = `
      <div style="display:flex;gap:14px;align-items:flex-start;margin-bottom:10px;">
        <div style="width:96px;height:96px;border:1px dashed #4a4a4a;border-radius:8px;overflow:hidden;display:flex;align-items:center;justify-content:center;background:#1f1f1f;">
          <img id="imgPreview" alt="Preview" style="max-width:100%;max-height:100%;${imageDataURL ? 'display:block' : 'display:none'};" src="${imageDataURL || ''}">
          <span id="imgPlaceholder" style="color:#6b7280;font-size:12px;${imageDataURL ? 'display:none' : 'display:block'};">No image</span>
        </div>
        <div>
          <label style="display:block;font-size:12px;color:#9ca3af;margin-bottom:6px;">Product Image</label>
          <input type="file" id="image" accept="image/*" style="background:#3a3a3a;color:#fff;border:1px solid #4a4a4a;border-radius:6px;padding:8px;width:220px;">
        </div>
      </div>
    `;

    const f = product?.factors || {};
    // Factor fields use the frontend camelCase from the 'product' object
    const factorGroup = `
      <div style="display:flex;flex-direction:column;gap:10px;">
        <h4 style="margin:4px 0 2px 0;font-size:14px;color:#9ca3af;">Environmental Factors</h4>
        ${factorField('carbonFootprint', 'Carbon Footprint', f.carbonFootprint || '0.42', 'kg CO₂e')}
        ${factorField('waterConsumption', 'Water Consumption', f.waterConsumption || '3.1', 'liters')}
        ${factorField('energyUsage', 'Energy Usage', f.energyUsage || '0.18', 'kWh')}
        ${selectField('wastePollution', 'Waste & Pollution', ['Low', 'Medium', 'High'])}
        ${selectField('chemicalUsage', 'Chemical Usage', ['Minimal', 'Moderate', 'Severe'])}
        ${selectField('recyclability', 'Recyclability', ['High', 'Medium', 'Low'])}
      </div>
    `;

    const footer = `
      <button type="button" data-close style="background:#1d1d1d;color:#fff;border:1px solid #4a4a4a;border-radius:6px;padding:10px 14px;cursor:pointer;">Cancel</button>
      <button id="saveProductBtn" style="background:#10b981;color:#000;border:1px solid #10b981;border-radius:6px;padding:10px 16px;font-weight:600;cursor:pointer;">
        ${editId ? 'Update' : 'Save'} Product
      </button>
    `;

    openOverlay(modalShell(editId ? 'Edit Product' : 'Add Product', imgBlock + coreFields + factorGroup, footer));

    // wire image preview
    const imgInput = $('#image', overlay);
    const imgPrev = $('#imgPreview', overlay);
    const imgPh = $('#imgPlaceholder', overlay);
    imgInput?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        imageDataURL = reader.result;
        imgPrev.src = imageDataURL;
        imgPrev.style.display = 'block';
        imgPh.style.display = 'none';
      };
      reader.readAsDataURL(file);
    });

    // Eco score and letter are computed automatically; no live updates are needed.


    // prefill factor values (using frontend camelCase)
    const setVal = (id, val) => { const el = $('#' + id, overlay); if (el && val != null) el.value = val; };
    setVal('carbonFootprint', f.carbonFootprint);
    setVal('waterConsumption', f.waterConsumption);
    setVal('energyUsage', f.energyUsage);
    setVal('wastePollution', f.wastePollution);
    setVal('chemicalUsage', f.chemicalUsage);
    setVal('recyclability', f.recyclability);

    // prefill Ingredients as a comma list if present
    const ing = (product?.ingredients && Array.isArray(product.ingredients))
      ? product.ingredients.join(', ')
      : (product?.ingredients || '');
    const ingEl = $('#ingredients', overlay);
    if (ingEl) ingEl.value = ing;

    // save/update 
    // save/update
    // save/update
    const saveBtn = $('#saveProductBtn', overlay);
    saveBtn.addEventListener('click', async () => {
      // decide endpoint first
      let saveEndpoint, saveMethod;
      if (editId) {
        saveEndpoint = `/products/${editId}`;
        saveMethod = 'PUT';
      } else {
        saveEndpoint = '/products';
        saveMethod = 'POST';
      }

      const btn = $('#saveProductBtn', overlay);
      btn.disabled = true;
      btn.textContent = editId ? 'Updating…' : 'Saving…';

      const name = $('#name', overlay).value.trim();
      const category = $('#category', overlay).value.trim();
      const date = $('#date', overlay).value;
      const sustain = $('#sustain', overlay).value;
      const impact = $('#impact', overlay).value.trim();

      // Validate required fields (ecoLetter removed because it is computed)
      if (!name || !category || !date || !sustain || !impact) {
        alert('Please fill out all required fields.');
        btn.disabled = false;
        btn.textContent = editId ? 'Update Product' : 'Save Product';
        return;
      }

      // convert / collect factors
      const factors = {
        carbonFootprint: $('#carbonFootprint', overlay).value.trim(),
        waterConsumption: $('#waterConsumption', overlay).value.trim(),
        energyUsage: $('#energyUsage', overlay).value.trim(),
        wastePollution: $('#wastePollution', overlay).value.trim(),
        chemicalUsage: $('#chemicalUsage', overlay).value.trim(),
        recyclability: $('#recyclability', overlay).value.trim(),
      };
      const ingredientsRaw = ($('#ingredients', overlay)?.value || '').trim();
      const ingredients = ingredientsRaw ? ingredientsRaw.split(',').map(s => s.trim()).filter(Boolean) : [];

      // Compute eco score and letter using the factors, impact and sustainability level
      const ecoResult = computeEcoScore({
        carbonFootprint: factors.carbonFootprint,
        waterConsumption: factors.waterConsumption,
        energyUsage: factors.energyUsage,
        wastePollution: factors.wastePollution,
        chemicalUsage: factors.chemicalUsage,
        recyclability: factors.recyclability,
        environmentalImpact: impact,
        sustainabilityLevel: sustain,
      });

      const numericalScore = ecoResult.score;
      const ecoLetter = ecoResult.letter;

      const newOrUpdatedProduct = {
        name,
        category,
        date,
        image: imageDataURL,
        impact,
        sustain,
        eco_score: numericalScore,
        eco_letter: ecoLetter,
        factors,
        ingredients,
      };

      try {
        console.debug('[Save]', saveMethod, saveEndpoint, { id: editId });
        const serverProduct = await apiFetch(saveEndpoint, saveMethod, newOrUpdatedProduct);

        // update local cache + UI from server echo
        const updatedProduct = serverProduct;
        if (editId) {
          const idx = allProducts.findIndex(p => p.id === editId);
          if (idx > -1) allProducts[idx] = updatedProduct;
        } else {
          allProducts.unshift(updatedProduct);
          page = 1;
        }

        closeOverlay();
        render();
      } catch (err) {

        // If the server reported 404 (e.g., redundant second request, stale id, or race),
        // treat it as a soft case: close the modal and reload fresh data without scaring the user.
        if (err.status === 404 && editId) {
          console.warn('[Save] 404 for', saveEndpoint, '— soft-refreshing products.');
          closeOverlay();
          await loadInitialData();            // pulls canonical state from server
          return;                             // no alert
        }

        // Otherwise, only alert if overlay is still visible (operation really failed)
        if (overlay && overlay.style.display === 'flex') {
          alert('Failed to save product to database. See console for details.');
        }
      } finally {
        if (overlay && overlay.style.display === 'flex') {
          btn.disabled = false;
          btn.textContent = editId ? 'Update Product' : 'Save Product';
        }
      }
    }, { once: true });

  }

  // ---------- Details Modal (MODIFIED to use new fields) ----------
  function openDetails(product) {
    // Use the simplified field names for local product object
    const f = product.factors || {};
    const numericalScore = product.eco; // Now numerical
    const ecoLetter = product.eco_letter; // Now letter grade for color
    const sustainabilityLevel = product.sustain;

    const badge = (txt, cls) => `<span class="pd-badge ${cls}">${txt || '-'}</span>`;

    const headerMedia = product.image
      ? `<img src="${product.image}" alt="${product.name}" class="pd-img">`
      : `<div class="pd-img pd-img--ph">N/A</div>`;

    const body = `
      <style>
        /* ... (Your existing CSS styles) ... */
        .pd-wrap { max-width: 100%; font-family: sans-serif; }
        .pd-top { display: flex; gap: 15px; align-items: flex-start; margin-bottom: 15px; }
        .pd-img { width: 90px; height: 90px; border-radius: 8px; object-fit: cover; background: #3a3a3a; flex-shrink: 0; }
        .pd-img--ph { display: flex; align-items: center; justify-content: center; color: #9ca3af; font-size: 12px; }
        .pd-titlebox { flex-grow: 1; }
        .pd-name { font-size: 20px; font-weight: 600; margin: 0; }
        .pd-sub { font-size: 14px; color: #9ca3af; margin: 2px 0; }
        .pd-idtext { font-size: 10px; color: #6b7280; }
        .pd-quick { display: flex; gap: 8px; flex-shrink: 0; }
        .pd-badge { padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 600; text-transform: uppercase; }
        .pd-hr { border: none; border-top: 1px solid #3a3a3a; margin: 15px 0; }
        .pd-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
        .pd-item { display: flex; flex-direction: column; }
        .pd-label { font-size: 12px; color: #9ca3af; margin-bottom: 4px; }
        .pd-val { font-size: 14px; font-weight: 500; }
        .pd-section { font-size: 16px; margin: 20px 0 10px 0; color: #fff; border-bottom: 1px solid #4a4a4a; padding-bottom: 5px; }
        .pd-factors { display: flex; flex-direction: column; gap: 8px; }
        .pd-frow { display: grid; grid-template-columns: 180px 1fr 60px; align-items: center; }
        .pd-flabel { font-size: 13px; color: #9ca3af; }
        .pd-fval { font-size: 13px; font-weight: 500; }
        .pd-funit { font-size: 11px; color: #6b7280; }
        .pd-fpill { grid-column: 2 / span 2; font-size: 13px; background: #3a3a3a; color: #fff; padding: 4px 8px; border-radius: 4px; display: inline-block; }
        
        /* Eco/Sustainability Colors */
        .bg-green { background-color: #10b981; }
        .bg-lime { background-color: #84cc16; }
        .bg-amber { background-color: #f59e0b; }
        .bg-orange { background-color: #f97316; }
        .bg-red { background-color: #ef4444; }
        
        /* Use the color mapping based on the letter grade (p.eco_letter) */
        .pd-quick .pd-badge:nth-child(1) { 
            background-color: ${(ecoLetter && { 'A': '#10b981', 'B': '#84cc16', 'C': '#f59e0b', 'D': '#f97316', 'E': '#ef4444' })[ecoLetter] || '#f59e0b'};
        }
        .pd-quick .pd-badge:nth-child(2) { 
            background-color: ${(sustainabilityLevel && { 'high': '#10b981', 'medium': '#f59e0b', 'low': '#ef4444' })[sustainabilityLevel] || '#f59e0b'};
        }
      </style>
      <div class="pd-wrap">
        <div class="pd-top">
          ${headerMedia}
          <div class="pd-titlebox">
            <div class="pd-name">${product.name || '-'}</div>
            <div class="pd-sub">${product.category || 'N/A'}</div>
            <div class="pd-idtext">${product.id || ''}</div>
          </div>
          <div class="pd-quick">
            ${badge(`${numericalScore}/100`, ecoBadge(ecoLetter))}
            ${badge(sustainabilityLevel, susBadge(sustainabilityLevel))}
          </div>
        </div>

        <hr class="pd-hr" />

        <div class="pd-grid">
          <div class="pd-item">
            <span class="pd-label">Analysis Date</span>
            <span class="pd-val">${product.date || '-'}</span>
          </div>
          <div class="pd-item">
            <span class="pd-label">Environmental Impact</span>
            <span class="pd-val">${product.impact || '-'}</span>
          </div>
        </div>

        <h4 class="pd-section">Environmental Factors</h4>

        <div class="pd-factors">
          <div class="pd-frow">
            <span class="pd-flabel">Carbon Footprint</span>
            <span class="pd-fval">${f.carbonFootprint || '-'}</span>
            <span class="pd-funit">kg CO₂e</span>
          </div>
          <div class="pd-frow">
            <span class="pd-flabel">Water Consumption</span>
            <span class="pd-fval">${f.waterConsumption || '-'}</span>
            <span class="pd-funit">liters</span>
          </div>
          <div class="pd-frow">
            <span class="pd-flabel">Energy Usage</span>
            <span class="pd-fval">${f.energyUsage || '-'}</span>
            <span class="pd-funit">kWh</span>
          </div>
          <div class="pd-frow">
            <span class="pd-flabel">Waste & Pollution</span>
            <span class="pd-fpill">${f.wastePollution || '-'}</span>
          </div>
          <div class="pd-frow">
            <span class="pd-flabel">Chemical Usage</span>
            <span class="pd-fpill">${f.chemicalUsage || '-'}</span>
          </div>
          <div class="pd-frow">
            <span class="pd-flabel">Recyclability</span>
            <span class="pd-fpill">${f.recyclability || '-'}</span>
          </div>
        </div>
      </div>
    `;

    openOverlay(modalShell('Product Details', body,
      '<button data-close class="ap-btn ap-btn--ghost" style="background:#3a3a3a;color:#fff;border:1px solid #4a4a4a;border-radius:6px;padding:10px 14px;cursor:pointer;">Close</button>'));
  }


  // ---------- table rendering & paging (MODIFIED to use new fields) ----------
  const tbody = $('#productTableBody');
  const searchBox = $('.search-box');
  const entriesSelect = $('.entries-select');
  const paginationInfo = $('.pagination .pagination-info') || $('.pagination-info');
  const paginationControls = $('.pagination-controls');

  // Color coding is now based on 's' (which is the letter grade)
  const ecoBadge = (s) => ({ A: 'bg-green', B: 'bg-lime', C: 'bg-amber', D: 'bg-orange', E: 'bg-red' })[s] || 'bg-amber';
  const susBadge = (s) => ({ high: 'bg-green', medium: 'bg-amber', low: 'bg-red' })[s] || 'bg-amber';

  // MODIFIED: Numerical Score (p.eco) in the ECO SCORE column
  const rowHTML = (p) => `
    <tr data-id="${p.id}">
      <td >${p.id}</td>
      <td style="display:flex;align-items:center;gap:10px;">
        ${p.image ? `<img src="${p.image}" style="width:40px;height:40px;border-radius:6px;object-fit:cover;border:1px solid #3a3a3a;">` :
      `<div style="width:40px;height:40px;border-radius:6px;background:#2d2d2d;border:1px solid #3a3a3a;display:flex;align-items:center;justify-content:center;color:#6b7280;font-size:10px;">No Img</div>`}
        <span>${p.name}</span>
      </td>
      <td>${p.category}</td>
      <td>${p.date}</td>
      <td><span class="eco-score ${ecoBadge(p.eco_letter)}">${p.eco}</span></td>
      <td><span class="sustainability-level ${susBadge(p.sustain)}">${p.sustain}</span></td>
      <td>${p.impact}</td>
      <td>
        <button class="btn-details" style="margin-right:6px;background:#3a3a3a;color:#fff;border:1px solid #4a4a4a;border-radius:4px;padding:6px 10px;cursor:pointer;width:80px; margin-bottom:5px;">Details</button>
        <button class="btn-edit" style="margin-right:6px;background:#3a3a3a;color:#fff;border:1px solid #4a4a4a;border-radius:4px;padding:6px 10px;cursor:pointer;width:80px;margin-bottom:5px;">Edit</button>
        <button class="btn-delete" style="color:#ef4444;background:#3a3a3a;border:1px solid #4a4a4a; padding:6px 10px;cursor:pointer;border-radius:4px; width:80px;">Delete</button>
      </td>
    </tr>
  `;

  let allProducts = [];
  let filter = '';
  let page = 1;

  const pageSize = () => parseInt(entriesSelect?.value || '5', 10) || 5;

  // --- Data Normalization Function for Loading from DB/API ---
  // Note: Since the server's mapToFrontend now returns camelCase keys, 
  // the normalization process is simpler but still needed for compatibility.
  function normalizeProduct(p) {
    if (!p) return null;

    // Use default 'N/A' or empty string for null fields for safety
    const safeDisplay = (value, defaultVal = 'N/A') => (value && String(value).trim() !== '') ? value : defaultVal;

    return {
      id: p.id || p._id,
      name: safeDisplay(p.name, ''),
      category: safeDisplay(p.category, ''),
      date: safeDisplay(p.date, ''),
      image: p.image || '', // Image can be empty string
      impact: safeDisplay(p.impact),
      sustain: safeDisplay(p.sustain),

      // Score fields from server
      eco: safeDisplay(p.eco),
      eco_letter: safeDisplay(p.eco_letter, 'N/A'),

      // Factors are returned in camelCase from server
      factors: p.factors || {},
      ingredients: Array.isArray(p.ingredients) ? p.ingredients : (p.ingredients ? [p.ingredients] : [])
    };
  }

  const applyFilter = (arr) => {
    if (!filter) return arr;
    const t = filter.toLowerCase();
    // Check against product fields and factor values
    return arr.filter(p => [
      p.id, p.name, p.category, p.date, p.eco, p.eco_letter, p.sustain, p.impact,
      ...(p.factors ? Object.values(p.factors) : [])
    ].filter(Boolean).join(' ').toLowerCase().includes(t));
  };

  function render() {
    if (!tbody) return;
    const items = applyFilter(allProducts);
    const size = pageSize();
    const pages = Math.max(1, Math.ceil(items.length / size));
    if (page > pages) page = pages;
    const start = (page - 1) * size;
    const slice = items.slice(start, start + size);
    tbody.innerHTML = slice.map(rowHTML).join('');

    // actions
    $$('tr', tbody).forEach(tr => {
      const id = tr.getAttribute('data-id');
      const product = allProducts.find(p => p.id === id);
      if (!product) return;

      tr.querySelector('.btn-details')?.addEventListener('click', () => openDetails(product));
      tr.querySelector('.btn-edit')?.addEventListener('click', () => openForm(product));
      tr.querySelector('.btn-delete')?.addEventListener('click', async () => {
        if (!confirm(`Delete product ${product.name} (${id}) permanently? This cannot be undone.`)) return;

        try {
          await apiFetch(`/products/${id}`, 'DELETE');
          allProducts = allProducts.filter(p => p.id !== id);
          // saveCache(allProducts); // REMOVED: Hindi na magse-save ng data sa local cache
          render();
        } catch (error) {
          console.error('Error deleting product:', error);
          alert('Failed to delete product from database. See console for details.');
        }
      });
    });

    if (paginationInfo) {
      const from = items.length ? start + 1 : 0;
      const to = Math.min(start + size, items.length);
      paginationInfo.textContent = `Showing ${from} to ${to} of ${items.length} entries`;
    }
    if (paginationControls) {
      paginationControls.innerHTML = '';
      const mk = (label, disabled, fn, active = false) => {
        const b = document.createElement('button');
        b.className = 'page-btn' + (active ? ' active' : '');
        b.textContent = label;
        if (disabled) b.disabled = true;
        b.addEventListener('click', fn);
        paginationControls.appendChild(b);
      };
      const totalPages = Math.max(1, Math.ceil(items.length / size));
      mk('Prev', page === 1, () => { page--; render(); });
      const show = 5;
      const sp = Math.max(1, page - Math.floor(show / 2));
      const ep = Math.min(totalPages, sp + show - 1);
      for (let i = sp; i <= ep; i++) mk(String(i), false, () => { page = i; render(); }, i === page);
      mk('Next', page === totalPages, () => { page++; render(); });
    }
  }

  async function loadInitialData() {
    try {
      const data = await apiFetch('/products');
      allProducts = Array.isArray(data) ? data.map(normalizeProduct) : [];
      // saveCache(allProducts); // REMOVED: Hindi na magse-save ng data sa local cache
      console.log(`[EcoBrand Admin] Loaded ${allProducts.length} products from API.`);
    } catch (error) {
      // MODIFIED: Hindi na magpa-fallback sa cache dahil delikado ito
      console.error('Error loading products from API. Cache fallback disabled.', error);
      allProducts = [];
    }
    render();
  }

  function findAddButton() {
    return document.querySelector('.add-product-btn') ||
      document.querySelector('#addProduct') ||
      document.querySelector('[data-action="add-product"]');
  }

  ready(() => {
    const addBtn = findAddButton();
    addBtn?.addEventListener('click', (e) => { e.preventDefault(); openForm(null); });
    loadInitialData();
  });

  searchBox?.addEventListener('input', (e) => { filter = e.target.value || ''; page = 1; render(); });
  entriesSelect?.addEventListener('change', () => { page = 1; render(); });

})();


// ===== EcoBrand Read Bridge (User Frontend) - Updated to use new 'eco_letter' field =====
(function () {
  const API_BASE_URL = window.location.origin.replace(/\/$/, '');
  const LS_KEY = 'ecobrand.products.v2.cache'; // Key is kept for consistency

  // Maps the server's response (camelCase) to the expected User Frontend Bridge format
  function normalizeToUser(p) {
    if (!p) return null;
    const f = p.factors || {};

    // Helper function for safe display (from server.js logic)
    const safeDisplay = (value, defaultVal = 'N/A') => (value && String(value).trim() !== '') ? value : defaultVal;

    return {
      ProductName: safeDisplay(p.name, 'N/A'),
      Category: safeDisplay(p.category, 'N/A'),
      AnalysisDate: safeDisplay(p.date, 'N/A'),
      ProductImageURL: p.image || '',

      // Factors mapped for user display (camelCase is fine here)
      carbonfootprint: safeDisplay(f.carbonFootprint, 'N/A'),
      waterconsumption: safeDisplay(f.waterConsumption, 'N/A'),
      energyusage: safeDisplay(f.energyUsage, 'N/A'),
      wastepollution: safeDisplay(f.wastePollution, 'N/A'),
      chemicalusage: safeDisplay(f.chemicalUsage, 'N/A'),
      recyclability: safeDisplay(f.recyclability, 'N/A'),

      _id: p.id || '',

      // Display fields
      _eco: p.eco || null, // Numerical Score for user display (e.g., "90/100")
      _sustain: p.sustain || null,
      _impact: p.impact || null,
      _eco_letter: p.eco_letter || null // Letter for color-coding reference
    };
  }

  // --- API Functions (Async) ---
  async function apiFetch(endpoint, method = 'GET', data = null) {
    const url = `${API_BASE_URL}${endpoint}`;
    const options = {
      method: method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (data) options.body = JSON.stringify(data);

    const response = await fetch(url, options);
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API Error: ${response.status} - ${errorText}`);
    }
    if (response.status !== 204) {
      return response.json();
    }
    return null;
  }

  // MODIFIED: loadAll no longer saves or loads from cache, it only fetches from API.
  async function loadAll() {
    try {
      // Server's /products endpoint returns data already mapped to frontend format
      const data = await apiFetch('/products');
      const arr = Array.isArray(data) ? data.filter(Boolean) : [];
      // REMOVED: localStorage.setItem(LS_KEY, JSON.stringify(arr));
      return arr;
    } catch (error) {
      console.warn('[EcoAPI] Failed to fetch products. Returning empty list.', error);
      // REMOVED: Fallback logic
      return [];
    }
  }

  async function search(query) {
    const q = (query || '').toLowerCase().trim();
    const all = await loadAll();
    if (!q) return all.map(normalizeToUser);
    const hits = all.filter(p => {
      // Search logic uses the simpler frontend keys
      const hay = [
        p?.id, p?.name, p?.category, p?.date, p?.eco, p?.eco_letter, p?.sustain, p?.impact,
        ...(p?.factors ? Object.values(p.factors) : [])
      ].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q);
    });
    return hits.map(normalizeToUser);
  }

  window.__EcoAPI = Object.freeze({
    getAllProducts: () => search(''),
    searchProducts: (q) => search(q),
    getFirstProduct: async (q) => {
      const list = await search(q);
      return list.length ? list[0] : null;
    }
  });
  console.debug('[EcoAPI] ready - (Now ASYNC with Letter in eco_letter and Numeric in eco_score, CACHE DISABLED)');
})();