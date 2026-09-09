'use strict';

const { express, success, HttpError, hashPassword, comparePassword } = require('nemkit');
const { authenticate } = require('../middlewares/auth.middleware');

const authRoutes = require('../modules/foundation/auth/auth.routes');
const logsRoutes = require('../modules/foundation/loggers/logs.routes');
const { usersService } = require('../modules/foundation/users/users.service');

const projectsRoutes = require('../modules/timetrack/projects/projects.routes');
const activitiesRoutes = require('../modules/timetrack/activities/activities.routes');
const tasksRoutes = require('../modules/timetrack/tasks/tasks.routes');
const notesRoutes = require('../modules/timetrack/notes/notes.routes');
const knowledgeRoutes = require('../modules/knowledge/knowledge.routes');
const cacheRoutes = require('../modules/cache/cache.routes');

const router = express.Router();

// Public
router.use('/auth', authRoutes);

// Protected
router.use(authenticate);

// Profile
router.get('/profile', async (req, res, next) => {
  try {
    const user = await usersService.getById(req.user.id);
    return success(res, {
      id: user._id,
      fullName: user.fullName,
      email: user.email,
      roles: user.roles,
      security: {
        lastLoginAt: user.security?.lastLoginAt ?? null,
        loginAttempts: user.security?.loginAttempts ?? 0,
        lockedUntil: user.security?.lockedUntil ?? null,
        mustChangePassword: user.security?.mustChangePassword ?? false,
      },
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    });
  } catch (err) { next(err); }
});

router.put('/profile', async (req, res, next) => {
  try {
    const { fullName, email } = req.body;
    const updated = await usersService.updateById(req.user.id, { fullName, email }, req.user.id);
    return success(res, { fullName: updated.fullName, email: updated.email }, 'Profile updated');
  } catch (err) { next(err); }
});

router.put('/profile/password', async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) throw HttpError.badRequest('Current and new password are required');
    if (newPassword.length < 6) throw HttpError.badRequest('New password must be at least 6 characters');

    const user = await usersService.findByIdWithPassword(req.user.id);
    if (!user) throw HttpError.notFound('User not found');

    const valid = await comparePassword(currentPassword, user.passwordHash);
    if (!valid) throw HttpError.badRequest('Current password is incorrect');

    const passwordHash = await hashPassword(newPassword);
    await usersService.updateById(req.user.id, { passwordHash }, req.user.id);
    return success(res, null, 'Password changed successfully');
  } catch (err) { next(err); }
});

// ── Timetrack: Project → Activity → Task ──────────────────────

// Projects CRUD
router.use('/projects', projectsRoutes);

// Activities nested under a project, and flat by id
router.use('/projects/:projectId/activities', activitiesRoutes.nestedRouter);
router.use('/activities', activitiesRoutes.flatRouter);

// Tasks nested under an activity, and flat by id
router.use('/activities/:activityId/tasks', tasksRoutes.nestedRouter);
router.use('/tasks', tasksRoutes.flatRouter);

// Notes: free-text notes per project (nested + flat)
router.use('/projects/:projectId/notes', notesRoutes.nestedRouter);
router.use('/notes', notesRoutes.flatRouter);

// Knowledge base: folders (N-level tree) + items (files/notes/bugs)
router.use('/knowledge', knowledgeRoutes);

// Cache administration (ADMIN only) — no manual value editing
router.use('/cache', cacheRoutes);

// Logs viewer (ADMIN only, enforced inside the router)
router.use('/logs', logsRoutes);

module.exports = router;
