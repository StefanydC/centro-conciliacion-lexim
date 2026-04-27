require('dotenv').config();
const express  = require('express');
const cors     = require('cors');
const mongoose = require('mongoose');
const jwt      = require('jsonwebtoken');
const morgan   = require('morgan');

const app  = express();
const PORT = process.env.PORT || 3003;

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors({
  origin: '*',
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization']
}));
app.use(express.json());
app.use(morgan('dev'));

// ─── Autenticación ────────────────────────────────────────────────────────────
// Acepta headers inyectados por el gateway (X-User-ID / X-User-Role)
// o valida el JWT directamente como fallback.
function requireAuth(req, res, next) {
  const userId   = req.headers['x-user-id'];
  const userRole = req.headers['x-user-role'];

  if (userId && userRole) {
    req.user = {
      sub:          userId,
      tipo_usuario: userRole,
      email:        req.headers['x-user-email'] || ''
    };
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token requerido' });
  }
  try {
    const payload = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET);
    req.user = {
      sub:          payload.sub  || payload.id,
      tipo_usuario: payload.tipo_usuario || payload.rol || 'judicante',
      email:        payload.email || ''
    };
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

// ─── Modelo Evento ────────────────────────────────────────────────────────────
const eventoSchema = new mongoose.Schema(
  {
    titulo:      { type: String, required: true, trim: true, maxlength: 120 },
    tipo:        { type: String, enum: ['audiencia','vencimiento','reunion','otro'], default: 'audiencia' },
    caso:        { type: String, default: '',   trim: true, maxlength: 80  },
    fecha:       { type: String, default: '' },   // YYYY-MM-DD
    hora:        { type: String, default: '' },   // HH:MM
    lugar:       { type: String, default: '',   trim: true, maxlength: 120 },
    descripcion: { type: String, default: '',   trim: true, maxlength: 500 },
    creadoPor:   { type: String, required: true }  // userId del JWT
  },
  { timestamps: true, collection: 'eventos' }
);

const Evento = mongoose.model('Evento', eventoSchema);

// ─── Rutas ────────────────────────────────────────────────────────────────────
const router = express.Router();

// GET /agenda/ — listar eventos
// Admin ve todos; judicante ve solo los suyos.
router.get('/', requireAuth, async (req, res) => {
  try {
    const esAdmin = req.user.tipo_usuario === 'administrador';
    const filter  = esAdmin ? {} : { creadoPor: req.user.sub };
    const items   = await Evento.find(filter).sort({ fecha: 1, hora: 1 });
    res.json({ data: items });
  } catch (err) {
    console.error('[AGENDA] Error al listar:', err.message);
    res.status(500).json({ error: 'Error al obtener eventos', detalle: err.message });
  }
});

// GET /agenda/:id — obtener un evento
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const item = await Evento.findById(req.params.id);
    if (!item) return res.status(404).json({ error: 'Evento no encontrado' });
    if (req.user.tipo_usuario !== 'administrador' && item.creadoPor !== req.user.sub) {
      return res.status(403).json({ error: 'Sin permiso' });
    }
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: 'Error', detalle: err.message });
  }
});

// POST /agenda/ — crear evento
router.post('/', requireAuth, async (req, res) => {
  try {
    const { titulo, tipo, caso, fecha, hora, lugar, descripcion } = req.body;
    if (!titulo?.trim()) return res.status(400).json({ error: 'El título es requerido' });
    if (!fecha)          return res.status(400).json({ error: 'La fecha es requerida' });

    const item = await Evento.create({
      titulo: titulo.trim(),
      tipo:   tipo || 'audiencia',
      caso:   caso   || '',
      fecha,
      hora:   hora   || '',
      lugar:  lugar  || '',
      descripcion: descripcion || '',
      creadoPor: req.user.sub
    });

    console.log(`✅ Evento creado: ${item._id} por ${req.user.sub}`);
    res.status(201).json({ mensaje: 'Evento creado correctamente', data: item });
  } catch (err) {
    console.error('[AGENDA] Error al crear:', err.message);
    res.status(500).json({ error: 'Error al crear evento', detalle: err.message });
  }
});

// PATCH /agenda/:id — actualizar evento
router.patch('/:id', requireAuth, async (req, res) => {
  try {
    const item = await Evento.findById(req.params.id);
    if (!item) return res.status(404).json({ error: 'Evento no encontrado' });
    if (req.user.tipo_usuario !== 'administrador' && item.creadoPor !== req.user.sub) {
      return res.status(403).json({ error: 'Sin permiso para editar este evento' });
    }

    const { titulo, tipo, caso, fecha, hora, lugar, descripcion } = req.body;
    const updated = await Evento.findByIdAndUpdate(
      req.params.id,
      { titulo, tipo, caso, fecha, hora, lugar, descripcion },
      { new: true, runValidators: true }
    );

    res.json({ mensaje: 'Evento actualizado correctamente', data: updated });
  } catch (err) {
    console.error('[AGENDA] Error al actualizar:', err.message);
    res.status(500).json({ error: 'Error al actualizar evento', detalle: err.message });
  }
});

// DELETE /agenda/:id — eliminar evento
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const item = await Evento.findById(req.params.id);
    if (!item) return res.status(404).json({ error: 'Evento no encontrado' });
    if (req.user.tipo_usuario !== 'administrador' && item.creadoPor !== req.user.sub) {
      return res.status(403).json({ error: 'Sin permiso para eliminar este evento' });
    }

    await Evento.findByIdAndDelete(req.params.id);
    console.log(`🗑️  Evento eliminado: ${req.params.id}`);
    res.json({ mensaje: 'Evento eliminado correctamente' });
  } catch (err) {
    console.error('[AGENDA] Error al eliminar:', err.message);
    res.status(500).json({ error: 'Error al eliminar evento', detalle: err.message });
  }
});

app.use('/agenda', router);

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({
    status:  'ok',
    service: 'agenda-service',
    db:      mongoose.connection.readyState === 1 ? 'conectado' : 'desconectado'
  });
});

// ─── Iniciar ──────────────────────────────────────────────────────────────────
mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME })
  .then(() => {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`✅ agenda-service corriendo en puerto ${PORT}`);
    });
  })
  .catch(err => {
    console.error('❌ Error al conectar MongoDB:', err.message);
    process.exit(1);
  });
