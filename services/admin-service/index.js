import bcrypt from "bcryptjs";
import { getDb, ObjectId } from "../../shared/db.js";

export const adminService = {
    async changePassword(userId, currentPassword, newPassword) {
        if (!currentPassword || !newPassword) {
            throw { status: 400, message: 'Current and new passwords are required.' };
        }

        if (newPassword.length < 8) {
            throw { status: 400, message: 'New password must be at least 8 characters long.' };
        }

        const db = getDb();
        const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });

        if (!user) {
            throw { status: 404, message: 'User not found.' };
        }

        const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
        if (!isMatch) {
            throw { status: 401, message: 'Invalid current password.' };
        }

        const saltRounds = 10;
        const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

        await db.collection('users').updateOne(
            { _id: new ObjectId(userId) },
            { $set: { password_hash: newPasswordHash, updated_at: new Date() } }
        );

        return { success: true };
    },

    async deleteAccount(userId) {
        const db = getDb();
        const result = await db.collection('users').deleteOne({ _id: new ObjectId(userId) });

        if (result.deletedCount === 0) {
            throw { status: 404, message: 'User not found.' };
        }

        return { success: true };
    },

    async getAllUsers() {
        const db = getDb();
        const users = await db.collection('users')
            .find({}, {
                projection: {
                    Fullname: 1,
                    Emailadd: 1,
                    Mobile: 1,
                    Bio: 1,
                    Location: 1,
                    Profile_Picture_URL: 1,
                    last_active_at: 1
                }
            })
            .toArray();

        return users.map(user => ({
            user_id: user._id.toString(),
            Fullname: user.Fullname,
            Emailadd: user.Emailadd,
            Mobile: user.Mobile || 'N/A',
            Bio: user.Bio || 'N/A',
            Location: user.Location || 'N/A',
            ProfilePic: user.Profile_Picture_URL || null,
            last_active_at: user.last_active_at || new Date(0)
        }));
    },

    async getUserEmails() {
        const db = getDb();
        const users = await db.collection('users')
            .find({}, { projection: { Emailadd: 1 } })
            .toArray();

        return users.map(user => user.Emailadd);
    },

    async deleteUser(userId) {
        const db = getDb();
        
        await Promise.all([
            db.collection('products').deleteMany({ user_id: userId }),
            db.collection('searches').deleteMany({ user_id: userId })
        ]);

        const result = await db.collection('users').deleteOne({ _id: new ObjectId(userId) });

        if (result.deletedCount === 0) {
            throw { status: 404, message: 'User not found.' };
        }

        return { success: true };
    },

    async sendNotification(emails, title, message) {
        if (!emails || !title || !message) {
            throw { status: 400, message: 'Missing required fields.' };
        }

        const db = getDb();
        const notification = {
            title,
            message,
            recipient_emails: emails,
            sent_at: new Date()
        };

        const result = await db.collection('notifications').insertOne(notification);

        if (!result.insertedId) {
            throw { status: 500, message: 'Failed to save notification.' };
        }

        return { success: true };
    },

    async getNotificationHistory(page = 1, limit = 10) {
        const db = getDb();
        const skip = (page - 1) * limit;

        const [totalItems, notifications] = await Promise.all([
            db.collection('notifications').countDocuments({}),
            db.collection('notifications')
                .find({})
                .sort({ sent_at: -1 })
                .skip(skip)
                .limit(limit)
                .toArray()
        ]);

        const formattedHistory = notifications.map(item => {
            const date = new Date(item.sent_at);
            const sentAtString = date.toLocaleDateString('en-US', { 
                year: 'numeric', month: 'long', day: 'numeric' 
            }) + ', ' + date.toLocaleTimeString('en-US', { 
                hour: 'numeric', minute: 'numeric', hour12: true 
            });

            return {
                ...item,
                sent_at: sentAtString,
                recipient_emails: JSON.stringify(
                    Array.isArray(item.recipient_emails) ? item.recipient_emails : [item.recipient_emails]
                )
            };
        });

        return {
            notifications: formattedHistory,
            totalItems,
            totalPages: Math.ceil(totalItems / limit),
            currentPage: page
        };
    }
};