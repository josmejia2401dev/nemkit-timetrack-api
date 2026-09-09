'use strict';

const { success, created, paginated } = require('nemkit');
const { activitiesService } = require('./activities.service');
const { createSchema, updateSchema } = require('./activities.validators');

class ActivitiesController {
  constructor() { this.service = activitiesService; }

  async listByProject(req, res, next) {
    try {
      const { data, pagination } = await this.service.listForProject(+req.params.projectId, req.user.id, req.query);
      return paginated(res, data, pagination);
    } catch (err) { next(err); }
  }

  async createInProject(req, res, next) {
    try {
      const { errorResponse, sanitized } = createSchema.check(req.body, req);
      if (errorResponse) return res.status(400).json(errorResponse);
      return created(res, await this.service.createForProject(+req.params.projectId, sanitized, req.user.id));
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
      return success(res, await this.service.updateOwned(+req.params.id, sanitized, req.user.id), 'Activity updated');
    } catch (err) { next(err); }
  }

  async archive(req, res, next) {
    try {
      await this.service.archiveOwned(+req.params.id, req.user.id);
      return success(res, null, 'Activity archived');
    } catch (err) { next(err); }
  }

  async remove(req, res, next) {
    try {
      await this.service.deleteOwned(+req.params.id, req.user.id);
      return success(res, null, 'Activity deleted');
    } catch (err) { next(err); }
  }
}

module.exports = { ActivitiesController, activitiesController: new ActivitiesController() };
