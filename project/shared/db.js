import { MongoClient, ObjectId } from "mongodb";

let client;
let db;

export const connectToMongoDB = async () => {
    try {
        const mongoUrl = process.env.MONGODB_URL;
        const dbName = process.env.DATABASE_NAME || 'signup_db';

        client = new MongoClient(mongoUrl, {
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
        });

        await client.connect();
        db = client.db(dbName);
        
        console.log('✅ MongoDB connected:', db.databaseName);

        // Create indexes
        await createIndexes();
        
        return db;
    } catch (error) {
        console.error('❌ MongoDB connection error:', error);
        throw error;
    }
};

const createIndexes = async () => {
    try {
        await db.collection('users').createIndex({ Username: 1 }, { unique: true });
        await db.collection('users').createIndex({ Emailadd: 1 }, { unique: true });
        await db.collection('products').createIndex({ ProductName: 1 });
        await db.collection('searches').createIndex({ user_id: 1, created_at: -1 });
        console.log('✅ Database indexes created');
    } catch (error) {
        console.error('⚠️ Index creation warning:', error.message);
    }
};

export const getDb = () => {
    if (!db) throw new Error('Database not initialized. Call connectToMongoDB first.');
    return db;
};

export const closeConnection = async () => {
    if (client) {
        await client.close();
        console.log('✅ MongoDB connection closed');
    }
};

export { ObjectId };