'use strict';

const { mongoose, applyPlatformSchema } = require('nemkit');

/**
 * Carpeta de la base de conocimiento. Árbol de N niveles.
 * - parentId null → carpeta raíz
 * - path: ruta completa cacheada, ej "/java/utils" (para breadcrumbs y navegación)
 */
const KnowledgeFolderSchema = applyPlatformSchema({
  userId:   { type: Number, required: true, index: true },
  name:     { type: String, required: true, trim: true },
  parentId: { type: Number, default: null, index: true },
  path:     { type: String, default: '/', index: true },
});

module.exports = mongoose.model('knowledge_folders', KnowledgeFolderSchema);
