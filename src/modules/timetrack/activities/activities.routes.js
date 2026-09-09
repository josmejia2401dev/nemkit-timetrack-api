'use strict';

const { express } = require('nemkit');
const { activitiesController } = require('./activities.controller');

// Nested router mounted under /projects/:projectId/activities
const nestedRouter = express.Router({ mergeParams: true });
nestedRouter.get('/',  activitiesController.listByProject.bind(activitiesController));
nestedRouter.post('/', activitiesController.createInProject.bind(activitiesController));

// Flat router mounted under /activities
const flatRouter = express.Router();
flatRouter.get('/:id',    activitiesController.getById.bind(activitiesController));
flatRouter.put('/:id',    activitiesController.update.bind(activitiesController));
flatRouter.post('/:id/archive', activitiesController.archive.bind(activitiesController));
flatRouter.delete('/:id', activitiesController.remove.bind(activitiesController));

module.exports = { nestedRouter, flatRouter };
