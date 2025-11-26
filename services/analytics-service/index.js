import { getDb } from "../../shared/db.js";
import { cache } from "../../shared/cache.js";

export const analyticsService = {
    async getTotalProducts() {
        const cached = cache.get('total_products');
        if (cached !== null) return cached;

        const db = getDb();
        const total = await db.collection('products').countDocuments();
        
        cache.set('total_products', total, 300);
        return total;
    },

    async getProductsComparison() {
        const db = getDb();
        const now = new Date();
        const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

        const [thisMonthCount, lastMonthCount] = await Promise.all([
            db.collection('products').countDocuments({ created_at: { $gte: startOfThisMonth } }),
            db.collection('products').countDocuments({
                created_at: {
                    $gte: startOfLastMonth,
                    $lt: startOfThisMonth
                }
            })
        ]);

        return {
            lastMonthCount,
            thisMonthCount,
            difference: thisMonthCount - lastMonthCount
        };
    },

    async getTodayUsers() {
        const db = getDb();
        const startOfDay = new Date();
        startOfDay.setUTCHours(0, 0, 0, 0);
        const endOfDay = new Date();
        endOfDay.setUTCHours(23, 59, 59, 999);

        const todayCount = await db.collection('users').countDocuments({
            last_active_at: { $gte: startOfDay, $lte: endOfDay }
        });

        return todayCount;
    },

    async getUsersComparison() {
        const db = getDb();
        const now = new Date();
        const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

        const [thisMonthUsers, lastMonthUsers] = await Promise.all([
            db.collection('users').countDocuments({ created_at: { $gte: startOfThisMonth } }),
            db.collection('users').countDocuments({
                created_at: {
                    $gte: startOfLastMonth,
                    $lt: startOfThisMonth
                }
            })
        ]);

        const change = lastMonthUsers === 0 ? 0 :
            ((thisMonthUsers - lastMonthUsers) / lastMonthUsers) * 100;

        return parseFloat(change.toFixed(2));
    },

    async getWeeklyProductData() {
        const db = getDb();
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        sevenDaysAgo.setHours(0, 0, 0, 0);

        const pipeline = [
            { $match: { created_at: { $gte: sevenDaysAgo } } },
            {
                $group: {
                    _id: { $dayOfWeek: '$created_at' },
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ];

        const results = await db.collection('products').aggregate(pipeline).toArray();
        
        const chartLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        const chartData = [0, 0, 0, 0, 0, 0, 0];

        results.forEach(item => {
            const mongoDayIndex = item._id;
            let chartIndex = mongoDayIndex === 1 ? 6 : mongoDayIndex - 2;
            if (chartIndex >= 0 && chartIndex < 7) {
                chartData[chartIndex] = item.count;
            }
        });

        return { days: chartLabels, data: chartData };
    },

    async getProductClustering() {
        const cached = cache.get('product_clustering');
        if (cached) return cached;

        const db = getDb();
        
        const [highCount, moderateCount, lowCount] = await Promise.all([
            db.collection('products').countDocuments({ environmental_impact: { $regex: /high/i } }),
            db.collection('products').countDocuments({ environmental_impact: { $regex: /moderate/i } }),
            db.collection('products').countDocuments({ environmental_impact: { $regex: /low/i } })
        ]);

        const result = {
            high: highCount,
            moderate: moderateCount,
            low: lowCount,
            total: highCount + moderateCount + lowCount
        };

        cache.set('product_clustering', result, 600);
        return result;
    },

    async getMonthlyUserData() {
        const db = getDb();
        const now = new Date();
        const startDate = new Date(now.getFullYear(), now.getMonth() - 11, 1);

        const pipeline = [
            { $match: { created_at: { $gte: startDate } } },
            {
                $group: {
                    _id: {
                        year: { $year: '$created_at' },
                        month: { $month: '$created_at' }
                    },
                    count: { $sum: 1 }
                }
            },
            { $sort: { '_id.year': 1, '_id.month': 1 } }
        ];

        const results = await db.collection('users').aggregate(pipeline).toArray();
        
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
            'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const chartLabels = [];
        const chartData = [];

        for (let i = 11; i >= 0; i--) {
            const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
            chartLabels.push(monthNames[date.getMonth()]);

            const monthData = results.find(r =>
                r._id.year === date.getFullYear() &&
                r._id.month === (date.getMonth() + 1)
            );

            chartData.push(monthData ? monthData.count : 0);
        }

        return { labels: chartLabels, data: chartData };
    },

    async getTotalEmissions() {
        const db = getDb();
        const result = await db.collection('products').aggregate([
            {
                $addFields: {
                    carbonFootprintNum: {
                        $convert: {
                            input: "$carbon_footprint",
                            to: "decimal",
                            onError: 0,
                            onNull: 0
                        }
                    }
                }
            },
            {
                $group: {
                    _id: null,
                    totalEmissionsKg: { $sum: "$carbonFootprintNum" }
                }
            }
        ]).toArray();

        let totalEmissions = 0;
        if (result.length > 0) {
            totalEmissions = parseFloat(result[0].totalEmissionsKg.valueOf());
        }

        return totalEmissions;
    },

    async getEmissionsComparison() {
        const db = getDb();
        const now = new Date();
        const startOfToday = new Date(now);
        startOfToday.setUTCHours(0, 0, 0, 0);
        const startOfYesterday = new Date(startOfToday);
        startOfYesterday.setDate(startOfToday.getDate() - 1);

        const calculateEmissions = async (startDate, endDate) => {
            const pipeline = [
                { $match: { created_at: { $gte: startDate, $lte: endDate } } },
                {
                    $addFields: {
                        carbonFootprintNum: {
                            $convert: { input: "$carbon_footprint", to: "decimal", onError: 0, onNull: 0 }
                        }
                    }
                },
                { $group: { _id: null, total: { $sum: "$carbonFootprintNum" } } }
            ];

            const result = await db.collection('products').aggregate(pipeline).toArray();
            return result.length > 0 ? parseFloat(result[0].total.valueOf()) : 0;
        };

        const [todayEmissions, yesterdayEmissions] = await Promise.all([
            calculateEmissions(startOfToday, now),
            calculateEmissions(startOfYesterday, startOfToday)
        ]);

        let percentChange = 0;
        if (yesterdayEmissions > 0) {
            percentChange = ((todayEmissions - yesterdayEmissions) / yesterdayEmissions) * 100;
        } else if (todayEmissions > 0) {
            percentChange = 100;
        }

        return parseFloat(percentChange.toFixed(2));
    },

    async getEmissionsTrend() {
        const db = getDb();
        const currentYear = new Date().getFullYear();
        const currentMonth = new Date().getMonth() + 1;

        const monthlyData = await db.collection('products').aggregate([
            { $match: { created_at: { $exists: true } } },
            {
                $addFields: {
                    carbonFootprintNum: {
                        $convert: { input: "$carbon_footprint", to: "decimal", onError: 0, onNull: 0 }
                    }
                }
            },
            {
                $group: {
                    _id: { year: { $year: "$created_at" }, month: { $month: "$created_at" } },
                    totalMonthlyEmissions: { $sum: "$carbonFootprintNum" }
                }
            },
            { $sort: { "_id.year": 1, "_id.month": 1 } }
        ]).toArray();

        const labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        let historicalEmissions = [];
        let dataPoints = [];

        for (let month = 1; month <= 12; month++) {
            const dataPoint = monthlyData.find(d =>
                d._id.year === currentYear && d._id.month === month
            );
            const emissions = dataPoint ? parseFloat(dataPoint.totalMonthlyEmissions.valueOf()) : 0;
            historicalEmissions.push(emissions.toFixed(2));
            
            if (month <= currentMonth) {
                dataPoints.push({ x: month - 1, y: emissions });
            }
        }

        // Linear regression
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
        const PREDICTION_OFFSET = 1500;

        let regressionData = [];
        for (let x = 0; x < 12; x++) {
            let y_pred = m * x + b + PREDICTION_OFFSET;
            regressionData.push(Math.max(0, y_pred.toFixed(2)));
        }

        return { labels, historicalData: historicalEmissions, regressionData };
    }
};