// ARCHIVO: backend/conciliacion-service/src/server.js
require('dotenv').config({ override: false });
const { registerService, deregisterService } = require('./utils/consulRegister');
const express  = require('express');
const cors     = require('cors');
const mongoose = require('mongoose');
const jwt      = require('jsonwebtoken');
const helmet   = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');

const app  = express();
const PORT = process.env.PORT || 3002;

// ─── Seguridad HTTP — Ley 1581 Art. 17 literal f ─────────────────────────────
app.use(helmet());
app.use(cors({
  origin: '*',
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization','X-User-ID','X-User-Role','X-User-Email']
}));
app.use(express.json());
// Prevenir NoSQL injection — Ley 1581 Art. 17 literal f
app.use(mongoSanitize());

// ─── Auth ─────────────────────────────────────────────────────────────────────
function requireAuth(req, res, next) {
  const userId   = req.headers['x-user-id'];
  const userRole = req.headers['x-user-role'];
  if (userId && userRole) {
    req.user = { sub: userId, tipo_usuario: userRole, email: req.headers['x-user-email'] || '' };
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

// ─── Modelo Auditoría — Ley 1581 Art. 17 literal d ───────────────────────────
const auditLogSchema = new mongoose.Schema(
  {
    usuario_id:    { type: String, index: true, default: 'anonimo' },
    usuario_email: { type: String, default: '' },
    accion:        { type: String, required: true, index: true },
    recurso:       { type: String, required: true },
    ip:            { type: String, default: 'desconocida' },
    fecha:         { type: Date, default: Date.now, index: true },
    datos_nuevos:  { type: mongoose.Schema.Types.Mixed, default: null },
    resultado:     { type: String, enum: ['exitoso','fallido'], default: 'exitoso' },
    detalle:       { type: String, default: '' },
    // Retención 5 años — Ley 1581 Art. 11
    fecha_retencion_hasta: {
      type: Date,
      default: () => { const d = new Date(); d.setFullYear(d.getFullYear() + 5); return d; }
    }
  },
  { timestamps: false, strict: true, collection: 'audit_logs' }
);
const AuditLog = mongoose.models.AuditLog || mongoose.model('AuditLog', auditLogSchema);

function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
         req.headers['x-real-ip'] || req.socket?.remoteAddress || 'desconocida';
}

async function registrarAudit(req, accion, recurso, resultado = 'exitoso', datoNuevo = null) {
  try {
    await AuditLog.create({
      usuario_id:    req.user?.sub   || 'anonimo',
      usuario_email: req.user?.email || '',
      accion,
      recurso,
      ip:          getClientIp(req),
      fecha:       new Date(),
      datos_nuevos: datoNuevo,
      resultado,
      detalle:     `${req.method} ${req.originalUrl}`
    });
  } catch (err) {
    console.error('[AUDIT] Error al registrar:', err.message);
  }
}

// ─── Modelo Conciliación ──────────────────────────────────────────────────────
const conciliacionSchema = new mongoose.Schema(
  {
    nro_expediente: {
      type:     String,
      required: [true, 'El número de expediente es requerido'],
      trim:     true,
      unique:   true,
      index:    true
    },
    parte_convocante: {
      nombre:    { type: String, required: true, trim: true },
      documento: { type: String, trim: true, default: '' },
      contacto:  { type: String, trim: true, default: '' }
    },
    parte_convocada: {
      nombre:    { type: String, required: true, trim: true },
      documento: { type: String, trim: true, default: '' },
      contacto:  { type: String, trim: true, default: '' }
    },
    tema: {
      type:      String,
      required:  [true, 'El tema es requerido'],
      trim:      true,
      maxlength: 200
    },
    descripcion: { type: String, trim: true, default: '', maxlength: 2000 },
    estado: {
      type:    String,
      enum:    ['registrado', 'pendiente', 'potencial'],
      default: 'registrado'
    },
    creadoPor: { type: String, required: true, index: true },
    // Ley 1581 Art. 11 — retención expedientes judiciales 10 años (Ley 640/2001 Art. 20)
    fecha_retencion_hasta: {
      type: Date,
      default: () => {
        const d = new Date();
        d.setFullYear(d.getFullYear() + 10);
        return d;
      }
    }
  },
  {
    timestamps: true,
    // strict: true — Ley 1581 Art. 17 lit. f — prevenir campos no declarados
    strict: true,
    collection: 'conciliaciones'
  }
);

const Conciliacion = mongoose.models.Conciliacion ||
  mongoose.model('Conciliacion', conciliacionSchema);

// ─── Rutas ────────────────────────────────────────────────────────────────────
const router = express.Router();

// GET /conciliacion
router.get('/', requireAuth, async (req, res) => {
  try {
    const esAdmin = req.user.tipo_usuario === 'administrador';
    const filter  = esAdmin ? {} : { creadoPor: req.user.sub };

    const { q, estado, limit = 50, skip = 0 } = req.query;
    if (q) filter.$or = [
      { nro_expediente:            { $regex: q, $options: 'i' } },
      { tema:                      { $regex: q, $options: 'i' } },
      { 'parte_convocante.nombre': { $regex: q, $options: 'i' } },
      { 'parte_convocada.nombre':  { $regex: q, $options: 'i' } }
    ];
    if (estado) filter.estado = estado;

    const [items, total] = await Promise.all([
      Conciliacion.find(filter).sort({ createdAt: -1 }).limit(Number(limit)).skip(Number(skip)),
      Conciliacion.countDocuments(filter)
    ]);

    res.json({ data: items, total });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener conciliaciones', detalle: err.message });
  }
});

// GET /conciliacion/:id
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const item = await Conciliacion.findById(req.params.id);
    if (!item) return res.status(404).json({ error: 'No encontrado' });

    const esAdmin = req.user.tipo_usuario === 'administrador';
    if (!esAdmin && item.creadoPor !== req.user.sub) {
      return res.status(403).json({ error: 'Sin permiso para ver este registro' });
    }
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: 'Error', detalle: err.message });
  }
});

// POST /conciliacion
router.post('/', requireAuth, async (req, res) => {
  try {
    const { nro_expediente, parte_convocante, parte_convocada, tema, descripcion, estado } = req.body;

    const errs = [];
    if (!nro_expediente?.trim())           errs.push('nro_expediente es requerido');
    if (!parte_convocante?.nombre?.trim()) errs.push('parte_convocante.nombre es requerido');
    if (!parte_convocada?.nombre?.trim())  errs.push('parte_convocada.nombre es requerido');
    if (!tema?.trim())                     errs.push('tema es requerido');
    if (errs.length) return res.status(400).json({ error: errs.join(', ') });

    const item = await Conciliacion.create({
      nro_expediente: nro_expediente.trim(),
      parte_convocante: {
        nombre:    parte_convocante.nombre.trim(),
        documento: parte_convocante.documento?.trim() || '',
        contacto:  parte_convocante.contacto?.trim()  || ''
      },
      parte_convocada: {
        nombre:    parte_convocada.nombre.trim(),
        documento: parte_convocada.documento?.trim() || '',
        contacto:  parte_convocada.contacto?.trim()  || ''
      },
      tema:        tema.trim(),
      descripcion: descripcion?.trim() || '',
      estado:      estado || 'registrado',
      creadoPor:   req.user.sub
    });

    // Auditoría — Ley 1581 Art. 17 literal d
    registrarAudit(req, 'CREAR', `conciliacion:${item._id}`, 'exitoso', { nro_expediente: item.nro_expediente });

    res.status(201).json({ mensaje: 'Conciliación creada correctamente', data: item });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'Ya existe un expediente con ese número' });
    }
    res.status(500).json({ error: 'Error al crear conciliación', detalle: err.message });
  }
});

// PATCH /conciliacion/:id
router.patch('/:id', requireAuth, async (req, res) => {
  try {
    const item = await Conciliacion.findById(req.params.id);
    if (!item) return res.status(404).json({ error: 'No encontrado' });

    const esAdmin = req.user.tipo_usuario === 'administrador';
    if (!esAdmin && item.creadoPor !== req.user.sub) {
      return res.status(403).json({ error: 'Sin permiso para editar este registro' });
    }

    const { nro_expediente, parte_convocante, parte_convocada, tema, descripcion, estado } = req.body;
    const update = {};

    if (nro_expediente !== undefined) update.nro_expediente = nro_expediente.trim();
    if (tema           !== undefined) update.tema           = tema.trim();
    if (descripcion    !== undefined) update.descripcion    = descripcion.trim();
    if (estado         !== undefined) {
      const estadosValidos = ['registrado', 'pendiente', 'potencial'];
      if (!estadosValidos.includes(estado)) {
        return res.status(400).json({ error: `Estado inválido. Valores permitidos: ${estadosValidos.join(', ')}` });
      }
      update.estado = estado;
    }
    if (parte_convocante) {
      if (parte_convocante.nombre    !== undefined) update['parte_convocante.nombre']    = parte_convocante.nombre.trim();
      if (parte_convocante.documento !== undefined) update['parte_convocante.documento'] = parte_convocante.documento.trim();
      if (parte_convocante.contacto  !== undefined) update['parte_convocante.contacto']  = parte_convocante.contacto.trim();
    }
    if (parte_convocada) {
      if (parte_convocada.nombre    !== undefined) update['parte_convocada.nombre']    = parte_convocada.nombre.trim();
      if (parte_convocada.documento !== undefined) update['parte_convocada.documento'] = parte_convocada.documento.trim();
      if (parte_convocada.contacto  !== undefined) update['parte_convocada.contacto']  = parte_convocada.contacto.trim();
    }

    const updated = await Conciliacion.findByIdAndUpdate(
      req.params.id, update, { new: true, runValidators: true }
    );

    // Auditoría
    registrarAudit(req, 'ACTUALIZAR', `conciliacion:${req.params.id}`, 'exitoso', update);

    res.json({ mensaje: 'Actualizado correctamente', data: updated });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'Ya existe un expediente con ese número' });
    }
    res.status(500).json({ error: 'Error al actualizar', detalle: err.message });
  }
});

// DELETE /conciliacion/:id
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const item = await Conciliacion.findById(req.params.id);
    if (!item) return res.status(404).json({ error: 'No encontrado' });

    const esAdmin = req.user.tipo_usuario === 'administrador';
    if (!esAdmin && item.creadoPor !== req.user.sub) {
      return res.status(403).json({ error: 'Sin permiso para eliminar este registro' });
    }

    await Conciliacion.findByIdAndDelete(req.params.id);

    // Auditoría
    registrarAudit(req, 'ELIMINAR', `conciliacion:${req.params.id}`, 'exitoso');

    res.json({ mensaje: 'Eliminado correctamente' });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar', detalle: err.message });
  }
});

app.use('/conciliacion', router);

// ─── Health ───────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'conciliacion-service',
    db: mongoose.connection.readyState === 1 ? 'conectado' : 'desconectado'
  });
});

// ─── Iniciar ──────────────────────────────────────────────────────────────────
mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME })
  .then(() => {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`✅ conciliacion-service corriendo en puerto ${PORT}`);
      setTimeout(registerService, 3000);
    });
  })
  .catch(err => {
    console.error('❌ Error al conectar MongoDB:', err.message);
    process.exit(1);
  });

process.on('SIGTERM', async () => { await deregisterService(); process.exit(0); });
process.on('SIGINT',  async () => { await deregisterService(); process.exit(0); });
