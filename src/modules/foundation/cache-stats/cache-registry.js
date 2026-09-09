'use strict';

/**
 * Registro central de caches de la aplicación.
 *
 * Cada cache se registra con un nombre y una función que devuelve sus
 * estadísticas (NUNCA sus datos). El endpoint de diagnóstico consume esto.
 *
 * Uso:
 *   const { cacheRegistry } = require('.../cache-registry');
 *   cacheRegistry.register('knowledge', { type: 'memory', getStats: () => cache.stats() });
 */
class CacheRegistry {
  #caches = new Map(); // name -> adapter

  register(name, { type = 'memory', getStats, ...operations }) {
    if (typeof getStats !== 'function') {
      throw new Error(`CacheRegistry.register("${name}"): getStats must be a function`);
    }
    this.#caches.set(name, { type, getStats, ...operations });
  }

  get(name) {
    return this.#caches.get(name) ?? null;
  }

  names() {
    return [...this.#caches.keys()];
  }

  /** Devuelve estadísticas de todos los caches registrados (sin keys ni values). */
  snapshot() {
    const caches = [];
    let totalHits = 0;
    let totalMisses = 0;

    for (const [name, { type, getStats }] of this.#caches) {
      let stats = {};
      try { stats = getStats() ?? {}; } catch { stats = { error: 'stats unavailable' }; }

      totalHits += stats.hits ?? 0;
      totalMisses += stats.misses ?? 0;
      caches.push({ name, type, ...stats });
    }

    const totalReq = totalHits + totalMisses;
    return {
      generatedAt: new Date().toISOString(),
      totals: {
        caches: caches.length,
        hits: totalHits,
        misses: totalMisses,
        hitRate: totalReq > 0 ? +(totalHits / totalReq).toFixed(4) : 0,
      },
      caches,
    };
  }
}

const cacheRegistry = new CacheRegistry();

module.exports = { CacheRegistry, cacheRegistry };
