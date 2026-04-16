require('dotenv').config();
const express  = require('express');
const cors     = require('cors');
const bcrypt   = require('bcryptjs');
const mongoose = require('mongoose');
const jwt      = require('jsonwebtoken');

const app  = express();
const PORT = process.env.PORT || 3003;

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

// ─── Modelo de Usuario ────────────────────────────────────────────────────────
const usuarioSchema = new mongoose.Schema({
  nombre:   { type: String, required: true },
  email:    { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true, select: false },
  rol:      { type: String, enum: ['admin', 'conciliador', 'usuario'], default: 'usuario' },
  activo:   { type: Boolean, default: true },
}, { timestamps: true });

usuarioSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

const Usuario = mongoose.model('Usuario', usuarioSchema);

// ─── Rutas ────────────────────────────────────────────────────────────────────
const router = express.Router();

// GET /usuarios  — listar todos (requiere auth)
router.get('/', requireAuth, async (req, res) => {
  try {
    const usuarios = await Usuario.find({ activo: true }).select('-password').sort({ createdAt: -1 });
    res.json(usuarios);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener usuarios', detalle: err.message });
  }
});

// GET /usuarios/:id
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const usuario = await Usuario.findById(req.params.id).select('-password');
    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json(usuario);
  } catch (err) {
    res.status(500).json({ error: 'Error', detalle: err.message });
  }
});

// POST /usuarios  — crear usuario
router.post('/', requireAuth, async (req, res) => {
  try {
    const { nombre, email, password, rol } = req.body;
    if (!nombre || !email || !password) {
      return res.status(400).json({ error: 'nombre, email y password son requeridos' });
    }
    const existe = await Usuario.findOne({ email });
    if (existe) return res.status(409).json({ error: 'El email ya está registrado' });
    const usuario = await Usuario.create({ nombre, email, password, rol });
    const { password: _pw, ...datos } = usuario.toObject();
    res.status(201).json(datos);
  } catch (err) {
    res.status(500).json({ error: 'Error al crear usuario', detalle: err.message });
  }
});

// PATCH /usuarios/:id  — actualizar datos (sin cambiar password)
router.patch('/:id', requireAuth, async (req, res) => {
  try {
    const { password, ...campos } = req.body;  // nunca actualizar password por esta ruta
    const usuario = await Usuario.findByIdAndUpdate(req.params.id, campos, { new: true, runValidators: true }).select('-password');
    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json(usuario);
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar', detalle: err.message });
  }
});

// DELETE /usuarios/:id  — baja lógica
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const usuario = await Usuario.findByIdAndUpdate(req.params.id, { activo: false }, { new: true }).select('-password');
    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json({ mensaje: 'Usuario desactivado correctamente', usuario });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar', detalle: err.message });
  }
});

app.use('/usuarios', router);

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'usuarios-service', db: mongoose.connection.readyState === 1 ? 'conectado' : 'desconectado' });
});

// ─── Iniciar ──────────────────────────────────────────────────────────────────
mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME })
  .then(() => {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`✅ usuarios-service corriendo en puerto ${PORT}`);
    });
  })
  .catch(err => {
    console.error('❌ Error al conectar MongoDB:', err.message);
    process.exit(1);
  });
