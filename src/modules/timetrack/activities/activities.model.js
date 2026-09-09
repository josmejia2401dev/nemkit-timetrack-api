'use strict';

const { mongoose, applyPlatformSchema } = require('nemkit');

const ActivitySchema = applyPlatformSchema({
  userId:           { type: Number, required: true, index: true },
  projectId:        { type: Number, required: true, index: true },
  name:             { type: String, required: true, trim: true },
  description:      { type: String, trim: true, default: '' },
  estimatedMinutes: { type: Number, default: 0, min: 0 },
  tags:             [{ type: String, trim: true }],
  technologies:     [{ type: String, trim: true }],
  status:           { type: String, enum: ['active', 'archived'], default: 'active' },
});

module.exports = mongoose.model('activities', ActivitySchema);
