// project/services/auth-service/index.js

import bcrypt from "bcryptjs";
import { getDb, ObjectId } from "../../shared/db.js"; 
import { sendEmail } from "../emailService.js"; // Ipagpalagay na tama ang path na ito

// *****************************************************************
// UTILITY FUNCTIONS 
// *****************************************************************
const OTP_EXPIRY_MINUTES = 10;
const TOKEN_EXPIRY_MINUTES = 30;

// Simple OTP generator
const generateOtp = () => {
    return Math.floor(100000 + Math.random() * 900000).toString(); 
};

// Secure Token generator
const generateToken = (length) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let token = '';
    for (let i = 0; i < length; i++) {
        token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return token;
};
// *****************************************************************


const authService = {
    // --- EXISTING REGISTER LOGIC ---
    async register(userData) {
        const { Fullname, Birthdate, Age, Username, Emailadd, password } = userData;

        if (!Fullname || !Birthdate || !Age || !Username || !Emailadd || !password) {
            throw { status: 400, message: 'All fields are required.' };
        }
        if (parseInt(Age) < 13) {
            throw { status: 400, message: 'You must be at least 13 years old to register.' };
        }

        const db = getDb();
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);
        const formattedBirthdate = new Date(Birthdate);

        const newUser = {
            Fullname, Birthdate: formattedBirthdate, Age: parseInt(Age), Username, Emailadd,
            password_hash: passwordHash,
            Profile_Picture_URL: '/images/default-profile.png', Bio: '', Mobile: '', Location: '',
            EcoScore: 0, ProductsUploaded: 0, role: 'user', created_at: new Date(), last_active_at: new Date()
        };

        try {
            const result = await db.collection('users').insertOne(newUser);
            return { success: true, userId: result.insertedId };
        } catch (error) {
            if (error.code === 11000) {
                const field = Object.keys(error.keyPattern)[0];
                if (field === 'Username') { throw { status: 409, message: 'Username already taken.' }; }
                if (field === 'Emailadd') { throw { status: 409, message: 'Email already registered.' }; }
            }
            throw error;
        }
    },

    // --- EXISTING LOGIN LOGIC ---
    async login(email, password) {
        if (!email || !password) {
            throw { status: 400, message: 'Email and password are required.' };
        }

        const db = getDb();
        const user = await db.collection('users').findOne({ Emailadd: email });

        if (!user) { throw { status: 401, message: 'Invalid credentials.' }; }

        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) { throw { status: 401, message: 'Invalid credentials.' }; }

        await db.collection('users').updateOne(
            { _id: user._id },
            { $set: { last_active_at: new Date() } }
        );

        return {
            id: user._id.toString(), username: user.Username, Fullname: user.Fullname,
            email: user.Emailadd, profilePictureUrl: user.Profile_Picture_URL,
            bio: user.Bio, mobile: user.Mobile, location: user.Location,
            ecoScore: user.EcoScore, productsUploaded: user.ProductsUploaded, role: user.role
        };
    },
    
    // =================================================================
    // 1. NEW FUNCTION: SEND OTP
    // =================================================================
    async sendOtp(email) {
        const db = getDb();
        const user = await db.collection('users').findOne({ Emailadd: email });

        if (!user) {
            // Security: Throw sensitive error para hindi malaman ng FE kung valid ang email
            const sensitiveError = new Error('User not found or email send failed.');
            sensitiveError.isSensitive = true; 
            throw sensitiveError;
        }

        const otpCode = generateOtp(); 
        const expirationTime = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60000); 
        
        console.log(`[OTP DEBUG] Generated OTP for ${email}: ${otpCode}`);
        console.log(`[OTP DEBUG] Expiration Time: ${expirationTime.toISOString()}`);
        // Log ang expiration time sa ISO format para mas madaling i-debug

        // Store OTP at Expiration
        await db.collection('users').updateOne(
            { _id: user._id },
            { $set: { otp_code: otpCode, otp_expires: expirationTime } }
        );

        const subject = "EcoBrand Password Reset Code";
        
        // Ipadala ang email
        const emailSuccess = await sendEmail(email, subject, otpCode, OTP_EXPIRY_MINUTES); 

        if (!emailSuccess) {
            // Rollback: Tanggalin ang OTP data
            await db.collection('users').updateOne(
                { _id: user._id },
                { $unset: { otp_code: "", otp_expires: "" } }
            );
            throw { status: 500, message: 'Failed to send OTP email. Please try again.' }; 
        }

        return { success: true };
    },

    // =================================================================
    // 2. NEW FUNCTION: VERIFY OTP
    // =================================================================
    async verifyOtp(otp_code) {
        if (!otp_code) {
            throw { status: 400, message: 'OTP code is required.' };
        }
        
        const db = getDb();
        
        // I-adjust ang currentTime ng 5 segundo (5000ms) pabalik para sa time drift buffer.
        const currentTimeWithBuffer = new Date(Date.now() - 5000); 
        
        // --- DEBUGGING LOGS ---
        console.log(`[OTP DEBUG] Received OTP: ${otp_code}`);
        console.log(`[OTP DEBUG] Current Time (Buffer): ${currentTimeWithBuffer.toISOString()}`);
        // --- END DEBUGGING LOGS ---

        const user = await db.collection('users').findOne({ 
            otp_code: otp_code,
            // Ginagamit ang buffer time para mahanap ang valid, hindi pa expired na OTP
            otp_expires: { $gt: currentTimeWithBuffer } 
        });

        if (!user) {
            // --- DEBUGGING LOGS ---
            console.log(`[OTP DEBUG] Failed verification for OTP: ${otp_code}. User not found or expired.`);
            // --- END DEBUGGING LOGS ---
            throw { status: 400, message: 'Invalid or expired OTP code. Please retry the process.' };
        }

        // --- DEBUGGING LOGS ---
        console.log(`[OTP DEBUG] OTP Verified! User ID: ${user._id}`);
        // --- END DEBUGGING LOGS ---
        
        // Generate Reset Token
        const resetToken = generateToken(32);
        const tokenExpiration = new Date(Date.now() + TOKEN_EXPIRY_MINUTES * 60000);

        // Store Token at Tanggalin ang OTP
        await db.collection('users').updateOne(
            { _id: user._id },
            { 
                $set: { reset_token: resetToken, token_expires: tokenExpiration },
                $unset: { otp_code: "", otp_expires: "" } 
            }
        );

        return { resetToken };
    },

    // =================================================================
    // 3. NEW FUNCTION: CHANGE PASSWORD
    // =================================================================
    async resetPassword(newPassword, confirmPassword, resetToken) {
        if (!newPassword || !confirmPassword || !resetToken) {
            throw { status: 400, message: 'All fields are required.' };
        }

        if (newPassword !== confirmPassword) {
            throw { status: 400, message: 'New passwords do not match.' };
        }

        const db = getDb();
        const currentTime = new Date();

        const user = await db.collection('users').findOne({ 
            reset_token: resetToken,
            token_expires: { $gt: currentTime } 
        });

        if (!user) {
            throw { status: 400, message: 'Invalid or expired reset session. Please restart the process.' };
        }

        // I-hash ang Bagong Password
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

        // Update Password at I-invalidate ang Token
        await db.collection('users').updateOne(
            { _id: user._id },
            { 
                $set: { password_hash: hashedPassword },
                $unset: { reset_token: "", token_expires: "" } 
            }
        );

        return { success: true };
    }
};

// Ito ang nag-aayos ng "does not provide an export named 'default'" error.
export default authService;
