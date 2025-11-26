document.addEventListener("DOMContentLoaded", async () => {
    // --- API Configuration ---
    const API_URL = '/api/categories/data'; 

    // Reduced refresh interval to 3 seconds for better real-time feel
    const REFRESH_INTERVAL_MS = 3000; // 3 seconds

    // --- Element Selectors (Low Impact) ---
    const lowImpactContainer = {
        key: 'low', 
        body: document.getElementById("productTableBody"),
        search: document.getElementById("searchInput"),
        entries: document.getElementById("entriesPerPage"),
        pagination: document.querySelector(".dashboard-container .pagination-container"),
        originalData: [], 
        products: [], 
        currentPage: 1,
        entriesPerPage: 5,
    };

    // --- Element Selectors (Moderate Impact) ---
    const moderateImpactContainer = {
        key: 'moderate', 
        body: document.getElementById("MproductTableBody"),
        search: document.getElementById("moderatesearchInput"),
        entries: document.getElementById("moderateentriesPerPage"),
        pagination: document.querySelector(".moderate-dashboard-container .mpagination-container"),
        originalData: [],
        products: [],
        currentPage: 1,
        entriesPerPage: 5,
    };

    // --- Element Selectors (High Impact) ---
    const highImpactContainer = {
        key: 'high', 
        body: document.getElementById("hproductTableBody"),
        search: document.getElementById("highsearchInput"),
        entries: document.getElementById("highentriesPerPage"),
        pagination: document.querySelector(".high-dashboard-container .hpagination-container"),
        originalData: [],
        products: [],
        currentPage: 1,
        entriesPerPage: 5,
    };

    const allContainers = [lowImpactContainer, moderateImpactContainer, highImpactContainer];

    // Track last product count for each category
    let lastProductCounts = {
        low: 0,
        moderate: 0,
        high: 0
    };

    // --- Helper Functions ---

    function createProductRow(product) {
        const tr = document.createElement('tr');
        const productName = product.ProductName || 'N/A';
        const category = product.Category || 'N/A';
        const ecoScore = parseInt(product.eco_score) || 0;
        const impact = product.environmental_impact || 'N/A';
        const sustainabilityLevel = product.sustainability_level || 'N/A';
        const analysisDate = product.AnalysisDate ? new Date(product.AnalysisDate).toLocaleDateString() : 'N/A';
        const imageUrl = product.ProductImageURL || 'https://placehold.co/30x30/4f46e5/ffffff?text=P'; 
        
        tr.addEventListener('click', () => {
             window.location.href = `user-products.html?query=${encodeURIComponent(productName)}`; 
        });

// Add this CSS to categories.css for the notification:
/*
.new-product-notification {
    position: fixed;
    top: 20px;
    right: 20px;
    background: linear-gradient(135deg, #00d084, #39d185);
    color: white;
    padding: 15px 25px;
    border-radius: 10px;
    box-shadow: 0 4px 15px rgba(0, 208, 132, 0.4);
    display: flex;
    align-items: center;
    gap: 10px;
    font-weight: 500;
    z-index: 9999;
    opacity: 0;
    transform: translateX(400px);
    transition: all 0.3s ease-out;
}

.new-product-notification.show {
    opacity: 1;
    transform: translateX(0);
}

.new-product-notification i {
    font-size: 20px;
}
*/
        
        const impactClass = impact.toLowerCase().replace(/\s+/g, '-'); 

        tr.innerHTML = `
            <td>
                <div class="product-info-cell">
                    <img src="${imageUrl}" alt="${productName}" class="product-img">
                    <span class="product-name-text">${productName}</span>
                </div>
            </td>
            <td>${category}</td>
            <td>${analysisDate}</td>
            <td><span class="impact-badge ${impactClass}">${impact}</span></td>
            <td>${sustainabilityLevel}</td>
            <td class="score-cell"><span class="score-badge score-${impactClass}">${ecoScore}</span></td>
        `;
        return tr;
    }
    
    function renderTable(container) {
        if (!container.body) return;

        const { products, currentPage, entriesPerPage, body } = container;
        const startIndex = (currentPage - 1) * entriesPerPage;
        const endIndex = startIndex + entriesPerPage;
        const productsToDisplay = products.slice(startIndex, endIndex);

        body.innerHTML = ''; 

        if (productsToDisplay.length === 0) {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td colspan="6" style="text-align: center; padding: 20px;">No products found in this category.</td>`;
            body.appendChild(tr);
            renderPagination(container); 
            return;
        }

        productsToDisplay.forEach(p => {
            body.appendChild(createProductRow(p));
        });

        renderPagination(container);
    }

    function createPaginationButton(text, targetPage, isDisabled) {
        const btn = document.createElement('button');
        btn.className = 'pagination-btn';
        btn.innerHTML = text;
        if (isDisabled || targetPage <= 0) {
            btn.disabled = true;
            btn.classList.add('disabled');
        }
        return btn;
    }

    function renderPagination(container) {
        const { products, pagination, currentPage, entriesPerPage } = container;
        if (!pagination) return;

        const totalPages = Math.ceil(products.length / entriesPerPage);
        const newPagination = document.createElement('div');
        newPagination.className = `${container.key}-pagination-container pagination-container`; 
        
        const firstBtn = createPaginationButton('<<', 1, currentPage === 1 || totalPages <= 1);
        firstBtn.addEventListener('click', () => {
            if (container.currentPage !== 1) {
                container.currentPage = 1;
                renderTable(container);
            }
        });
        newPagination.appendChild(firstBtn);

        const prevBtn = createPaginationButton('<', currentPage - 1, currentPage === 1 || totalPages <= 1);
        prevBtn.addEventListener('click', () => {
            if (container.currentPage > 1) {
                container.currentPage--;
                renderTable(container);
            }
        });
        newPagination.appendChild(prevBtn);

        const pageSpan = document.createElement('span');
        pageSpan.className = 'page-number';
        pageSpan.textContent = totalPages > 0 ? `${currentPage} / ${totalPages}` : '0 / 0';
        newPagination.appendChild(pageSpan);

        const nextBtn = createPaginationButton('>', currentPage + 1, currentPage === totalPages || totalPages <= 1);
        nextBtn.addEventListener('click', () => {
            if (container.currentPage < totalPages) {
                container.currentPage++;
                renderTable(container);
            }
        });
        newPagination.appendChild(nextBtn);

        const lastBtn = createPaginationButton('>>', totalPages, currentPage === totalPages || totalPages <= 1);
        lastBtn.addEventListener('click', () => {
            if (container.currentPage !== totalPages) {
                container.currentPage = totalPages;
                renderTable(container);
            }
        });
        newPagination.appendChild(lastBtn);
        
        const oldPagination = document.querySelector(`.${container.key}-dashboard-container .pagination-container`);
        if (oldPagination) {
            oldPagination.parentNode.replaceChild(newPagination, oldPagination);
        } else if (container.pagination) {
             container.pagination.parentNode.replaceChild(newPagination, container.pagination);
        }
        container.pagination = newPagination; 
    }

    function handleSearch(container) {
        if (!container.search || !container.originalData) return;

        const query = container.search.value.toLowerCase().trim();
        
        if (query) {
            container.products = container.originalData.filter(p => {
                const productName = p.ProductName ? p.ProductName.toLowerCase() : '';
                const category = p.Category ? p.Category.toLowerCase() : '';
                return productName.includes(query) || category.includes(query);
            });
        } else {
            container.products = [...container.originalData];
        }

        container.currentPage = 1; 
        renderTable(container);
    }

    function setupEventListeners(container) {
        container.entries?.addEventListener('change', (e) => {
            container.entriesPerPage = parseInt(e.target.value);
            container.currentPage = 1;
            renderTable(container);
        });

        if (container.search) {
             container.search.addEventListener('input', () => {
                handleSearch(container);
            });
        }
    }

    function reapplySearchFilter(container) {
         if (!container.search || !container.originalData) return;

        const query = container.search.value.toLowerCase().trim();
        
        if (query) {
             container.products = container.originalData.filter(p => {
                const productName = p.ProductName ? p.ProductName.toLowerCase() : '';
                const category = p.Category ? p.Category.toLowerCase() : '';
                return productName.includes(query) || category.includes(query);
            });
        } else {
             container.products = [...container.originalData];
        }
        renderTable(container);
    }

    // --- NEW: Visual notification for new products ---
    function showNewProductNotification(categoryName, count) {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = 'new-product-notification';
        notification.innerHTML = `
            <i class="fa fa-check-circle"></i>
            <span>${count} new product${count > 1 ? 's' : ''} added to ${categoryName} Impact</span>
        `;
        
        // Add to body
        document.body.appendChild(notification);
        
        // Trigger animation
        setTimeout(() => notification.classList.add('show'), 100);
        
        // Remove after 3 seconds
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    // --- Main Data Fetching with Enhanced Real-time Detection ---

    async function loadCategorizedProducts() {
        try {
            // Use cache-busting URL to prevent stale data
            const uniqueApiUrl = `${API_URL}?t=${new Date().getTime()}`;
            const response = await fetch(uniqueApiUrl, {
                method: 'GET',
                headers: {
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache',
                    'Expires': '0'
                }
            }); 
            
            if (!response.ok) {
                const errorBody = await response.json().catch(() => ({ message: 'Unknown error.' }));
                throw new Error(`Server error! Status: ${response.status}. Message: ${errorBody.message || 'Server returned error status.'}`);
            }

            const data = await response.json(); 

            allContainers.forEach(container => {
                const fetchedProducts = data[container.key] || [];
                
                // Track if this is first load
                const isFirstLoad = container.originalData.length === 0;
                
                // Detect changes
                const originalDataLength = container.originalData.length;
                const fetchedDataLength = fetchedProducts.length;
                const productCountChanged = originalDataLength !== fetchedDataLength;
                
                // Check if new products were added (not just removed)
                const newProductsAdded = fetchedDataLength > originalDataLength;
                const newProductCount = fetchedDataLength - originalDataLength;
                
                // Check content changes
                const productsJson = JSON.stringify(container.products.map(p => p.ProductName).sort());
                const fetchedJson = JSON.stringify(fetchedProducts.map(p => p.ProductName).sort());
                const productContentChanged = productsJson !== fetchedJson;

                // Update originalData
                container.originalData = fetchedProducts;

                // Determine if UI update is needed
                const isSearching = container.search && container.search.value.trim() !== '';

                if (isSearching) {
                    // Scenario A: Active search - re-apply filter
                    reapplySearchFilter(container); 
                } else if (productCountChanged) {
                    // Scenario B: Count changed - update and reset to page 1
                    container.products = [...fetchedProducts]; 
                    container.currentPage = 1; 
                    renderTable(container);
                    
                    // Show notification only if new products were added (and not first load)
                    if (newProductsAdded && !isFirstLoad) {
                        const categoryDisplayName = container.key.charAt(0).toUpperCase() + container.key.slice(1);
                        showNewProductNotification(categoryDisplayName, newProductCount);
                        console.log(`✨ ${newProductCount} new product(s) added to ${categoryDisplayName} Impact category`);
                    }
                } else if (productContentChanged) {
                    // Scenario C: Content changed (edit) - update without notification
                    container.products = [...fetchedProducts];
                    renderTable(container);
                }

                // Update last count tracker
                lastProductCounts[container.key] = fetchedDataLength;
            });

        } catch (error) {
            console.error("❌ Error fetching categorized products:", error);
            allContainers.forEach(c => {
                if (c.body) {
                    c.body.innerHTML = `<td colspan="6" style="text-align: center; color: red; padding: 20px;">Error loading data: ${error.message}. Please check server connection.</td>`;
                }
            });
        }
    }

    // --- Initialization ---

    // 1. Initial Data Load
    console.log('🔄 Loading initial product data...');
    await loadCategorizedProducts(); 

    // 2. Setup Event Listeners
    allContainers.forEach(container => {
        setupEventListeners(container);
    });
    
    // 3. Start Auto-Refresh
    console.log(`✅ Auto-refresh enabled: Checking for updates every ${REFRESH_INTERVAL_MS / 1000} seconds`);
    setInterval(loadCategorizedProducts, REFRESH_INTERVAL_MS);

    // 4. Add visibility change listener to refresh when tab becomes active
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            console.log('👁️ Tab became visible, refreshing data...');
            loadCategorizedProducts();
        }
    });
});