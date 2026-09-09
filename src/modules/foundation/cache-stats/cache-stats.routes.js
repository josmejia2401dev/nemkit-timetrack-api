'use strict';

const { express, success } = require('nemkit');
const { requireRole } = require('../../../middlewares/authorize.middleware');
const { cacheRegistry } = require('./cache-registry');

const router = express.Router();

/**
 * GET /cache/stats — Estadísticas de todos los caches registrados.
 * Solo ADMIN. NO expone keys ni values, únicamente métricas agregadas.
 */
router.get('/stats', requireRole('ADMIN'), (req, res, next) => {
  try {
    return success(res, cacheRegistry.snapshot());
  } catch (err) { next(err); }
});

module.exports = router;
