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
const AUTH_SERVICE_URL         = process.env.AUTH_SERVICE_URL         || 'http://auth-service:3001';
const CONCILIACION_SERVICE_URL = process.env.CONCILIACION_SERVICE_URL || 'http://conciliacion-service:3002';
const USUARIOS_SERVICE_URL     = process.env.USUARIOS_SERVICE_URL     || 'http://usuarios-service:3003';
const DOCUMENT_SERVICE_URL     = process.env.DOCUMENT_SERVICE_URL     || 'http://document-service:3004';

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
  target: AUTH_SERVICE_URL,
  changeOrigin: true,
  proxyTimeout: 10000,
  pathRewrite: (path) => `/auth${path}`,
  on: {
    proxyReq: (proxyReq, req) => {
      console.log(`→ [AUTH] ${req.method} ${req.originalUrl}`);
      forwardBody(proxyReq, req);
    },
    proxyRes: markGateway,
    error: (err, req, res) => proxyError('Auth service', 'AUTH_UNAVAILABLE', req, res, err)
  }
}));

// ─────────────────────────────────────────────────────────────────────────────
//  RUTAS PROTEGIDAS — requieren JWT válido (administrador o judicante)
// ─────────────────────────────────────────────────────────────────────────────

// ✅ TASKS — cualquier usuario autenticado
app.use('/tasks', requireJudicante, createProxyMiddleware({
  target: AUTH_SERVICE_URL,
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
    error: (err, req, res) => proxyError('Tasks service', 'TASKS_UNAVAILABLE', req, res, err)
  }
}));

// 💰 FINANZAS — cualquier usuario autenticado
app.use('/finanzas', requireJudicante, createProxyMiddleware({
  target: AUTH_SERVICE_URL,
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
    error: (err, req, res) => proxyError('Finanzas service', 'FINANZAS_UNAVAILABLE', req, res, err)
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
      // Reenviar body JSON para endpoints como POST /documentos/folders.
      // En uploads multipart req.body no viene parseado por express.json(),
      // por lo que forwardBody no modifica el stream original del archivo.
      forwardBody(proxyReq, req);
    },
    proxyRes: markGateway,
    error: (err, req, res) => proxyError('Document service', 'DOCUMENTS_UNAVAILABLE', req, res, err)
  }
}));

// ─────────────────────────────────────────────────────────────────────────────
//  RUTAS PRIVADAS — acceso exclusivo para administradores
// ─────────────────────────────────────────────────────────────────────────────

// 👤 USUARIOS — solo administrador
app.use('/usuarios', requireAdmin, createProxyMiddleware({
  target: USUARIOS_SERVICE_URL,
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
    error: (err, req, res) => proxyError('Usuarios service', 'USUARIOS_UNAVAILABLE', req, res, err)
  }
}));

// 🔑 ADMIN — alias privado para operaciones administrativas
//    Actualmente enruta a usuarios-service. En el futuro puede ser
//    su propio microservicio sin cambiar el contrato de la API.
app.use('/admin', requireAdmin, createProxyMiddleware({
  target: USUARIOS_SERVICE_URL,
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
    error: (err, req, res) => proxyError('Admin (usuarios) service', 'ADMIN_UNAVAILABLE', req, res, err)
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
      auth:         AUTH_SERVICE_URL,
      conciliacion: CONCILIACION_SERVICE_URL,
      usuarios:     USUARIOS_SERVICE_URL,
      documentos:   DOCUMENT_SERVICE_URL
    },
    rutas: {
      publicas:   ['/auth', '/health'],
      protegidas: ['/tasks', '/finanzas', '/conciliacion', '/documentos'],
      soloAdmin:  ['/usuarios', '/admin']
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Gateway corriendo en puerto ${PORT}`);
  console.log(`JWT_SECRET configurado: ${process.env.JWT_SECRET ? 'si' : 'NO - verificar .env'}`);
});
