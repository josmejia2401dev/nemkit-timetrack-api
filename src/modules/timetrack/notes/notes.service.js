'use strict';

const { BaseService, HttpError } = require('nemkit');
const { NotesRepository } = require('./notes.repository');
const { projectsService } = require('../projects/projects.service');

class NotesService extends BaseService {
  constructor() {
    super(new NotesRepository());
    this.notFoundMessage = 'Note not found';
  }

  /**
   * Lista las notas de un proyecto (validando ownership del proyecto).
   * Las fijadas (pinned) primero, luego por fecha de actualización.
   */
  async listForProject(projectId, userId, query = {}) {
    await projectsService.getOwned(projectId, userId);
    const { page = 1, limit = 100, search } = query;
    const filter = { projectId, userId };

    const options = { page: +page, limit: +limit, sort: { pinned: -1, updatedAt: -1 } };
    if (search) options.search = { fields: ['title', 'content'], value: search };

    return this.filterAndPaginate(filter, options);
  }

  async getOwned(id, userId) {
    const note = await this.findOne({ _id: id, userId });
    if (!note) throw HttpError.notFound('Note not found');
    return note;
  }

  async createForProject(projectId, payload, userId) {
    await projectsService.getOwned(projectId, userId);
    return this.repository.create({ ...payload, projectId, userId }, userId);
  }

  async updateOwned(id, payload, userId) {
    await this.getOwned(id, userId);
    const { userId: _u, projectId: _p, ...safe } = payload;
    return this.updateById(id, safe, userId);
  }

  async deleteOwned(id, userId) {
    await this.getOwned(id, userId);
    return this.softDelete(id, userId);
  }
}

module.exports = { NotesService, notesService: new NotesService() };
