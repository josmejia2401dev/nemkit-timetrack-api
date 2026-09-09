'use strict';

const { MongoRepository } = require('nemkit');
const Project = require('./projects.model');

class ProjectsRepository extends MongoRepository {
  constructor() { super(Project); }
}

module.exports = { ProjectsRepository };
