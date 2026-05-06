// ARCHIVO: backend/gateway/index.js
require('dotenv').config();
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const morgan  = require('morgan');
const cors    = require('cors');

const { requireJudicante, requireAdmin } = require('./middleware/auth');

const app  = express();
const PORT = process.env.PORT || 5000;

// ─── URLs de microservicios ───────────────────────────────────────────────────
// NUNCA usar localhost: cada contenedor Docker tiene su propia red.
// Los nombres de servicio son resueltos por el DNS interno de Docker.
const USER_AUTH_SERVICE_URL    = process.env.USER_AUTH_SERVICE_URL    || 'http://user-auth-service:3001';
const CONCILIACION_SERVICE_URL = process.env.CONCILIACION_SERVICE_URL || 'http://conciliacion-service:3002';
const DOCUMENT_SERVICE_URL     = process.env.DOCUMENT_SERVICE_URL     || 'http://document-service:3004';
const AGENDA_SERVICE_URL       = process.env.AGENDA_SERVICE_URL       || 'http://agenda-service:3003';
const FINANCE_SERVICE_URL      = process.env.FINANCE_SERVICE_URL      || 'http://finance-service:3005';
const TASK_SERVICE_URL         = process.env.TASK_SERVICE_URL         || 'http://task-service:3006';

// ─── CORS ─────────────────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : null;

app.use(morgan('dev'));
app.use(cors({
  origin: (origin, callback) => {
    if (!origin)               return callback(null, true);  // server-to-server / curl
    if (!ALLOWED_ORIGINS)      return callback(null, true);  // dev: permitir todo
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    callback(new Error(`Origin no permitido: ${origin}`));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Helpers ──────────────────────────────────────────────────────────────────
function proxyError(serviceName, errorCode, _req, res, err) {
  console.error(`[GATEWAY] Error en ${serviceName}:`, err.message);
  res.status(503).json({ error: `${serviceName} no disponible`, code: errorCode });
}

/**
 * Inyecta headers de usuario en la petición al microservicio.
 * El servicio de destino puede leer X-User-ID, X-User-Role, X-User-Email
 * sin necesidad de re-validar el JWT (confía en el gateway).
 */
function injectUserHeaders(proxyReq, req) {
  if (req.user) {
    proxyReq.setHeader('X-User-ID',    req.user.sub);
    proxyReq.setHeader('X-User-Role',  req.user.tipo_usuario);
    proxyReq.setHeader('X-User-Email', req.user.email || '');
  }
}

function forwardBody(proxyReq, req) {
  const contentType = req.headers['content-type'] || '';
  // No tocar streams multipart — el proxy los pasa directamente sin bufferear
  if (contentType.includes('multipart/form-data')) return;
  if (req.body !== undefined && req.body !== null) {
    const bodyData = JSON.stringify(req.body);
    proxyReq.setHeader('Content-Type', 'application/json');
    proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
    proxyReq.write(bodyData);
  }
}

function markGateway(proxyRes) {
  proxyRes.headers['x-api-gateway'] = 'lexim-gateway';
}

// ─────────────────────────────────────────────────────────────────────────────
//  RUTAS PÚBLICAS — no requieren JWT
// ─────────────────────────────────────────────────────────────────────────────

// 🔓 AUTH — login (público, sin verificación de token)
app.use('/auth', createProxyMiddleware({
  target: USER_AUTH_SERVICE_URL,
  changeOrigin: true,
  proxyTimeout: 10000,
  pathRewrite: (path) => `/auth${path}`,
  on: {
    proxyReq: (proxyReq, req) => {
      console.log(`→ [AUTH] ${req.method} ${req.originalUrl}`);
      forwardBody(proxyReq, req);
    },
    proxyRes: markGateway,
    error: (err, req, res) => proxyError('User Auth service', 'AUTH_UNAVAILABLE', req, res, err)
  }
}));

// ─────────────────────────────────────────────────────────────────────────────
//  RUTAS PROTEGIDAS — requieren JWT válido (administrador o judicante)
// ─────────────────────────────────────────────────────────────────────────────

// ✅ TASKS (legacy) — ruta original hacia user-auth-service
app.use('/tasks', requireJudicante, createProxyMiddleware({
  target: USER_AUTH_SERVICE_URL,
  changeOrigin: true,
  proxyTimeout: 10000,
  pathRewrite: (path) => `/tasks${path}`,
  on: {
    proxyReq: (proxyReq, req) => {
      console.log(`→ [TASKS] ${req.method} ${req.originalUrl} | user: ${req.user?.sub}`);
      injectUserHeaders(proxyReq, req);
      forwardBody(proxyReq, req);
    },
    proxyRes: markGateway,
    error: (err, req, res) => proxyError('User Auth service', 'TASKS_UNAVAILABLE', req, res, err)
  }
}));

// ✅ TASKS2 — nuevo microservicio de tareas independiente
app.use('/tasks2', requireJudicante, createProxyMiddleware({
  target: TASK_SERVICE_URL,
  changeOrigin: true,
  proxyTimeout: 10000,
  pathRewrite: (path) => `/tasks2${path}`,
  on: {
    proxyReq: (proxyReq, req) => {
      console.log(`→ [TASKS2] ${req.method} ${req.originalUrl} | user: ${req.user?.sub}`);
      injectUserHeaders(proxyReq, req);
      forwardBody(proxyReq, req);
    },
    proxyRes: markGateway,
    error: (err, req, res) => proxyError('Task service', 'TASKS2_UNAVAILABLE', req, res, err)
  }
}));

// 🔔 NOTIFICACIONES — cualquier usuario autenticado
app.use('/notifications', requireJudicante, createProxyMiddleware({
  target: USER_AUTH_SERVICE_URL,
  changeOrigin: true,
  proxyTimeout: 10000,
  pathRewrite: (path) => `/notifications${path}`,
  on: {
    proxyReq: (proxyReq, req) => {
      console.log(`→ [NOTIFICATIONS] ${req.method} ${req.originalUrl} | user: ${req.user?.sub}`);
      injectUserHeaders(proxyReq, req);
      forwardBody(proxyReq, req);
    },
    proxyRes: markGateway,
    error: (err, req, res) => proxyError('User Auth service', 'NOTIFICATIONS_UNAVAILABLE', req, res, err)
  }
}));

// 💰 FINANZAS (legacy) — rutas de finanzas en user-auth-service
app.use('/finanzas', requireJudicante, createProxyMiddleware({
  target: USER_AUTH_SERVICE_URL,
  changeOrigin: true,
  proxyTimeout: 10000,
  pathRewrite: (path) => `/finanzas${path}`,
  on: {
    proxyReq: (proxyReq, req) => {
      console.log(`→ [FINANZAS] ${req.method} ${req.originalUrl} | user: ${req.user?.sub}`);
      injectUserHeaders(proxyReq, req);
      forwardBody(proxyReq, req);
    },
    proxyRes: markGateway,
    error: (err, req, res) => proxyError('User Auth service', 'FINANZAS_UNAVAILABLE', req, res, err)
  }
}));

// 💰 FINANCE — nuevo microservicio de finanzas independiente
app.use('/finance', requireJudicante, createProxyMiddleware({
  target: FINANCE_SERVICE_URL,
  changeOrigin: true,
  proxyTimeout: 10000,
  pathRewrite: (path) => `/finance${path}`,
  on: {
    proxyReq: (proxyReq, req) => {
      console.log(`→ [FINANCE] ${req.method} ${req.originalUrl} | user: ${req.user?.sub}`);
      injectUserHeaders(proxyReq, req);
      forwardBody(proxyReq, req);
    },
    proxyRes: markGateway,
    error: (err, req, res) => proxyError('Finance service', 'FINANCE_UNAVAILABLE', req, res, err)
  }
}));

// ⚖️ CONCILIACION — cualquier usuario autenticado
app.use('/conciliacion', requireJudicante, createProxyMiddleware({
  target: CONCILIACION_SERVICE_URL,
  changeOrigin: true,
  proxyTimeout: 10000,
  pathRewrite: (path) => `/conciliacion${path}`,
  on: {
    proxyReq: (proxyReq, req) => {
      console.log(`→ [CONCILIACION] ${req.method} ${req.originalUrl} | user: ${req.user?.sub}`);
      injectUserHeaders(proxyReq, req);
      forwardBody(proxyReq, req);
    },
    proxyRes: markGateway,
    error: (err, req, res) => proxyError('Conciliacion service', 'CONCILIACION_UNAVAILABLE', req, res, err)
  }
}));

// 📄 DOCUMENTOS — admin y judicante (control de roles en el microservicio)
app.use('/documentos', requireJudicante, createProxyMiddleware({
  target: DOCUMENT_SERVICE_URL,
  changeOrigin: true,
  proxyTimeout: 60000,
  limit: '200mb',
  pathRewrite: (path) => path.replace(/^\/documentos/, ''),
  on: {
    proxyReq: (proxyReq, req) => {
      console.log(`→ [DOCUMENTOS] ${req.method} ${req.originalUrl} | user: ${req.user?.sub}`);
      injectUserHeaders(proxyReq, req);
      forwardBody(proxyReq, req);
    },
    proxyRes: markGateway,
    error: (err, req, res) => proxyError('Document service', 'DOCUMENTS_UNAVAILABLE', req, res, err)
  }
}));

// 📅 AGENDA — cualquier usuario autenticado
app.use('/agenda', requireJudicante, createProxyMiddleware({
  target: AGENDA_SERVICE_URL,
  changeOrigin: true,
  proxyTimeout: 10000,
  pathRewrite: (path) => `/agenda${path}`,
  on: {
    proxyReq: (proxyReq, req) => {
      console.log(`→ [AGENDA] ${req.method} ${req.originalUrl} | user: ${req.user?.sub}`);
      injectUserHeaders(proxyReq, req);
      forwardBody(proxyReq, req);
    },
    proxyRes: markGateway,
    error: (err, req, res) => proxyError('Agenda service', 'AGENDA_UNAVAILABLE', req, res, err)
  }
}));

// ─────────────────────────────────────────────────────────────────────────────
//  RUTAS PRIVADAS — acceso exclusivo para administradores
// ─────────────────────────────────────────────────────────────────────────────

// 👤 USUARIOS — solo administrador
app.use('/usuarios', requireAdmin, createProxyMiddleware({
  target: USER_AUTH_SERVICE_URL,
  changeOrigin: true,
  proxyTimeout: 10000,
  pathRewrite: (path) => `/usuarios${path}`,
  on: {
    proxyReq: (proxyReq, req) => {
      console.log(`→ [USUARIOS] ${req.method} ${req.originalUrl} | admin: ${req.user?.sub}`);
      injectUserHeaders(proxyReq, req);
      forwardBody(proxyReq, req);
    },
    proxyRes: markGateway,
    error: (err, req, res) => proxyError('User Auth service', 'USUARIOS_UNAVAILABLE', req, res, err)
  }
}));

// 🔑 ADMIN — alias privado para operaciones administrativas
app.use('/admin', requireAdmin, createProxyMiddleware({
  target: USER_AUTH_SERVICE_URL,
  changeOrigin: true,
  proxyTimeout: 10000,
  pathRewrite: (path) => `/usuarios${path}`,
  on: {
    proxyReq: (proxyReq, req) => {
      console.log(`→ [ADMIN] ${req.method} ${req.originalUrl} | admin: ${req.user?.sub}`);
      injectUserHeaders(proxyReq, req);
      forwardBody(proxyReq, req);
    },
    proxyRes: markGateway,
    error: (err, req, res) => proxyError('User Auth service', 'ADMIN_UNAVAILABLE', req, res, err)
  }
}));

// ─────────────────────────────────────────────────────────────────────────────
//  HEALTH CHECK — público, sin autenticación
// ─────────────────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.setHeader('x-api-gateway', 'lexim-gateway');
  res.json({
    gateway: 'ok',
    servicios: {
      userAuth:     USER_AUTH_SERVICE_URL,
      conciliacion: CONCILIACION_SERVICE_URL,
      documentos:   DOCUMENT_SERVICE_URL,
      agenda:       AGENDA_SERVICE_URL,
      finance:      FINANCE_SERVICE_URL,
      tasks2:       TASK_SERVICE_URL
    },
    rutas: {
      publicas:   ['/auth', '/health'],
      protegidas: ['/tasks', '/tasks2', '/notifications', '/finanzas', '/finance', '/conciliacion', '/documentos', '/agenda'],
      soloAdmin:  ['/usuarios', '/admin']
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Gateway corriendo en puerto ${PORT}`);
  console.log(`JWT_SECRET configurado: ${process.env.JWT_SECRET ? 'si' : 'NO - verificar .env'}`);
});
