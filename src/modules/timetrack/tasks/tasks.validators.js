'use strict';

const { createValidator } = require('nemkit');

const fields = {
  title:            { type: 'string', trim: true, minLength: 2, maxLength: 200 },
  description:      { type: 'string', trim: true, maxLength: 2000 },
  status:           { type: 'string', enum: ['pending', 'in_progress', 'done'] },
  estimatedMinutes: { type: 'number', min: 0 },
  category:         { type: 'string', trim: true, maxLength: 60 },
  tags:             { type: 'array', of: { type: 'string', maxLength: 40 } },
  technologies:     { type: 'array', of: { type: 'string', maxLength: 40 } },
  aiAssisted:       { type: 'boolean' },
};

const createSchema = createValidator({ ...fields, title: { ...fields.title, required: true } });
const updateSchema = createValidator(fields);

module.exports = { createSchema, updateSchema };
