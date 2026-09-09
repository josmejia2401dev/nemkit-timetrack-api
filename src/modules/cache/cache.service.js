'use strict';

const { HttpError } = require('nemkit');
const { cacheRegistry } = require('../foundation/cache-stats/cache-registry');

const MAX_LIMIT = 100;

class CacheService {
  listCaches() {
    const snapshot = cacheRegistry.snapshot();
    return {
      ...snapshot,
      caches: snapshot.caches.map((cache) => ({
        ...cache,
        operations: this.#operations(cache.name),
      })),
    };
  }

  listEntries(cacheName, options = {}) {
    return this.#adapter(cacheName).listEntries({
      page: Math.max(1, Number(options.page) || 1),
      limit: Math.min(MAX_LIMIT, Math.max(1, Number(options.limit) || 50)),
      search: String(options.search ?? '').trim(),
    });
  }

  getEntry(cacheName, key) {
    const entry = this.#adapter(cacheName).getEntry(key);
    if (!entry) throw HttpError.notFound('Cache entry not found');
    return entry;
  }

  deleteEntry(cacheName, key) {
    const deleted = this.#adapter(cacheName).deleteEntry(key);
    if (!deleted) throw HttpError.notFound('Cache entry not found');
    return { deleted: true, key };
  }

  invalidate(cacheName, pattern) {
    const normalizedPattern = String(pattern ?? '').trim();
    if (!normalizedPattern || normalizedPattern.length > 200) {
      throw HttpError.badRequest('A valid cache pattern is required');
    }
    if (normalizedPattern.includes('..') || normalizedPattern.startsWith('/')) {
      throw HttpError.badRequest('Invalid cache pattern');
    }
    const adapter = this.#adapter(cacheName);
    if (typeof adapter.invalidatePattern !== 'function') {
      throw HttpError.badRequest('Pattern invalidation is not supported');
    }
    return {
      pattern: normalizedPattern,
      deletedEntries: adapter.invalidatePattern(normalizedPattern),
    };
  }

  clear(cacheName, confirmation) {
    if (confirmation !== 'CLEAR_CACHE') {
      throw HttpError.badRequest('Confirmation CLEAR_CACHE is required');
    }
    const adapter = this.#adapter(cacheName);
    if (typeof adapter.clear !== 'function') {
      throw HttpError.badRequest('Cache clearing is not supported');
    }
    adapter.clear();
    return { cleared: true, cacheName };
  }

  #adapter(cacheName) {
    const adapter = cacheRegistry.get(cacheName);
    if (!adapter) throw HttpError.notFound('Cache not found');
    if (typeof adapter.listEntries !== 'function') {
      throw HttpError.badRequest('Cache administration is not supported');
    }
    return adapter;
  }

  #operations(cacheName) {
    const adapter = cacheRegistry.get(cacheName);
    if (!adapter) return [];
    return [
      typeof adapter.listEntries === 'function' && 'list',
      typeof adapter.getEntry === 'function' && 'view',
      typeof adapter.deleteEntry === 'function' && 'delete',
      typeof adapter.invalidatePattern === 'function' && 'invalidate',
      typeof adapter.clear === 'function' && 'clear',
    ].filter(Boolean);
  }
}

module.exports = { CacheService, cacheService: new CacheService() };
