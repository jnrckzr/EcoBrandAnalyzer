import "dotenv/config";
import express from 'express';
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import session from "express-session";
import multer from "multer";
import fs from "fs";
import bcrypt from "bcryptjs";
import helmet from 'helmet';

// Database connection
import { connectToMongoDB, closeConnection, getDb, ObjectId } from "./project/shared/db.js";

// Middleware
import { requestLogger, errorHandler, isAuthenticated } from "./project/shared/middleware.js";

// LLM routers
import { insightsRouter } from "./project/backend/api/insightRouter.js";
import { chatbotRouter } from "./project/backend/api/chatbotRouter.js";
import { alternativesRouter } from "./project/backend/api/alternativesRouter.js";
import { authRouter } from './project/backend/api/authRouter.js';
import { productRouter } from './project/backend/api/productRoutes.js';
import { analyticsRouter } from "./project/backend/api/analyticsRoutes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let db; // Will be set after MongoDB connects
let client; // For analytics endpoints that use client.db()

console.log("GROQ key present?", !!process.env.GROQ_API_KEY);

const app = express();
const PORT = process.env.PORT || 3000;

// simple request logger
app.use((req, _res, next) => { console.log("[REQ]", req.method, req.url); next(); });

// core middleware
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// --- Express Session Middleware ---
app.use(session({
    secret: process.env.SESSION_SECRET || 'a_very_secret_key_for_session',
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 1000 * 60 * 60 * 24, // Session lasts for 24 hours
        httpOnly: true
    }
}));

app.use(
    helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
                fontSrc: ["'self'", "https://cdnjs.cloudflare.com"],
                scriptSrc: [
                    "'self'",
                    "https://cdnjs.cloudflare.com",
                    "https://cdn.jsdelivr.net"
                ],
                imgSrc: ["'self'", "data:", "https:"],
                connectSrc: [
                    "'self'",
                    "https://cdn.jsdelivr.net"
                ],
                objectSrc: ["'none'"],
                upgradeInsecureRequests: [],
            },
        },
    })
);

// static files
app.use(express.static(path.join(__dirname, "public")));

// Mount the LLM insights API
app.use("/api", insightsRouter);
app.use("/api", chatbotRouter);
app.use("/api", alternativesRouter);
app.use("/api", authRouter);
app.use("/api", productRouter);
app.use("/api", analyticsRouter);

// --- Middleware ---
app.use(express.json({ limit: '50mb' }));// To parse JSON bodies
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(path.join(__dirname, 'public'))); // To serve static files

const UPLOAD_DIR = path.join(__dirname, 'public', 'uploads', 'profile_pictures');

// Ensure the upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Configure Multer for disk storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, UPLOAD_DIR);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const fileExtension = path.extname(file.originalname);
        cb(null, file.fieldname + '-' + uniqueSuffix + fileExtension);
    }
});

// Initialize Multer with the storage configuration and file filter
const upload = multer({
    storage: storage,
    limits: { fileSize: 2 * 1024 * 1024 }, // 2MB file size limit
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png|gif/;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

        if (mimetype && extname) {
            return cb(null, true);
        }
        cb(new Error('Only images are allowed! (jpeg, jpg, png, gif)'));
    }
}).single('profile_picture');

// --- Authentication Middleware ---
const checkAuth = (req, res, next) => {
    if (req.session.user && req.session.user.username) {
        next();
    } else {
        // If it's an API request, send 401 (Unauthorized)
        if (req.xhr || req.headers.accept.indexOf('json') > -1) {
            res.status(401).json({ message: 'Unauthorized. Please log in.' });
        } else {
            // Otherwise, redirect to the login page
            res.redirect('/login.html');
        }
    }
};

// --- Routes ---

// Public Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'landing.html'));
});

app.get('/login.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/signup.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'signup.html'));
});

app.get('/termsandcondition.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'termsandcondition.html'));
});

// Registration Endpoint - MongoDB Version
app.post('/register', async (req, res) => {
    const { Fullname, Birthdate, Age, Username, Emailadd, password } = req.body;

    // Check if all required fields are present
    if (!Fullname || !Birthdate || !Age || !Username || !Emailadd || !password) {
        return res.status(400).json({ success: false, message: 'All fields are required.' });
    }

    // Age validation check
    if (parseInt(Age) < 13) {
        return res.status(400).json({ success: false, message: 'You must be at least 13 years old to register.' });
    }

    try {
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);
        const formattedBirthdate = new Date(Birthdate);

        const newUser = {
            Fullname,
            Birthdate: formattedBirthdate,
            Age: parseInt(Age),
            Username,
            Emailadd,
            password_hash: passwordHash,
            Profile_Picture_URL: '/images/default-profile.png',
            Bio: '',
            Mobile: '',
            Location: '',
            EcoScore: 0,
            ProductsUploaded: 0,
            role: 'user',
            created_at: new Date(),
            last_active_at: new Date()
        };

        const result = await db.collection('users').insertOne(newUser);

        if (result.insertedId) {
            res.status(201).json({
                success: true,
                message: 'Registration successful! Redirecting to login...',
                redirectUrl: '/login.html'
            });
        } else {
            res.status(500).json({ success: false, message: 'Failed to register user. Please try again.' });
        }

    } catch (error) {
        console.error('Database insertion error:', error);

        if (error.code === 11000) { // MongoDB duplicate key error
            const field = Object.keys(error.keyPattern)[0];
            if (field === 'Username') {
                return res.status(409).json({ success: false, message: 'Username already taken. Please choose another.' });
            }
            if (field === 'Emailadd') {
                return res.status(409).json({ success: false, message: 'Email address already registered. Please use a different one.' });
            }
        }
        res.status(500).json({ success: false, message: 'Server error. Registration failed. Please try again later.' });
    }
});

// Login Route - MongoDB Version
app.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    try {
        const user = await db.collection('users').findOne({ Emailadd: email });

        if (!user) {
            return res.status(401).json({ success: false, message: 'Invalid credentials.' });
        }

        const isMatch = await bcrypt.compare(password, user.password_hash);

        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Invalid credentials.' });
        }

        // Update last active time
        await db.collection('users').updateOne(
            { _id: user._id },
            { $set: { last_active_at: new Date() } }
        );

        req.session.user = {
            id: user._id.toString(),
            username: user.Username,
            Fullname: user.Fullname,
            email: user.Emailadd,
            profilePictureUrl: user.Profile_Picture_URL,
            bio: user.Bio,
            mobile: user.Mobile,
            location: user.Location,
            ecoScore: user.EcoScore,
            productsUploaded: user.ProductsUploaded,
            role: user.role
        };

        console.log('User logged in, session created:', req.session.user);

        const loginResponse = {
            success: true,
            message: 'Login successful!',
            user_id: user._id.toString(),
            redirectUrl: user.role === 'admin' ? '/adminpage.html' : '/homepage.html'
        };

        res.status(200).json(loginResponse);

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, message: 'Server error during login. Please try again later.' });
    }
});

// --- API Endpoint to get User Data for Profile Page ---
app.get('/api/user-data', isAuthenticated, async (req, res) => {
    try {
        const userId = new ObjectId(req.session.user.id);

        const user = await db.collection('users').findOne({ _id: userId });

        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        let userProducts = [];

        res.json({
            username: user.Username,
            Fullname: user.Fullname,
            email: user.Emailadd,
            profilePictureUrl: user.Profile_Picture_URL,
            bio: user.Bio,
            mobile: user.Mobile,
            location: user.Location,
            ecoScore: user.EcoScore,
            productsUploaded: user.ProductsUploaded,
            products: userProducts
        });

    } catch (error) {
        console.error('Error fetching user data:', error);
        res.status(500).json({ message: 'Server error fetching user data.' });
    }
});

// --- API Endpoint to Update User Profile ---
app.post('/api/update-profile', isAuthenticated, async (req, res) => {
    const userId = new ObjectId(req.session.user.id);
    const { bio, mobile, location } = req.body;

    if (bio === undefined || mobile === undefined || location === undefined) {
        return res.status(400).json({ success: false, message: 'Invalid input for profile update.' });
    }

    try {
        const result = await db.collection('users').updateOne(
            { _id: userId },
            {
                $set: {
                    Bio: bio,
                    Mobile: mobile,
                    Location: location,
                    updated_at: new Date()
                }
            }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ success: false, message: 'User not found or no changes applied.' });
        }

        const updatedUser = await db.collection('users').findOne({ _id: userId });

        req.session.user = {
            id: userId.toString(),
            username: updatedUser.Username,
            Fullname: updatedUser.Fullname,
            email: updatedUser.Emailadd,
            profilePictureUrl: updatedUser.Profile_Picture_URL,
            bio: updatedUser.Bio,
            mobile: updatedUser.Mobile,
            location: updatedUser.Location,
            ecoScore: updatedUser.EcoScore,
            productsUploaded: updatedUser.ProductsUploaded,
            role: updatedUser.role
        };

        res.json({ success: true, message: 'Profile updated successfully!', user: req.session.user });

    } catch (error) {
        console.error('Error updating user profile:', error);
        res.status(500).json({ success: false, message: 'Server error updating profile.' });
    }
});

// --- API Endpoint to Change Password ---
app.post('/api/change-password', isAuthenticated, async (req, res) => {
    const userId = new ObjectId(req.session.user.id);
    const { newPassword, confirmNewPassword } = req.body;

    if (!newPassword || !confirmNewPassword) {
        return res.status(400).json({ success: false, message: 'New password and confirmation are required.' });
    }

    if (newPassword !== confirmNewPassword) {
        return res.status(400).json({ success: false, message: 'New password and confirmation do not match.' });
    }

    if (newPassword.length < 8) {
        return res.status(400).json({ success: false, message: 'Password must be at least 8 characters long.' });
    }

    try {
        const saltRounds = 10;
        const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

        const result = await db.collection('users').updateOne(
            { _id: userId },
            {
                $set: {
                    password_hash: newPasswordHash,
                    updated_at: new Date()
                }
            }
        );

        if (result.matchedCount === 1) {
            res.json({ success: true, message: 'Password updated successfully!' });
        } else {
            res.status(500).json({ success: false, message: 'Failed to update password.' });
        }

    } catch (error) {
        console.error('Error changing password:', error);
        res.status(500).json({ success: false, message: 'Server error during password change.' });
    }
});

// --- API Endpoint to Delete Account ---
app.delete('/api/delete-account', isAuthenticated, async (req, res) => {
    const userId = new ObjectId(req.session.user.id);

    try {
        // Delete related records first (if any)
        await db.collection('products').deleteMany({ user_id: userId });
        await db.collection('searches').deleteMany({ user_id: userId });

        const result = await db.collection('users').deleteOne({ _id: userId });

        if (result.deletedCount === 0) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }

        req.session.destroy((err) => {
            if (err) {
                console.error('Error destroying session after account deletion:', err);
                return res.json({ success: true, message: 'Account deleted, but session destruction had an issue. Please clear cookies manually.' });
            }
            res.clearCookie('connect.sid');
            res.status(200).json({ success: true, message: 'Account deleted successfully. Redirecting to login.', redirectUrl: '/login.html' });
        });

    } catch (error) {
        console.error('Error deleting account:', error);
        res.status(500).json({ success: false, message: 'Server error during account deletion.' });
    }
});

// --- API Endpoint to Upload Profile Picture ---
app.post('/api/upload-profile-pic', isAuthenticated, (req, res) => {
    upload(req, res, async (err) => {
        if (err instanceof multer.MulterError) {
            return res.status(400).json({ success: false, message: err.message });
        } else if (err) {
            return res.status(400).json({ success: false, message: err.message });
        }
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file selected.' });
        }

        const userId = new ObjectId(req.session.user.id);
        const profilePicturePath = `/uploads/profile_pictures/${req.file.filename}`;

        try {
            await db.collection('users').updateOne(
                { _id: userId },
                {
                    $set: {
                        Profile_Picture_URL: profilePicturePath,
                        updated_at: new Date()
                    }
                }
            );

            req.session.user.profilePictureUrl = profilePicturePath;
            req.session.save();

            res.json({
                success: true,
                message: 'Profile picture updated successfully!',
                profilePictureUrl: profilePicturePath
            });

        } catch (dbError) {
            console.error('Database error on profile picture upload:', dbError);
            fs.unlink(req.file.path, (unlinkErr) => {
                if (unlinkErr) console.error('Error deleting uploaded file:', unlinkErr);
            });
            res.status(500).json({ success: false, message: 'Server error updating profile picture.' });
        }
    });
});

// --- Protected Navigation Pages (require authentication) ---
app.get('/homepage.html', isAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'homepage.html'));
});

app.get('/environmental-news.html', isAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'environmental-news.html'));
});

app.get('/profile.html', isAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'profile.html'));
});

app.get('/categories.html', isAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'categories.html'));
});

app.get('/settings.html', isAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'settings.html'));
});

app.get('/new-product.html', isAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'new-product.html'));
});

// Logout Route - Destroys the user's session
app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Error destroying session:', err);
            return res.status(500).json({ message: 'Error logging out.' });
        }
        res.clearCookie('connect.sid');
        console.log('User logged out');
        res.redirect('/login.html');
    });
});

// --- API Endpoint to Add News ---
app.post('/api/add-news', async (req, res) => {
    const { title, summary, image_url, article_link } = req.body;

    if (!title || !summary || !image_url || !article_link) {
        return res.status(400).json({ success: false, message: 'All news fields are required.' });
    }

    try {
        const newsArticle = {
            title,
            summary,
            image_url,
            article_link,
            published_date: new Date(),
            is_latest: true,
            created_at: new Date()
        };

        const result = await db.collection('news_articles').insertOne(newsArticle);

        if (result.insertedId) {
            res.status(201).json({ success: true, message: 'News added successfully!' });
        } else {
            res.status(500).json({ success: false, message: 'Failed to add news article.' });
        }

    } catch (error) {
        console.error('Database error when adding news:', error);
        res.status(500).json({ success: false, message: 'Server error adding news article.' });
    }
});

// --- API Endpoint to Get News ---
app.get('/api/news', async (req, res) => {
    try {
        const articles = await db.collection('news_articles')
            .find({})
            .sort({ published_date: -1 })
            .toArray();

        res.status(200).json({ success: true, articles });
    } catch (error) {
        console.error('Error fetching news:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch news articles.' });
    }
});

// --- API Endpoint to Get Search History ---
app.get('/api/search-history', isAuthenticated, async (req, res) => {
    try {
        const userId = req.session.user.id;

        const history = await db.collection('searches')
            .find({ user_id: userId })
            .sort({ created_at: -1 })
            .toArray();

        res.json({ success: true, history });
    } catch (error) {
        console.error('Error fetching search history:', error);
        res.status(500).json({ success: false, message: 'Server error fetching search history.' });
    }
});

// --- API Endpoint to Get Environmental Impact ---
app.get('/api/environmental_impact', isAuthenticated, async (req, res) => {
    const { ProductName } = req.query;

    if (!ProductName) {
        try {
            console.log('Fetching all products...');

            const products = await db.collection('products')
                .find({})
                .sort({ AnalysisDate: -1 })
                .toArray();

            console.log('All products fetched:', products.length, 'products found');

            res.json({
                success: true,
                products: products,
                total: products.length
            });

        } catch (error) {
            console.error('Database error fetching all products:', error);
            res.status(500).json({
                success: false,
                message: 'Database error occurred',
                error: error.message
            });
        }
    } else {
        try {
            const environmentalImpact = await db.collection('environmental_impact')
                .findOne({
                    ProductName: { $regex: new RegExp(`^${ProductName.trim()}$`, 'i') }
                });

            if (!environmentalImpact) {
                return res.json({ success: false, environmental_impact: null });
            }

            res.json({
                success: true,
                environmental_impact: environmentalImpact
            });

        } catch (error) {
            res.json({ success: false, environmental_impact: null });
        }
    }
});

// --- API Endpoint to Search Products (robust match) ---
app.get('/api/search-products', isAuthenticated, async (req, res) => {
    const raw = (req.query.query || '').trim();
    const userId = req.session.user.id;

    console.log('[SEARCH] Query received:', raw);
    console.log('[SEARCH] User ID:', userId);

    if (!raw) {
        console.log('[SEARCH] Empty query, returning empty array');
        return res.json({ success: true, products: [] });
    }

    try {
        // Search by partial match (case-insensitive)
        const searchRegex = new RegExp(raw, 'i');

        console.log('[SEARCH] Searching with regex:', searchRegex);

        const products = await db.collection('products')
            .find({ ProductName: searchRegex })
            .collation({ locale: 'en', strength: 2 })
            .limit(20) // Limit to 20 results max
            .toArray();

        console.log('[SEARCH] Found products:', products.length);

        if (products.length > 0) {
            console.log('[SEARCH] First product:', products[0].ProductName);
            console.log('[SEARCH] Sample product data:', JSON.stringify(products[0]));
        }

        // Record search in database
        const searchRecord = {
            user_id: userId,
            query: raw,
            created_at: new Date(),
            product_id: products.length > 0 ? products[0]._id.toString() : null,
            searched_product_name: products.length > 0 ? products[0].ProductName : null,
            is_found: products.length > 0,
            eco_score: products.length > 0 ? (products[0].eco_score ?? null) : null,
            eco_letter: products.length > 0 ? (products[0].eco_letter ?? null) : null,
        };

        await db.collection('searches').insertOne(searchRecord);
        console.log('[SEARCH] Search record saved');

        // Map products to ensure consistent format for frontend
        const mapped = products.map(p => ({
            _id: p._id,
            ProductName: p.ProductName || 'Unnamed Product',
            Category: p.Category || 'Uncategorized',
            ProductImageURL: p.ProductImageURL || '',
            eco_score: p.eco_score ?? 0,
            _eco: parseInt(p.eco_score) || 0,
            sustainability_level: p.sustainability_level || 'Unknown',
            environmental_impact: p.environmental_impact || '',
            carbon_footprint: p.carbon_footprint || 0,
            water_consumption: p.water_consumption || 0,
            energy_usage: p.energy_usage || 0,
            AnalysisDate: p.AnalysisDate || p.created_at
        }));

        console.log('[SEARCH] Returning', mapped.length, 'mapped products');
        return res.json({ success: true, products: mapped });
    } catch (error) {
        console.error('[SEARCH] Database error:', error);
        return res.status(500).json({ success: false, message: 'Server error searching products.' });
    }
});

// --- Admin Middleware ---
const isAdmin = (req, res, next) => {
    if (req.session.user && req.session.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({ success: false, message: 'Forbidden: Admin access required.' });
    }
};

// --- API Endpoint to Change Admin Password ---
app.post('/api/admin/change-password', isAuthenticated, isAdmin, async (req, res) => {
    const userId = new ObjectId(req.session.user.id);
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
        return res.status(400).json({ success: false, message: 'Current and new passwords are required.' });
    }

    if (newPassword.length < 8) {
        return res.status(400).json({ success: false, message: 'New password must be at least 8 characters long.' });
    }

    try {
        const user = await db.collection('users').findOne({ _id: userId });

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }

        const isMatch = await bcrypt.compare(currentPassword, user.password_hash);

        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Invalid current password.' });
        }

        const saltRounds = 10;
        const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

        const result = await db.collection('users').updateOne(
            { _id: userId },
            {
                $set: {
                    password_hash: newPasswordHash,
                    updated_at: new Date()
                }
            }
        );

        if (result.matchedCount === 1) {
            res.json({ success: true, message: 'Password updated successfully!' });
        } else {
            res.status(500).json({ success: false, message: 'Failed to update password.' });
        }

    } catch (error) {
        console.error('Error changing password:', error);
        res.status(500).json({ success: false, message: 'Server error during password change.' });
    }
});

// --- API Endpoint to Delete Admin Account ---
app.delete('/api/admin/delete-account', isAuthenticated, isAdmin, async (req, res) => {
    const userId = new ObjectId(req.session.user.id);

    try {
        const result = await db.collection('users').deleteOne({ _id: userId });

        if (result.deletedCount === 0) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }

        req.session.destroy((err) => {
            if (err) {
                console.error('Error destroying session after account deletion:', err);
                return res.json({ success: true, message: 'Account deleted, but session destruction had an issue. Please clear cookies manually.' });
            }
            res.clearCookie('connect.sid');
            res.status(200).json({ success: true, message: 'Account deleted successfully. Redirecting to login.', redirectUrl: '/login.html' });
        });

    } catch (error) {
        console.error('Error deleting account:', error);
        res.status(500).json({ success: false, message: 'Server error during account deletion.' });
    }
});

// --- API Endpoint to Get All Users ---
app.get('/api/admin/get-users', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const users = await db.collection('users')
            .find({}, { projection: { Emailadd: 1 } })
            .toArray();

        const userEmails = users.map(user => user.Emailadd);

        res.json({ success: true, emails: userEmails });

    } catch (error) {
        console.error('Error fetching user emails:', error);
        res.status(500).json({ success: false, message: 'Server error fetching user data.' });
    }
});

// --- API Endpoint to Get Notification History ---
app.get('/api/admin/notification-history', isAuthenticated, isAdmin, async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    try {
        const totalItems = await db.collection('notifications').countDocuments({});

        const notifications = await db.collection('notifications')
            .find({})
            .sort({ sent_at: -1 })
            .skip(skip)
            .limit(limit)
            .toArray();

        const formattedHistory = notifications.map(item => {
            let date;

            if (item.sent_at) {
                date = new Date(item.sent_at);
            }

            const sentAtString = (date && !isNaN(date))
                ? date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) +
                ', ' +
                date.toLocaleTimeString('en-US', { hour: 'numeric', minute: 'numeric', hour12: true })
                : 'N/A';


            const recipientEmailsJsonString = Array.isArray(item.recipient_emails)
                ? JSON.stringify(item.recipient_emails)
                : JSON.stringify([item.recipient_emails]); // Handle case where it's a single string

            return {
                ...item,
                sent_at: sentAtString,
                recipient_emails: recipientEmailsJsonString
            };
        });

        res.json({
            success: true,
            notifications: formattedHistory,
            totalItems: totalItems,
            totalPages: Math.ceil(totalItems / limit),
            currentPage: page
        });

    } catch (error) {
        console.error('Error fetching notification history:', error);
        res.status(500).json({ success: false, message: 'Server error fetching history.' });
    }
});

// --- API Endpoint to Send Notification ---
app.post('/api/admin/send-notification', isAuthenticated, isAdmin, async (req, res) => {
    const { emails, title, message } = req.body;

    if (!emails || !title || !message) {
        return res.status(400).json({ success: false, message: 'Missing required fields.' });
    }

    try {
        const notification = {
            title,
            message,
            recipient_emails: emails,
            sent_at: new Date()
        };

        const result = await db.collection('notifications').insertOne(notification);

        if (result.insertedId) {
            res.status(200).json({ success: true, message: 'Notification sent successfully.' });
        } else {
            res.status(500).json({ success: false, message: 'Failed to save notification to history.' });
        }
    } catch (error) {
        console.error('Error sending notification:', error);
        res.status(500).json({ success: false, message: 'An unexpected error occurred.' });
    }
});

// --- API Endpoint for Users to Get Their Notifications ---
app.get('/api/notifications', isAuthenticated, async (req, res) => {
    try {
        const userEmail = req.session.user.email;

        if (!userEmail) {
            return res.status(401).json({ success: false, message: 'User email not found.' });
        }

        const notifications = await db.collection('notifications')
            .find({ recipient_emails: { $in: [userEmail] } })
            .sort({ sent_at: -1 })
            .toArray();

        const formattedNotifications = notifications.map(item => {
            const date = new Date(item.sent_at);
            const options = {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: 'numeric',
                minute: 'numeric',
                hour12: true
            };
            return {
                id: item._id.toString(),
                title: item.title,
                message: item.message,
                sent_at: date.toLocaleDateString('en-US', options) + ', ' + date.toLocaleTimeString('en-US', { hour: 'numeric', minute: 'numeric', hour12: true })
            };
        });

        res.json({ success: true, notifications: formattedNotifications });

    } catch (error) {
        console.error('Error fetching user notifications:', error);
        res.status(500).json({ success: false, message: 'Server error fetching notifications.' });
    }
});

// --- API Endpoint to Get All Users (Admin) ---
app.get('/api/users', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const projection = {
            Fullname: 1,
            Emailadd: 1,
            Mobile: 1,
            Bio: 1,
            Location: 1,
            ProfilePic: 1,
            Profile_Picture_URL: 1,
            last_active_at: 1,
        };

        const users = await db.collection('users')
            .find({}, { projection: projection })
            .toArray();

        const formattedUsers = users.map(user => ({
            user_id: user._id.toString(),
            Fullname: user.Fullname,
            Emailadd: user.Emailadd,
            Mobile: user.Mobile || 'N/A',
            Bio: user.Bio || 'N/A',
            Location: user.Location || 'N/A',
            ProfilePic: user.ProfilePic || user.Profile_Picture_URL || null,
            last_active_at: user.last_active_at || new Date(0),
        }));

        res.json({ success: true, users: formattedUsers });

    } catch (error) {
        console.error('Error fetching full user list for admin:', error);
        res.status(500).json({ success: false, message: 'Server error fetching user data.' });
    }
});

// --- API Endpoint to Delete a User (for users.js) ---
app.delete('/api/users/:id', isAuthenticated, isAdmin, async (req, res) => {
    const userId = req.params.id;

    if (!ObjectId.isValid(userId)) {
        return res.status(400).json({ success: false, message: 'Invalid User ID format.' });
    }

    const objectId = new ObjectId(userId);

    try {
        // First, delete related records (products, searches)
        await db.collection('products').deleteMany({ user_id: userId });
        await db.collection('searches').deleteMany({ user_id: userId });

        // Then, delete the user itself
        const result = await db.collection('users').deleteOne({ _id: objectId });

        if (result.deletedCount === 0) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }

        res.json({ success: true, message: 'User and all related data deleted successfully.' });

    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ success: false, message: 'Server error during user deletion.' });
    }
});

// --- API Endpoint to Update User Activity (Heartbeat) ---
app.post('/api/update-activity', isAuthenticated, async (req, res) => {
    const { user_id } = req.body;

    // Ensure the ID sent from the frontend matches the logged-in user's ID
    if (!user_id || user_id !== req.session.user.id) {
        return res.status(403).json({ success: false, message: 'Unauthorized activity update.' });
    }

    try {
        const objectId = new ObjectId(user_id);

        const result = await db.collection('users').updateOne(
            { _id: objectId },
            { $set: { last_active_at: new Date() } }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }

        res.json({ success: true, message: 'Activity timestamp updated.' });

    } catch (error) {
        console.error('Error updating user activity:', error);
        res.status(500).json({ success: false, message: 'Server error during activity update.' });
    }
});

// --- Graceful shutdown ---
process.on('SIGINT', async () => {
    console.log('Shutting down server...');
    if (client) {
        await client.close();
        console.log('MongoDB connection closed.');
    }
    process.exit(0);
});

// Add this helper ABOVE mapToDb:
const clampEcoScore = (n) => {
    const x = parseFloat(n);
    if (Number.isNaN(x)) return null;
    // 0–95 cap and 2-dec rounding
    return Math.max(0, Math.min(95, parseFloat(x.toFixed(2))));
};

const mapToDb = (data) => ({

    ProductName: data.name,
    ProductImageURL: data.image,
    Category: data.category,
    AnalysisDate: data.date ? new Date(data.date) : new Date(),
    eco_score: clampEcoScore(data.eco_score),
    eco_letter: data.eco_letter || null,

    carbon_footprint: data.factors?.carbonFootprint || null,
    water_consumption: data.factors?.waterConsumption || null,
    energy_usage: data.factors?.energyUsage || null,
    waste_pollution: data.factors?.wastePollution || null,
    chemical_usage: data.factors?.chemicalUsage || null,
    recyclability: data.factors?.recyclability || null,

    eco_score: data.eco_score || null,
    eco_letter: data.eco_letter || null,

    environmental_impact: data.impact,
    sustainability_level: data.sustain,
    analysis_date: data.date ? new Date(data.date) : new Date(),

    uploaded_by_user_id: data.user_id ? new ObjectId(data.user_id) : null,
    created_at: new Date(),
    updated_at: new Date(),

    ingredients: Array.isArray(data.ingredients)
        ? data.ingredients
        : (typeof data.ingredients === 'string'
            ? data.ingredients.split(',').map(s => s.trim()).filter(Boolean)
            : []),
});

const mapToFrontend = (dbDoc) => {
    const doc = dbDoc;

    const safeDisplay = (value) => (value && String(value).trim() !== '') ? value : 'N/A';

    const carbon = doc.carbon_footprint ? doc.carbon_footprint.toString() : null;
    const water = doc.water_consumption ? doc.water_consumption.toString() : null;
    const energy = doc.energy_usage ? doc.energy_usage.toString() : null;

    const rawEcoScore = doc.eco_score ? String(doc.eco_score) : null;
    const ecoScoreValue = parseInt(rawEcoScore);

    return {
        id: doc._id.toString(),
        name: safeDisplay(doc.ProductName),
        image: doc.ProductImageURL,
        category: safeDisplay(doc.Category),
        date: doc.AnalysisDate ? new Date(doc.AnalysisDate).toISOString().slice(0, 10) : 'N/A',

        eco: (ecoScoreValue >= 0 && !isNaN(ecoScoreValue)) ? `${ecoScoreValue}/100` : 'N/A',
        eco_letter: safeDisplay(doc.eco_letter),
        impact: safeDisplay(doc.environmental_impact),
        sustain: safeDisplay(doc.sustainability_level),

        // Factors 
        factors: {
            carbonFootprint: carbon,
            waterConsumption: water,
            energyUsage: energy,
            wastePollution: doc.waste_pollution || null,
            chemicalUsage: doc.chemical_usage || null,
            recyclability: doc.recyclability || null,
        },

        // NEW: ingredients to camelCase frontend
        ingredients: Array.isArray(doc.ingredients)
            ? doc.ingredients
            : (doc.ingredients ? [doc.ingredients] : [])
    };
};


app.get('/products', async (req, res) => {
    try {
        const products = await db.collection('products')
            .find({})
            .sort({ created_at: -1 })
            .toArray();

        res.status(200).json(products.map(mapToFrontend));
    } catch (error) {
        console.error("GET /products error (Native MongoDB):", error);
        res.status(500).json({ message: 'Failed to retrieve products', error: error.message });
    }
});

// B. POST /products: Add New Product
app.post('/products', async (req, res) => {
    try {
        const userId = req.session.user ? req.session.user.id : null;

        // Tiyakin na may user ID bago mag-map
        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized. Please log in.' });
        }

        const dbData = mapToDb({ ...req.body, user_id: userId });

        const result = await db.collection('products').insertOne(dbData);

        if (result.insertedId) {
            const savedProduct = await db.collection('products').findOne({ _id: result.insertedId });
            res.status(201).json(mapToFrontend(savedProduct));
        } else {
            throw new Error("Product insertion failed.");
        }
    } catch (error) {
        console.error("POST /products error (Native MongoDB):", error);
        res.status(500).json({ message: 'Failed to add product', error: error.message });
    }
});

function buildIdOrQuery(rawId) {
    const id = String(rawId ?? "").trim();

    const or = [];
    try {
        or.push({ _id: new ObjectId(id) });
    } catch (e) {
    }

    or.push({ _id: id }, { id });

    return { $or: or };
}

// PUT /products/:id
app.put('/products/:id', async (req, res) => {
    const rawId = req.params.id;
    try {
        if (!rawId) return res.status(400).json({ message: 'Invalid product id' });

        const query = buildIdOrQuery(rawId);

        const { uploaded_by_user_id, created_at, _id, id, ...updateFields } = mapToDb(req.body);

        console.log('[PUT /products/:id]', rawId, JSON.stringify(query));

        const result = await db.collection('products').findOneAndUpdate(
            query,
            { $set: { ...updateFields, updated_at: new Date() } },
            { returnDocument: 'after' }
        );

        if (!result.value) return res.status(404).json({ message: 'Product not found' });
        res.status(200).json(mapToFrontend(result.value));
    } catch (error) {
        console.error('PUT /products/:id error:', error);
        res.status(500).json({ message: 'Failed to update product', error: error.message });
    }
});

// DELETE /products/:id
app.delete('/products/:id', async (req, res) => {
    const rawId = req.params.id;
    try {
        if (!rawId) return res.status(400).json({ message: 'Invalid product id' });

        const query = buildIdOrQuery(rawId);
        console.log('[DELETE /products/:id]', rawId, JSON.stringify(query));

        const result = await db.collection('products').deleteOne(query);
        if (result.deletedCount === 0) return res.status(404).json({ message: 'Product not found' });

        res.status(204).send();
    } catch (error) {
        console.error('DELETE /products/:id error:', error);
        res.status(500).json({ message: 'Failed to delete product', error: error.message });
    }
});

// --- API Endpoint to Get Categorized Products (Categories Page) ---
app.get('/api/categories/data', async (req, res) => {
    try {
        console.log('\n🔍 === FETCHING CATEGORIZED PRODUCTS ===');


        const allProducts = await db.collection('products')
            .find({})
            .sort({ created_at: -1 }) // Latest first
            .toArray();

        console.log(`📦 Total products in database: ${allProducts.length}`);

        if (!allProducts || allProducts.length === 0) {
            console.log('⚠️ No products found in database');
            return res.json({ low: [], moderate: [], high: [] });
        }


        const normalizeImpact = (impact) => {
            if (!impact) return '';
            return impact.toString().toLowerCase().trim().replace(/\s+/g, ' ');
        };


        const categorized = {
            low: [],
            moderate: [],
            high: [],
            uncategorized: []
        };

        allProducts.forEach(product => {
            const impact = normalizeImpact(product.environmental_impact);

            console.log(`Product: ${product.ProductName} | Impact: "${product.environmental_impact}" | Normalized: "${impact}"`);

            if (impact.includes('low') && impact.includes('emission')) {
                categorized.low.push(product);
            } else if (impact.includes('moderate') && impact.includes('emission')) {
                categorized.moderate.push(product);
            } else if (impact.includes('high') && impact.includes('emission')) {
                categorized.high.push(product);
            } else {
                categorized.uncategorized.push(product);
                console.log(`⚠️ Uncategorized product: ${product.ProductName} with impact: "${product.environmental_impact}"`);
            }
        });

        console.log('\n📊 === CATEGORIZATION RESULTS ===');
        console.log(`✅ Low Impact: ${categorized.low.length} products`);
        console.log(`⚠️ Moderate Impact: ${categorized.moderate.length} products`);
        console.log(`❌ High Impact: ${categorized.high.length} products`);
        console.log(`🔍 Uncategorized: ${categorized.uncategorized.length} products`);

        res.json({
            low: categorized.low,
            moderate: categorized.moderate,
            high: categorized.high
        });

    } catch (error) {
        console.error('❌ Error fetching and clustering products:', error);
        res.status(500).json({
            message: 'Error retrieving product data',
            error: error.message,
            low: [],
            moderate: [],
            high: []
        });
    }
});

// GET total number of products
app.get('/api/total-products', async (req, res) => {
    try {
        const db = client.db('signup_db');
        const products = db.collection('products');
        const total = await products.countDocuments();
        res.json({ total });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching total products' });
    }
});

// GET total products comparison (this month vs last month)
app.get('/api/total-products-comparison', async (req, res) => {
    try {
        const db = client.db('signup_db');
        const products = db.collection('products');

        const now = new Date();
        const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1); 
        const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1); 
        
        // 1. TAMANG QUERY: Gamitin ang $lt (less than) para sa previous month
        const lastMonthCount = await products.countDocuments({
            created_at: { 
                $gte: startOfLastMonth, 
                $lt: startOfThisMonth // Ito ang tamang upper boundary
            }
        });

        // 2. THIS MONTH QUERY: Start mula sa simula ng buwan na ito
        const thisMonthCount = await products.countDocuments({
            created_at: { $gte: startOfThisMonth }
        });

        // 3. TAMANG CALCULATION
        let percentageDifference = 0;

        if (lastMonthCount > 0) {
            percentageDifference = ((thisMonthCount - lastMonthCount) / lastMonthCount) * 100;
        } else if (thisMonthCount > 0) {
            percentageDifference = 100;
        } 
        
        // 4. IPADALA ANG TAMANG RESULTA
        // Expected result for 2 vs 191 is -98.95...
        res.json({
            // Padalhan ng 2 decimal places ang frontend.
            difference: percentageDifference.toFixed(2) 
        });

    } catch (error) {
        console.error('Error fetching product comparison:', error);
        res.status(500).json({ message: 'Error fetching product comparison' });
    }
});

// --- MongoDB connection ---
const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log(`✅ MongoDB connected: ${conn.connection.host}`);
    } catch (error) {

    }
};


connectDB();

// --- Get today's users (using LAST_ACTIVE_AT) ---
app.get('/api/today-users', async (req, res) => {
    try {
        const db = client.db('signup_db');
        const usersCollection = db.collection('users');

        const startOfDay = new Date();
        startOfDay.setUTCHours(0, 0, 0, 0);

        const endOfDay = new Date();
        endOfDay.setUTCHours(23, 59, 59, 999);

        const todayCount = await usersCollection.countDocuments({
            last_active_at: { $gte: startOfDay, $lte: endOfDay }
        });

        res.json({ todayUsers: todayCount });
    } catch (err) {
        console.error('Error fetching today users:', err);
        res.status(500).json({ error: 'Failed to fetch today users' });
    }
});

// --- Compare user growth vs last month ---
app.get('/api/users-comparison', async (req, res) => {
    try {
        const db = client.db('signup_db');
        const usersCollection = db.collection('users');

        const now = new Date();
        const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

        const thisMonthUsers = await usersCollection.countDocuments({
            created_at: { $gte: startOfThisMonth }
        });

        const lastMonthUsers = await usersCollection.countDocuments({
            created_at: { $gte: startOfLastMonth, $lt: startOfThisMonth }
        });

        const change = lastMonthUsers === 0
            ? 0
            : ((thisMonthUsers - lastMonthUsers) / lastMonthUsers) * 100;

        res.json({ percentChange: change.toFixed(2) });
    } catch (err) {
        console.error('Error fetching user comparison:', err);
        res.status(500).json({ error: 'Failed to fetch user comparison' });
    }
});

// --- Get weekly product data for the bar chart ---
app.get('/api/new-products-week', async (req, res) => {
    try {
        const db = client.db('signup_db');
        const products = db.collection('products');

        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        sevenDaysAgo.setHours(0, 0, 0, 0);

        const pipeline = [
            {
                $match: {
                    created_at: { $gte: sevenDaysAgo }
                }
            },
            {
                $group: {
                    _id: { $dayOfWeek: '$created_at' },
                    count: { $sum: 1 }
                }
            },
            {
                $sort: {
                    _id: 1
                }
            }
        ];

        const results = await products.aggregate(pipeline).toArray();

        // Map results to chart.js format
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const chartLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        const chartData = [0, 0, 0, 0, 0, 0, 0];

        results.forEach(item => {
            const mongoDayIndex = item._id;
            let chartIndex;

            if (mongoDayIndex === 1) {
                chartIndex = 6;
            } else {
                chartIndex = mongoDayIndex - 2;
            }

            if (chartIndex >= 0 && chartIndex < 7) {
                chartData[chartIndex] = item.count;
            }
        });


        res.json({
            days: chartLabels,
            data: chartData
        });

    } catch (err) {
        console.error('Error fetching weekly product data:', err);
        res.status(500).json({ error: 'Failed to fetch weekly product data' });
    }
});

// API endpoint for Product Clustering Summary
app.get('/api/product-clustering', async (req, res) => {
    try {
        const db = client.db('signup_db');  // 
        const products = db.collection('products');

        const highCount = await products.countDocuments({
            environmental_impact: { $regex: /high/i }
        });

        const moderateCount = await products.countDocuments({
            environmental_impact: { $regex: /moderate/i }
        });

        const lowCount = await products.countDocuments({
            environmental_impact: { $regex: /low/i }
        });

        res.json({
            high: highCount,
            moderate: moderateCount,
            low: lowCount,
            total: highCount + moderateCount + lowCount
        });

    } catch (err) {
        console.error('Error fetching product clustering data:', err);
        res.status(500).json({ error: 'Failed to fetch product clustering data' });
    }
});

// --- API Endpoint: Get Monthly User Data for Line Chart ---
app.get('/api/users-monthly', async (req, res) => {
    try {
        const db = client.db('signup_db');
        const usersCollection = db.collection('users');

        const now = new Date();
        const startDate = new Date(now.getFullYear(), now.getMonth() - 11, 1);
        startDate.setHours(0, 0, 0, 0);

        const pipeline = [
            {
                $match: {
                    created_at: { $gte: startDate }
                }
            },
            {
                $group: {
                    _id: {
                        year: { $year: '$created_at' },
                        month: { $month: '$created_at' }
                    },
                    count: { $sum: 1 }
                }
            },
            {
                $sort: {
                    '_id.year': 1,
                    '_id.month': 1
                }
            }
        ];

        const results = await usersCollection.aggregate(pipeline).toArray();

        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
            'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const chartLabels = [];
        const chartData = [];

        for (let i = 11; i >= 0; i--) {
            const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const monthLabel = monthNames[date.getMonth()];
            chartLabels.push(monthLabel);

            const monthData = results.find(r =>
                r._id.year === date.getFullYear() &&
                r._id.month === (date.getMonth() + 1)
            );

            chartData.push(monthData ? monthData.count : 0);
        }

        res.json({
            labels: chartLabels,
            data: chartData
        });

        console.log('✅ Monthly user data sent:', chartLabels, chartData);
    } catch (err) {
        console.error('❌ Error fetching monthly user data:', err);
        res.status(500).json({ error: 'Failed to fetch monthly user data' });
    }
});



// --- API Endpoint to Calculate Total Emissions ---
app.get('/api/totalEmissions', async (req, res) => {
    if (!db) {
        return res.status(503).json({ success: false, message: 'Database not connected yet.' });
    }

    try {
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

        res.json({ success: true, totalEmissions: totalEmissions });

    } catch (err) {
        console.error('❌ CRITICAL TOTAL EMISSIONS DB ERROR:', err);
        res.status(500).json({ success: false, message: 'Failed to calculate total emissions on server.' });
    }
});


// --- API Endpoint: Compare Emissions (Today vs Yesterday) ---
app.get('/api/emissions-comparison', async (req, res) => {
    if (!db) {
        return res.status(503).json({ success: false, message: 'Database not connected yet.' });
    }

    try {
        const products = db.collection('products');

        const now = new Date();
        const startOfToday = new Date(now);
        startOfToday.setUTCHours(0, 0, 0, 0);
        const startOfYesterday = new Date(startOfToday);
        startOfYesterday.setDate(startOfToday.getDate() - 1);
        const endOfYesterday = new Date(startOfToday);
        endOfYesterday.setMilliseconds(endOfYesterday.getMilliseconds() - 1);
        const endOfToday = new Date(now);
        endOfToday.setUTCHours(23, 59, 59, 999);

        const calculateEmissions = async (startDate, endDate) => {
            const pipeline = [
                {
                    $match: {
                        created_at: { $gte: startDate, $lte: endDate }
                    }
                },
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
                        total: { $sum: "$carbonFootprintNum" }
                    }
                }
            ];

            const result = await products.aggregate(pipeline).toArray();
            // Use .valueOf() and parseFloat to get a standard JavaScript number
            return result.length > 0 ? parseFloat(result[0].total.valueOf()) : 0;
        };

        const todayEmissions = await calculateEmissions(startOfToday, endOfToday);
        const yesterdayEmissions = await calculateEmissions(startOfYesterday, endOfYesterday);

        let percentChange = 0;
        if (yesterdayEmissions > 0) {
            percentChange = ((todayEmissions - yesterdayEmissions) / yesterdayEmissions) * 100;
        } else if (todayEmissions > 0) {
            percentChange = 100;
        }

        res.json({
            success: true,
            percentChange: percentChange.toFixed(2)
        });

    } catch (err) {
        console.error('❌ Error fetching emissions comparison:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch emissions comparison.' });
    }
});


// --- API Endpoint: Monthly Emissions & Linear Regression Trend ---
app.get('/api/emissions-trend', async (req, res) => {
    if (!db) {
        return res.status(503).json({ success: false, message: 'Database not connected yet.' });
    }

    try {
        const products = db.collection('products');

        // 1. Get Monthly Emissions Data from MongoDB
        const monthlyData = await products.aggregate([
            // Match records with a created_at field (ensure data is present)
            { $match: { created_at: { $exists: true } } },
            {
                // Convert carbon_footprint to a numeric type for calculation
                $addFields: {
                    carbonFootprintNum: {
                        $convert: { input: "$carbon_footprint", to: "decimal", onError: 0, onNull: 0 }
                    }
                }
            },
            {
                // Group by month and year, and calculate total emissions for that month
                $group: {
                    _id: {
                        year: { $year: "$created_at" },
                        month: { $month: "$created_at" }
                    },
                    totalMonthlyEmissions: { $sum: "$carbonFootprintNum" }
                }
            },
            // Sort chronologically
            { $sort: { "_id.year": 1, "_id.month": 1 } }
        ]).toArray();

        // 2. Prepare Data for Linear Regression and Charting
        const labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

        // Map monthly data to a sequential array, filling missing months with 0
        let historicalEmissions = [];
        let dataPoints = []; // [{ x: monthIndex, y: emissionTotal }]
        let overallMonthIndex = 0; // Sequential month count for regression (X-axis variable)

        // Assume we only want data from the current year for simplicity
        const currentYear = new Date().getFullYear();
        const currentMonth = new Date().getMonth() + 1; // 1-indexed

        // Store actual emissions as numbers for easier comparison later
        let actualEmissionsNumeric = new Array(12).fill(0);

        // Initialize 12 months for the current year
        for (let month = 1; month <= 12; month++) {
            const dataPoint = monthlyData.find(d =>
                d._id.year === currentYear && d._id.month === month
            );

            const emissions = dataPoint
                ? parseFloat(dataPoint.totalMonthlyEmissions.valueOf())
                : 0.00; // Keep as number for now

            historicalEmissions.push(emissions.toFixed(2)); // Push fixed string for display
            actualEmissionsNumeric[month - 1] = emissions; // Store numeric for conditional logic

            // Only add points with actual data (or up to the current month) to the regression data set
            // For regression, we want the actual trends, even if zero for past months up to current.
            if (month <= currentMonth) { // Include all months up to current for regression basis
                dataPoints.push({ x: overallMonthIndex, y: emissions });
            }
            overallMonthIndex++;
        }

        // 3. Perform Simple Linear Regression (Y = mX + b)
        let sumX = 0, sumY = 0, sumXX = 0, sumXY = 0;
        const n = dataPoints.length;

        dataPoints.forEach(p => {
            sumX += p.x;
            sumY += p.y;
            sumXX += p.x * p.x;
            sumXY += p.x * p.y;
        });

        // Calculate slope (m) and intercept (b)
        const m = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
        const b = (sumY - m * sumX) / n;

        const PREDICTION_OFFSET = 500;

        // 4. Generate Regression Line Data for all 12 months
        let regressionData = [];
        for (let x = 0; x < 12; x++) {
            let y_pred = m * x + b;

            y_pred += PREDICTION_OFFSET;

            regressionData.push(Math.max(0, y_pred.toFixed(2)));
        }

        res.json({
            success: true,
            labels: labels,
            historicalData: historicalEmissions,
            regressionData: regressionData
        });

    } catch (err) {
        console.error('❌ CRITICAL EMISSIONS TREND DB ERROR:', err);
        res.status(500).json({ success: false, message: 'Failed to calculate emissions trend on server.' });
    }
});


// server.js (API Endpoint A: AVERAGE ECO SCORE)
app.get('/api/user-average-score', isAuthenticated, async (req, res) => {

    const userId = req.session.user ? req.session.user.id : null;

    console.log(`[DEBUG: AVG SCORE] User ID from session: ${userId}`);

    try {
        if (!userId) {
            console.warn('[WARN] Session ID is missing. Returning 0 average score.');
            return res.json({ average_score: 0 });
        }
        if (!db) return res.status(503).json({ error: 'Database service unavailable' });

        const pipeline = [
            { $match: { user_id: userId } },

            {
                $group: {
                    _id: null,
                    average_score: {
                        $avg: {
                            $convert: {
                                input: "$eco_score",
                                to: "double",
                                onError: 0,
                                onNull: 0
                            }
                        }
                    }
                }
            }
        ];

        const result = await db.collection('searches').aggregate(pipeline).toArray();

        // Debug: I-log ang raw result
        console.log(`[DEBUG: AVG SCORE] Aggregation Result:`, result);

        let average_score = 0;
        if (result.length > 0 && result[0].average_score !== null) {
            average_score = Math.round(parseFloat(result[0].average_score));
        }

        res.json({ average_score: average_score });

    } catch (error) {
        console.error('MongoDB Aggregation Error:', error);
        res.status(500).json({ error: 'Failed to calculate average score due to server error' });
    }
});



(async () => {
    try {
        await connectToMongoDB();
        db = getDb();
        client = db.client;

        console.log('✅ Database ready, starting server...');

        // Start the Express server
        app.listen(PORT, () => {
            console.log(`🚀 Server is running on http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error("❌ Failed to start application:", error);
        process.exit(1);
    }
})();