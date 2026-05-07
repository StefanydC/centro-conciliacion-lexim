const express = require('express');
const cors    = require('cors');
const morgan  = require('morgan');

const folderRoutes = require('./routes/folder.routes');
const fileRoutes   = require('./routes/file.routes');

const app = express();

// ─── Middleware global ────────────────────────────────────────────────────────
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Rutas ────────────────────────────────────────────────────────────────────
app.use('/folders', folderRoutes);
app.use('/',        fileRoutes);

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({
    status:    'ok',
    service:   'document-service',
    uptime:    process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// ─── Manejo global de errores ─────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('[Error]', err.message);
  res.status(err.status || 500).json({
    error: err.message || 'Error interno del servidor',
  });
});

module.exports = app;
