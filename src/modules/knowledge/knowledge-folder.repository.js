'use strict';

const { MongoRepository } = require('nemkit');
const KnowledgeFolder = require('./knowledge-folder.model');

class KnowledgeFolderRepository extends MongoRepository {
  constructor() { super(KnowledgeFolder); }

  /** Subcarpetas directas de un padre (null = raíz). */
  listChildren(userId, parentId = null) {
    return this.find({ userId, parentId }, { sort: { name: 1 } });
  }

  /** Todas las carpetas del usuario (para armar el árbol o descendientes). */
  listAll(userId) {
    return this.find({ userId }, { sort: { path: 1 } });
  }
}

module.exports = { KnowledgeFolderRepository };
