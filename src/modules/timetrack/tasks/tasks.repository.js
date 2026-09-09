'use strict';

const { MongoRepository } = require('nemkit');
const Task = require('./tasks.model');

class TasksRepository extends MongoRepository {
  constructor() { super(Task); }

  /**
   * Agrega un time record a la tarea y recalcula totalMs de forma atómica.
   * @returns el documento actualizado (normalizado)
   */
  async pushTimeRecord(id, record, userId = null) {
    const doc = await this.model.findOneAndUpdate(
      { _id: id, ...this._baseFilter() },
      {
        $push: { timeRecords: record },
        $inc: { totalMs: record.durationMs },
        $set: { updatedBy: userId },
      },
      { returnDocument: 'after' },
    );
    return this.normalizeOutput(doc);
  }

  /**
   * Elimina un time record por su _id y recalcula totalMs.
   */
  async pullTimeRecord(id, recordId, userId = null) {
    const task = await this.model.findOne({ _id: id, ...this._baseFilter() });
    if (!task) return null;

    const record = task.timeRecords.id(recordId);
    if (!record) return { notFound: true };

    // Remove the subdocument by its real _id (ObjectId), then recompute total.
    record.deleteOne();
    task.totalMs = task.timeRecords.reduce((sum, r) => sum + (r.durationMs || 0), 0);
    task.updatedBy = userId;
    await task.save();

    return this.normalizeOutput(task);
  }
}

module.exports = { TasksRepository };
