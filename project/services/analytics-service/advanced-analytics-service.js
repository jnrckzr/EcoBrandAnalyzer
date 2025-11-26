import { getDb } from "../../shared/db.js";

export const advancedAnalyticsService = {
    
    // ==================== LINEAR REGRESSION ====================
    
    /**
     * Eco Score Trend Analysis with Linear Regression
     * Predicts future average eco scores based on product creation timeline
     */
    async getEcoScoreTrend() {
        const db = getDb();
        const currentYear = new Date().getFullYear();
        const currentMonth = new Date().getMonth() + 1;

        // Get monthly average eco scores
        const monthlyData = await db.collection('products').aggregate([
            { 
                $match: { 
                    created_at: { $exists: true },
                    eco_score: { $exists: true, $ne: null }
                } 
            },
            {
                $group: {
                    _id: { 
                        year: { $year: "$created_at" }, 
                        month: { $month: "$created_at" } 
                    },
                    avgEcoScore: { $avg: "$eco_score" },
                    count: { $sum: 1 }
                }
            },
            { $sort: { "_id.year": 1, "_id.month": 1 } }
        ]).toArray();

        const labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        let historicalScores = [];
        let dataPoints = [];

        for (let month = 1; month <= 12; month++) {
            const dataPoint = monthlyData.find(d =>
                d._id.year === currentYear && d._id.month === month
            );
            const score = dataPoint ? dataPoint.avgEcoScore : 0;
            historicalScores.push(score.toFixed(1));
            
            if (month <= currentMonth && score > 0) {
                dataPoints.push({ x: month - 1, y: score });
            }
        }

        // Calculate linear regression
        let sumX = 0, sumY = 0, sumXX = 0, sumXY = 0;
        const n = dataPoints.length;

        dataPoints.forEach(p => {
            sumX += p.x;
            sumY += p.y;
            sumXX += p.x * p.x;
            sumXY += p.x * p.y;
        });

        const m = n > 1 ? (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX) : 0;
        const b = n > 0 ? (sumY - m * sumX) / n : 0;

        let regressionData = [];
        for (let x = 0; x < 12; x++) {
            let y_pred = m * x + b;
            regressionData.push(Math.max(0, Math.min(100, y_pred.toFixed(1))));
        }

        // Calculate trend direction
        const trendDirection = m > 0.5 ? 'improving' : m < -0.5 ? 'declining' : 'stable';
        const avgScore = n > 0 ? (sumY / n).toFixed(1) : 0;

        return { 
            labels, 
            historicalData: historicalScores, 
            regressionData,
            trendDirection,
            avgScore,
            slope: m.toFixed(3)
        };
    },

    /**
     * Carbon Footprint vs Eco Score Correlation
     * Shows relationship between carbon emissions and eco ratings
     */
    async getCarbonEcoCorrelation() {
        const db = getDb();
        
        const products = await db.collection('products').find({
            carbon_footprint: { $exists: true, $ne: null },
            eco_score: { $exists: true, $ne: null }
        }).toArray();

        let scatterData = products.map(p => ({
            x: parseFloat(p.carbon_footprint) || 0,
            y: p.eco_score || 0,
            label: p.ProductName
        })).filter(d => d.x > 0 && d.y > 0);

        // Calculate correlation coefficient
        if (scatterData.length < 2) {
            return { scatterData: [], correlation: 0, strength: 'insufficient data' };
        }

        const n = scatterData.length;
        const sumX = scatterData.reduce((sum, d) => sum + d.x, 0);
        const sumY = scatterData.reduce((sum, d) => sum + d.y, 0);
        const sumXY = scatterData.reduce((sum, d) => sum + (d.x * d.y), 0);
        const sumXX = scatterData.reduce((sum, d) => sum + (d.x * d.x), 0);
        const sumYY = scatterData.reduce((sum, d) => sum + (d.y * d.y), 0);

        const correlation = (n * sumXY - sumX * sumY) / 
            Math.sqrt((n * sumXX - sumX * sumX) * (n * sumYY - sumY * sumY));

        const absCorr = Math.abs(correlation);
        const strength = absCorr > 0.7 ? 'strong' : absCorr > 0.4 ? 'moderate' : 'weak';

        return {
            scatterData: scatterData.slice(0, 100), // Limit to 100 points for performance
            correlation: correlation.toFixed(3),
            strength,
            totalProducts: n
        };
    },

    /**
     * Search Pattern Eco Score Analysis
     * Tracks what eco scores users are searching for over time
     */
    async getSearchEcoTrend() {
        const db = getDb();
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const dailySearches = await db.collection('searches').aggregate([
            { 
                $match: { 
                    created_at: { $gte: thirtyDaysAgo },
                    eco_score: { $exists: true, $ne: null }
                } 
            },
            {
                $group: {
                    _id: {
                        $dateToString: { format: "%Y-%m-%d", date: "$created_at" }
                    },
                    avgEcoScore: { $avg: "$eco_score" },
                    searchCount: { $sum: 1 }
                }
            },
            { $sort: { "_id": 1 } }
        ]).toArray();

        const labels = dailySearches.map(d => {
            const date = new Date(d._id);
            return `${date.getMonth() + 1}/${date.getDate()}`;
        });
        const scores = dailySearches.map(d => d.avgEcoScore.toFixed(1));
        const counts = dailySearches.map(d => d.searchCount);

        // Calculate if users are becoming more eco-conscious
        const firstWeekAvg = scores.slice(0, 7).reduce((a, b) => parseFloat(a) + parseFloat(b), 0) / Math.min(7, scores.length);
        const lastWeekAvg = scores.slice(-7).reduce((a, b) => parseFloat(a) + parseFloat(b), 0) / Math.min(7, scores.length);
        const trend = lastWeekAvg > firstWeekAvg ? 'more eco-conscious' : 'less eco-conscious';

        return {
            labels,
            scores,
            counts,
            trend,
            avgScore: (scores.reduce((a, b) => parseFloat(a) + parseFloat(b), 0) / scores.length).toFixed(1)
        };
    },

    // ==================== K-MEANS CLUSTERING ====================

    /**
     * Product Sustainability Clustering (K-Means)
     * Groups products by carbon, water, energy, and eco_score
     */
    async getProductSustainabilityClusters() {
        const db = getDb();
        
        const products = await db.collection('products').find({
            carbon_footprint: { $exists: true, $ne: null },
            water_consumption: { $exists: true, $ne: null },
            energy_usage: { $exists: true, $ne: null },
            eco_score: { $exists: true, $ne: null }
        }).toArray();

        if (products.length < 3) {
            return { clusters: [], error: 'Insufficient data for clustering' };
        }

        // Normalize features
        const features = products.map(p => ({
            carbon: parseFloat(p.carbon_footprint) || 0,
            water: parseFloat(p.water_consumption) || 0,
            energy: parseFloat(p.energy_usage) || 0,
            eco: p.eco_score || 0,
            id: p._id.toString(),
            name: p.ProductName,
            category: p.Category
        }));

        // Find min/max for normalization
        const minMax = {
            carbon: { min: Math.min(...features.map(f => f.carbon)), max: Math.max(...features.map(f => f.carbon)) },
            water: { min: Math.min(...features.map(f => f.water)), max: Math.max(...features.map(f => f.water)) },
            energy: { min: Math.min(...features.map(f => f.energy)), max: Math.max(...features.map(f => f.energy)) },
            eco: { min: Math.min(...features.map(f => f.eco)), max: Math.max(...features.map(f => f.eco)) }
        };

        // Normalize
        const normalized = features.map(f => ({
            ...f,
            nCarbon: (f.carbon - minMax.carbon.min) / (minMax.carbon.max - minMax.carbon.min || 1),
            nWater: (f.water - minMax.water.min) / (minMax.water.max - minMax.water.min || 1),
            nEnergy: (f.energy - minMax.energy.min) / (minMax.energy.max - minMax.energy.min || 1),
            nEco: (f.eco - minMax.eco.min) / (minMax.eco.max - minMax.eco.min || 1)
        }));

        // K-Means with k=4 (Excellent, Good, Fair, Poor)
        const k = 4;
        let centroids = this.initializeCentroids(normalized, k);
        let clusters = [];
        let iterations = 0;
        const maxIterations = 50;

        while (iterations < maxIterations) {
            // Assign points to nearest centroid
            clusters = Array(k).fill().map(() => []);
            
            normalized.forEach(point => {
                let minDist = Infinity;
                let clusterIndex = 0;
                
                centroids.forEach((centroid, i) => {
                    const dist = this.euclideanDistance(point, centroid);
                    if (dist < minDist) {
                        minDist = dist;
                        clusterIndex = i;
                    }
                });
                
                clusters[clusterIndex].push(point);
            });

            // Update centroids
            const newCentroids = clusters.map(cluster => {
                if (cluster.length === 0) return centroids[0];
                return {
                    nCarbon: cluster.reduce((s, p) => s + p.nCarbon, 0) / cluster.length,
                    nWater: cluster.reduce((s, p) => s + p.nWater, 0) / cluster.length,
                    nEnergy: cluster.reduce((s, p) => s + p.nEnergy, 0) / cluster.length,
                    nEco: cluster.reduce((s, p) => s + p.nEco, 0) / cluster.length
                };
            });

            // Check convergence
            const converged = centroids.every((c, i) => 
                this.euclideanDistance(c, newCentroids[i]) < 0.001
            );

            centroids = newCentroids;
            iterations++;

            if (converged) break;
        }

        // Sort clusters by average eco score (descending)
        const clusterStats = clusters.map((cluster, i) => {
            const avgEco = cluster.reduce((s, p) => s + p.eco, 0) / (cluster.length || 1);
            const avgCarbon = cluster.reduce((s, p) => s + p.carbon, 0) / (cluster.length || 1);
            return { index: i, cluster, avgEco, avgCarbon, count: cluster.length };
        }).sort((a, b) => b.avgEco - a.avgEco);

        // Label clusters
        const labels = ['Excellent Sustainability', 'Good Sustainability', 'Fair Sustainability', 'Poor Sustainability'];
        
        const result = clusterStats.map((stat, i) => ({
            label: labels[i] || `Cluster ${i + 1}`,
            count: stat.count,
            avgEcoScore: stat.avgEco.toFixed(1),
            avgCarbonFootprint: stat.avgCarbon.toFixed(1),
            products: stat.cluster.slice(0, 5).map(p => ({ name: p.name, eco: p.eco, category: p.category }))
        }));

        return { clusters: result };
    },

    /**
     * User Search Pattern Clustering
     * Groups users by their search behavior and eco-consciousness
     */
    async getUserSearchClusters() {
        const db = getDb();
        
        // Get user search statistics
        const userStats = await db.collection('searches').aggregate([
            {
                $group: {
                    _id: "$user_id",
                    totalSearches: { $sum: 1 },
                    avgEcoScore: { $avg: "$eco_score" },
                    highEcoSearches: {
                        $sum: { $cond: [{ $gte: ["$eco_score", 80] }, 1, 0] }
                    },
                    lowEcoSearches: {
                        $sum: { $cond: [{ $lte: ["$eco_score", 50] }, 1, 0] }
                    }
                }
            }
        ]).toArray();

        if (userStats.length < 3) {
            return { clusters: [], error: 'Insufficient user data' };
        }

        // Calculate eco-consciousness ratio
        const features = userStats.map(u => ({
            userId: u._id,
            searches: u.totalSearches,
            avgEco: u.avgEcoScore || 0,
            highRatio: (u.highEcoSearches / u.totalSearches) || 0,
            lowRatio: (u.lowEcoSearches / u.totalSearches) || 0
        }));

        // Simple 3-cluster classification based on avgEco
        const ecoConscious = features.filter(f => f.avgEco >= 70);
        const ecoModerate = features.filter(f => f.avgEco >= 50 && f.avgEco < 70);
        const ecoUnaware = features.filter(f => f.avgEco < 50);

        return {
            clusters: [
                {
                    label: 'Eco-Conscious Users',
                    count: ecoConscious.length,
                    percentage: ((ecoConscious.length / features.length) * 100).toFixed(1),
                    avgEcoScore: (ecoConscious.reduce((s, f) => s + f.avgEco, 0) / (ecoConscious.length || 1)).toFixed(1),
                    description: 'Users actively seeking sustainable products'
                },
                {
                    label: 'Eco-Moderate Users',
                    count: ecoModerate.length,
                    percentage: ((ecoModerate.length / features.length) * 100).toFixed(1),
                    avgEcoScore: (ecoModerate.reduce((s, f) => s + f.avgEco, 0) / (ecoModerate.length || 1)).toFixed(1),
                    description: 'Users with mixed sustainability preferences'
                },
                {
                    label: 'Eco-Unaware Users',
                    count: ecoUnaware.length,
                    percentage: ((ecoUnaware.length / features.length) * 100).toFixed(1),
                    avgEcoScore: (ecoUnaware.reduce((s, f) => s + f.avgEco, 0) / (ecoUnaware.length || 1)).toFixed(1),
                    description: 'Users not prioritizing sustainability'
                }
            ],
            totalUsers: features.length
        };
    },

    /**
     * Category Performance Clustering
     * Groups product categories by environmental performance
     */
    async getCategoryPerformanceClusters() {
        const db = getDb();
        
        const categoryStats = await db.collection('products').aggregate([
            {
                $match: {
                    Category: { $exists: true, $ne: null },
                    eco_score: { $exists: true, $ne: null },
                    carbon_footprint: { $exists: true, $ne: null }
                }
            },
            {
                $group: {
                    _id: "$Category",
                    avgEcoScore: { $avg: "$eco_score" },
                    avgCarbon: { $avg: { $toDouble: "$carbon_footprint" } },
                    productCount: { $sum: 1 }
                }
            }
        ]).toArray();

        // Classify categories
        const topPerformers = categoryStats.filter(c => c.avgEcoScore >= 75);
        const averagePerformers = categoryStats.filter(c => c.avgEcoScore >= 50 && c.avgEcoScore < 75);
        const lowPerformers = categoryStats.filter(c => c.avgEcoScore < 50);

        return {
            clusters: [
                {
                    label: 'Top Environmental Performers',
                    categories: topPerformers.map(c => ({
                        name: c._id,
                        ecoScore: c.avgEcoScore.toFixed(1),
                        carbon: c.avgCarbon.toFixed(1),
                        products: c.productCount
                    }))
                },
                {
                    label: 'Average Environmental Performers',
                    categories: averagePerformers.map(c => ({
                        name: c._id,
                        ecoScore: c.avgEcoScore.toFixed(1),
                        carbon: c.avgCarbon.toFixed(1),
                        products: c.productCount
                    }))
                },
                {
                    label: 'Low Environmental Performers',
                    categories: lowPerformers.map(c => ({
                        name: c._id,
                        ecoScore: c.avgEcoScore.toFixed(1),
                        carbon: c.avgCarbon.toFixed(1),
                        products: c.productCount
                    }))
                }
            ]
        };
    },

    // Helper methods for K-Means
    initializeCentroids(data, k) {
        const centroids = [];
        const used = new Set();
        
        while (centroids.length < k && centroids.length < data.length) {
            const index = Math.floor(Math.random() * data.length);
            if (!used.has(index)) {
                used.add(index);
                centroids.push({
                    nCarbon: data[index].nCarbon,
                    nWater: data[index].nWater,
                    nEnergy: data[index].nEnergy,
                    nEco: data[index].nEco
                });
            }
        }
        
        return centroids;
    },

    euclideanDistance(p1, p2) {
        const dCarbon = p1.nCarbon - p2.nCarbon;
        const dWater = p1.nWater - p2.nWater;
        const dEnergy = p1.nEnergy - p2.nEnergy;
        const dEco = p1.nEco - p2.nEco;
        return Math.sqrt(dCarbon * dCarbon + dWater * dWater + dEnergy * dEnergy + dEco * dEco);
    }
};