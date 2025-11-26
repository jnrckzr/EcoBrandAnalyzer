import express from "express";
import { newsService } from "../services/news-service/index.js";
import { isAuthenticated } from "../shared/middleware.js";

export const newsRouter = express.Router();

// Add news
newsRouter.post('/add-news', async (req, res, next) => {
    try {
        await newsService.addNews(req.body);
        res.status(201).json({ success: true, message: 'News added successfully!' });
    } catch (error) {
        next(error);
    }
});

// Get all news
newsRouter.get('/news', async (req, res, next) => {
    try {
        const articles = await newsService.getAllNews();
        res.json({ success: true, articles });
    } catch (error) {
        next(error);
    }
});

// Get user notifications
newsRouter.get('/notifications', isAuthenticated, async (req, res, next) => {
    try {
        const userEmail = req.session.user.email;
        
        if (!userEmail) {
            return res.status(401).json({ success: false, message: 'User email not found.' });
        }

        const notifications = await newsService.getNotifications(userEmail);
        res.json({ success: true, notifications });
    } catch (error) {
        next(error);
    }
});

// Delete news article (admin only)
newsRouter.delete('/news/:id', isAuthenticated, async (req, res, next) => {
    try {
        await newsService.deleteNews(req.params.id);
        res.json({ success: true, message: 'News article deleted successfully.' });
    } catch (error) {
        next(error);
    }
});

// Update news article (admin only)
newsRouter.put('/news/:id', isAuthenticated, async (req, res, next) => {
    try {
        const updatedArticle = await newsService.updateNews(req.params.id, req.body);
        res.json({ success: true, article: updatedArticle });
    } catch (error) {
        next(error);
    }
});