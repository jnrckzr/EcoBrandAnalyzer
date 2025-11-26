// Complete integrated navigation and search system (Cleaned & Updated for API Autocomplete)
document.addEventListener("DOMContentLoaded", async () => {

    // Warm the chatbot product digest on page load (no UI impact)
    try {
        fetch('/api/chatbot/ping?warm=1').catch(() => { });
    } catch (_) { }

    // --- Element Definitions ---
    const displayUserNameSpan = document.getElementById("displayUserName");
    const topBarUserNameSpan = document.getElementById("topBarUserName");
    const productSearchForm = document.getElementById("productSearchForm");
    const productQueryInput = document.getElementById("productQuery");
    const productListEl = document.getElementById("productList");
    const noProductsMessageEl = document.getElementById("noProductsMessage");
    const newProductBtn = document.getElementById("newProductBtn");
    const signOutBtn = document.getElementById("signOutBtn");

    // chat shell nodes
    const chatShell = document.getElementById('chatgpt-shell');
    const chatMessages = document.getElementById('chatMessages');
    const chatPrompt = document.getElementById('chatPrompt');
    const chatSend = document.getElementById('chatSend');

    // Existing search UI nodes we will hide in Chatbot mode
    const inputContainer = document.querySelector('.input-container');
    const disclaimerEl = document.querySelector('.disclaimer');


    // Homepage search elements - More comprehensive search
    const homepageSearchInput = document.querySelector('input[placeholder="Ask EcoBrand"]') ||
        document.querySelector('.product-input') ||
        document.querySelector('input[type="text"]') ||
        document.querySelector('.search-input') ||
        document.querySelector('[data-search="input"]') ||
        document.querySelector('form input[type="text"]');

    const homepageSearchButton =
        document.getElementById('askButton') ||
        document.querySelector('.submit-button') ||
        document.querySelector('button[type="submit"]') ||
        document.querySelector('.search-btn') ||
        document.querySelector('[data-search="button"]') ||
        document.querySelector('form button') ||
        document.querySelector('.search-button');

    // Mode selector and chat area (for chatbot integration)
    const modeSelect = document.getElementById('modeSelect');
    const chatModeSelect = document.getElementById('modeSelectChat');
    const chatArea = document.getElementById('chat-area');

    // NEW: Suggestions Dropdown Element
    const suggestionsDropdown = document.getElementById('suggestionsDropdown');

    // Toggle chat area visibility based on selected mode (both dropdowns stay in sync)
    if (modeSelect || chatModeSelect) {
        const switchMode = (value) => {
            // source of truth: explicit value (from event) or whichever select exists
            const mode = value || modeSelect?.value || chatModeSelect?.value || 'search';
            const isChat = mode === 'chat';

            // keep both selectors in sync
            if (modeSelect) modeSelect.value = mode;
            if (chatModeSelect) chatModeSelect.value = mode;

            // SHOW/HIDE chat shell correctly
            if (chatShell) {
                chatShell.style.display = isChat ? 'block' : 'none';

                if (isChat) {
                    // Reset inner scroll to top and scroll page to chat header
                    const msgs = chatShell.querySelector('#chatMessages');
                    if (msgs) msgs.scrollTop = 0;

                    const header = chatShell.querySelector('.chat-header') || chatShell;
                    const y = header.getBoundingClientRect().top + window.pageYOffset - 80; // tweak offset if needed
                    window.scrollTo({ top: y, behavior: 'smooth' });
                }
            }

            // Hide search input when in chat; show when in search
            if (inputContainer) inputContainer.style.display = isChat ? 'none' : 'flex';
            if (disclaimerEl) disclaimerEl.style.display = isChat ? 'none' : 'block';

            // Delay focusing textarea slightly so browser doesn’t jump to bottom before scroll
            if (isChat && chatPrompt) setTimeout(() => chatPrompt.focus(), 150);

            // Hide suggestions when switching to chat mode
            if (isChat && suggestionsDropdown) suggestionsDropdown.style.display = 'none';

            // (Optional) When returning to search, bring user back to the main input
            if (!isChat && inputContainer) {
                const y2 = inputContainer.getBoundingClientRect().top + window.pageYOffset - 80;
                window.scrollTo({ top: y2, behavior: 'smooth' });
                const mainInput = homepageSearchInput || inputContainer.querySelector('input[type="text"]');
                if (mainInput) setTimeout(() => mainInput.focus(), 150);
            }
        };

        modeSelect?.addEventListener('change', (e) => switchMode(e.target.value));
        chatModeSelect?.addEventListener('change', (e) => switchMode(e.target.value));
        switchMode(); // run on load
    }

    // User-products page elements
    const breadcrumbProductElement = document.getElementById('breadcrumb-product');
    const productNameElement = document.getElementById('product-name');
    const productCategoryElement = document.getElementById('product-category');
    const analysisDateElement = document.getElementById('analysis-date');
    const productImageElement = document.getElementById('product-main-image');

    // --- Core User Authentication ---
    (async () => {
        try {
            const response = await fetch("/api/user-data");
            if (response.ok) {
                const data = await response.json();
                if (data.username) {
                    if (displayUserNameSpan)
                        displayUserNameSpan.textContent = data.username + "!";
                    if (topBarUserNameSpan)
                        topBarUserNameSpan.textContent = data.username;
                }
            } else if (response.status === 401) {
                console.warn('User not authenticated, redirecting to login.');
                window.location.href = "/login.html";
            } else {
                console.error('Failed to fetch user data:', response.status, response.statusText);
            }
        } catch (error) {
            console.error("Network error fetching user data:", error);
        }
    })();

    // --- Product History Management ---
    function renderProductList() {
        if (!productListEl || !noProductsMessageEl) return;

        const raw = JSON.parse(localStorage.getItem("Products")) || [];

        // Normalize everything to a string name (handles legacy objects)
        const toName = (item) => {
            if (typeof item === "string") return item;
            if (item && typeof item === "object") {
                return item.name || item.ProductName || item.query || "";
            }
            return "";
        };

        const normalized = raw
            .map(toName)
            .map((s) => (s ? String(s).trim() : ""))
            .filter(Boolean);

        // Dedupe (case-insensitive), keep order
        const seen = new Set();
        const products = [];
        for (const n of normalized) {
            const k = n.toLowerCase();
            if (!seen.has(k)) {
                seen.add(k);
                products.push(n);
            }
        }

        // Persist back as strings only (cleans old format)
        localStorage.setItem("Products", JSON.stringify(products));

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
                loadProductDetails(productName);
            });
            productListEl.appendChild(li);
        });
    }

    function addProductToHistory(productName) {
        if (!productName || !productName.trim()) return;

        const trimmedName = productName.trim();

        const raw = JSON.parse(localStorage.getItem("Products")) || [];
        const toName = (item) => {
            if (typeof item === "string") return item;
            if (item && typeof item === "object") {
                return item.name || item.ProductName || item.query || "";
            }
            return "";
        };

        // Normalize to strings
        let products = raw
            .map(toName)
            .map((s) => (s ? String(s).trim() : ""))
            .filter(Boolean);

        // Remove duplicate (case-insensitive)
        products = products.filter((p) => p.toLowerCase() !== trimmedName.toLowerCase());

        // Add to beginning and cap length
        products.unshift(trimmedName);
        products = products.slice(0, 5);

        // Store back as strings only
        localStorage.setItem("Products", JSON.stringify(products));

        renderProductList();
    }

    function loadProductDetails(productName) {
        if (!productName) return;
        window.location.href = `user-products.html?query=${encodeURIComponent(productName)}`;
    }
    function handleSearch(query) {
        if (!query || !query.trim()) {
            alert("Please enter a product name to search.");
            return;
        }
        const trimmedQuery = query.trim();
        addProductToHistory(trimmedQuery);
        // Navigate to search results page instead of directly to product page
        window.location.href = `search-results.html?query=${encodeURIComponent(trimmedQuery)}`;
    }

    function nowTime() {
        const d = new Date();
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    function appendMsg(role, text) {
        if (!chatMessages) return;
        const row = document.createElement('div');
        row.className = `msg ${role}`;
        row.innerHTML = `
    <div class="avatar">${role === 'user' ? '🧑' : '🤖'}</div>
    <div>
      <div class="bubble">${text}</div>
      <div class="meta"><span>${role === 'user' ? 'You' : 'EcoBrand'}</span><span>•</span><span>${nowTime()}</span></div>
    </div>`;
        chatMessages.appendChild(row);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    let typingEl = null;
    function showTyping() {
        if (!chatMessages) return;
        typingEl = document.createElement('div');
        typingEl.className = 'typing';
        typingEl.innerHTML = `<span>EcoBrand is typing</span><span class="dot1"></span><span class="dot2"></span><span class="dot3"></span>`;
        chatMessages.appendChild(typingEl);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    function hideTyping() {
        if (typingEl && typingEl.parentNode) typingEl.parentNode.removeChild(typingEl);
        typingEl = null;
    }

    // --- Chat handler ---
    async function handleChat(query) {
        // Ensure chat UI is visible and focused
        if (modeSelect && modeSelect.value !== 'chat') modeSelect.value = 'chat';
        if (chatShell) {
            chatShell.style.display = 'block';
            chatShell.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        const msgs = chatShell.querySelector('#chatMessages');
        if (msgs) msgs.scrollTop = 0;

        const header = chatShell.querySelector('.chat-header') || chatShell;
        const y = header.getBoundingClientRect().top + window.pageYOffset - 80;
        window.scrollTo({ top: y, behavior: 'smooth' });

        setTimeout(() => chatPrompt?.focus(), 150);

        if (inputContainer) inputContainer.style.display = 'none';
        if (disclaimerEl) disclaimerEl.style.display = 'none';

        const q = (query || '').trim();
        if (!q) {
            alert("Please enter a question.");
            return;
        }

        // Ensure chat UI is visible and focused (and keep both dropdowns in sync)
        if (modeSelect) modeSelect.value = 'chat';
        if (chatModeSelect) chatModeSelect.value = 'chat';
        // Note: The switchMode function is locally scoped above, we rely on the modeSelect value sync

        if (chatShell) {
            chatShell.style.display = 'block';
            chatShell.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        if (inputContainer) inputContainer.style.display = 'none';
        if (disclaimerEl) disclaimerEl.style.display = 'none';

        appendMsg('user', q);
        showTyping();

        try {
            const r = await fetch('/api/chatbot/ask', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: q })
            });
            const data = r.ok ? await r.json() : null;
            hideTyping();

            let reply = 'Sorry—my knowledge is limited to eco-friendly products, environmental health, and recyclability.';
            // Always prefer the server-provided reply if present, regardless of success flag
            if (data && data.reply) reply = data.reply;

            appendMsg('assistant', reply);
        } catch (err) {
            hideTyping();
            appendMsg('assistant', 'Error retrieving response.');
            console.error(err);
        }
    }

    // Send via button
    if (chatSend && chatPrompt) {
        chatSend.addEventListener('click', () => {
            const text = chatPrompt.value.trim();
            if (!text) return;
            chatPrompt.value = '';
            handleChat(text);
        });
        // Enter to send (Shift+Enter for newline)
        chatPrompt.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                const text = chatPrompt.value.trim();
                if (!text) return;
                chatPrompt.value = '';
                handleChat(text);
            }
        });
    }

    // =================================================================
    // --- NEW: Product Search Autocomplete (API Driven) ---
    // =================================================================

    /**
     * Fetches product suggestions from the backend API based on the user's query.
     * @param {string} query The text the user has typed.
     * @returns {Promise<string[]>} A promise that resolves to an array of product name strings.
     */
    async function getSuggestionsFromAPI(query) {
        const trimmedQuery = query.toLowerCase().trim();
        // Start suggestions only after a minimum of 2 characters
        if (trimmedQuery.length < 2) return [];

        try {
            // Tiyakin na ito ang tamang endpoint ninyo
            const response = await fetch(`/api/product-suggestions?query=${encodeURIComponent(trimmedQuery)}`);

            if (!response.ok) {
                console.error('API call failed with status:', response.status);
                return [];
            }

            const data = await response.json();

            // Asahan na ang API ay nagbabalik ng object na may 'suggestions' array ng strings
            if (data && Array.isArray(data.suggestions)) {
                // Limitahan ang resulta sa 5 para hindi masyadong mahaba ang dropdown
                return data.suggestions.slice(0, 5);
            }

            return [];
        } catch (error) {
            console.error("Error fetching product suggestions:", error);
            return [];
        }
    }

    // Function to render and display the suggestions dropdown
    async function renderSuggestions(query) {
        // Tiyakin na Search mode tayo at may element
        if (!suggestionsDropdown || modeSelect.value !== 'search') return;

        const suggestions = await getSuggestionsFromAPI(query);

        suggestionsDropdown.innerHTML = '';

        if (suggestions.length === 0 || !query.trim()) {
            suggestionsDropdown.style.display = 'none';
            return;
        }

        suggestions.forEach(suggestion => {
            const item = document.createElement('div');
            item.classList.add('suggestion-item');
            item.textContent = suggestion;

            // Kapag na-click, punan ang input at mag-search
            item.addEventListener('click', () => {
                homepageSearchInput.value = suggestion;
                suggestionsDropdown.style.display = 'none';
                handleSearch(suggestion); // Tumuloy sa product page
            });

            suggestionsDropdown.appendChild(item);
        });

        suggestionsDropdown.style.display = 'block';
    }

    // 1. Listener para sa pag-type sa main search input
    if (homepageSearchInput && modeSelect) {
        homepageSearchInput.addEventListener('input', () => {
            const query = homepageSearchInput.value;
            if (modeSelect.value === 'search') {
                renderSuggestions(query); // Tawagin ang function na magpe-fetch na
            } else {
                // Itago ang suggestions kung Chat mode
                if (suggestionsDropdown) suggestionsDropdown.style.display = 'none';
            }
        });
    }

    // 2. Itago ang dropdown kapag nag-click sa labas
    document.addEventListener('click', (e) => {
        if (suggestionsDropdown && homepageSearchInput) {
            const isOutside = !homepageSearchInput.contains(e.target) && !suggestionsDropdown.contains(e.target);
            if (isOutside) {
                suggestionsDropdown.style.display = 'none';
            }
        }
    });

    // =================================================================
    // --- Search Event Handlers ---
    // =================================================================

    // Homepage search functionality (Search Button Click)
    if (homepageSearchButton && homepageSearchInput) {
        homepageSearchButton.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();

            const query = homepageSearchInput.value.trim();
            if (!query) {
                alert("Please enter a product name or question.");
                homepageSearchInput.focus();
                return;
            }

            // Siguraduhin na nakatago ang suggestions
            if (suggestionsDropdown) suggestionsDropdown.style.display = 'none';

            const mode = modeSelect ? modeSelect.value : 'search';
            if (mode === 'chat') {
                handleChat(query);
            } else {
                if (chatArea) chatArea.style.display = 'none';
                handleSearch(query);
            }
        });

        // Enter key works the same
        homepageSearchInput.addEventListener('keypress', function (e) {
            if (e.key !== 'Enter') return;
            e.preventDefault();

            const query = homepageSearchInput.value.trim();
            if (!query) {
                alert("Please enter a product name or question.");
                homepageSearchInput.focus();
                return;
            }

            // Siguraduhin na nakatago ang suggestions
            if (suggestionsDropdown) suggestionsDropdown.style.display = 'none';

            const mode = modeSelect ? modeSelect.value : 'search';
            if (mode === 'chat') {
                handleChat(query);
            } else {
                if (chatArea) chatArea.style.display = 'none';
                handleSearch(query);
            }
        });
    }

    // Sidebar search form
    if (productSearchForm && productQueryInput) {
        productSearchForm.addEventListener("submit", (e) => {
            e.preventDefault();
            const query = productQueryInput.value.trim();
            console.log('Sidebar search form submitted, query:', query); // Debug log
            if (query) {
                handleSearch(query);
            } else {
                alert("Please enter a product name to search.");
                productQueryInput.focus();
            }
        });
    }

    // Handle data-page buttons
    const dataPageButton = document.querySelector('[data-page="user-products.html"]');
    if (dataPageButton) {
        dataPageButton.addEventListener('click', function (e) {
            e.preventDefault();
            const query = homepageSearchInput ? homepageSearchInput.value.trim() : '';
            console.log('Data-page button clicked, query:', query); // Debug log
            if (query) {
                const mode = modeSelect ? modeSelect.value : 'search';
                if (mode === 'chat') {
                    handleChat(query);
                } else {
                    if (chatArea) chatArea.style.display = 'none';
                    handleSearch(query);
                }
            } else {
                alert("Please enter a product name or question.");
                if (homepageSearchInput) homepageSearchInput.focus();
            }
        });
    }

    // Check for any form submissions that might be interfering
    document.addEventListener('submit', function (e) {
        console.log('Form submission detected:', e.target);
    });

    // --- Button Handlers ---
    if (newProductBtn) {
        newProductBtn.addEventListener("click", () => {
            window.location.href = "homepage.html";
        });
    }

    if (signOutBtn) {
        signOutBtn.addEventListener("click", () => {
            alert("Signed out");
            // Add your sign-out logic here
            // window.location.href = '/login.html';
        });
    }

    // --- User Products Page Integration ---

    // Function to display product data (for user-products page)
    function displayProduct(product) {
        if (!productNameElement) return; // Not on user-products page

        if (!product) {
            productNameElement.textContent = 'Product not found';
            if (productCategoryElement) productCategoryElement.textContent = 'No data available';
            if (analysisDateElement) analysisDateElement.textContent = '';
            if (breadcrumbProductElement) breadcrumbProductElement.textContent = 'Error';
            if (productImageElement) productImageElement.src = 'placeholder.jpg';
            return;
        }

        productNameElement.textContent = product.ProductName;
        if (productCategoryElement) productCategoryElement.textContent = product.Category;

        if (analysisDateElement) {
            const date = new Date(product.AnalysisDate);
            analysisDateElement.textContent = date.toLocaleDateString();
        }

        if (breadcrumbProductElement) breadcrumbProductElement.textContent = product.ProductName;
        if (productImageElement) {
            productImageElement.src = product.ProductImageURL || 'placeholder.jpg';
            productImageElement.alt = product.ProductName;
        }

        console.log('Successfully displayed product:', product.ProductName);
    }

    // Main function to load products (for user-products page)
    async function loadProducts() {
        if (!productNameElement) return; // Not on user-products page

        try {
            let response;
            const urlParams = new URLSearchParams(window.location.search);
            const query = urlParams.get('query');

            console.log('Query parameter:', query);

            if (query) {
                // Use search endpoint when there's a query
                console.log('Searching for:', query);
                response = await fetch(`/api/search-products?query=${encodeURIComponent(query)}`);

                // Add to history when loading from URL
                addProductToHistory(query);
            } else {
                // Default = get all products
                console.log('Getting all products');
                response = await fetch('/api/get-all-products');
            }

            if (!response.ok) throw new Error(`HTTP error: ${response.status}`);

            const data = await response.json();
            console.log('API response:', data);

            let products = [];
            if (data.success && Array.isArray(data.products)) {
                products = data.products;
            }

            if (products.length > 0) {
                // If search, use first result
                let productToDisplay = products[0];
                console.log('Displaying product:', productToDisplay.ProductName);
                displayProduct(productToDisplay);
            } else {
                console.log('No products found.');
                displayProduct(null);
            }
        } catch (err) {
            console.error('Error fetching products:', err);
            displayProduct(null);
        }
    }

    // --- Initialize Page ---

    // Handle URL query parameters
    const urlParams = new URLSearchParams(window.location.search);
    const queryParam = urlParams.get('query');
    if (queryParam) {
        if (productQueryInput) {
            productQueryInput.value = queryParam;
        }
        if (homepageSearchInput) {
            homepageSearchInput.value = queryParam;
        }
        // Ensure this search is in history
        addProductToHistory(queryParam);
    }

    // Load products if on user-products page
    if (productNameElement) {
        await loadProducts();
    }

    // Always render the product history list
    renderProductList();
});