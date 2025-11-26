import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { userService } from "../services/user-service/index.js";
import { isAuthenticated } from "../shared/middleware.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const userRouter = express.Router();

// Multer setup for profile picture upload
const UPLOAD_DIR = path.join(__dirname, '../../public/uploads/profile_pictures');
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 2 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png|gif/;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        if (mimetype && extname) return cb(null, true);
        cb(new Error('Only images are allowed!'));
    }
}).single('profile_picture');

// Get user data
userRouter.get('/user-data', isAuthenticated, async (req, res, next) => {
    try {
        const userData = await userService.getUserById(req.session.user.id);
        res.json(userData);
    } catch (error) {
        next(error);
    }
});

// Update profile
userRouter.post('/update-profile', isAuthenticated, async (req, res, next) => {
    try {
        const updatedUser = await userService.updateProfile(req.session.user.id, req.body);
        
        // Update session
        req.session.user = {
            ...req.session.user,
            bio: updatedUser.bio,
            mobile: updatedUser.mobile,
            location: updatedUser.location
        };

        res.json({ success: true, message: 'Profile updated successfully!', user: req.session.user });
    } catch (error) {
        next(error);
    }
});

// Change password
userRouter.post('/change-password', isAuthenticated, async (req, res, next) => {
    try {
        const { newPassword, confirmNewPassword } = req.body;
        await userService.changePassword(req.session.user.id, newPassword, confirmNewPassword);
        res.json({ success: true, message: 'Password updated successfully!' });
    } catch (error) {
        next(error);
    }
});

// Delete account
userRouter.delete('/delete-account', isAuthenticated, async (req, res, next) => {
    try {
        await userService.deleteAccount(req.session.user.id);
        
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

// Upload profile picture
userRouter.post('/upload-profile-pic', isAuthenticated, (req, res, next) => {
    upload(req, res, async (err) => {
        if (err) {
            return res.status(400).json({ success: false, message: err.message });
        }
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file selected.' });
        }

        try {
            const profilePicturePath = `/uploads/profile_pictures/${req.file.filename}`;
            await userService.updateProfilePicture(req.session.user.id, profilePicturePath);
            
            req.session.user.profilePictureUrl = profilePicturePath;
            req.session.save();

            res.json({
                success: true,
                message: 'Profile picture updated successfully!',
                profilePictureUrl: profilePicturePath
            });
        } catch (error) {
            fs.unlink(req.file.path, (unlinkErr) => {
                if (unlinkErr) console.error('Error deleting uploaded file:', unlinkErr);
            });
            next(error);
        }
    });
});

// Update activity (heartbeat)
userRouter.post('/update-activity', isAuthenticated, async (req, res, next) => {
    try {
        const { user_id } = req.body;
        
        if (!user_id || user_id !== req.session.user.id) {
            return res.status(403).json({ success: false, message: 'Unauthorized activity update.' });
        }

        await userService.updateActivity(user_id);
        res.json({ success: true, message: 'Activity timestamp updated.' });
    } catch (error) {
        next(error);
    }
});

// Get user average eco score
userRouter.get('/user-average-score', isAuthenticated, async (req, res, next) => {
    try {
        const userId = req.session.user.id;
        const average_score = await userService.getUserAverageScore(userId);
        res.json({ average_score });
    } catch (error) {
        next(error);
    }
});