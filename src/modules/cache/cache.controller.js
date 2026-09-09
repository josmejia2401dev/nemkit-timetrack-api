'use strict';

const { success } = require('nemkit');
const { cacheService } = require('./cache.service');

class CacheController {
  listCaches(req, res, next) {
    try { return success(res, cacheService.listCaches()); } catch (err) { return next(err); }
  }

  listEntries(req, res, next) {
    try {
      return success(res, cacheService.listEntries(req.params.cacheName, req.query));
    } catch (err) { return next(err); }
  }

  getEntry(req, res, next) {
    try {
      return success(res, cacheService.getEntry(req.params.cacheName, req.params.key));
    } catch (err) { return next(err); }
  }

  deleteEntry(req, res, next) {
    try {
      return success(res, cacheService.deleteEntry(req.params.cacheName, req.params.key), 'Cache entry deleted');
    } catch (err) { return next(err); }
  }

  invalidate(req, res, next) {
    try {
      return success(res, cacheService.invalidate(req.params.cacheName, req.body?.pattern), 'Cache entries invalidated');
    } catch (err) { return next(err); }
  }

  clear(req, res, next) {
    try {
      return success(res, cacheService.clear(req.params.cacheName, req.body?.confirmation), 'Cache cleared');
    } catch (err) { return next(err); }
  }
}

module.exports = { CacheController, cacheController: new CacheController() };
