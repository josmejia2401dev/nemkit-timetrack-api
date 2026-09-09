'use strict';

const { mongoose, applyPlatformSchema } = require('nemkit');

/**
 * Note — nota libre de texto asociada a un proyecto.
 * El usuario guarda aquí información relevante: instrucciones, comandos,
 * enlaces, recordatorios, pasos, etc. Contenido libre (soporta markdown).
 */
const NoteSchema = applyPlatformSchema({
  userId:    { type: Number, required: true, index: true },
  projectId: { type: Number, required: true, index: true },
  title:     { type: String, required: true, trim: true },
  content:   { type: String, default: '' },
  pinned:    { type: Boolean, default: false },
  tags:      [{ type: String, trim: true }],
});

module.exports = mongoose.model('notes', NoteSchema);
