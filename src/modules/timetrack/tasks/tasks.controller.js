'use strict';

const { success, created, paginated } = require('nemkit');
const { tasksService } = require('./tasks.service');
const { createSchema, updateSchema } = require('./tasks.validators');

class TasksController {
  constructor() { this.service = tasksService; }

  async listByActivity(req, res, next) {
    try {
      const { data, pagination } = await this.service.listForActivity(+req.params.activityId, req.user.id, req.query);
      return paginated(res, data, pagination);
    } catch (err) { next(err); }
  }

  async createInActivity(req, res, next) {
    try {
      const { errorResponse, sanitized } = createSchema.check(req.body, req);
      if (errorResponse) return res.status(400).json(errorResponse);
      return created(res, await this.service.createInActivity(+req.params.activityId, sanitized, req.user.id));
    } catch (err) { next(err); }
  }

  async getById(req, res, next) {
    try {
      return success(res, await this.service.getOwned(+req.params.id, req.user.id));
    } catch (err) { next(err); }
  }

  async update(req, res, next) {
    try {
      const { errorResponse, sanitized } = updateSchema.check(req.body, req);
      if (errorResponse) return res.status(400).json(errorResponse);
      return success(res, await this.service.updateOwned(+req.params.id, sanitized, req.user.id), 'Task updated');
    } catch (err) { next(err); }
  }

  async remove(req, res, next) {
    try {
      await this.service.deleteOwned(+req.params.id, req.user.id);
      return success(res, null, 'Task deleted');
    } catch (err) { next(err); }
  }

  // ── Manual time records ───────────────────────────────

  async addTimeRecord(req, res, next) {
    try {
      const { start, end, durationMs, type, note } = req.body;
      if (!start || !end) {
        return res.status(400).json({ success: false, message: 'start and end are required' });
      }
      const task = await this.service.addTimeRecord(
        +req.params.id,
        { start, end, durationMs, type, note },
        req.user.id,
      );
      return created(res, task, 'Time record added');
    } catch (err) { next(err); }
  }

  async removeTimeRecord(req, res, next) {
    try {
      const task = await this.service.removeTimeRecord(+req.params.id, req.params.recordId, req.user.id);
      return success(res, task, 'Time record removed');
    } catch (err) { next(err); }
  }
}

module.exports = { TasksController, tasksController: new TasksController() };
