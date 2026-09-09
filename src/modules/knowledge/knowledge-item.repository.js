'use strict';

const { MongoRepository } = require('nemkit');
const KnowledgeItem = require('./knowledge-item.model');

/** Escapa una cadena para usarla de forma segura dentro de un RegExp. */
function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

class KnowledgeItemRepository extends MongoRepository {
  constructor() { super(KnowledgeItem); }

  /** Archivos de una carpeta (null = raíz), opcionalmente filtrados por kind. El contenido NO se incluye (select:false). */
  listByFolder(userId, folderId = null, kind = null) {
    const filter = { userId, folderId };
    if (kind) filter.kind = kind;
    return this.find(filter, { sort: { name: 1 } });
  }

  /** Obtiene un item incluyendo el content (texto plano). */
  async findWithContent(id, userId) {
    const doc = await this.model.findOne({ _id: id, userId, ...this._baseFilter() }).select('+content');
    return this.normalizeOutput(doc);
  }

  /**
   * Busca items del usuario por nombre, tags o contenido (case-insensitive).
   * Usa regex sobre name/content/tags para permitir coincidencias parciales.
   * El contenido NO se devuelve (solo metadata) para no inflar la respuesta.
   */
  async search(userId, term, kind = null) {
    const rx = new RegExp(escapeRegex(term), 'i');
    const filter = {
      userId,
      ...this._baseFilter(),
      $or: [{ name: rx }, { content: rx }, { tags: rx }],
    };
    if (kind) filter.kind = kind;

    const docs = await this.model.find(filter)
      .select('-content') // metadata solamente
      .sort({ name: 1 })
      .limit(100);
    return docs.map((d) => this.normalizeOutput(d));
  }

  /** Borrado FÍSICO de todos los archivos de un conjunto de carpetas (del usuario). */
  async hardDeleteByFolders(folderIds, userId) {
    if (!folderIds.length) return { deletedCount: 0 };
    const filter = { folderId: { $in: folderIds } };
    if (userId != null) filter.userId = userId;
    return this.hardDeleteMany(filter);
  }

  /** Borrado FÍSICO de un item por id (validando dueño). */
  async hardDeleteOwned(id, userId) {
    return this.hardDelete({ _id: id, userId });
  }
}

module.exports = { KnowledgeItemRepository };
