// ARCHIVO: backend/gateway/index.js
require('dotenv').config({ override: false });
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const morgan  = require('morgan');
const cors    = require('cors');

const { requireJudicante, requireAdmin } = require('./middleware/auth');
const { resolveService }                 = require('./src/utils/consulDiscovery');

const app  = express();
const PORT = process.env.PORT || 5000;

// Confiar en proxy (para que req.protocol / req.secure reflejen X-Forwarded-Proto)
app.set('trust proxy', true);

// Forzar redirección a HTTPS en producción o si se activa explícitamente
if (process.env.FORCE_HTTPS === 'true' || process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    const proto = String(req.get('x-forwarded-proto') || req.protocol || '').toLowerCase();
    if (proto === 'https' || req.secure) return next();
    return res.redirect(301, 'https://' + req.get('host') + req.originalUrl);
  });
}

// ─── URLs de microservicios (fallback si Consul no responde) ──────────────────
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
    if (!origin)               return callback(null, true);
    if (!ALLOWED_ORIGINS)      return callback(null, true);
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

function injectUserHeaders(proxyReq, req) {
  if (req.user) {
    proxyReq.setHeader('X-User-ID',    req.user.sub);
    proxyReq.setHeader('X-User-Role',  req.user.tipo_usuario);
    proxyReq.setHeader('X-User-Email', req.user.email || '');
  }
}

function forwardBody(proxyReq, req) {
  const contentType = req.headers['content-type'] || '';
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
//  ASISTENTE IA — ruta pública, sin JWT
// ─────────────────────────────────────────────────────────────────────────────

const AI_SYSTEM_PROMPT = `Eres un asistente virtual de orientación básica sobre conciliación en Colombia.

Tu función es únicamente brindar información general y orientativa sobre:
- conciliación,
- conflictos familiares,
- cuota alimentaria,
- régimen de visitas,
- acuerdos,
- procesos conciliatorios,
- asistencia a audiencias,
- conflictos conciliables.

IMPORTANTE:
- No eres abogado.
- No brindas asesoría jurídica profesional.
- No puedes garantizar resultados legales.
- No debes redactar demandas, denuncias o documentos legales.
- No debes interpretar leyes de forma definitiva.
- No reemplazas a un profesional del derecho.

COMPORTAMIENTO:
- Responde de forma clara, amable y fácil de entender.
- Usa lenguaje sencillo para cualquier ciudadano.
- Evita tecnicismos jurídicos complejos.
- Mantén respuestas cortas y organizadas.
- Explica únicamente conceptos generales.
- Si el usuario pregunta algo complejo o delicado, recomienda acudir a un centro de conciliación o abogado.

LIMITACIONES:
- Si la pregunta NO está relacionada con conciliación o conflictos conciliables en Colombia,
  responde:
  "Este asistente únicamente responde preguntas relacionadas con conciliación y orientación básica en Colombia."

SEGURIDAD:
- Si detectas violencia intrafamiliar, abuso, amenazas, delitos, riesgo para menores o situaciones urgentes:
  NO des orientación jurídica específica.
  Indica que el usuario debe acudir inmediatamente a las autoridades competentes o entidades especializadas.
  En este caso NO agregues el mensaje de aviso legal al final.

Al final de TODAS las respuestas que NO sean de seguridad agrega EXACTAMENTE este texto:

"Esta respuesta es únicamente orientativa y no constituye asesoría jurídica profesional. Para recibir atención personalizada y formal, se recomienda acudir a un centro de conciliación o consultar con un profesional del derecho."`;

app.post('/ai/chat', async (req, res) => {
  try {
    const mensaje = String(req.body?.mensaje || '').trim();
    if (!mensaje) return res.status(400).json({ error: 'Mensaje requerido' });
    if (mensaje.length > 1000) return res.status(400).json({ error: 'Mensaje demasiado largo (máx. 1000 caracteres)' });
    if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error: 'Servicio de IA no configurado' });

    // Validar y limpiar historial de conversación
    const historialRaw = Array.isArray(req.body?.historial) ? req.body.historial : [];
    const historial = historialRaw
      .filter(m => m && ['user', 'assistant'].includes(m.role) && typeof m.content === 'string' && m.content.trim())
      .slice(-8)
      .map(m => ({ role: m.role, content: String(m.content).slice(0, 2000) }));

    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: AI_SYSTEM_PROMPT },
          ...historial,
          { role: 'user',   content: mensaje }
        ],
        max_tokens: 800,
        temperature: 0.5,
        presence_penalty: 0.1
      })
    });

    if (!openaiRes.ok) {
      const errBody = await openaiRes.json().catch(() => ({}));
      console.error('[AI] OpenAI error:', errBody?.error?.message || openaiRes.status);
      return res.status(502).json({ error: 'Error del servicio de IA' });
    }

    const data     = await openaiRes.json();
    const respuesta = data.choices?.[0]?.message?.content || 'No se pudo obtener respuesta.';
    console.log(`[AI] chat OK | tokens: ${data.usage?.total_tokens}`);
    res.json({ respuesta });
  } catch (err) {
    console.error('[AI] Error:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  RUTAS PÚBLICAS — no requieren JWT
// ─────────────────────────────────────────────────────────────────────────────

app.use('/auth', createProxyMiddleware({
  target:      USER_AUTH_SERVICE_URL,
  router:      () => resolveService('user_auth_service', USER_AUTH_SERVICE_URL),
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
//  RUTAS PROTEGIDAS — requieren JWT válido
// ─────────────────────────────────────────────────────────────────────────────

app.use('/tasks', requireJudicante, createProxyMiddleware({
  target:      USER_AUTH_SERVICE_URL,
  router:      () => resolveService('user_auth_service', USER_AUTH_SERVICE_URL),
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

app.use('/tasks2', requireJudicante, createProxyMiddleware({
  target:      TASK_SERVICE_URL,
  router:      () => resolveService('task_service', TASK_SERVICE_URL),
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

app.use('/notifications', requireJudicante, createProxyMiddleware({
  target:      USER_AUTH_SERVICE_URL,
  router:      () => resolveService('user_auth_service', USER_AUTH_SERVICE_URL),
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

app.use('/finanzas', requireJudicante, createProxyMiddleware({
  target:      USER_AUTH_SERVICE_URL,
  router:      () => resolveService('user_auth_service', USER_AUTH_SERVICE_URL),
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

app.use('/finance', requireJudicante, createProxyMiddleware({
  target:      FINANCE_SERVICE_URL,
  router:      () => resolveService('finance_service', FINANCE_SERVICE_URL),
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

app.use('/conciliacion', requireJudicante, createProxyMiddleware({
  target:      CONCILIACION_SERVICE_URL,
  router:      () => resolveService('conciliacion_service', CONCILIACION_SERVICE_URL),
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

app.use('/documentos', requireJudicante, createProxyMiddleware({
  target:      DOCUMENT_SERVICE_URL,
  router:      () => resolveService('document_service', DOCUMENT_SERVICE_URL),
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

app.use('/agenda', requireJudicante, createProxyMiddleware({
  target:      AGENDA_SERVICE_URL,
  router:      () => resolveService('agenda_service', AGENDA_SERVICE_URL),
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
//  RUTAS PRIVADAS — solo administrador
// ─────────────────────────────────────────────────────────────────────────────

app.use('/usuarios', requireAdmin, createProxyMiddleware({
  target:      USER_AUTH_SERVICE_URL,
  router:      () => resolveService('user_auth_service', USER_AUTH_SERVICE_URL),
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

app.use('/admin', requireAdmin, createProxyMiddleware({
  target:      USER_AUTH_SERVICE_URL,
  router:      () => resolveService('user_auth_service', USER_AUTH_SERVICE_URL),
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
//  HEALTH CHECK — público
// ─────────────────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.setHeader('x-api-gateway', 'lexim-gateway');
  res.json({
    gateway:   'ok',
    uptime:    process.uptime(),
    timestamp: new Date().toISOString(),
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
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Gateway corriendo en puerto ${PORT}`);
  console.log(`JWT_SECRET configurado: ${process.env.JWT_SECRET ? 'si' : 'NO - verificar .env'}`);
  console.log(`Consul: ${process.env.CONSUL_HOST || 'consul'}:${process.env.CONSUL_PORT || '8500'}`);
});
