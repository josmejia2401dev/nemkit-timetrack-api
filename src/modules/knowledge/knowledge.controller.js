'use strict';

const { success, created } = require('nemkit');
const { knowledgeFolderService } = require('./knowledge-folder.service');
const { knowledgeItemService } = require('./knowledge-item.service');
const { storageHandler } = require('../../config/storage');
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
    this.chunkMeta = new Map(); // uploadId -> { folderId, name, userId }
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

  // ── Upload / Download (binarios vía nemkit/storage) ──
  async uploadItem(req, res, next) {
    let fileHandle = null;
    try {
      const originalName = decodeURIComponent(req.headers['x-file-name'] || 'file');
      const mime = req.headers['content-type'] || 'application/octet-stream';
      const folderId = parseNullableId(req.query.folderId);
      const name = req.query.name ? decodeURIComponent(String(req.query.name)) : originalName;

      // El request es un stream; el handler decide memoria vs disco por tamaño.
      fileHandle = await storageHandler.receive(req, { originalName, mime });

      const item = await this.items.createFromUpload(fileHandle, { name, folderId }, req.user.id);
      return created(res, item);
    } catch (err) {
      next(err);
    } finally {
      if (fileHandle) { try { await fileHandle.discard(); } catch { /* staging ya limpio */ } }
    }
  }

  // ── Chunked upload (archivos ≥ 500 KB) ──
  async initChunkUpload(req, res, next) {
    try {
      const { originalName, mime, totalChunks, totalSize } = req.body;
      if (!originalName || !totalChunks) return res.status(400).json({ success: false, message: 'originalName and totalChunks are required' });
      const folderId = parseNullableId(req.body.folderId);
      const name = req.body.name ? String(req.body.name) : String(originalName);

      const session = await storageHandler.initChunkUpload({
        originalName: String(originalName),
        mime: mime || 'application/octet-stream',
        totalChunks: Number(totalChunks),
        totalSize: totalSize != null ? Number(totalSize) : null,
      });

      this.chunkMeta.set(session.uploadId, { folderId, name, userId: req.user.id });
      return success(res, { uploadId: session.uploadId, totalChunks: session.totalChunks });
    } catch (err) { next(err); }
  }

  async uploadChunk(req, res, next) {
    try {
      const { uploadId, index } = req.params;
      const meta = this.chunkMeta.get(uploadId);
      if (!meta || meta.userId !== req.user.id) return res.status(404).json({ success: false, message: 'Upload session not found' });

      const result = await storageHandler.receiveChunk(uploadId, Number(index), req);
      return success(res, result);
    } catch (err) { next(err); }
  }

  async completeChunkUpload(req, res, next) {
    let fileHandle = null;
    try {
      const { uploadId } = req.params;
      const meta = this.chunkMeta.get(uploadId);
      if (!meta || meta.userId !== req.user.id) return res.status(404).json({ success: false, message: 'Upload session not found' });

      fileHandle = await storageHandler.complete(uploadId);
      const item = await this.items.createFromUpload(fileHandle, { name: meta.name, folderId: meta.folderId }, req.user.id);
      this.chunkMeta.delete(uploadId);
      return created(res, item);
    } catch (err) {
      next(err);
    } finally {
      if (fileHandle) { try { await fileHandle.discard(); } catch { /* limpio */ } }
    }
  }

  async abortChunkUpload(req, res, next) {
    try {
      const { uploadId } = req.params;
      const meta = this.chunkMeta.get(uploadId);
      if (meta && meta.userId !== req.user.id) return res.status(404).json({ success: false, message: 'Upload session not found' });
      await storageHandler.abortChunkUpload(uploadId);
      this.chunkMeta.delete(uploadId);
      return success(res, { aborted: true });
    } catch (err) { next(err); }
  }

  async downloadItem(req, res, next) {
    try {
      const file = await this.items.getBinary(+req.params.id, req.user.id);
      res.setHeader('Content-Type', file.mimeType);
      res.setHeader('Content-Length', file.sizeBytes);
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.originalName)}"`);
      return res.end(file.buffer);
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
