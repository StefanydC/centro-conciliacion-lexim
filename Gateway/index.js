require('dotenv').config();
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const morgan = require('morgan');

const app = express();
const PORT = 5000;

app.use(morgan('dev'));

app.use('/auth', createProxyMiddleware({
  target: 'http://localhost:3001/auth',
  changeOrigin: true,
  on: {
    proxyReq: (proxyReq, req) => {
      console.log('→ Enviando al backend:', req.method, proxyReq.path);
    },
    error: (err, req, res) => {
      res.status(503).json({ error: 'Auth service no disponible' });
    }
  }
}));

app.use('/conciliacion', createProxyMiddleware({
  target: 'http://localhost:3002/conciliacion',
  changeOrigin: true,
  on: {
    error: (err, req, res) => {
      res.status(503).json({ error: 'Conciliacion service no disponible' });
    }
  }
}));

app.use('/usuarios', createProxyMiddleware({
  target: 'http://localhost:3003/usuarios',
  changeOrigin: true,
  on: {
    error: (err, req, res) => {
      res.status(503).json({ error: 'Usuarios service no disponible' });
    }
  }
}));

app.get('/health', (req, res) => {
  res.json({
    gateway: 'ok',
    servicios: {
      auth:         'http://localhost:3001',
      conciliacion: 'http://localhost:3002',
      usuarios:     'http://localhost:3003'
    }
  });
});

app.listen(PORT, () => {
  console.log(`Gateway corriendo en http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});