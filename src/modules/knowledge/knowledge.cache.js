'use strict';

const path = require('path');
const { createExclusiveCache } = require('nemkit');

const cacheFile = process.env.KNOWLEDGE_CACHE_FILE
  || path.resolve(process.cwd(), 'data', 'cache', 'knowledge.json');

// Arranca en modo DISK por defecto
const cache = createExclusiveCache({
  prefix: 'knowledge',
  defaultTtlMs: 60_000, // 60s
  filePath: cacheFile,
});

// Rastreo mínimo exclusivo para poder invalidar la caché por usuario
const activeKeys = new Set();

const keys = {
  folder: (userId, folderId) => `u:${userId}:folder:${folderId}`,
  tree: (userId) => `u:${userId}:tree`,
  pathMap: (userId) => `u:${userId}:pathmap`,
  foldersAll: (userId) => `u:${userId}:folders:all`,
  folders: (userId, parentId) => `u:${userId}:folders:${parentId ?? 'root'}`,
  item: (userId, itemId) => `u:${userId}:item:${itemId}`,
  items: (userId, folderId, kind) => `u:${userId}:items:${folderId ?? 'root'}:${kind ?? 'all'}`,
  search: (userId, term, kind) => `u:${userId}:search:${encodeURIComponent(term)}:${kind ?? 'all'}`,
};

const knowledgeCache = {
  keys,

  get: (key) => {
    return cache.get(key);
  },

  set: (key, value, ttlMs) => {
    activeKeys.add(key);
    return cache.set(key, value, ttlMs != null ? { ttlMs } : undefined);
  },

  del: (key) => {
    activeKeys.delete(key);
    return cache.del(key);
  },

  /** Cache-aside directo sin versionamiento manual */
  getOrSet: async (userId, key, fetchFn, ttlMs) => {
    const cached = cache.get(key);
    if (cached !== undefined) return cached;

    const value = await fetchFn();
    knowledgeCache.set(key, value, ttlMs);
    return value;
  },

  setFolder: (userId, folder) => knowledgeCache.set(keys.folder(userId, folder.id), folder),
  setItem: (userId, item) => {
    knowledgeCache.del(keys.itemContent(userId, item.id)); // Forzar refresco del contenido
    return knowledgeCache.set(keys.item(userId, item.id), item);
  },

  /** Invalida únicamente las entradas del usuario actual */
  invalidateUser: (userId) => {
    const prefix = `u:${userId}:`;
    for (const key of activeKeys) {
      if (key.startsWith(prefix)) {
        cache.del(key);
        activeKeys.delete(key);
      }
    }
  },

  invalidateItem: (userId, itemId) => {
    return knowledgeCache.del(keys.item(userId, itemId));
  },

  clear: () => {
    activeKeys.clear();
    return cache.clear();
  }
};

module.exports = { knowledgeCache };