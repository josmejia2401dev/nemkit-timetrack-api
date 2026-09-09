'use strict';

const { BaseService, HttpError } = require('nemkit');
const { KnowledgeItemRepository } = require('./knowledge-item.repository');
const { knowledgeFolderService } = require('./knowledge-folder.service');
const { knowledgeCache } = require('./knowledge.cache');

const MAX_SIZE_BYTES = 1024 * 1024; // 1 MB

class KnowledgeItemService extends BaseService {
  constructor() {
    super(new KnowledgeItemRepository());
    this.notFoundMessage = 'Item not found';
  }

  /** Valida que la carpeta destino exista y sea del usuario (null = raíz). */
  async #assertFolder(folderId, userId) {
    if (folderId == null) return;
    await knowledgeFolderService.getOwned(folderId, userId);
  }

  /** Normaliza el contenido a texto y valida el límite de 1 MB. */
  #normalizeContent(content) {
    const raw = typeof content === 'string' ? content : String(content ?? '');
    const sizeBytes = Buffer.byteLength(raw, 'utf8');
    if (sizeBytes > MAX_SIZE_BYTES) {
      throw HttpError.badRequest('File exceeds the 1MB limit');
    }
    return { text: raw, sizeBytes };
  }

  /** Lista los archivos de una carpeta (sin content). */
  listByFolder(userId, folderId, kind = null) {
    const fid = folderId ?? null;
    return knowledgeCache.getOrSet(
      userId,
      knowledgeCache.keys.items(userId, fid, kind),
      () => this.repository.listByFolder(userId, fid, kind),
    );
  }

  /**
   * Busca items del usuario por nombre, tags o contenido.
   * @param {number} userId
   * @param {string} q - texto a buscar
   * @param {string|null} kind - filtro opcional por tipo
   */
  async search(userId, q, kind = null) {
    const term = String(q ?? '').trim();
    if (!term) return [];
    const normalizedTerm = term.toLowerCase().replace(/\s+/g, ' ');
    return knowledgeCache.getOrSet(
      userId,
      knowledgeCache.keys.search(userId, normalizedTerm, kind),
      async () => {
        const [results, pathMap] = await Promise.all([
          this.repository.search(userId, normalizedTerm, kind),
          knowledgeFolderService.folderPathMap(userId),
        ]);
        return results.map((item) => ({
          ...item,
          folderPath: item.folderId == null
            ? 'Root'
            : knowledgeFolderService.formatPath(pathMap.get(item.folderId)),
        }));
      },
    );
  }

  /** Obtiene metadata del item (sin content). Lanza 404 si no existe. */
  async getOwned(id, userId) {
    const item = await knowledgeCache.getOrSet(
      userId,
      knowledgeCache.keys.item(userId, id),
      () => this.repository.findOne({ _id: id, userId }),
    );
    if (!item) throw HttpError.notFound('Item not found');
    return item;
  }

  /** Obtiene el item CON su contenido y la ruta legible de su carpeta. */
  async getWithContent(id, userId) {
    const item = await knowledgeCache.getOrSet(
      userId,
      knowledgeCache.keys.item(userId, id),
      () => this.repository.findWithContent(id, userId),
    );
    if (!item) throw HttpError.notFound('Item not found');
    const folderPath = await knowledgeFolderService.folderPathLabel(item.folderId, userId);
    return { ...item, content: item.content ?? '', folderPath };
  }

  async create(payload, userId) {
    const { name, folderId, kind, content = '', language, mimeType, tags } = payload;
    if (!name || !name.trim()) throw HttpError.badRequest('File name is required');

    const fid = folderId ?? null;
    await this.#assertFolder(fid, userId);

    const { text, sizeBytes } = this.#normalizeContent(content);

    const created = await this.repository.create({
      userId,
      folderId: fid,
      name: name.trim(),
      kind: ['file', 'note', 'bug'].includes(kind) ? kind : 'file',
      language: language || 'text',
      mimeType: mimeType || 'text/plain',
      sizeBytes,
      content: text,
      tags: Array.isArray(tags) ? tags : [],
    }, userId);

    // Devolvemos metadata limpia (sin content) para no inflar la respuesta de la lista.
    const { content: _c, ...meta } = created;
    knowledgeCache.invalidateUser(userId);
    knowledgeCache.setItem(userId, created);
    return meta;
  }

  async updateOwned(id, payload, userId) {
    await this.getOwned(id, userId);

    const update = {};
    if (payload.name != null) {
      if (!payload.name.trim()) throw HttpError.badRequest('File name is required');
      update.name = payload.name.trim();
    }
    if (payload.kind != null && ['file', 'note', 'bug'].includes(payload.kind)) update.kind = payload.kind;
    if (payload.language != null) update.language = payload.language;
    if (payload.mimeType != null) update.mimeType = payload.mimeType;
    if (Array.isArray(payload.tags)) update.tags = payload.tags;

    if (payload.content != null) {
      const { text, sizeBytes } = this.#normalizeContent(payload.content);
      update.content = text;
      update.sizeBytes = sizeBytes;
    }

    const updated = await this.updateById(id, update, userId);
    const fresh = await this.repository.findWithContent(id, userId);
    const { content: _c, ...meta } = fresh ?? updated;
    knowledgeCache.invalidateUser(userId);
    knowledgeCache.setItem(userId, fresh ?? updated);
    return meta;
  }

  /** Mueve el item a otra carpeta (null = raíz). */
  async move(id, newFolderId, userId) {
    await this.getOwned(id, userId);
    const fid = newFolderId ?? null;
    await this.#assertFolder(fid, userId);
    const updated = await this.updateById(id, { folderId: fid }, userId);
    const fresh = await this.repository.findWithContent(id, userId);
    const { content: _c, ...meta } = fresh ?? updated;
    knowledgeCache.invalidateUser(userId);
    knowledgeCache.setItem(userId, fresh ?? updated);
    return meta;
  }

  /** Borrado FÍSICO del item (no recuperable). */
  async deleteOwned(id, userId) {
    await this.getOwned(id, userId); // valida existencia y dueño (404 si no)
    const result = await this.repository.hardDeleteOwned(id, userId);
    knowledgeCache.invalidateUser(userId);
    return result;
  }
}

module.exports = { KnowledgeItemService, knowledgeItemService: new KnowledgeItemService() };
