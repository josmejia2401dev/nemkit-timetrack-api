'use strict';

const { MongoRepository } = require('nemkit');
const Note = require('./notes.model');

class NotesRepository extends MongoRepository {
  constructor() { super(Note); }
}

module.exports = { NotesRepository };
