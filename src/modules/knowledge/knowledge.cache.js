'use strict';

const fs = require('fs');
const path = require('path');
const { TieredCache } = require('nemkit');

/**
 * Cache en memoria dedicado al módulo Knowledge.
 *
 * Estrategia:
 * - Una key por consulta, namespaced por usuario: `u:<userId>:...`
 * - L1 en memoria y L2 persistente en disco.
 * - Invalidación por patrón: cualquier cambio estructural de un usuario
 *   limpia TODO su knowledge cacheado con `u:<userId>:*`.
 *
 * Encapsular el cache aquí permite cambiar el backend (p.ej. TieredCache con
 * tags) en el futuro sin tocar los servicios.
 */
const cacheFile = process.env.KNOWLEDGE_CACHE_FILE
  || path.resolve(process.cwd(), 'data', 'cache', 'knowledge.json');

const cache = new TieredCache({
  prefix: 'knowledge',
  defaultTtlMs: 60_000,   // 60s
  file: {
    path: cacheFile,
  },
});

const versions = new Map();
const knownKeys = new Set();

const rememberKey = (key) => knownKeys.add(key);
const forgetKeys = (pattern) => {
  const regex = new RegExp(`^${pattern.replace(/\*/g, '.*')}$`);
  for (const key of knownKeys) {
    if (regex.test(key)) knownKeys.delete(key);
  }
};
const readDiskEntries = () => {
  try {
    if (!fs.existsSync(cacheFile)) return {};
    const entries = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
    return Object.fromEntries(Object.entries(entries).filter(([, record]) => (
      record?.expiresAt == null || record.expiresAt > Date.now()
    )));
  } catch {
    return {};
  }
};
const serializedSize = (value) => Buffer.byteLength(JSON.stringify(value ?? null), 'utf8');
const setCache = (key, value, ttlMs) => {
  rememberKey(key);
  return cache.set(key, value, ttlMs != null ? { ttlMs } : undefined);
};

const keys = {
  folder:   (userId, folderId) => `u:${userId}:folder:${folderId}`,
  tree:     (userId) => `u:${userId}:tree`,
  pathMap:  (userId) => `u:${userId}:pathmap`,
  foldersAll: (userId) => `u:${userId}:folders:all`,
  folders:  (userId, parentId) => `u:${userId}:folders:${parentId ?? 'root'}`,
  item:     (userId, itemId) => `u:${userId}:item:${itemId}`,
  items:    (userId, folderId, kind) => `u:${userId}:items:${folderId ?? 'root'}:${kind ?? 'all'}`,
  search:   (userId, term, kind) => `u:${userId}:search:${encodeURIComponent(term)}:${kind ?? 'all'}`,
};

const getVersion = (userId) => versions.get(String(userId)) ?? 0;
const bumpVersion = (userId) => {
  const key = String(userId);
  versions.set(key, getVersion(userId) + 1);
};

const knowledgeCache = {
  keys,

  get: (key) => {
    const value = cache.get(key);
    if (value !== undefined) rememberKey(key);
    return value;
  },
  set: setCache,
  del: (key) => {
    knownKeys.delete(key);
    return cache.del(key);
  },

  /** Cache-aside: devuelve del cache o ejecuta fetchFn y lo guarda. */
  getOrSet: async (userId, key, fetchFn, ttlMs) => {
    const cached = knowledgeCache.get(key);
    if (cached !== undefined) return cached;

    const version = getVersion(userId);
    const value = await fetchFn();
    if (version !== getVersion(userId)) {
      return knowledgeCache.getOrSet(userId, key, fetchFn, ttlMs);
    }

    setCache(key, value, ttlMs);
    return value;
  },

  setFolder: (userId, folder) => setCache(keys.folder(userId, folder.id), folder),
  setItem: (userId, item) => setCache(keys.item(userId, item.id), item),

  /** Invalida TODO el knowledge cacheado de un usuario. Llamar tras cualquier escritura. */
  invalidateUser: (userId) => {
    bumpVersion(userId);
    forgetKeys(`u:${userId}:*`);
    return cache.invalidatePattern(`u:${userId}:*`);
  },

  invalidateItem: (userId, itemId) => {
    bumpVersion(userId);
    return knowledgeCache.del(keys.item(userId, itemId));
  },

  listEntries: ({ page = 1, limit = 50, search = '' } = {}) => {
    const diskEntries = readDiskEntries();
    const diskKeys = Object.keys(diskEntries)
      .filter((key) => key.startsWith('knowledge:'))
      .map((key) => key.slice('knowledge:'.length));
    const allKeys = [...new Set([...knownKeys, ...diskKeys])]
      .filter((key) => key.toLowerCase().includes(String(search).toLowerCase()))
      .sort();
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(100, Math.max(1, Number(limit) || 50));
    const start = (safePage - 1) * safeLimit;
    const entries = allKeys.slice(start, start + safeLimit).map((key) => {
      const fullKey = `knowledge:${key}`;
      const record = diskEntries[fullKey];
      return {
        key,
        expiresAt: record?.expiresAt ?? null,
        sizeBytes: serializedSize(record?.value),
        availableInMemory: knowledgeCache.get(key) !== undefined,
        availableOnDisk: Boolean(record),
      };
    });
    return {
      entries,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total: allKeys.length,
        totalPages: Math.ceil(allKeys.length / safeLimit),
      },
    };
  },
  getEntry: (key) => {
    const diskEntries = readDiskEntries();
    const record = diskEntries[`knowledge:${key}`];
    const value = knowledgeCache.get(key);
    if (value === undefined && !record) return null;
    const resolvedValue = value === undefined ? record.value : value;
    return {
      key,
      value: resolvedValue,
      expiresAt: record?.expiresAt ?? null,
      sizeBytes: serializedSize(resolvedValue),
      availableInMemory: value !== undefined,
      availableOnDisk: Boolean(record),
    };
  },
  deleteEntry: (key) => knowledgeCache.del(key),
  invalidatePattern: (pattern) => {
    const userId = /^u:([^:]+):/.exec(pattern)?.[1];
    if (userId) bumpVersion(userId);
    forgetKeys(pattern);
    return cache.invalidatePattern(pattern);
  },

  /** Utilidad para tests/diagnóstico. */
  clear: () => {
    knownKeys.clear();
    return cache.clear();
  },
  stats: () => cache.getStats(),
  flush: () => cache.flush(),
};

// Auto-registro en el diagnóstico de caches (solo estadísticas, nunca datos).
const { cacheRegistry } = require('../foundation/cache-stats/cache-registry');
cacheRegistry.register('knowledge', {
  type: 'tiered-memory-file',
  getStats: () => cache.getStats(),
  listEntries: knowledgeCache.listEntries,
  getEntry: knowledgeCache.getEntry,
  deleteEntry: knowledgeCache.deleteEntry,
  invalidatePattern: knowledgeCache.invalidatePattern,
  clear: knowledgeCache.clear,
});

module.exports = { knowledgeCache };
