require('dotenv').config();
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const morgan = require('morgan');
const cors = require('cors');

const app = express();
const PORT = 5000;

app.use(morgan('dev'));
app.use(cors({
  origin: ['http://127.0.0.1:5500', 'http://localhost:5500'],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 🔐 AUTH SERVICE
app.use('/auth', createProxyMiddleware({
  target: 'http://auth-service:3001',
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

    error: (err, req, res) => {
      console.error('❌ Error en AUTH:', err.message);
      res.status(503).json({ mensaje: 'Auth service no disponible', code: 'AUTH_UNAVAILABLE' });
    }
  }
}));

// ⚖️ CONCILIACION SERVICE
app.use('/conciliacion', createProxyMiddleware({
  target: 'http://localhost:3002/conciliacion', // 🔥 CORREGIDO
  changeOrigin: true,
  proxyTimeout: 10000,
  on: {
    proxyReq: (proxyReq, req) => {
      console.log('→ [CONCILIACION] Enviando:', req.method, req.originalUrl);
    },
    error: (err, req, res) => {
      console.error('❌ Error en CONCILIACION:', err.message);
      res.status(503).json({ mensaje: 'Conciliacion service no disponible', code: 'CONCILIACION_UNAVAILABLE' });
    }
  }
}));

// 👤 USUARIOS SERVICE
app.use('/usuarios', createProxyMiddleware({
  target: 'http://localhost:3003/usuarios', // 🔥 CORREGIDO
  changeOrigin: true,
  proxyTimeout: 10000,
  on: {
    proxyReq: (proxyReq, req) => {
      console.log('→ [USUARIOS] Enviando:', req.method, req.originalUrl);
    },
    error: (err, req, res) => {
      console.error('❌ Error en USUARIOS:', err.message);
      res.status(503).json({ mensaje: 'Usuarios service no disponible', code: 'USUARIOS_UNAVAILABLE' });
    }
  }
}));

// 🩺 HEALTH CHECK
app.get('/health', (req, res) => {
  res.json({
    gateway: 'ok',
    servicios: {
      auth: 'http://localhost:3001',
      conciliacion: 'http://localhost:3002',
      usuarios: 'http://localhost:3003'
    }
  });
});

// 🚀 START SERVER
app.listen(PORT, () => {
  console.log(`🚀 Gateway corriendo en http://localhost:${PORT}`);
  console.log(`🩺 Health check: http://localhost:${PORT}/health`);
});
