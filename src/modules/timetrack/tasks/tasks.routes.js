'use strict';

const { express } = require('nemkit');
const { tasksController } = require('./tasks.controller');

// Nested router mounted under /activities/:activityId/tasks
const nestedRouter = express.Router({ mergeParams: true });
nestedRouter.get('/',  tasksController.listByActivity.bind(tasksController));
nestedRouter.post('/', tasksController.createInActivity.bind(tasksController));

// Flat router mounted under /tasks
const flatRouter = express.Router();
flatRouter.get('/:id',    tasksController.getById.bind(tasksController));
flatRouter.put('/:id',    tasksController.update.bind(tasksController));
flatRouter.delete('/:id', tasksController.remove.bind(tasksController));

// Manual time records on a task
flatRouter.post('/:id/time-records',              tasksController.addTimeRecord.bind(tasksController));
flatRouter.delete('/:id/time-records/:recordId',  tasksController.removeTimeRecord.bind(tasksController));

module.exports = { nestedRouter, flatRouter };
