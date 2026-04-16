require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const mongoose   = require('mongoose');
const jwt        = require('jsonwebtoken');

const app  = express();
const PORT = process.env.PORT || 3002;

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors({ origin: '*', methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'], allowedHeaders: ['Content-Type','Authorization'] }));
app.use(express.json());

// ─── Middleware de autenticación JWT ─────────────────────────────────────────
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token requerido' });
  }
  try {
    req.user = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

// ─── Modelo de Conciliación ───────────────────────────────────────────────────
const conciliacionSchema = new mongoose.Schema({
  titulo:      { type: String, required: true },
  descripcion: { type: String, default: '' },
  estado:      { type: String, enum: ['pendiente', 'en_proceso', 'cerrado'], default: 'pendiente' },
  creadoPor:   { type: String, required: true },   // userId del JWT
}, { timestamps: true });

const Conciliacion = mongoose.model('Conciliacion', conciliacionSchema);

// ─── Rutas ────────────────────────────────────────────────────────────────────
const router = express.Router();

// GET /conciliacion  — listar todas
router.get('/', requireAuth, async (req, res) => {
  try {
    const items = await Conciliacion.find().sort({ createdAt: -1 });
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener conciliaciones', detalle: err.message });
  }
});

// GET /conciliacion/:id  — obtener una
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const item = await Conciliacion.findById(req.params.id);
    if (!item) return res.status(404).json({ error: 'No encontrado' });
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: 'Error', detalle: err.message });
  }
});

// POST /conciliacion  — crear
router.post('/', requireAuth, async (req, res) => {
  try {
    const { titulo, descripcion, estado } = req.body;
    if (!titulo) return res.status(400).json({ error: 'El campo titulo es requerido' });
    const item = await Conciliacion.create({ titulo, descripcion, estado, creadoPor: req.user.id });
    res.status(201).json(item);
  } catch (err) {
    res.status(500).json({ error: 'Error al crear conciliación', detalle: err.message });
  }
});

// PATCH /conciliacion/:id  — actualizar estado
router.patch('/:id', requireAuth, async (req, res) => {
  try {
    const item = await Conciliacion.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!item) return res.status(404).json({ error: 'No encontrado' });
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar', detalle: err.message });
  }
});

// DELETE /conciliacion/:id
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const item = await Conciliacion.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ error: 'No encontrado' });
    res.json({ mensaje: 'Eliminado correctamente' });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar', detalle: err.message });
  }
});

app.use('/conciliacion', router);

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'conciliacion-service', db: mongoose.connection.readyState === 1 ? 'conectado' : 'desconectado' });
});

// ─── Iniciar ──────────────────────────────────────────────────────────────────
mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME })
  .then(() => {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`✅ conciliacion-service corriendo en puerto ${PORT}`);
    });
  })
  .catch(err => {
    console.error('❌ Error al conectar MongoDB:', err.message);
    process.exit(1);
  });
