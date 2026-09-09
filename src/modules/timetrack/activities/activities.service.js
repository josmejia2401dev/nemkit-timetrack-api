'use strict';

const { BaseService, HttpError } = require('nemkit');
const { ActivitiesRepository } = require('./activities.repository');
const { projectsService } = require('../projects/projects.service');
const { TasksRepository } = require('../tasks/tasks.repository');

class ActivitiesService extends BaseService {
  constructor() {
    super(new ActivitiesRepository());
    this.tasksRepository = new TasksRepository();
    this.notFoundMessage = 'Activity not found';
  }

  /**
   * Elimina (soft delete) las tareas de una actividad. Los tiempos viven dentro
   * de cada tarea, así que se van con ella.
   */
  async #deleteTasksOf(activityId, userId) {
    await this.tasksRepository.softDeleteMany({ activityId }, userId);
  }

  /**
   * Elimina (soft delete) las tareas de un conjunto de actividades.
   * Usado por la cascada del proyecto.
   */
  async deleteTasksOfActivities(activityIds, userId) {
    if (!activityIds.length) return;
    await this.tasksRepository.softDeleteMany({ activityId: { $in: activityIds } }, userId);
  }

  /**
   * Lista las actividades de un proyecto, validando que el proyecto sea del usuario.
   */
  async listForProject(projectId, userId, query = {}) {
    await projectsService.getOwned(projectId, userId); // ownership del padre
    const { page = 1, limit = 50, status } = query;
    const filter = { projectId, userId };
    if (status) filter.status = status;
    return this.filterAndPaginate(filter, { page: +page, limit: +limit, sort: { createdAt: -1 } });
  }

  async getOwned(id, userId) {
    const activity = await this.findOne({ _id: id, userId });
    if (!activity) throw HttpError.notFound('Activity not found');
    return activity;
  }

  async createForProject(projectId, payload, userId) {
    await projectsService.getOwned(projectId, userId); // valida padre
    return this.repository.create({ ...payload, projectId, userId }, userId);
  }

  async updateOwned(id, payload, userId) {
    await this.getOwned(id, userId);
    const { userId: _u, projectId: _p, ...safe } = payload; // no reasignar dueño ni padre
    return this.updateById(id, safe, userId);
  }

  /**
   * Archiva la actividad (recuperable). Solo cambia el status, NO toca sus tareas.
   */
  async archiveOwned(id, userId) {
    await this.getOwned(id, userId);
    return this.updateById(id, { status: 'archived' }, userId);
  }

  /**
   * Elimina (soft delete) la actividad Y sus tareas en cascada. Definitivo.
   */
  async deleteOwned(id, userId) {
    await this.getOwned(id, userId);
    await this.#deleteTasksOf(id, userId);
    return this.softDelete(id, userId);
  }

  /**
   * Elimina en cascada todas las actividades de un proyecto + sus tareas.
   * Usado por la cascada de eliminación del proyecto.
   */
  async deleteByProject(projectId, userId) {
    const acts = await this.repository.find({ projectId, userId });
    const ids = acts.map((a) => a.id ?? a._id);
    await this.deleteTasksOfActivities(ids, userId);
    await this.repository.softDeleteMany({ projectId, userId }, userId);
  }
}

module.exports = { ActivitiesService, activitiesService: new ActivitiesService() };
