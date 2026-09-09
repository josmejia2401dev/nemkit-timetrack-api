'use strict';

const { mongoose, applyPlatformSchema } = require('nemkit');

/**
 * Un registro de tiempo (intervalo) dentro de una tarea.
 * El cronómetro se maneja en el frontend; al detenerlo, el intervalo
 * resultante se envía a POST /tasks/:id/time-records y se guarda aquí.
 */
const TIME_RECORD_TYPES = ['development', 'meeting', 'design', 'bugfix', 'documentation', 'testing', 'research', 'other'];

const TimeRecordSchema = new mongoose.Schema({
  start:      { type: Date, required: true },
  end:        { type: Date, required: true },
  durationMs: { type: Number, required: true, min: 0 },
  type:       { type: String, enum: TIME_RECORD_TYPES, default: 'development' },
  note:       { type: String, trim: true, default: '' },
}, { _id: true });

const TaskSchema = applyPlatformSchema({
  userId:           { type: Number, required: true, index: true },
  projectId:        { type: Number, required: true, index: true },
  activityId:       { type: Number, required: true, index: true },
  title:            { type: String, required: true, trim: true },
  description:      { type: String, trim: true, default: '' },
  status:           { type: String, enum: ['pending', 'in_progress', 'done'], default: 'pending' },
  estimatedMinutes: { type: Number, default: 0, min: 0 },
  category:         { type: String, trim: true, default: '' },
  tags:             [{ type: String, trim: true }],
  technologies:     [{ type: String, trim: true }],
  aiAssisted:       { type: Boolean, default: false },
  timeRecords:      { type: [TimeRecordSchema], default: [] },
  totalMs:          { type: Number, default: 0, min: 0 },
});

const TaskModel = mongoose.model('tasks', TaskSchema);
TaskModel.TIME_RECORD_TYPES = TIME_RECORD_TYPES;

module.exports = TaskModel;
