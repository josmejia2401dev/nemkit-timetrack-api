'use strict';

const { BaseService, HttpError } = require('nemkit');
const { KnowledgeFolderRepository } = require('./knowledge-folder.repository');
const { KnowledgeItemRepository } = require('./knowledge-item.repository');
const { knowledgeCache } = require('./knowledge.cache');

class KnowledgeFolderService extends BaseService {
  constructor() {
    super(new KnowledgeFolderRepository());
    this.itemsRepository = new KnowledgeItemRepository();
    this.notFoundMessage = 'Folder not found';
  }

  listChildren(userId, parentId) {
    const pid = parentId ?? null;
    return knowledgeCache.getOrSet(
      userId,
      knowledgeCache.keys.folders(userId, pid),
      () => this.repository.listChildren(userId, pid),
    );
  }

  listAll(userId) {
    return knowledgeCache.getOrSet(
      userId,
      knowledgeCache.keys.foldersAll(userId),
      () => this.repository.listAll(userId),
    );
  }

  /**
   * Devuelve un Map<folderId, path> con todas las carpetas del usuario.
   * Útil para resolver la ubicación de items sin múltiples consultas.
   *
   * Nota: el cache guarda un array de pares [id, path] (serializable) y se
   * reconstruye el Map al leer, porque un Map no sobrevive bien a estructuras
   * de cache genéricas.
   */
  async folderPathMap(userId) {
    const pairs = await knowledgeCache.getOrSet(
      userId,
      knowledgeCache.keys.pathMap(userId),
      async () => {
        const all = await this.repository.listAll(userId);
        return all.map((f) => [f.id, f.path]);
      },
    );
    return new Map(pairs);
  }

  /** Path legible de una carpeta (null = raíz). Ej: "Root / mi-unidad / bugs". */
  async folderPathLabel(folderId, userId) {
    if (folderId == null) return 'Root';
    const folder = await this.getOwned(folderId, userId);
    return folder ? this.formatPath(folder.path) : 'Root';
  }

  /** Convierte un path cacheado "/a/b/c" en etiqueta legible "Root / a / b / c". */
  formatPath(path) {
    if (!path) return 'Root';
    const parts = path.split('/').filter(Boolean);
    return ['Root', ...parts].join(' / ');
  }

  /**
   * Devuelve todas las carpetas del usuario como un árbol anidado.
   * Cada nodo: { id, name, parentId, path, children: [] }
   */
  tree(userId) {
    return knowledgeCache.getOrSet(
      userId,
      knowledgeCache.keys.tree(userId),
      async () => {
        const all = await this.repository.listAll(userId);
        const byId = new Map();
        all.forEach((f) => byId.set(f.id, { id: f.id, name: f.name, parentId: f.parentId, path: f.path, children: [] }));

        const roots = [];
        byId.forEach((node) => {
          if (node.parentId != null && byId.has(node.parentId)) {
            byId.get(node.parentId).children.push(node);
          } else {
            roots.push(node);
          }
        });
        return roots;
      },
    );
  }

  async getOwned(id, userId) {
    const folder = await knowledgeCache.getOrSet(
      userId,
      knowledgeCache.keys.folder(userId, id),
      () => this.repository.findOne({ _id: id, userId }),
    );
    if (!folder) throw HttpError.notFound('Folder not found');
    return folder;
  }

  /** Construye el path de una carpeta a partir de su padre. */
  async #buildPath(name, parentId, userId) {
    if (parentId == null) return `/${name}`;
    const parent = await this.getOwned(parentId, userId);
    return `${parent.path}/${name}`;
  }

  async create({ name, parentId }, userId) {
    if (!name || !name.trim()) throw HttpError.badRequest('Folder name is required');
    const pid = parentId ?? null;
    if (pid != null) await this.getOwned(pid, userId); // valida que el padre exista y sea del usuario

    // Evitar nombre duplicado en el mismo nivel
    const siblings = await this.repository.listChildren(userId, pid);
    if (siblings.some((s) => s.name.toLowerCase() === name.trim().toLowerCase())) {
      throw HttpError.conflict('A folder with that name already exists here');
    }

    const path = await this.#buildPath(name.trim(), pid, userId);
    const created = await this.repository.create({ userId, name: name.trim(), parentId: pid, path }, userId);
    knowledgeCache.invalidateUser(userId);
    knowledgeCache.setFolder(userId, created);
    return created;
  }

  async rename(id, newName, userId) {
    if (!newName || !newName.trim()) throw HttpError.badRequest('Folder name is required');
    const folder = await this.getOwned(id, userId);
    const newPath = await this.#buildPath(newName.trim(), folder.parentId, userId);

    await this.updateById(id, { name: newName.trim(), path: newPath }, userId);
    await this.#recalcDescendantPaths(id, userId);
    knowledgeCache.invalidateUser(userId);
    const updated = await this.repository.findOne({ _id: id, userId });
    knowledgeCache.setFolder(userId, updated);
    return updated;
  }

  /**
   * Mueve una carpeta a otro padre. Previene ciclos y recalcula paths.
   */
  async move(id, newParentId, userId) {
    const folder = await this.getOwned(id, userId);
    const target = newParentId ?? null;

    if (target === folder.id) throw HttpError.badRequest('A folder cannot be moved into itself');

    if (target != null) {
      const targetFolder = await this.getOwned(target, userId);
      // Prevenir ciclo: el destino no puede ser un descendiente de la carpeta que movemos
      if (targetFolder.path.startsWith(folder.path + '/') || targetFolder.path === folder.path) {
        throw HttpError.badRequest('Cannot move a folder into one of its descendants');
      }
    }

    const newPath = await this.#buildPath(folder.name, target, userId);
    await this.updateById(id, { parentId: target, path: newPath }, userId);
    await this.#recalcDescendantPaths(id, userId);
    knowledgeCache.invalidateUser(userId);
    const updated = await this.repository.findOne({ _id: id, userId });
    knowledgeCache.setFolder(userId, updated);
    return updated;
  }

  /**
   * Recalcula el path de todos los descendientes tras un rename/move.
   */
  async #recalcDescendantPaths(folderId, userId) {
    const all = await this.repository.listAll(userId);
    const byId = new Map(all.map((f) => [f.id, f]));

    const computePath = (f) => {
      if (f.parentId == null) return `/${f.name}`;
      const parent = byId.get(f.parentId);
      return parent ? `${computePath(parent)}/${f.name}` : `/${f.name}`;
    };

    for (const f of all) {
      const fresh = computePath(f);
      if (fresh !== f.path) {
        await this.repository.updateById(f.id, { path: fresh }, userId);
      }
    }
  }

  /**
   * Elimina una carpeta y en cascada TODAS sus subcarpetas + archivos.
   */
  async deleteOwned(id, userId) {
    const folder = await this.getOwned(id, userId);

    // Descendientes: se recorren por parentId para no depender de paths cacheados.
    const all = await this.repository.listAll(userId);
    const childrenByParent = new Map();
    for (const candidate of all) {
      const parentKey = candidate.parentId ?? null;
      const children = childrenByParent.get(parentKey) ?? [];
      children.push(candidate);
      childrenByParent.set(parentKey, children);
    }

    const toDelete = [];
    const pending = [folder.id];
    const foldersById = new Map(all.map((candidate) => [candidate.id, candidate]));
    while (pending.length) {
      const currentId = pending.pop();
      const current = foldersById.get(currentId) ?? (currentId === folder.id ? folder : null);
      if (current) toDelete.push(current);
      for (const child of childrenByParent.get(currentId) ?? []) pending.push(child.id);
    }
    const ids = toDelete.map((f) => f.id);

    // Borrado FÍSICO (no recuperable): primero los archivos de todas esas carpetas,
    // luego las carpetas.
    await this.itemsRepository.hardDeleteByFolders(ids, userId);
    await this.repository.hardDeleteMany({ _id: { $in: ids }, userId });

    knowledgeCache.invalidateUser(userId);
    return { deletedFolders: ids.length };
  }
}

module.exports = { KnowledgeFolderService, knowledgeFolderService: new KnowledgeFolderService() };
