'use strict';

const { createValidator } = require('nemkit');

const createSchema = createValidator({
  title:   { type: 'string', required: true, trim: true, minLength: 1, maxLength: 150 },
  content: { type: 'string', maxLength: 20000 },
  pinned:  { type: 'boolean' },
  tags:    { type: 'array', of: { type: 'string', maxLength: 40 } },
});

const updateSchema = createValidator({
  title:   { type: 'string', trim: true, minLength: 1, maxLength: 150 },
  content: { type: 'string', maxLength: 20000 },
  pinned:  { type: 'boolean' },
  tags:    { type: 'array', of: { type: 'string', maxLength: 40 } },
});

module.exports = { createSchema, updateSchema };
