'use strict';

const { BaseService, HttpError } = require('nemkit');
const { TasksRepository } = require('./tasks.repository');
const { activitiesService } = require('../activities/activities.service');

class TasksService extends BaseService {
  constructor() {
    super(new TasksRepository());
    this.notFoundMessage = 'Task not found';
  }

  /**
   * Lista las tareas de una actividad, validando ownership de la actividad.
   */
  async listForActivity(activityId, userId, query = {}) {
    await activitiesService.getOwned(activityId, userId); // ownership del padre
    const { page = 1, limit = 50, status } = query;
    const filter = { activityId, userId };
    if (status) filter.status = status;
    return this.filterAndPaginate(filter, { page: +page, limit: +limit, sort: { createdAt: -1 } });
  }

  async getOwned(id, userId) {
    const task = await this.findOne({ _id: id, userId });
    if (!task) throw HttpError.notFound('Task not found');
    return task;
  }

  /**
   * Crea una tarea en una actividad. Hereda projectId de la actividad padre.
   */
  async createInActivity(activityId, payload, userId) {
    const activity = await activitiesService.getOwned(activityId, userId); // valida padre
    return this.repository.create({
      ...payload,
      activityId,
      projectId: activity.projectId, // heredado
      userId,
    }, userId);
  }

  async updateOwned(id, payload, userId) {
    await this.getOwned(id, userId);
    // No permitir reasignar dueño ni jerarquía ni tocar tiempos directamente aquí
    const { userId: _u, projectId: _p, activityId: _a, timeRecords: _tr, totalMs: _t, ...safe } = payload;
    return this.updateById(id, safe, userId);
  }

  async deleteOwned(id, userId) {
    await this.getOwned(id, userId);
    return this.softDelete(id, userId);
  }

  // ── Time records ──────────────────────────────────────

  /**
   * Agrega un intervalo de tiempo a la tarea (validando ownership).
   * El frontend envía el intervalo cuando el usuario detiene su cronómetro.
   * @param {number} id
   * @param {{ start: Date|string, end: Date|string, durationMs?: number, note?: string }} record
   * @param {number} userId
   */
  async addTimeRecord(id, record, userId) {
    await this.getOwned(id, userId);

    const start = new Date(record.start);
    const end = new Date(record.end);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw HttpError.badRequest('start and end must be valid dates');
    }

    // If the client sends an explicit durationMs (excluding paused time),
    // use it. Otherwise derive it from the interval.
    const durationMs = record.durationMs != null
      ? record.durationMs
      : end.getTime() - start.getTime();

    if (durationMs <= 0) throw HttpError.badRequest('duration must be greater than zero');

    const Task = require('./tasks.model');
    const type = record.type && Task.TIME_RECORD_TYPES.includes(record.type) ? record.type : 'development';

    return this.repository.pushTimeRecord(
      id,
      { start, end, durationMs, type, note: record.note ?? '' },
      userId,
    );
  }

  async removeTimeRecord(id, recordId, userId) {
    await this.getOwned(id, userId);
    if (!recordId || recordId === 'undefined') throw HttpError.badRequest('recordId is required');
    const result = await this.repository.pullTimeRecord(id, recordId, userId);
    if (result?.notFound) throw HttpError.notFound('Time record not found');
    return result;
  }
}

module.exports = { TasksService, tasksService: new TasksService() };
