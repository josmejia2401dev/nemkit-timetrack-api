'use strict';

const { express } = require('nemkit');
const { notesController } = require('./notes.controller');

// Nested router mounted under /projects/:projectId/notes
const nestedRouter = express.Router({ mergeParams: true });
nestedRouter.get('/',  notesController.listByProject.bind(notesController));
nestedRouter.post('/', notesController.createInProject.bind(notesController));

// Flat router mounted under /notes
const flatRouter = express.Router();
flatRouter.get('/:id',    notesController.getById.bind(notesController));
flatRouter.put('/:id',    notesController.update.bind(notesController));
flatRouter.delete('/:id', notesController.remove.bind(notesController));

module.exports = { nestedRouter, flatRouter };
