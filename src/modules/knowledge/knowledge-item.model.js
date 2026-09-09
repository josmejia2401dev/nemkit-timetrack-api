'use strict';

const { mongoose, applyPlatformSchema } = require('nemkit');

/**
 * Archivo/snippet de la base de conocimiento.
 * - folderId null → está en la raíz
 * - content: texto plano (sin comprimir), para permitir búsqueda por contenido.
 *            Oculto por defecto (select:false) porque puede pesar.
 * - sizeBytes: tamaño del contenido en bytes, para validar el límite de 1MB.
 */
const KnowledgeItemSchema = applyPlatformSchema({
  userId:    { type: Number, required: true, index: true },
  folderId:  { type: Number, default: null, index: true },
  name:      { type: String, required: true, trim: true },
  kind:      { type: String, enum: ['file', 'note', 'bug'], default: 'file', index: true }, // tipo de entrada
  language:  { type: String, default: 'text' },     // java, javascript, markdown, text, json, ...
  mimeType:  { type: String, default: 'text/plain' },
  sizeBytes: { type: Number, default: 0 },           // tamaño en bytes
  content:   { type: String, default: '', select: false }, // texto plano, oculto por defecto (pesa)
  tags:      [{ type: String, trim: true }],
});

module.exports = mongoose.model('knowledge_items', KnowledgeItemSchema);
