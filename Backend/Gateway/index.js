require('dotenv').config();
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const morgan = require('morgan');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5000;

// ─── URLs de microservicios (siempre usar nombres de servicio Docker, nunca localhost) ───
const AUTH_SERVICE_URL         = process.env.AUTH_SERVICE_URL         || 'http://auth-service:3001';
const CONCILIACION_SERVICE_URL = process.env.CONCILIACION_SERVICE_URL || 'http://conciliacion-service:3002';
const USUARIOS_SERVICE_URL     = process.env.USUARIOS_SERVICE_URL     || 'http://usuarios-service:3003';

// Orígenes permitidos: env var (separados por coma) o wildcard en desarrollo
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : null;

app.use(morgan('dev'));
app.use(cors({
  origin: (origin, callback) => {
    // Sin origin = petición server-to-server o curl → permitir
    if (!origin) return callback(null, true);
    // Si no hay lista configurada → permitir todo (útil en desarrollo)
    if (!ALLOWED_ORIGINS) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    callback(new Error(`Origin no permitido por CORS: ${origin}`));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

function proxyError(serviceName, errorCode, req, res, err) {
  console.error(`Error en ${serviceName}:`, err.message);
  res.status(503).json({ mensaje: `${serviceName} no disponible`, code: errorCode });
}

function markGatewayHit(proxyRes) {
  proxyRes.headers['x-api-gateway'] = 'backend-gateway';
}

// 🔐 AUTH SERVICE
app.use('/auth', createProxyMiddleware({
  target: AUTH_SERVICE_URL,
  changeOrigin: true,
  proxyTimeout: 10000,
  pathRewrite: (path) => `/auth${path}`,

  on: {
    proxyReq: (proxyReq, req) => {
      console.log('→ [AUTH] Enviando:', req.method, req.originalUrl);

      // 🔥 REENVIAR BODY (CLAVE)
      if (req.body && Object.keys(req.body).length) {
        const bodyData = JSON.stringify(req.body);

        proxyReq.setHeader('Content-Type', 'application/json');
        proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));

        proxyReq.write(bodyData);
      }
    },

    proxyRes: (proxyRes) => {
      markGatewayHit(proxyRes);
    },

    error: (err, req, res) => {
      proxyError('Auth service', 'AUTH_UNAVAILABLE', req, res, err);
    }
  }
}));

// ✅ TASKS SERVICE (en auth-service)
app.use('/tasks', createProxyMiddleware({
  target: AUTH_SERVICE_URL,
  changeOrigin: true,
  proxyTimeout: 10000,
  pathRewrite: (path) => `/tasks${path}`,
  on: {
    proxyReq: (proxyReq, req) => {
      console.log('→ [TASKS] Enviando:', req.method, req.originalUrl);

      if (req.body && Object.keys(req.body).length) {
        const bodyData = JSON.stringify(req.body);
        proxyReq.setHeader('Content-Type', 'application/json');
        proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
        proxyReq.write(bodyData);
      }
    },

    proxyRes: (proxyRes) => {
      markGatewayHit(proxyRes);
    },

    error: (err, req, res) => {
      proxyError('Tasks service', 'TASKS_UNAVAILABLE', req, res, err);
    }
  }
}));

// ⚖️ CONCILIACION SERVICE
app.use('/conciliacion', createProxyMiddleware({
  target: CONCILIACION_SERVICE_URL,   // http://conciliacion-service:3002
  changeOrigin: true,
  proxyTimeout: 10000,
  pathRewrite: (path) => `/conciliacion${path}`,
  on: {
    proxyReq: (proxyReq, req) => {
      console.log('→ [CONCILIACION] Enviando:', req.method, req.originalUrl);
      if (req.body && Object.keys(req.body).length) {
        const bodyData = JSON.stringify(req.body);
        proxyReq.setHeader('Content-Type', 'application/json');
        proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
        proxyReq.write(bodyData);
      }
    },
    proxyRes: (proxyRes) => {
      markGatewayHit(proxyRes);
    },
    error: (err, req, res) => {
      proxyError('Conciliacion service', 'CONCILIACION_UNAVAILABLE', req, res, err);
    }
  }
}));

// 👤 USUARIOS SERVICE
app.use('/usuarios', createProxyMiddleware({
  target: USUARIOS_SERVICE_URL,       // http://usuarios-service:3003
  changeOrigin: true,
  proxyTimeout: 10000,
  pathRewrite: (path) => `/usuarios${path}`,
  on: {
    proxyReq: (proxyReq, req) => {
      console.log('→ [USUARIOS] Enviando:', req.method, req.originalUrl);
      if (req.body && Object.keys(req.body).length) {
        const bodyData = JSON.stringify(req.body);
        proxyReq.setHeader('Content-Type', 'application/json');
        proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
        proxyReq.write(bodyData);
      }
    },
    proxyRes: (proxyRes) => {
      markGatewayHit(proxyRes);
    },
    error: (err, req, res) => {
      proxyError('Usuarios service', 'USUARIOS_UNAVAILABLE', req, res, err);
    }
  }
}));

// 🩺 HEALTH CHECK
app.get('/health', (req, res) => {
  res.setHeader('x-api-gateway', 'backend-gateway');
  res.json({
    gateway: 'ok',
    servicios: {
      auth:         AUTH_SERVICE_URL,
      conciliacion: CONCILIACION_SERVICE_URL,
      usuarios:     USUARIOS_SERVICE_URL
    }
  });
});

// 🚀 START SERVER
app.listen(PORT, () => {
  console.log(`🚀 Gateway corriendo en http://localhost:${PORT}`);
  console.log(`🔌 Auth service target: ${AUTH_SERVICE_URL}`);
  console.log(`🩺 Health check: http://localhost:${PORT}/health`);
});
