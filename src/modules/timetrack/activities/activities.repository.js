'use strict';

const { MongoRepository } = require('nemkit');
const Activity = require('./activities.model');

class ActivitiesRepository extends MongoRepository {
  constructor() { super(Activity); }
}

module.exports = { ActivitiesRepository };
