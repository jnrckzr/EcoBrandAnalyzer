// searchHistory.js (Connected to /api/search-history)

// --- Element References ---
// Kinuha ang mga elemento mula sa profile.html (sidebar)
const productListEl = document.getElementById("productList");
const noProductsMessageEl = document.getElementById("noProductsMessage");

// --- History Retrieval and Rendering ---

/**
 * Kinukuha ang user-specific search history mula sa server (MongoDB)
 * at ipinapakita ito sa sidebar. Permanenteng history ito na nakabase sa user ID.
 */
async function renderProductList() {
    if (!productListEl || !noProductsMessageEl) return;
    
    productListEl.innerHTML = "";
    noProductsMessageEl.style.display = "none";
    
    let products = [];
    
    try {
        // TAWAGIN ang iyong server endpoint. Ang server na ang bahala sa authentication at user ID.
        const resp = await fetch("/api/search-history"); 
        
        if (resp.ok) {
            const data = await resp.json();
            // I-extract lang ang search query string mula sa history objects.
            products = (data.history || []).map(item => item.query); 
        } 
    } catch (e) {
        console.error("Error fetching search history from server:", e);
    }

    // Kung walang history (kasama na ang mga bagong user)
    if (products.length === 0) {
        noProductsMessageEl.style.display = "block";
        return;
    }
    
    // I-render ang mga permanenteng history items
    products.forEach((name) => {
        const li = document.createElement("li");
        li.textContent = name;
        li.classList.add("history-item");
        // Nagti-trigger ng redirect para sa product load
        li.addEventListener("click", () => loadProductDetails(name));
        productListEl.appendChild(li);
    });
}

// --- Search Handlers ---

/**
 * Nagre-redirect para i-load ang detalye ng produkto.
 * Ito ang nagti-trigger sa server-side saving sa /api/search-products endpoint.
 */
function loadProductDetails(name) {
    if (!name) return;
    // Ang pag-redirect ay magbubukas ng user-products.html na may query parameter.
    window.location.href = `user-products.html?query=${encodeURIComponent(name)}`;
}

/**
 * Hini-handle ang search input at nagre-redirect. 
 * Walang client-side saving (tinanggal ang localStorage logic).
 */
function handleSearch(query) {
    if (!query || !query.trim()) {
        // Ipagpalagay na ang 'showPopup' ay available sa global scope o sa user-products.js
        if (typeof showPopup === 'function') {
            showPopup("The product is not available nor analyze");
        } else {
            alert("The product is not available nor analyze");
        }
        return;
    }
    const q = query.trim();
    loadProductDetails(q); 
}

// --- Initialization ---
// Sa profile.html, kailangan mo lang ipakita ang existing history.
// Ang 'loadProducts()' function (para sa pag-save/pag-refresh) ay nasa user-products.js.

// Dahil ang script na ito ay kasama sa profile.html, tawagin ang renderProductList
// kapag fully loaded na ang page.
document.addEventListener("DOMContentLoaded", () => {
    // Tiyakin na ASYNC ang pagtawag
    renderProductList(); 
});