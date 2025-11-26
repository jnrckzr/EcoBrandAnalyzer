import express from "express";
import { adminService } from "../services/admin-service/index.js";
import { isAuthenticated, isAdmin } from "../shared/middleware.js";

export const adminRouter = express.Router();

// Change admin password
adminRouter.post('/admin/change-password', isAuthenticated, isAdmin, async (req, res, next) => {
    try {
        const { currentPassword, newPassword } = req.body;
        await adminService.changePassword(req.session.user.id, currentPassword, newPassword);
        res.json({ success: true, message: 'Password updated successfully!' });
    } catch (error) {
        next(error);
    }
});

// Delete admin account
adminRouter.delete('/admin/delete-account', isAuthenticated, isAdmin, async (req, res, next) => {
    try {
        await adminService.deleteAccount(req.session.user.id);
        
        req.session.destroy((err) => {
            if (err) {
                return res.json({ 
                    success: true, 
                    message: 'Account deleted, but session destruction had an issue.' 
                });
            }
            res.clearCookie('connect.sid');
            res.status(200).json({ 
                success: true, 
                message: 'Account deleted successfully.', 
                redirectUrl: '/login.html' 
            });
        });
    } catch (error) {
        next(error);
    }
});

// Get all users (admin)
adminRouter.get('/users', isAuthenticated, isAdmin, async (req, res, next) => {
    try {
        const users = await adminService.getAllUsers();
        res.json({ success: true, users });
    } catch (error) {
        next(error);
    }
});

// Get user emails
adminRouter.get('/admin/get-users', isAuthenticated, isAdmin, async (req, res, next) => {
    try {
        const emails = await adminService.getUserEmails();
        res.json({ success: true, emails });
    } catch (error) {
        next(error);
    }
});

// Delete a user
adminRouter.delete('/users/:id', isAuthenticated, isAdmin, async (req, res, next) => {
    try {
        await adminService.deleteUser(req.params.id);
        res.json({ success: true, message: 'User and all related data deleted successfully.' });
    } catch (error) {
        next(error);
    }
});

// Send notification
adminRouter.post('/admin/send-notification', isAuthenticated, isAdmin, async (req, res, next) => {
    try {
        const { emails, title, message } = req.body;
        await adminService.sendNotification(emails, title, message);
        res.json({ success: true, message: 'Notification sent successfully.' });
    } catch (error) {
        next(error);
    }
});

// Get notification history
adminRouter.get('/admin/notification-history', isAuthenticated, isAdmin, async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        
        const history = await adminService.getNotificationHistory(page, limit);
        res.json({ success: true, ...history });
    } catch (error) {
        next(error);
    }
});