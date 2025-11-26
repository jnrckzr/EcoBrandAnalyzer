import express from "express";
import { productService } from "../services/product-service/index.js";
import { isAuthenticated } from "../shared/middleware.js";
import { getDb } from "../shared/db.js";

export const searchRouter = express.Router();

// Search products
searchRouter.get('/search-products', isAuthenticated, async (req, res, next) => {
    try {
        const { query } = req.query;
        const userId = req.session.user.id;
        
        const products = await productService.searchProducts(query, userId);
        res.json({ success: true, products });
    } catch (error) {
        next(error);
    }
});

// Get search history
searchRouter.get('/search-history', isAuthenticated, async (req, res, next) => {
    try {
        const userId = req.session.user.id;
        const db = getDb();
        
        const history = await db.collection('searches')
            .find({ user_id: userId })
            .sort({ created_at: -1 })
            .toArray();

        res.json({ success: true, history });
    } catch (error) {
        next(error);
    }
});