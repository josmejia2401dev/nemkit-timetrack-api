'use strict';

const { createValidator } = require('nemkit');

const fields = {
  name:             { type: 'string', trim: true, minLength: 2, maxLength: 100 },
  description:      { type: 'string', trim: true, maxLength: 500 },
  estimatedMinutes: { type: 'number', min: 0 },
  tags:             { type: 'array', of: { type: 'string', maxLength: 40 } },
  technologies:     { type: 'array', of: { type: 'string', maxLength: 40 } },
  status:           { type: 'string', enum: ['active', 'archived'] },
};

const createSchema = createValidator({ ...fields, name: { ...fields.name, required: true } });
const updateSchema = createValidator(fields);

module.exports = { createSchema, updateSchema };
