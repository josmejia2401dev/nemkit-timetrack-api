'use strict';

const { eventBus } = require('nemkit');
const logger = require('../config/logger');

/**
 * Middleware de auditoría.
 * Registra acciones (POST, PUT, PATCH, DELETE) con datos del request.
 * Emite eventos al eventBus para que otros módulos reaccionen si quieren.
 */

const SKIP_PATHS = new Set(['/', '/health', '/ready']);
const AUDITABLE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function auditMiddleware(req, res, next) {
  if (SKIP_PATHS.has(req.path)) return next();
  if (!AUDITABLE_METHODS.has(req.method)) return next();

  const startedAt = process.hrtime.bigint();

  res.on('finish', () => {
    const durationMs = Math.round(Number(process.hrtime.bigint() - startedAt) / 1e6);

    const entry = {
      event: 'audit.request',
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs,
      requestId: req.requestId ?? null,
      userId: req.user?.id ?? null,
      userEmail: req.user?.email ?? null,
      ip: req.ip,
      timestamp: new Date().toISOString(),
    };

    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
    logger[level]('audit', entry);

    eventBus.emit('audit.action', entry);
  });

  next();
}

module.exports = { auditMiddleware };
