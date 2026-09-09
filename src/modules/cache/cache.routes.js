'use strict';

const { express } = require('nemkit');
const { requireRole } = require('../../middlewares/authorize.middleware');
const { cacheController: c } = require('./cache.controller');

const router = express.Router();
const admin = requireRole('ADMIN');

router.get('/', admin, c.listCaches.bind(c));
router.get('/stats', admin, c.listCaches.bind(c));
router.get('/:cacheName/entries', admin, c.listEntries.bind(c));
router.get('/:cacheName/entries/:key', admin, c.getEntry.bind(c));
router.delete('/:cacheName/entries/:key', admin, c.deleteEntry.bind(c));
router.post('/:cacheName/invalidate', admin, c.invalidate.bind(c));
router.post('/:cacheName/clear', admin, c.clear.bind(c));

module.exports = router;
