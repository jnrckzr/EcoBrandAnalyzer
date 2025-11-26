import { cache } from "../../shared/cache.js";

export const gatewayService = {
    /**
     * Make an external API call with caching and retry logic
     */
    async callExternalAPI(url, options = {}, cacheTTL = 300) {
        const cacheKey = `api_${url}_${JSON.stringify(options)}`;
        
        // Check cache first
        const cached = cache.get(cacheKey);
        if (cached) {
            console.log(`📦 Gateway: Returning cached response for ${url}`);
            return cached;
        }

        const maxRetries = options.maxRetries || 3;
        let lastError;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                console.log(`🌐 Gateway: Calling ${url} (attempt ${attempt}/${maxRetries})`);
                
                const response = await fetch(url, {
                    method: options.method || 'GET',
                    headers: options.headers || {},
                    body: options.body ? JSON.stringify(options.body) : undefined,
                    signal: AbortSignal.timeout(options.timeout || 10000) // 10s default timeout
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                const data = await response.json();
                
                // Cache successful response
                cache.set(cacheKey, data, cacheTTL);
                
                console.log(`✅ Gateway: Successfully called ${url}`);
                return data;

            } catch (error) {
                lastError = error;
                console.warn(`⚠️ Gateway: Attempt ${attempt} failed for ${url}:`, error.message);
                
                if (attempt < maxRetries) {
                    // Exponential backoff: 1s, 2s, 4s
                    const delay = Math.pow(2, attempt - 1) * 1000;
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }

        // All retries failed
        console.error(`❌ Gateway: All attempts failed for ${url}`);
        throw {
            status: 503,
            message: 'External API call failed after multiple retries',
            originalError: lastError.message
        };
    },

    /**
     * Batch multiple API calls with Promise.allSettled
     */
    async batchCalls(requests) {
        console.log(`🔄 Gateway: Batching ${requests.length} API calls`);
        
        const promises = requests.map(req => 
            this.callExternalAPI(req.url, req.options, req.cacheTTL)
                .catch(error => ({ error: error.message }))
        );

        const results = await Promise.allSettled(promises);
        
        return results.map((result, index) => ({
            url: requests[index].url,
            status: result.status,
            data: result.status === 'fulfilled' ? result.value : null,
            error: result.status === 'rejected' ? result.reason : null
        }));
    },

    /**
     * Rate limiter for external API calls
     */
    rateLimiter: {
        limits: new Map(),

        async checkLimit(apiKey, maxRequests = 100, windowMs = 60000) {
            const now = Date.now();
            const windowStart = now - windowMs;

            if (!this.limits.has(apiKey)) {
                this.limits.set(apiKey, []);
            }

            const requests = this.limits.get(apiKey);
            
            // Remove old requests outside the window
            const validRequests = requests.filter(timestamp => timestamp > windowStart);
            this.limits.set(apiKey, validRequests);

            if (validRequests.length >= maxRequests) {
                throw {
                    status: 429,
                    message: 'Rate limit exceeded. Please try again later.',
                    retryAfter: Math.ceil((validRequests[0] - windowStart) / 1000)
                };
            }

            // Add current request
            validRequests.push(now);
            this.limits.set(apiKey, validRequests);

            return {
                allowed: true,
                remaining: maxRequests - validRequests.length,
                resetAt: new Date(validRequests[0] + windowMs)
            };
        }
    },

    /**
     * Proxy request with API key injection
     */
    async proxyRequest(targetUrl, apiKeyEnvVar, options = {}) {
        const apiKey = process.env[apiKeyEnvVar];
        
        if (!apiKey) {
            throw {
                status: 500,
                message: `API key ${apiKeyEnvVar} not configured`
            };
        }

        const headers = {
            ...options.headers,
            'Authorization': `Bearer ${apiKey}`
        };

        return await this.callExternalAPI(targetUrl, { ...options, headers });
    },

    /**
     * Health check for external services
     */
    async healthCheck(services) {
        const checks = services.map(async service => {
            try {
                const start = Date.now();
                await this.callExternalAPI(service.url, { 
                    method: 'GET',
                    maxRetries: 1,
                    timeout: 5000 
                });
                const duration = Date.now() - start;

                return {
                    name: service.name,
                    status: 'healthy',
                    responseTime: `${duration}ms`
                };
            } catch (error) {
                return {
                    name: service.name,
                    status: 'unhealthy',
                    error: error.message
                };
            }
        });

        return await Promise.all(checks);
    },

    /**
     * Clear gateway cache
     */
    clearCache() {
        // Clear all cache entries starting with 'api_'
        const keys = Array.from(cache.store.keys());
        keys.forEach(key => {
            if (key.startsWith('api_')) {
                cache.delete(key);
            }
        });
        console.log('🗑️ Gateway cache cleared');
    }
};