import { getDb, ObjectId } from "../../shared/db.js";
import { mapProductToDb, mapProductToFrontend, buildIdQuery } from "../../shared/utils.js";
import { cache } from "../../shared/cache.js";

export const productService = {
    /**
     * Get all products with caching
     */
    async getAllProducts() {
        // Check cache first
        const cached = cache.get('all_products');
        if (cached) {
            console.log('📦 Returning cached products');
            return cached;
        }

        const db = getDb();
        const products = await db.collection('products')
            .find({})
            .sort({ created_at: -1 })
            .toArray();

        const mapped = products.map(mapProductToFrontend);
        
        // Cache for 5 minutes
        cache.set('all_products', mapped, 300);
        console.log(`✅ Fetched ${mapped.length} products from database`);
        
        return mapped;
    },

    /**
     * Get a single product by ID
     */
    async getProductById(productId) {
        const db = getDb();
        const query = buildIdQuery(productId);
        const product = await db.collection('products').findOne(query);
        
        if (!product) {
            throw { status: 404, message: 'Product not found' };
        }

        return mapProductToFrontend(product);
    },

    /**
     * Create a new product
     */
    async createProduct(productData, userId) {
        if (!userId) {
            throw { status: 401, message: 'User ID is required to create a product' };
        }

        const db = getDb();
        // Compute eco score and letter before mapping to DB
        try {
            const ecoResult = computeEcoScoreFromProduct(productData);
            if (ecoResult.score != null) {
                productData.eco_score = ecoResult.score;
                productData.eco_letter = ecoResult.letter;
            }
        } catch (e) {
            console.warn('Eco score computation failed during product creation:', e);
        }
        const dbData = mapProductToDb({ ...productData, user_id: userId });

        const result = await db.collection('products').insertOne(dbData);
        
        if (!result.insertedId) {
            throw { status: 500, message: 'Failed to create product' };
        }

        // Invalidate cache
        cache.delete('all_products');
        cache.delete('categorized_products');
        console.log('🗑️ Cache invalidated after product creation');

        const savedProduct = await db.collection('products').findOne({ _id: result.insertedId });
        return mapProductToFrontend(savedProduct);
    },

    /**
     * Update an existing product
     */
    async updateProduct(productId, updateData) {
        const db = getDb();
        const query = buildIdQuery(productId);
        
        // Compute eco score and letter prior to mapping; updateData may only contain changed fields,
        // but computeEcoScoreFromProduct gracefully handles missing values.
        try {
            const ecoResult = computeEcoScoreFromProduct(updateData);
            if (ecoResult.score != null) {
                updateData.eco_score = ecoResult.score;
                updateData.eco_letter = ecoResult.letter;
            }
        } catch (e) {
            console.warn('Eco score computation failed during product update:', e);
        }

        // Don't allow these fields to be overwritten
        const { uploaded_by_user_id, created_at, _id, id, ...updateFields } = mapProductToDb(updateData);

        const result = await db.collection('products').findOneAndUpdate(
            query,
            { $set: { ...updateFields, updated_at: new Date() } },
            { returnDocument: 'after' }
        );

        if (!result.value) {
            throw { status: 404, message: 'Product not found' };
        }

        // Invalidate cache
        cache.delete('all_products');
        cache.delete('categorized_products');
        console.log('🗑️ Cache invalidated after product update');

        return mapProductToFrontend(result.value);
    },

    /**
     * Delete a product
     */
    async deleteProduct(productId) {
        const db = getDb();
        const query = buildIdQuery(productId);
        
        const result = await db.collection('products').deleteOne(query);
        
        if (result.deletedCount === 0) {
            throw { status: 404, message: 'Product not found' };
        }

        // Invalidate cache
        cache.delete('all_products');
        cache.delete('categorized_products');
        console.log('🗑️ Cache invalidated after product deletion');

        return { success: true };
    },

    /**
     * Search products by name and log the search
     */
    async searchProducts(searchQuery, userId) {
        if (!searchQuery || searchQuery.trim() === '') {
            return [];
        }

        const db = getDb();
        
        // Search for products matching the query
        const products = await db.collection('products')
            .find({
                ProductName: { $regex: searchQuery, $options: 'i' }
            })
            .limit(10)
            .toArray();

        // Log the search to searches collection
        const firstProduct = products.length > 0 ? products[0] : null;
        
        const searchRecord = {
            user_id: userId,
            query: searchQuery,
            created_at: new Date(),
            product_id: firstProduct ? firstProduct._id.toString() : null,
            searched_product_name: firstProduct ? firstProduct.ProductName : null,
            is_found: !!firstProduct,
            eco_score: firstProduct ? (firstProduct.eco_score || null) : null,
            eco_letter: firstProduct ? (firstProduct.eco_letter || null) : null,
        };

        await db.collection('searches').insertOne(searchRecord);
        
        console.log(`🔍 Search logged: "${searchQuery}" by user ${userId}, found: ${products.length}`);

        return products.map(mapProductToFrontend);
    },

    // ==========================================================
    // NEW: Function to get unique product names for suggestions
    // ==========================================================
    /**
     * Get a list of unique product names for autocomplete/suggestions based on a query.
     * @param {string} query The search query string.
     * @returns {Promise<string[]>} List of product names (strings).
     */
    async getSuggestionsByQuery(query) {
        if (!query || query.trim() === '') {
            return [];
        }

        const db = getDb();
        const searchQuery = query.trim();

        // Use distinct on ProductName with $regex to find unique names
        // 'i' means case-insensitive
        const uniqueProductNames = await db.collection('products')
            .distinct('ProductName', {
                ProductName: { $regex: searchQuery, $options: 'i' }
            });

        // Limitahan ang resulta sa 8 suggestions
        return uniqueProductNames.slice(0, 8); 
    },


    /**
     * Get products categorized by environmental impact
     */
    async getCategorizedProducts() {
    console.log('\n🔍 === SERVICE: Getting Categorized Products ===');
    
    // Check cache (optional - pwede tanggalin for testing)
    // const cached = cache.get('categorized_products');
    // if (cached) {
    //     console.log('📦 Returning cached categorized products');
    //     return cached;
    // }

    const db = getDb();
    const allProducts = await db.collection('products')
        .find({})
        .sort({ created_at: -1 })
        .toArray();

    console.log(`📦 Total products fetched: ${allProducts.length}`);

    // IMPROVED: Helper function with better matching logic
    const normalizeImpact = (impact) => {
        if (!impact) return '';
        return String(impact).toLowerCase().trim().replace(/\s+/g, ' ');
    };

    const matchesImpact = (product, targetImpact) => {
        const productImpact = normalizeImpact(product.environmental_impact);
        const target = normalizeImpact(targetImpact);
        
        // Direct match
        if (productImpact === target) return true;
        
        // Partial match (for flexibility)
        const targetWords = target.split(' ');
        return targetWords.every(word => productImpact.includes(word));
    };

    // Categorize products
    const categorized = {
        low: allProducts.filter(p => matchesImpact(p, 'Low Emission')),
        moderate: allProducts.filter(p => matchesImpact(p, 'Moderate Emission')),
        high: allProducts.filter(p => matchesImpact(p, 'High Emission'))
    };

    // Debug logging
    console.log(`✅ Low Impact: ${categorized.low.length}`);
    console.log(`⚠️ Moderate Impact: ${categorized.moderate.length}`);
    console.log(`❌ High Impact: ${categorized.high.length}`);

    // Log uncategorized products
    const totalCategorized = categorized.low.length + categorized.moderate.length + categorized.high.length;
    if (totalCategorized < allProducts.length) {
        const uncategorized = allProducts.filter(p => 
            !matchesImpact(p, 'Low Emission') &&
            !matchesImpact(p, 'Moderate Emission') &&
            !matchesImpact(p, 'High Emission')
        );
        console.log(`🔍 Uncategorized products: ${uncategorized.length}`);
        uncategorized.forEach(p => {
            console.log(`  - ${p.ProductName}: "${p.environmental_impact}"`);
        });
    }

    // Optional: Cache for 10 minutes
    // cache.set('categorized_products', categorized, 600);

    return categorized;
},


    /**
     * Get environmental impact data for a specific product
     */
    async getEnvironmentalImpact(productName) {
        const db = getDb();
        
        const environmentalImpact = await db.collection('environmental_impact')
            .findOne({
                ProductName: { $regex: new RegExp(`^${productName.trim()}$`, 'i') }
            });

        return environmentalImpact;
    },

    /**
     * Get search history for a user
     */
    async getSearchHistory(userId) {
        const db = getDb();
        
        const history = await db.collection('searches')
            .find({ user_id: userId })
            .sort({ created_at: -1 })
            .limit(50) // Limit to last 50 searches
            .toArray();

        return history;
    },

    /**
     * Get total product count
     */
    async getProductCount() {
        const db = getDb();
        return await db.collection('products').countDocuments();
    },

    /**
     * Get products by category
     */
    async getProductsByCategory(category) {
        const db = getDb();
        
        const products = await db.collection('products')
            .find({ Category: { $regex: new RegExp(`^${category}$`, 'i') } })
            .sort({ created_at: -1 })
            .toArray();

        return products.map(mapProductToFrontend);
    },

    /**
     * Get products by user
     */
    async getProductsByUser(userId) {
        const db = getDb();
        
        const products = await db.collection('products')
            .find({ uploaded_by_user_id: new ObjectId(userId) })
            .sort({ created_at: -1 })
            .toArray();

        return products.map(mapProductToFrontend);
    },

    /**
     * Bulk delete products (admin function)
     */
    async bulkDeleteProducts(productIds) {
        const db = getDb();
        
        const objectIds = productIds.map(id => {
            try {
                return new ObjectId(id);
            } catch (e) {
                return null;
            }
        }).filter(id => id !== null);

        const result = await db.collection('products').deleteMany({
            _id: { $in: objectIds }
        });

        // Invalidate cache
        cache.delete('all_products');
        cache.delete('categorized_products');

        return {
            success: true,
            deletedCount: result.deletedCount
        };
    },

    /**
     * Update product eco score (for batch processing)
     */
    async updateEcoScore(productId, ecoScore, ecoLetter) {
        const db = getDb();
        const query = buildIdQuery(productId);

        const result = await db.collection('products').updateOne(
            query,
            {
                $set: {
                    eco_score: ecoScore,
                    eco_letter: ecoLetter,
                    updated_at: new Date()
                }
            }
        );

        if (result.matchedCount === 0) {
            throw { status: 404, message: 'Product not found' };
        }

        // Invalidate cache
        cache.delete('all_products');
        cache.delete('categorized_products');

        return { success: true };
    }
};