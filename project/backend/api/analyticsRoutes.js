import express from "express";
import { analyticsService } from "../../services/analytics-service/index.js";
import { isAuthenticated, isAdmin } from "../../shared/middleware.js";
import { advancedAnalyticsService } from "../../services/analytics-service/advanced-analytics-service.js";

export const analyticsRouter = express.Router();

// Total products
analyticsRouter.get('/total-products', async (req, res, next) => {
    try {
        const total = await analyticsService.getTotalProducts();
        res.json({ total });
    } catch (error) {
        next(error);
    }
});

// Products comparison
analyticsRouter.get('/total-products-comparison', async (req, res, next) => {
    try {
        const comparison = await analyticsService.getProductsComparison();
        res.json(comparison);
    } catch (error) {
        next(error);
    }
});

// Today's users
analyticsRouter.get('/today-users', async (req, res, next) => {
    try {
        const todayUsers = await analyticsService.getTodayUsers();
        res.json({ todayUsers });
    } catch (error) {
        next(error);
    }
});

// Users comparison
analyticsRouter.get('/users-comparison', async (req, res, next) => {
    try {
        const percentChange = await analyticsService.getUsersComparison();
        res.json({ percentChange });
    } catch (error) {
        next(error);
    }
});

// Weekly product data
analyticsRouter.get('/new-products-week', async (req, res, next) => {
    try {
        const weeklyData = await analyticsService.getWeeklyProductData();
        res.json(weeklyData);
    } catch (error) {
        next(error);
    }
});

// Product clustering
analyticsRouter.get('/product-clustering', async (req, res, next) => {
    try {
        const clustering = await analyticsService.getProductClustering();
        res.json(clustering);
    } catch (error) {
        next(error);
    }
});

// Monthly user data
analyticsRouter.get('/users-monthly', async (req, res, next) => {
    try {
        const monthlyData = await analyticsService.getMonthlyUserData();
        res.json(monthlyData);
    } catch (error) {
        next(error);
    }
});

// Total emissions
analyticsRouter.get('/totalEmissions', async (req, res, next) => {
    try {
        const totalEmissions = await analyticsService.getTotalEmissions();
        res.json({ success: true, totalEmissions });
    } catch (error) {
        next(error);
    }
});

// Emissions comparison
analyticsRouter.get('/emissions-comparison', async (req, res, next) => {
    try {
        const percentChange = await analyticsService.getEmissionsComparison();
        res.json({ success: true, percentChange });
    } catch (error) {
        next(error);
    }
});

// Emissions trend
analyticsRouter.get('/emissions-trend', async (req, res, next) => {
    try {
        const trendData = await analyticsService.getEmissionsTrend();
        res.json({ success: true, ...trendData });
    } catch (error) {
        next(error);
    }
});

// Linear Regression: Eco Score Trend
analyticsRouter.get('/eco-score-trend', async (req, res, next) => {
    try {
        const trendData = await advancedAnalyticsService.getEcoScoreTrend();
        res.json({ success: true, ...trendData });
    } catch (error) {
        next(error);
    }
});

// Linear Regression: Carbon vs Eco Score Correlation
analyticsRouter.get('/carbon-eco-correlation', async (req, res, next) => {
    try {
        const correlationData = await advancedAnalyticsService.getCarbonEcoCorrelation();
        res.json({ success: true, ...correlationData });
    } catch (error) {
        next(error);
    }
});

// Linear Regression: Search Eco Trend
analyticsRouter.get('/search-eco-trend', async (req, res, next) => {
    try {
        const searchTrend = await advancedAnalyticsService.getSearchEcoTrend();
        res.json({ success: true, ...searchTrend });
    } catch (error) {
        next(error);
    }
});

// K-Means: Product Sustainability Clusters
analyticsRouter.get('/product-sustainability-clusters', async (req, res, next) => {
    try {
        const clusters = await advancedAnalyticsService.getProductSustainabilityClusters();
        res.json({ success: true, ...clusters });
    } catch (error) {
        next(error);
    }
});

// K-Means: User Search Clusters
analyticsRouter.get('/user-search-clusters', async (req, res, next) => {
    try {
        const clusters = await advancedAnalyticsService.getUserSearchClusters();
        res.json({ success: true, ...clusters });
    } catch (error) {
        next(error);
    }
});

// K-Means: Category Performance Clusters
analyticsRouter.get('/category-performance-clusters', async (req, res, next) => {
    try {
        const clusters = await advancedAnalyticsService.getCategoryPerformanceClusters();
        res.json({ success: true, ...clusters });
    } catch (error) {
        next(error);
    }
});