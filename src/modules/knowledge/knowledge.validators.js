'use strict';

const { createValidator } = require('nemkit');

// ── Folders ──────────────────────────────────────────────
const folderCreateSchema = createValidator({
  name:     { type: 'string', required: true, trim: true, minLength: 1, maxLength: 120 },
  parentId: { type: 'number' },
});

const folderRenameSchema = createValidator({
  name: { type: 'string', required: true, trim: true, minLength: 1, maxLength: 120 },
});

const folderMoveSchema = createValidator({
  parentId: { type: 'number' },
});

// ── Items ────────────────────────────────────────────────
const itemCreateSchema = createValidator({
  name:     { type: 'string', required: true, trim: true, minLength: 1, maxLength: 150 },
  folderId: { type: 'number' },
  kind:     { type: 'string', enum: ['file', 'note', 'bug'] },
  content:  { type: 'string', maxLength: 2000000 }, // ~2M chars; el límite real de 1MB se valida por bytes en el service
  language: { type: 'string', maxLength: 40 },
  mimeType: { type: 'string', maxLength: 100 },
  tags:     { type: 'array', of: { type: 'string', maxLength: 40 } },
});

const itemUpdateSchema = createValidator({
  name:     { type: 'string', trim: true, minLength: 1, maxLength: 150 },
  kind:     { type: 'string', enum: ['file', 'note', 'bug'] },
  content:  { type: 'string', maxLength: 2000000 },
  language: { type: 'string', maxLength: 40 },
  mimeType: { type: 'string', maxLength: 100 },
  tags:     { type: 'array', of: { type: 'string', maxLength: 40 } },
});

const itemMoveSchema = createValidator({
  folderId: { type: 'number' },
});

module.exports = {
  folderCreateSchema,
  folderRenameSchema,
  folderMoveSchema,
  itemCreateSchema,
  itemUpdateSchema,
  itemMoveSchema,
};
