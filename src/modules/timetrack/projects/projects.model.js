'use strict';

const { mongoose, applyPlatformSchema } = require('nemkit');

const ProjectSchema = applyPlatformSchema({
  userId:       { type: Number, required: true, index: true },
  name:         { type: String, required: true, trim: true },
  description:  { type: String, trim: true, default: '' },
  color:        { type: String, default: '#6366F1' },
  company:      { type: String, trim: true, default: '' },
  client:       { type: String, trim: true, default: '' },
  tags:         [{ type: String, trim: true }],
  technologies: [{ type: String, trim: true }],
  status:       { type: String, enum: ['active', 'archived'], default: 'active' },
});

module.exports = mongoose.model('projects', ProjectSchema);
