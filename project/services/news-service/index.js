import { getDb, ObjectId } from "../../shared/db.js";
import { cache } from "../../shared/cache.js";

export const newsService = {
    async addNews(newsData) {
        const { title, summary, image_url, article_link } = newsData;

        if (!title || !summary || !image_url || !article_link) {
            throw { status: 400, message: 'All news fields are required.' };
        }

        const db = getDb();
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

        if (!result.insertedId) {
            throw { status: 500, message: 'Failed to add news article.' };
        }

        // Invalidate cache
        cache.delete('news_articles');
        console.log('🗑️ News cache invalidated');

        return { success: true, articleId: result.insertedId };
    },

    async getAllNews() {
        // Check cache first
        const cached = cache.get('news_articles');
        if (cached) {
            console.log('📦 Returning cached news articles');
            return cached;
        }

        const db = getDb();
        const articles = await db.collection('news_articles')
            .find({})
            .sort({ published_date: -1 })
            .toArray();

        // Cache for 15 minutes
        cache.set('news_articles', articles, 900);
        console.log(`✅ Fetched ${articles.length} news articles`);

        return articles;
    },

    async getNotifications(userEmail) {
        const db = getDb();
        const notifications = await db.collection('notifications')
            .find({ recipient_emails: { $in: [userEmail] } })
            .sort({ sent_at: -1 })
            .toArray();

        return notifications.map(item => {
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
                sent_at: date.toLocaleDateString('en-US', options)
            };
        });
    },

    async deleteNews(newsId) {
        const db = getDb();
        const result = await db.collection('news_articles').deleteOne({ 
            _id: new ObjectId(newsId) 
        });

        if (result.deletedCount === 0) {
            throw { status: 404, message: 'News article not found.' };
        }

        // Invalidate cache
        cache.delete('news_articles');

        return { success: true };
    },

    async updateNews(newsId, updateData) {
        const { title, summary, image_url, article_link } = updateData;

        const db = getDb();
        const result = await db.collection('news_articles').findOneAndUpdate(
            { _id: new ObjectId(newsId) },
            {
                $set: {
                    title: title || undefined,
                    summary: summary || undefined,
                    image_url: image_url || undefined,
                    article_link: article_link || undefined,
                    updated_at: new Date()
                }
            },
            { returnDocument: 'after' }
        );

        if (!result.value) {
            throw { status: 404, message: 'News article not found.' };
        }

        // Invalidate cache
        cache.delete('news_articles');

        return result.value;
    }
};