// project/backend/api/authRouter.js

import express from "express";
// Ginagamit ang Default Import (Option A) para maayos ang "is not a function" error
import authService from '../../services/auth-service/index.js';


export const authRouter = express.Router();

// Tandaan: Dahil ang router na ito ay naka-mount sa app.use("/api", authRouter),
// ang lahat ng ruta dito ay magsisimula sa /api/

// --- Existing Routes ---

// Register: POST /api/register
authRouter.post('/register', async (req, res, next) => {    
    try {
        const result = await authService.register(req.body);
        res.status(201).json({
            success: true,
            message: 'Registration successful! Redirecting to login...',
            redirectUrl: '/login.html'
        });
    } catch (error) {
        next(error);
    }
});

// Login: POST /api/login
authRouter.post('/login', async (req, res, next) => {
    try {
        const { email, password } = req.body;
        const user = await authService.login(email, password);

        req.session.user = user;

        res.status(200).json({
            success: true,
            message: 'Login successful!',
            user_id: user.id,
            redirectUrl: user.role === 'admin' ? '/adminpage.html' : '/homepage.html'
        });
    } catch (error) {
        next(error);
    }
});

// Logout: GET /api/logout
authRouter.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Error destroying session:', err);
            return res.status(500).json({ message: 'Error logging out.' });
        }
        res.clearCookie('connect.sid');
        res.redirect('/login.html');
    });
});

// -----------------------------------------------------------------
// PASSWORD RESET FLOW ROUTES (Naka-prefix ang /auth/ dahil ito ang nasa FE request)
// -----------------------------------------------------------------

// 1. FORGOT PASSWORD (Send OTP): POST /api/auth/forgot-password
authRouter.post('/auth/forgot-password', async (req, res, next) => {
    try {
        const { email } = req.body;
        
        await authService.sendOtp(email); 

        res.status(200).json({
            success: true,
            message: 'A reset code has been sent to your email. Check your inbox.',
            redirectUrl: '/otp.html' 
        });
    } catch (error) {
        // Hahawakan ang sensitive errors (e.g., user not found)
        if (error.isSensitive) { 
             return res.status(200).json({
                 success: true,
                 message: 'Processing complete. Check your inbox for the reset code.',
                 redirectUrl: '/otp.html'
             });
        }
        
        // Ibang Non-sensitive errors (e.g., Email server fail, Database connection issues)
        console.error("Error sending OTP:", error);
        if (error.status === 500) {
            return res.status(500).json({
                success: false,
                message: error.message || 'Server error while processing your request. Please try again later.'
            });
        }
        
        // Para sa lahat ng iba pa, gamitin ang generic error handler
        next(error); 
    }
});

// 2. VERIFY OTP: POST /api/auth/verify-otp
authRouter.post('/auth/verify-otp', async (req, res, next) => {
    try {
        const { otp_code } = req.body; 
        
        const { resetToken } = await authService.verifyOtp(otp_code); 

        res.status(200).json({
            success: true,
            message: 'OTP verified successfully.',
            redirectUrl: `/changepass.html?token=${resetToken}` 
        });
    } catch (error) {
        // Kapag nag-throw ng 400 Bad Request (Invalid OTP), ang next(error) ay maghahatid dito.
        // Pero mas maigi kung direkta na itong i-handle para mag-return ng JSON.
        console.error("Error verifying OTP:", error);
        const status = error.status || 500;
        return res.status(status).json({
            success: false,
            message: error.message || 'Invalid or expired OTP code.'
        });
    }
});


// 3. CHANGE PASSWORD: POST /api/auth/reset-password
authRouter.post('/auth/reset-password', async (req, res, next) => {
    try {
        const { new_password, confirm_password, reset_token } = req.body;

        await authService.resetPassword(new_password, confirm_password, reset_token);

        res.status(200).json({
            success: true,
            message: 'Password changed successfully! Please log in with your new password.',
            redirectUrl: '/login.html?reset=success'
        });
    } catch (error) {
        // Explicit error handling para sa password reset
        console.error("Error resetting password:", error);
        const status = error.status || 500;
        return res.status(status).json({
            success: false,
            message: error.message || 'Password reset failed. Please restart the process.'
        });
    }
});
