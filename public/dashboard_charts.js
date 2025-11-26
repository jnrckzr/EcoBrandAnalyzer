let clusteringChart = null;

// --- Total Products count ---
async function loadTotalProducts() {
    try {
        const res = await fetch('/api/total-products');
        if (!res.ok) throw new Error('Network response was not ok');
        const data = await res.json();
        const totalElement = document.getElementById('kpi-total-products');
        if (totalElement) {
            totalElement.textContent = data.total ?? '--';
        }
        console.log('✅ Total products loaded:', data.total);
    } catch (error) {
        console.error('❌ Error fetching total products:', error);
    }
}

// --- Product Comparison (than last month) ---
async function loadProductComparison() {
    try {
        const response = await fetch('/api/total-products-comparison');
        if (!response.ok) throw new Error('Failed to fetch product comparison');
        
        // Assuming the API now returns the CORRECT percentage: { "difference": "91.00" }
        const data = await response.json();

        const comparisonElement = document.getElementById('products-comparison');
        
        // 1. I-parse ang difference bilang number
        let diff = parseFloat(data.difference);
        
        // Error check
        if (isNaN(diff)) {
            diff = 0;
        }

        // 2. CLAMPING: Limit the display value between -100 and 100
        const sign = Math.sign(diff); 
        const limitedAbsDiff = Math.min(100, Math.abs(diff));
        diff = limitedAbsDiff * sign; 
        
        // 3. Formatting
        const formattedDiff = diff.toFixed(1); // One decimal place (e.g., 91.0)
        
        if (comparisonElement) {
            // 4. Determine display text and sign
            const displaySign = diff >= 0 ? '+' : '';
            comparisonElement.textContent = `${displaySign}${formattedDiff}%`;
            
            // 5. Update classes/colors
            comparisonElement.classList.remove('positive', 'negative');
            
            if (diff > 0) {
                // E.g., +91.0%
                comparisonElement.classList.add('positive');
            } else if (diff < 0) {
                // E.g., -10.5%
                comparisonElement.classList.add('negative');
            }
            // If diff is 0, no color class is applied
        }
    } catch (error) {
        console.error('❌ Error fetching product comparison:', error);
        const comparisonElement = document.getElementById('products-comparison');
        if (comparisonElement) {
            comparisonElement.textContent = 'Err';
        }
    }
}

// --- Today's users count ---
async function loadTodaysUsers() {
    try {
        const res = await fetch('/api/today-users');
        if (!res.ok) throw new Error('Failed to fetch today users');
        const data = await res.json();
        const todayElement = document.getElementById('kpi-today-users');
        if (todayElement) {
            todayElement.textContent = data.todayUsers ?? '--';
        }
        console.log('✅ Today\'s users loaded:', data.todayUsers);
    } catch (error) {
        console.error('❌ Error fetching today\'s users:', error);
    }
}

// --- Load monthly user comparison (than last month) ---
async function loadUserComparison() {
    try {
        const res = await fetch('/api/users-comparison');
        if (!res.ok) throw new Error('Failed to fetch user comparison');
        const data = await res.json();

        const comparisonElement = document.getElementById('users-comparison');
        if (comparisonElement) {
            // 🎉 Dito ang pagbabago: Gumagamit na tayo ng 'percentChange'
            let percent = parseFloat(data.percentChange);

            // Naglalagay ng + sign at % sign
            comparisonElement.textContent = `${percent >= 0 ? '+' : ''}${percent}%`;

            // Dynamic color/class update
            if (percent >= 0) {
                comparisonElement.classList.remove('negative');
                comparisonElement.classList.add('positive');
            } else {
                comparisonElement.classList.remove('positive');
                comparisonElement.classList.add('negative');
            }
        }
        console.log('✅ User comparison loaded:', data.percentChange); // Updated console log
    } catch (error) {
        console.error('❌ Error fetching user login comparison:', error);
    }
}

// --- Product Clustering Chart (Bar) ---
async function loadProductClustering() {
    try {
        const response = await fetch('/api/product-clustering');
        if (!response.ok) throw new Error('Failed to fetch clustering data');
        const data = await response.json();

        const ctx = document.getElementById('clustering-chart');
        if (!ctx) return;

        // Destroy previous chart instance before creating a new one
        if (clusteringChart) {
            clusteringChart.destroy();
        }

        clusteringChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['High', 'Moderate', 'Low'],
                datasets: [{
                    data: [data.high, data.moderate, data.low],
                    backgroundColor: [
                        '#ee0707ff',
                        '#d4871bff',
                        '#00d084ff'
                    ],
                    borderColor: '#1f2937',
                    borderWidth: 1,
                    barThickness: 20
                }]
            },
            options: {
                indexAxis: 'y', // Horizontal bars
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#1f2937',
                        callbacks: {
                            label: (context) => `${context.parsed.x} products`
                        }
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        ticks: { color: '#9ca3af', font: { size: 10 } },
                        grid: { color: '#2a2a2a' }
                    },
                    y: {
                        ticks: { color: '#9ca3af', font: { size: 11 } },
                        grid: { display: false }
                    }
                }
            }
        });
        console.log('✅ Product Clustering Summary loaded and updated.');

    } catch (error) {
        console.error('❌ Error fetching product clustering:', error);
    }
}

// --- Emissions Trend Chart (Actual Data + Linear Regression) ---
async function createEmissionsTrendChart(canvasId) {
    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx) return console.warn(`Canvas with ID '${canvasId}' not found.`);

    try {
        const response = await fetch('/api/emissions-trend');
        if (!response.ok) {
            throw new Error(`Failed to fetch emissions trend data. Status: ${response.status}`);
        }
        const data = await response.json();

        const labels = data.labels;
        const historicalData = data.historicalData;
        const regressionData = data.regressionData;

        const maxVal = Math.max(...historicalData.map(Number), ...regressionData.map(Number));
        const suggestedMax = Math.ceil(Math.max(500, maxVal * 1.1) / 500) * 500;

        new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: '  Actual Emissions (kg)    ',
                        data: historicalData,
                        borderColor: '#FF5722',
                        backgroundColor: 'transparent',
                        borderWidth: 2,
                        tension: 0.4,
                        pointRadius: 3,
                        fill: false,
                        pointStyle: 'circle'
                    },
                    {
                        label: '  Linear Trend Prediction',
                        data: regressionData,
                        borderColor: '#00d084',
                        backgroundColor: 'transparent',
                        borderWidth: 2,
                        borderDash: [5, 5],
                        tension: 0.4,
                        pointRadius: 0,
                        fill: false,
                        pointStyle: 'line'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        suggestedMax: suggestedMax,
                        grid: { color: 'rgba(255, 255, 255, 0.1)' },
                        ticks: {
                            color: '#999999',
                            callback: (value) => `${value} kg`
                        },
                        title: { display: true, text: 'Emissions (kg)', color: '#999999' }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { color: '#999999' }
                    }
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'bottom',
                        labels: {
                            color: '#CCCCCC',
                            usePointStyle: true,
                            padding: 5 // Adjust this value. Default is 10.
                        }
                    },
                    tooltip: { mode: 'index', intersect: false }
                }
            }
        });
    } catch (error) {
        console.error('❌ Error loading emissions trend chart:', error);
    }
}

// Function to create Total Users Line Chart with REAL DATA
async function createUsersLineChart(canvasId) {
    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx) return console.warn(`Canvas with ID '${canvasId}' not found.`);

    try {
        const response = await fetch('/api/users-monthly');
        const data = await response.json();
        const labels = data?.labels ?? ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const values = data?.data ?? [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

        new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Number of users per month',
                    data: values,
                    borderColor: '#00d084',
                    backgroundColor: '#00d08430',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 5,
                    pointBackgroundColor: '#00d084',
                    pointBorderColor: '#1f2937',
                    pointBorderWidth: 2,
                    pointHoverRadius: 7,
                    pointHoverBackgroundColor: '#00d084',
                    pointHoverBorderColor: '#fff',
                    pointHoverBorderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(255, 255, 255, 0.1)' },
                        ticks: {
                            color: '#999999',
                            stepSize: 1,
                            callback: (value) => Number.isInteger(value) ? value : ''
                        }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { color: '#999999' }
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        padding: 12,
                        displayColors: false,
                        callbacks: {
                            label: (context) => `Users: ${context.parsed.y}`
                        }
                    }
                },
                interaction: {
                    intersect: false,
                    mode: 'index'
                }
            }
        });
        console.log('✅ Users line chart loaded successfully with real data');
    } catch (error) {
        console.error('❌ Error loading users line chart:', error);
    }
}

// Function to create a dynamic bar chart (for New Products)
async function createBarChart(canvasId, label, color) {
    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx) return console.warn(`Canvas with ID '${canvasId}' not found.`);

    try {
        const response = await fetch('/api/new-products-week');
        const data = await response.json();
        const labels = data?.days ?? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        const values = data?.data ?? [0, 0, 0, 0, 0, 0, 0];

        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: label,
                    data: values,
                    backgroundColor: color,
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(255, 255, 255, 0.1)' },
                        ticks: {
                            color: '#999999',
                            stepSize: 1,
                            callback: (value) => Number.isInteger(value) ? value : ''
                        },
                        title: { display: true, text: 'Number of Products' }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { color: '#999999' },
                        title: { display: true, text: 'Days of the Week' }
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: { mode: 'index', intersect: false }
                }
            }
        });
        console.log('✅ Weekly products chart loaded successfully');
    } catch (error) {
        console.error('❌ Error loading weekly products chart:', error);
    }
}

// Function to fetch Total Emissions KPI
async function loadTotalEmissions() {
    try {
        // 1. Fetch data from the new API endpoint
        const response = await fetch('/api/totalEmissions');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        // Ensure data is successfully retrieved
        if (data.success) {
            const totalEmissions = data.totalEmissions;

            // 2. Format the number (e.g., to 2 decimal places and add commas)
            // Use Intl.NumberFormat for clean formatting
            const formattedEmissions = new Intl.NumberFormat('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }).format(totalEmissions);

            // 3. Update the HTML element (assuming this is the ID)
            const emissionElement = document.getElementById('kpi-total-emissions');
            if (emissionElement) {
                emissionElement.textContent = `${formattedEmissions} `;
            } else {
                console.error("KPI element with ID 'kpi-total-emissions' not found.");
            }
        }
    } catch (error) {
        console.error('Error fetching total emissions:', error);
        // Display an error message if fetching fails
        const emissionElement = document.getElementById('kpi-total-emissions');
        if (emissionElement) {
            emissionElement.textContent = 'Data Error';
        }
    }
}

// Function to update the subtitle of the Emissions Graph and apply color classes
function updateGraphSubtitle(percent) {
    // We are targeting the parent <p> element for coloring the whole text
    const parentP = document.querySelector('#emissions-increase-text')?.parentElement;

    if (parentP) {
        const absPercent = Math.abs(percent).toFixed(2);

        // 1. Update the HTML content to include the correct word (Increase/Decrease)
        parentP.innerHTML = `<span id="emissions-increase-text">${absPercent}%</span> ${percent >= 0 ? 'Increase' : 'Decrease'} in today's emissions.`;

        // 2. Apply the color class logic
        parentP.classList.remove('text-positive', 'text-negative');

        if (percent > 0) {
            // Apply green for a positive change (Increase)
            parentP.classList.add('text-positive');
        } else if (percent < 0) {
            // Apply red/orange for a negative change (Decrease)
            parentP.classList.add('text-negative');
        }
        // If percent is 0, no color class is applied
    } else {
        console.error("Graph subtitle element (parent of emissions-increase-text) not found.");
    }
}

// Function to fetch all comparison data and call the update handlers
async function loadEmissionsComparison() {
    try {
        const res = await fetch('/api/emissions-comparison');
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        const data = await res.json();

        if (data.success) {
            const percent = parseFloat(data.percentChange);

            // 1. Update the Emissions Graph subtitle (This is where the color is applied)
            updateGraphSubtitle(percent);

            // 2. Update the KPI card (-- % than Yesterday)
            const kpiElement = document.getElementById('emissions-comparison');
            if (kpiElement) {
                kpiElement.textContent = `${percent >= 0 ? '+' : ''}${percent.toFixed(2)}%`;

                // Optional: Apply the same color logic to the KPI card text if it exists
                kpiElement.classList.remove('positive', 'negative');
                if (percent > 0) {
                    kpiElement.classList.add('positive');
                } else if (percent < 0) {
                    kpiElement.classList.add('negative');
                }
            }
        }
    } catch (error) {
        console.error('❌ Error fetching emissions comparison:', error);

        // Display error in the graph subtitle
        const subtitleSpan = document.getElementById('emissions-increase-text');
        if (subtitleSpan) subtitleSpan.textContent = '[Err]%';

        // Display error in the KPI card
        const kpiElement = document.getElementById('emissions-comparison');
        if (kpiElement) kpiElement.textContent = 'Error';
    }
}

// ==================== LINEAR REGRESSION CHARTS ====================

/**
 * Eco Score Trend Chart with Linear Regression
 */
async function createEcoScoreTrendChart(canvasId) {
    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx) return console.warn(`Canvas with ID '${canvasId}' not found.`);

    try {
        const response = await fetch('/api/eco-score-trend');
        if (!response.ok) throw new Error('Failed to fetch eco score trend');
        const data = await response.json();

        const labels = data.labels;
        const historicalData = data.historicalData;
        const regressionData = data.regressionData;

        new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: '  Actual Avg Eco Score',
                        data: historicalData,
                        borderColor: '#00d084',
                        backgroundColor: 'transparent',
                        borderWidth: 2,
                        tension: 0.4,
                        pointRadius: 4,
                        fill: false
                    },
                    {
                        label: '  Predicted Trend',
                        data: regressionData,
                        borderColor: '#FFA500',
                        backgroundColor: 'transparent',
                        borderWidth: 2,
                        borderDash: [5, 5],
                        tension: 0.4,
                        pointRadius: 0,
                        fill: false
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        grid: { color: 'rgba(255, 255, 255, 0.1)' },
                        ticks: {
                            color: '#999999',
                            callback: (value) => `${value}`
                        },
                        title: { display: true, text: 'Eco Score', color: '#999999' }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { color: '#999999' }
                    }
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'bottom',
                        labels: { color: '#CCCCCC', usePointStyle: true, padding: 5 }
                    },
                    tooltip: { mode: 'index', intersect: false }
                }
            }
        });

        // Update trend information
        document.getElementById('eco-trend-direction').textContent =
            `Trend: ${data.trendDirection.toUpperCase()}`;
        document.getElementById('eco-avg-score').textContent = data.avgScore;

        console.log('✅ Eco Score Trend chart loaded');
    } catch (error) {
        console.error('❌ Error loading eco score trend chart:', error);
    }
}

/**
 * Carbon vs Eco Score Correlation Scatter Plot
 */
async function createCarbonEcoCorrelationChart(canvasId) {
    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx) return console.warn(`Canvas with ID '${canvasId}' not found.`);

    try {
        const response = await fetch('/api/carbon-eco-correlation');
        if (!response.ok) throw new Error('Failed to fetch correlation data');
        const data = await response.json();

        const scatterData = data.scatterData || [];

        new Chart(ctx, {
            type: 'scatter',
            data: {
                datasets: [{
                    label: 'Products',
                    data: scatterData,
                    backgroundColor: 'rgba(0, 208, 132, 0.6)',
                    borderColor: '#00d084',
                    borderWidth: 1,
                    pointRadius: 5,
                    pointHoverRadius: 7
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        type: 'linear',
                        position: 'bottom',
                        title: { display: true, text: 'Carbon Footprint (kg)', color: '#999999' },
                        grid: { color: 'rgba(255, 255, 255, 0.1)' },
                        ticks: { color: '#999999' }
                    },
                    y: {
                        title: { display: true, text: 'Eco Score', color: '#999999' },
                        grid: { color: 'rgba(255, 255, 255, 0.1)' },
                        ticks: { color: '#999999' },
                        min: 0,
                        max: 100
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                const point = context.raw;
                                return `${point.label}: Carbon ${point.x}kg, Eco ${point.y}`;
                            }
                        }
                    }
                }
            }
        });

        // Update correlation info
        document.getElementById('correlation-strength').textContent =
            `${data.strength.toUpperCase()}`;
        document.getElementById('correlation-value').textContent = data.correlation;

        console.log('✅ Carbon-Eco correlation chart loaded');
    } catch (error) {
        console.error('❌ Error loading correlation chart:', error);
    }
}

/**
 * User Search Eco-Consciousness Trend
 */
async function createSearchEcoTrendChart(canvasId) {
    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx) return console.warn(`Canvas with ID '${canvasId}' not found.`);

    try {
        const response = await fetch('/api/search-eco-trend');
        if (!response.ok) throw new Error('Failed to fetch search eco trend');
        const data = await response.json();

        new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.labels || [],
                datasets: [{
                    label: 'Avg Eco Score of Searches',
                    data: data.scores || [],
                    borderColor: '#4CAF50',
                    backgroundColor: 'rgba(76, 175, 80, 0.2)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 3,
                    pointBackgroundColor: '#4CAF50'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        grid: { color: 'rgba(255, 255, 255, 0.1)' },
                        ticks: { color: '#999999' },
                        title: { display: true, text: 'Eco Score', color: '#999999' }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { color: '#999999', maxRotation: 45 }
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: { mode: 'index', intersect: false }
                }
            }
        });

        // Update trend info
        document.getElementById('search-trend').textContent =
            `Users are ${data.trend} (Avg: ${data.avgScore})`;

        console.log('✅ Search eco trend chart loaded');
    } catch (error) {
        console.error('❌ Error loading search eco trend chart:', error);
    }
}

// ==================== K-MEANS CLUSTERING CHARTS ====================

/**
 * Product Sustainability Clusters Chart
 */
async function createSustainabilityClusterChart(canvasId) {
    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx) return console.warn(`Canvas with ID '${canvasId}' not found.`);

    try {
        const response = await fetch('/api/product-sustainability-clusters');
        if (!response.ok) throw new Error('Failed to fetch sustainability clusters');
        const data = await response.json();

        if (data.clusters && data.clusters.length > 0) {
            const labels = data.clusters.map(c => c.label);
            const counts = data.clusters.map(c => c.count);
            const ecoScores = data.clusters.map(c => parseFloat(c.avgEcoScore));

            new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Product Count',
                        data: counts,
                        backgroundColor: ['#00d084', '#4CAF50', '#FFA500', '#FF5722'],
                        borderRadius: 5
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true,
                            grid: { color: 'rgba(255, 255, 255, 0.1)' },
                            ticks: {
                                color: '#999999',
                                stepSize: 1,
                                callback: (value) => Number.isInteger(value) ? value : ''
                            }
                        },
                        x: {
                            grid: { display: false },
                            ticks: { color: '#999999', maxRotation: 20 }
                        }
                    },
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                afterLabel: (context) => {
                                    const index = context.dataIndex;
                                    return `Avg Eco Score: ${ecoScores[index]}`;
                                }
                            }
                        }
                    }
                }
            });

            // Update cluster details
            const detailsHtml = data.clusters.map(c =>
                `<div style="margin: 5px 0;">
                    <strong>${c.label}:</strong> ${c.count} products 
                    (Eco: ${c.avgEcoScore}, Carbon: ${c.avgCarbonFootprint}kg)
                </div>`
            ).join('');
            document.getElementById('cluster-details').innerHTML = detailsHtml;
        }

        console.log('✅ Sustainability cluster chart loaded');
    } catch (error) {
        console.error('❌ Error loading sustainability cluster chart:', error);
    }
}

/**
 * User Eco-Awareness Clusters Chart
 */
async function createUserClusterChart(canvasId) {
    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx) return console.warn(`Canvas with ID '${canvasId}' not found.`);

    try {
        const response = await fetch('/api/user-search-clusters');
        if (!response.ok) throw new Error('Failed to fetch user clusters');
        const data = await response.json();

        if (data.clusters && data.clusters.length > 0) {
            const labels = data.clusters.map(c => c.label);
            const percentages = data.clusters.map(c => parseFloat(c.percentage));

            new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: labels,
                    datasets: [{
                        data: percentages,
                        backgroundColor: ['#00d084', '#FFA500', '#FF5722'],
                        borderColor: '#1f2937',
                        borderWidth: 2
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: { color: '#CCCCCC', padding: 10 }
                        },
                        tooltip: {
                            callbacks: {
                                label: (context) => {
                                    const index = context.dataIndex;
                                    const cluster = data.clusters[index];
                                    return `${cluster.label}: ${cluster.percentage}% (${cluster.count} users)`;
                                }
                            }
                        }
                    }
                }
            });

            // Update user cluster details
            const detailsHtml = data.clusters.map(c =>
                `<div style="margin: 5px 0;">
                    <strong>${c.label}:</strong> ${c.count} users (${c.percentage}%)
                    <br><small>${c.description}</small>
                </div>`
            ).join('');
            document.getElementById('user-cluster-details').innerHTML = detailsHtml;
        }

        console.log('✅ User cluster chart loaded');
    } catch (error) {
        console.error('❌ Error loading user cluster chart:', error);
    }
}

// Initialize charts and KPIs when DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('📄 Initializing dashboard data...');

    // ... KPI Calls
    loadTotalProducts();
    loadProductComparison();
    loadTodaysUsers();
    loadUserComparison();
    loadProductClustering();
    loadTotalEmissions();

    // CONSOLIDATED COMPARISON CALL
    loadEmissionsComparison();

    // Original Chart Generators
    createBarChart('newProductsChart', 'Products Added', '#00d084');
    createEmissionsTrendChart('emissionsChart');
    createUsersLineChart('usersChart');

    // ===== NEW: Advanced Analytics Charts (only on Insights page) =====
    if (
        document.getElementById('ecoScoreTrendChart') ||
        document.getElementById('sustainabilityClusterChart') ||
        document.getElementById('userClusterChart') ||
        document.getElementById('carbonEcoCorrelationChart') ||
        document.getElementById('searchEcoTrendChart')
    ) {
        console.log('📊 Loading advanced analytics...');
        createEcoScoreTrendChart('ecoScoreTrendChart');
        createCarbonEcoCorrelationChart('carbonEcoCorrelationChart');
        createSearchEcoTrendChart('searchEcoTrendChart');
        createSustainabilityClusterChart('sustainabilityClusterChart');
        createUserClusterChart('userClusterChart');
    }

    console.log('✅ All dashboard data and charts initialized');
});