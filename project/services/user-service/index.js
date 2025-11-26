import bcrypt from "bcryptjs";
import { getDb, ObjectId } from "../../shared/db.js";

export const userService = {
    async getUserById(userId) {
        const db = getDb();
        const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
        
        if (!user) {
            throw { status: 404, message: 'User not found.' };
        }

        return {
            username: user.Username,
            Fullname: user.Fullname,
            email: user.Emailadd,
            profilePictureUrl: user.Profile_Picture_URL,
            bio: user.Bio,
            mobile: user.Mobile,
            location: user.Location,
            ecoScore: user.EcoScore,
            productsUploaded: user.ProductsUploaded
        };
    },

    async updateProfile(userId, { bio, mobile, location }) {
        if (bio === undefined || mobile === undefined || location === undefined) {
            throw { status: 400, message: 'Invalid input for profile update.' };
        }

        const db = getDb();
        const result = await db.collection('users').updateOne(
            { _id: new ObjectId(userId) },
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
            throw { status: 404, message: 'User not found.' };
        }

        return await this.getUserById(userId);
    },

    async changePassword(userId, newPassword, confirmPassword) {
        if (!newPassword || !confirmPassword) {
            throw { status: 400, message: 'New password and confirmation are required.' };
        }

        if (newPassword !== confirmPassword) {
            throw { status: 400, message: 'Passwords do not match.' };
        }

        if (newPassword.length < 8) {
            throw { status: 400, message: 'Password must be at least 8 characters long.' };
        }

        const db = getDb();
        const saltRounds = 10;
        const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

        const result = await db.collection('users').updateOne(
            { _id: new ObjectId(userId) },
            {
                $set: {
                    password_hash: newPasswordHash,
                    updated_at: new Date()
                }
            }
        );

        if (result.matchedCount === 0) {
            throw { status: 404, message: 'User not found.' };
        }

        return { success: true };
    },

    async deleteAccount(userId) {
        const db = getDb();
        
        // Delete related records
        await db.collection('products').deleteMany({ user_id: userId });
        await db.collection('searches').deleteMany({ user_id: userId });

        const result = await db.collection('users').deleteOne({ _id: new ObjectId(userId) });

        if (result.deletedCount === 0) {
            throw { status: 404, message: 'User not found.' };
        }

        return { success: true };
    },

    async updateProfilePicture(userId, profilePicturePath) {
        const db = getDb();
        await db.collection('users').updateOne(
            { _id: new ObjectId(userId) },
            {
                $set: {
                    Profile_Picture_URL: profilePicturePath,
                    updated_at: new Date()
                }
            }
        );

        return { profilePictureUrl: profilePicturePath };
    },

    async updateActivity(userId) {
        const db = getDb();
        await db.collection('users').updateOne(
            { _id: new ObjectId(userId) },
            { $set: { last_active_at: new Date() } }
        );
    },

    async getUserAverageScore(userId) {
        const db = getDb();
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
        
        let average_score = 0;
        if (result.length > 0 && result[0].average_score !== null) {
            average_score = Math.round(parseFloat(result[0].average_score));
        }

        return average_score;
    }
};