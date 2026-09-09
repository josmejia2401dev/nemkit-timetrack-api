'use strict';

const { BaseService, HttpError } = require('nemkit');
const { ProjectsRepository } = require('./projects.repository');

class ProjectsService extends BaseService {
  constructor() {
    super(new ProjectsRepository());
    this.notFoundMessage = 'Project not found';
  }

  /**
   * Lista los proyectos del usuario (aislamiento por userId).
   */
  async listForUser(userId, query = {}) {
    const { page = 1, limit = 20, search, status } = query;
    const filter = { userId };
    if (status) filter.status = status;

    const options = { page: +page, limit: +limit, sort: { createdAt: -1 } };
    if (search) options.search = { fields: ['name', 'description'], value: search };

    return this.filterAndPaginate(filter, options);
  }

  /**
   * Obtiene un proyecto validando que pertenezca al usuario.
   */
  async getOwned(id, userId) {
    const project = await this.findOne({ _id: id, userId });
    if (!project) throw HttpError.notFound('Project not found');
    return project;
  }

  async createForUser(payload, userId) {
    return this.repository.create({ ...payload, userId }, userId);
  }

  async updateOwned(id, payload, userId) {
    await this.getOwned(id, userId); // valida ownership antes de tocar
    // Nunca permitir reasignar el dueño
    const { userId: _ignore, ...safe } = payload;
    return this.updateById(id, safe, userId);
  }

  /**
   * Archiva el proyecto (recuperable). Solo cambia el status, NO toca los hijos.
   */
  async archiveOwned(id, userId) {
    await this.getOwned(id, userId);
    return this.updateById(id, { status: 'archived' }, userId);
  }

  /**
   * Elimina (soft delete) el proyecto Y en cascada sus actividades y las
   * tareas de esas actividades. Borrado definitivo (no aparece en Archived).
   * Require diferido para evitar dependencia circular con activities.
   */
  async deleteOwned(id, userId) {
    await this.getOwned(id, userId);
    const { activitiesService } = require('../activities/activities.service');
    await activitiesService.deleteByProject(id, userId);
    return this.softDelete(id, userId);
  }
}

module.exports = { ProjectsService, projectsService: new ProjectsService() };
