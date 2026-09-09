'use strict';

const { express } = require('nemkit');
const { projectsController } = require('./projects.controller');

const router = express.Router();

router.get('/',      projectsController.list.bind(projectsController));
router.post('/',     projectsController.create.bind(projectsController));
router.get('/:id',   projectsController.getById.bind(projectsController));
router.put('/:id',   projectsController.update.bind(projectsController));
router.post('/:id/archive', projectsController.archive.bind(projectsController));
router.delete('/:id', projectsController.remove.bind(projectsController));

module.exports = router;
