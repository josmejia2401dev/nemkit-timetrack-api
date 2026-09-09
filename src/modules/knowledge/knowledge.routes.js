'use strict';

const { express } = require('nemkit');
const { knowledgeController: c } = require('./knowledge.controller');

const router = express.Router();

// Tree
router.get('/tree', c.getTree.bind(c));

// Folders
router.get('/folders',           c.listFolders.bind(c));
router.post('/folders',          c.createFolder.bind(c));
router.put('/folders/:id',       c.renameFolder.bind(c));
router.patch('/folders/:id/move', c.moveFolder.bind(c));
router.delete('/folders/:id',    c.deleteFolder.bind(c));

// Search (name / tags / content) — must be before /items/:id
router.get('/items/search',     c.searchItems.bind(c));

// Items (files / snippets)
router.get('/items',            c.listItems.bind(c));
router.post('/items',           c.createItem.bind(c));
router.get('/items/:id',        c.getItem.bind(c));
router.put('/items/:id',        c.updateItem.bind(c));
router.patch('/items/:id/move', c.moveItem.bind(c));
router.delete('/items/:id',     c.deleteItem.bind(c));

module.exports = router;
