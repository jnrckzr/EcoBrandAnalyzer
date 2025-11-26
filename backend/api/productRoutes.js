import express from "express";
import { productService } from "../../services/product-service/index.js";
import { isAuthenticated } from "../../shared/middleware.js";

export const productRouter = express.Router();

// Get all products
productRouter.get('/products', async (req, res, next) => {
    try {
        const products = await productService.getAllProducts();
        res.json(products);
    } catch (error) {
        next(error);
    }
});

// Get product by ID
productRouter.get('/products/:id', async (req, res, next) => {
    try {
        const product = await productService.getProductById(req.params.id);
        res.json(product);
    } catch (error) {
        next(error);
    }
});

// Create product
productRouter.post('/products', isAuthenticated, async (req, res, next) => {
    try {
        const userId = req.session.user.id;
        const product = await productService.createProduct(req.body, userId);
        res.status(201).json(product);
    } catch (error) {
        next(error);
    }
});

// Update product
productRouter.put('/products/:id', isAuthenticated, async (req, res, next) => {
    try {
        const product = await productService.updateProduct(req.params.id, req.body);
        res.json(product);
    } catch (error) {
        next(error);
    }
});

// Delete product
productRouter.delete('/products/:id', isAuthenticated, async (req, res, next) => {
    try {
        await productService.deleteProduct(req.params.id);
        res.status(204).send();
    } catch (error) {
        next(error);
    }
});

// Get categorized products
productRouter.get('/categories/data', async (req, res, next) => {
    try {
        const categorized = await productService.getCategorizedProducts();
        res.json(categorized);
    } catch (error) {
        next(error);
    }
});

// Get environmental impact
productRouter.get('/environmental_impact', isAuthenticated, async (req, res, next) => {
    try {
        const { ProductName } = req.query;
        
        if (!ProductName) {
            const products = await productService.getAllProducts();
            return res.json({ success: true, products, total: products.length });
        }

        const environmentalImpact = await productService.getEnvironmentalImpact(ProductName);
        
        if (!environmentalImpact) {
            return res.json({ success: false, environmental_impact: null });
        }

        res.json({ success: true, environmental_impact: environmentalImpact });
    } catch (error) {
        next(error);
    }
});


// ===============================================
// NEW: Product Suggestions Route for Autocomplete
// ===============================================
productRouter.get('/product-suggestions', async (req, res, next) => {
    const query = req.query.query; 

    if (!query || query.length < 2) {
        // Return agad kung masyadong maikli ang query
        return res.json({ success: true, suggestions: [] });
    }

    try {
        // Tawagin ang bagong function sa service layer
        const suggestions = await productService.getSuggestionsByQuery(query);

        // Magbalik ng response na inaasahan ng homepage.js
        res.json({ success: true, suggestions: suggestions });

    } catch (error) {
        // Hayaang i-handle ng Express error handler ang error
        next(error); 
    }
});