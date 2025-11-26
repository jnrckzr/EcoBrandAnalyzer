// search-results.js
document.addEventListener("DOMContentLoaded", async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const query = urlParams.get("query");
  const searchQueryEl = document.getElementById("searchQuery");
  const resultCountEl = document.getElementById("resultCount");
  const resultsContainer = document.getElementById("resultsContainer");

  console.log('[SEARCH-RESULTS] Page loaded with query:', query);

  // Display query in header
  if (searchQueryEl) searchQueryEl.textContent = query || "";

  // Fetch user data
  try {
    const response = await fetch("/api/user-data");
    if (response.ok) {
      const data = await response.json();
      if (data.username) {
        const topBarUserName = document.getElementById("topBarUserName");
        if (topBarUserName) topBarUserName.textContent = data.username;
      }
    }
  } catch (error) {
    console.error("Error fetching user data:", error);
  }

  // Render product list from sidebar
  function renderProductList() {
    const productListEl = document.getElementById("productList");
    const noProductsMessageEl = document.getElementById("noProductsMessage");
    if (!productListEl || !noProductsMessageEl) return;

    const raw = JSON.parse(localStorage.getItem("Products")) || [];

    const toName = (item) => {
      if (typeof item === "string") return item;
      if (item && typeof item === "object") {
        return item.name || item.ProductName || item.query || "";
      }
      return "";
    };

    const products = raw
      .map(toName)
      .map((s) => (s ? String(s).trim() : ""))
      .filter(Boolean);

    productListEl.innerHTML = "";
    if (products.length === 0) {
      noProductsMessageEl.style.display = "block";
      return;
    }
    noProductsMessageEl.style.display = "none";

    products.forEach((productName) => {
      const li = document.createElement("li");
      li.textContent = productName;
      li.classList.add("history-item");
      li.style.cursor = "pointer";
      li.addEventListener("click", () => {
        window.location.href = `user-products.html?query=${encodeURIComponent(
          productName
        )}`;
      });
      productListEl.appendChild(li);
    });
  }

  renderProductList();

  // Validate query
  if (!query || !query.trim()) {
    console.log('[SEARCH-RESULTS] No query provided');
    resultsContainer.innerHTML = `
      <div class="no-results">
        <i class="fa fa-search"></i>
        <h2>No search query provided</h2>
        <p>Please enter a product name to search.</p>
        <button class="back-button" id="backToHomeBtn">
          <i class="fa fa-arrow-left"></i> Back to Home
        </button>
      </div>
    `;
    resultCountEl.textContent = "0";
    document.getElementById('backToHomeBtn')?.addEventListener('click', () => {
      window.location.href = 'homepage.html';
    });
    return;
  }

  // Show loading state
  resultsContainer.innerHTML = '<p class="muted" style="text-align:center;padding:40px;">Searching...</p>';

  try {
    const searchUrl = `/api/search-products?query=${encodeURIComponent(query)}`;
    console.log('[SEARCH-RESULTS] Fetching from:', searchUrl);
    
    const response = await fetch(searchUrl);
    console.log('[SEARCH-RESULTS] Response status:', response.status);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('[SEARCH-RESULTS] Response data:', data);

    if (!data.success || !Array.isArray(data.products)) {
      console.error('[SEARCH-RESULTS] Invalid response format:', data);
      throw new Error('Invalid response format from server');
    }

    const products = data.products;
    console.log('[SEARCH-RESULTS] Found products:', products.length);

    if (products.length === 0) {
      console.log('[SEARCH-RESULTS] No products found');
      resultsContainer.innerHTML = `
        <div class="no-results">
          <i class="fa fa-frown-o"></i>
          <h2>No products found</h2>
          <p>We couldn't find any products matching "${query}".</p>
          <button class="back-button" id="backToHomeBtn2">
            <i class="fa fa-arrow-left"></i> Back to Home
          </button>
        </div>
      `;
      resultCountEl.textContent = "0";
      document.getElementById('backToHomeBtn2')?.addEventListener('click', () => {
        window.location.href = 'homepage.html';
      });
      return;
    }

    resultCountEl.textContent = products.length;

    // If only one product, redirect directly
    if (products.length === 1) {
      console.log('[SEARCH-RESULTS] Only one product found, redirecting to:', products[0].ProductName);
      window.location.href = `user-products.html?query=${encodeURIComponent(
        products[0].ProductName
      )}`;
      return;
    }

    // Display multiple products
    console.log('[SEARCH-RESULTS] Displaying', products.length, 'products');
    resultsContainer.innerHTML = products
      .map((product, index) => {
        console.log(`[SEARCH-RESULTS] Rendering product ${index + 1}:`, product.ProductName);
        
        // Get eco score with fallback
        let ecoScore = 0;
        if (product._eco != null) {
          ecoScore = parseInt(product._eco);
        } else if (product.eco_score != null) {
          const scoreStr = String(product.eco_score);
          if (scoreStr.includes("/")) {
            ecoScore = parseInt(scoreStr.split("/")[0]);
          } else {
            ecoScore = parseInt(scoreStr);
          }
        }

        // Determine score class and label
        let scoreClass = "low";
        let scoreLabel = "Low";
        if (ecoScore >= 75) {
          scoreClass = "high";
          scoreLabel = "High";
        } else if (ecoScore >= 50) {
          scoreClass = "medium";
          scoreLabel = "Medium";
        }

        const imageUrl = product.ProductImageURL || "";
        const imagePlaceholder = imageUrl
          ? `<img src="${imageUrl}" alt="${product.ProductName}" />`
          : `<div class="placeholder"><i class="fa fa-cube"></i></div>`;

        const productUrl = `user-products.html?query=${encodeURIComponent(product.ProductName)}`;

        return `
          <div class="product-result-card" data-product-url="${productUrl}">
            <div class="product-result-image">
              ${imagePlaceholder}
            </div>
            <div class="product-result-content">
              <div class="product-result-name">${product.ProductName}</div>
              <div class="product-result-category">${
                product.Category || "Uncategorized"
              }</div>
              <div class="product-result-meta">
                <span class="eco-badge ${scoreClass}">
                  <i class="fa fa-leaf"></i> ${scoreLabel} EcoScore: ${ecoScore}
                </span>
              </div>
            </div>
          </div>
        `;
      })
      .join("");

    // Add click handlers to all product cards
    document.querySelectorAll('.product-result-card').forEach(card => {
      card.addEventListener('click', function() {
        const url = this.getAttribute('data-product-url');
        if (url) window.location.href = url;
      });
    });

    console.log('[SEARCH-RESULTS] Products rendered successfully');
  } catch (error) {
    console.error('[SEARCH-RESULTS] Error:', error);
    resultsContainer.innerHTML = `
      <div class="no-results">
        <i class="fa fa-exclamation-triangle"></i>
        <h2>Error loading results</h2>
        <p>Something went wrong: ${error.message}</p>
        <p style="font-size:12px;color:#666;margin-top:10px;">Check the browser console for more details.</p>
        <button class="back-button" id="backToHomeBtn3">
          <i class="fa fa-arrow-left"></i> Back to Home
        </button>
      </div>
    `;
    resultCountEl.textContent = "0";
    document.getElementById('backToHomeBtn3')?.addEventListener('click', () => {
      window.location.href = 'homepage.html';
    });
  }
});