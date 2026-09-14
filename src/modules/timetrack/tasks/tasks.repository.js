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
      { returnDocument: 'after', lean: true }, // Forzar POJO limpio
    );
    return this.normalizeOutput(doc);
  }

  /**
   * Elimina un time record por su _id y recalcula totalMs de forma 100% atómica.
   * Evita instanciar el documento Mongoose en memoria (bypasses .save()).
   */
  async pullTimeRecord(id, recordId, userId = null) {
    // 1. Obtener solo la proyección del record específico para saber cuánto tiempo restar
    const task = await this.model.findOne(
      { _id: id, 'timeRecords._id': recordId, ...this._baseFilter() },
      { 'timeRecords.$': 1 }
    ).lean();

    if (!task || !task.timeRecords || !task.timeRecords.length) {
      return { notFound: true };
    }

    const durationMsToRemove = task.timeRecords[0].durationMs || 0;

    // 2. Ejecutar $pull y $inc atómicamente
    const updatedDoc = await this.model.findOneAndUpdate(
      { _id: id, ...this._baseFilter() },
      {
        $pull: { timeRecords: { _id: recordId } },
        $inc: { totalMs: -durationMsToRemove },
        $set: { updatedBy: userId },
      },
      { returnDocument: 'after', lean: true }
    );

    return this.normalizeOutput(updatedDoc);
  }
}

module.exports = { TasksRepository };
