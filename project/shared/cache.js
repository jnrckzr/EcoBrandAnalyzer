class Cache {
    constructor() {
        this.store = new Map();
    }

    set(key, value, ttlSeconds = 300) {
        const expiry = Date.now() + (ttlSeconds * 1000);
        this.store.set(key, { value, expiry });
    }

    get(key) {
        const item = this.store.get(key);
        if (!item) return null;
        
        if (Date.now() > item.expiry) {
            this.store.delete(key);
            return null;
        }
        
        return item.value;
    }

    delete(key) {
        this.store.delete(key);
    }

    clear() {
        this.store.clear();
    }

    // Clean expired entries
    cleanup() {
        const now = Date.now();
        for (const [key, item] of this.store.entries()) {
            if (now > item.expiry) {
                this.store.delete(key);
            }
        }
    }
}

export const cache = new Cache();

// Run cleanup every 5 minutes
setInterval(() => cache.cleanup(), 5 * 60 * 1000);