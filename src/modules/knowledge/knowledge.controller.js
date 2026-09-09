'use strict';

const { success, created } = require('nemkit');
const { knowledgeFolderService } = require('./knowledge-folder.service');
const { knowledgeItemService } = require('./knowledge-item.service');
const {
  folderCreateSchema, folderRenameSchema, folderMoveSchema,
  itemCreateSchema, itemUpdateSchema, itemMoveSchema,
} = require('./knowledge.validators');

const parseNullableId = (v) => {
  if (v === undefined || v === null || v === '' || v === 'null' || v === 'root') return null;
  return +v;
};

class KnowledgeController {
  constructor() {
    this.folders = knowledgeFolderService;
    this.items = knowledgeItemService;
  }

  // ── Tree ──────────────────────────────────────────────
  async getTree(req, res, next) {
    try {
      return success(res, await this.folders.tree(req.user.id));
    } catch (err) { next(err); }
  }

  // ── Folders ───────────────────────────────────────────
  async listFolders(req, res, next) {
    try {
      const parentId = parseNullableId(req.query.parentId);
      return success(res, await this.folders.listChildren(req.user.id, parentId));
    } catch (err) { next(err); }
  }

  async createFolder(req, res, next) {
    try {
      const { errorResponse, sanitized } = folderCreateSchema.check(req.body, req);
      if (errorResponse) return res.status(400).json(errorResponse);
      return created(res, await this.folders.create(sanitized, req.user.id));
    } catch (err) { next(err); }
  }

  async renameFolder(req, res, next) {
    try {
      const { errorResponse, sanitized } = folderRenameSchema.check(req.body, req);
      if (errorResponse) return res.status(400).json(errorResponse);
      return success(res, await this.folders.rename(+req.params.id, sanitized.name, req.user.id), 'Folder renamed');
    } catch (err) { next(err); }
  }

  async moveFolder(req, res, next) {
    try {
      const { errorResponse, sanitized } = folderMoveSchema.check(req.body, req);
      if (errorResponse) return res.status(400).json(errorResponse);
      return success(res, await this.folders.move(+req.params.id, sanitized.parentId ?? null, req.user.id), 'Folder moved');
    } catch (err) { next(err); }
  }

  async deleteFolder(req, res, next) {
    try {
      const result = await this.folders.deleteOwned(+req.params.id, req.user.id);
      return success(res, result, 'Folder deleted');
    } catch (err) { next(err); }
  }

  // ── Items ─────────────────────────────────────────────
  async listItems(req, res, next) {
    try {
      const folderId = parseNullableId(req.query.folderId);
      const kind = ['file', 'note', 'bug'].includes(req.query.kind) ? req.query.kind : null;
      return success(res, await this.items.listByFolder(req.user.id, folderId, kind));
    } catch (err) { next(err); }
  }

  async searchItems(req, res, next) {
    try {
      const kind = ['file', 'note', 'bug'].includes(req.query.kind) ? req.query.kind : null;
      return success(res, await this.items.search(req.user.id, req.query.q, kind));
    } catch (err) { next(err); }
  }

  async createItem(req, res, next) {
    try {
      const { errorResponse, sanitized } = itemCreateSchema.check(req.body, req);
      if (errorResponse) return res.status(400).json(errorResponse);
      return created(res, await this.items.create(sanitized, req.user.id));
    } catch (err) { next(err); }
  }

  async getItem(req, res, next) {
    try {
      // Incluye el contenido descomprimido
      return success(res, await this.items.getWithContent(+req.params.id, req.user.id));
    } catch (err) { next(err); }
  }

  async updateItem(req, res, next) {
    try {
      const { errorResponse, sanitized } = itemUpdateSchema.check(req.body, req);
      if (errorResponse) return res.status(400).json(errorResponse);
      return success(res, await this.items.updateOwned(+req.params.id, sanitized, req.user.id), 'File updated');
    } catch (err) { next(err); }
  }

  async moveItem(req, res, next) {
    try {
      const { errorResponse, sanitized } = itemMoveSchema.check(req.body, req);
      if (errorResponse) return res.status(400).json(errorResponse);
      return success(res, await this.items.move(+req.params.id, sanitized.folderId ?? null, req.user.id), 'File moved');
    } catch (err) { next(err); }
  }

  async deleteItem(req, res, next) {
    try {
      await this.items.deleteOwned(+req.params.id, req.user.id);
      return success(res, null, 'File deleted');
    } catch (err) { next(err); }
  }
}

module.exports = { KnowledgeController, knowledgeController: new KnowledgeController() };
