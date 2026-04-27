require('dotenv').config();
const express  = require('express');
const cors     = require('cors');
const mongoose = require('mongoose');
const jwt      = require('jsonwebtoken');
const morgan   = require('morgan');
const { google } = require('googleapis');

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

// ─── Modelos ──────────────────────────────────────────────────────────────────
const eventoSchema = new mongoose.Schema(
  {
    titulo:         { type: String, required: true, trim: true, maxlength: 120 },
    tipo:           { type: String, enum: ['audiencia','vencimiento','reunion','otro'], default: 'audiencia' },
    caso:           { type: String, default: '', trim: true, maxlength: 80  },
    fecha:          { type: String, default: '' },   // YYYY-MM-DD
    hora:           { type: String, default: '' },   // HH:MM
    lugar:          { type: String, default: '', trim: true, maxlength: 120 },
    descripcion:    { type: String, default: '', trim: true, maxlength: 500 },
    creadoPor:      { type: String, required: true },
    google_event_id: { type: String, default: null }  // ID del evento en Google Calendar
  },
  { timestamps: true, collection: 'agenda' }
);
const Evento = mongoose.model('Evento', eventoSchema);

// Modelo ligero para leer tokens de Google del usuario (misma BD, colección usuarios)
const userGoogleSchema = new mongoose.Schema(
  {
    google_connected:     Boolean,
    google_email:         String,
    google_access_token:  String,
    google_refresh_token: String,
    google_token_expiry:  Date
  },
  { strict: false, collection: 'usuarios' }
);
const UserGoogle = mongoose.model('UserGoogle', userGoogleSchema);

// ─── Google Calendar helpers ──────────────────────────────────────────────────
function getOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || 'http://localhost/auth/google/callback'
  );
}

async function getAuthenticatedClient(userId) {
  // Bug 4 fix: sin prefijo '+' — UserGoogle schema no tiene select:false en estos campos
  const user = await UserGoogle.findById(userId)
    .select('google_access_token google_refresh_token google_connected google_token_expiry');

  if (!user?.google_connected) return null;
  // Necesitamos al menos uno de los dos tokens para poder autenticar
  if (!user.google_access_token && !user.google_refresh_token) return null;

  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    console.warn('[GCAL] GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET no configurados en agenda-service');
    return null;
  }

  const client = getOAuthClient();

  // Bug 3 fix: pasar undefined (no null) para tokens ausentes.
  // Con null, googleapis NO intenta auto-refrescar. Con undefined, sí lo hace.
  client.setCredentials({
    access_token:  user.google_access_token  || undefined,
    refresh_token: user.google_refresh_token || undefined,
    expiry_date:   user.google_token_expiry  ? user.google_token_expiry.getTime() : undefined
  });

  // Persistir tokens renovados automáticamente por googleapis
  client.on('tokens', async (newTokens) => {
    const upd = {};
    if (newTokens.access_token)  upd.google_access_token  = newTokens.access_token;
    if (newTokens.expiry_date)   upd.google_token_expiry  = new Date(newTokens.expiry_date);
    if (newTokens.refresh_token) upd.google_refresh_token = newTokens.refresh_token;
    if (Object.keys(upd).length > 0) {
      await UserGoogle.findByIdAndUpdate(userId, upd).catch(() => {});
    }
  });

  return client;
}

function toGoogleEvent(evento) {
  const fecha = evento.fecha || new Date().toISOString().slice(0, 10);
  const hora  = evento.hora  || '09:00';

  // Construir datetimes en America/Bogota (UTC-5)
  const startISO = `${fecha}T${hora}:00`;
  const endISO   = (() => {
    const [h, m] = hora.split(':').map(Number);
    const endH   = String(h + 1).padStart(2, '0');
    return `${fecha}T${endH}:${String(m).padStart(2, '0')}:00`;
  })();

  const desc = [
    evento.descripcion,
    evento.caso  ? `Caso: ${evento.caso}`   : '',
    evento.lugar ? `Lugar: ${evento.lugar}` : ''
  ].filter(Boolean).join('\n');

  return {
    summary:     evento.titulo,
    description: desc,
    location:    evento.lugar || '',
    start: { dateTime: startISO, timeZone: 'America/Bogota' },
    end:   { dateTime: endISO,   timeZone: 'America/Bogota' }
  };
}

async function gcalCreate(userId, evento) {
  try {
    const client = await getAuthenticatedClient(userId);
    if (!client) return null;
    const cal    = google.calendar({ version: 'v3', auth: client });
    const res    = await cal.events.insert({ calendarId: 'primary', requestBody: toGoogleEvent(evento) });
    return res.data.id;
  } catch (err) {
    console.error('[GCAL] Error al crear evento:', err.message);
    return null;
  }
}

async function gcalUpdate(userId, googleEventId, evento) {
  try {
    const client = await getAuthenticatedClient(userId);
    if (!client || !googleEventId) return;
    const cal    = google.calendar({ version: 'v3', auth: client });
    await cal.events.update({ calendarId: 'primary', eventId: googleEventId, requestBody: toGoogleEvent(evento) });
  } catch (err) {
    console.error('[GCAL] Error al actualizar evento:', err.message);
  }
}

async function gcalDelete(userId, googleEventId) {
  try {
    const client = await getAuthenticatedClient(userId);
    if (!client || !googleEventId) return;
    const cal    = google.calendar({ version: 'v3', auth: client });
    await cal.events.delete({ calendarId: 'primary', eventId: googleEventId });
  } catch (err) {
    console.error('[GCAL] Error al eliminar evento:', err.message);
  }
}

// ─── Rutas ────────────────────────────────────────────────────────────────────
const router = express.Router();

// GET /agenda/google/status — estado de conexión Google Calendar del usuario
// ⚠️ Debe estar ANTES de GET /:id para que 'google' no sea tratado como un id
router.get('/google/status', requireAuth, async (req, res) => {
  try {
    const user = await UserGoogle.findById(req.user.sub)
      .select('google_connected google_email');
    res.json({
      connected: user?.google_connected || false,
      email:     user?.google_email     || null
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener estado de Google', detalle: err.message });
  }
});

// POST /agenda/google/disconnect — desconectar Google Calendar
router.post('/google/disconnect', requireAuth, async (req, res) => {
  try {
    await UserGoogle.findByIdAndUpdate(req.user.sub, {
      google_connected:     false,
      google_email:         null,
      google_access_token:  null,
      google_refresh_token: null,
      google_token_expiry:  null
    });
    res.json({ mensaje: 'Google Calendar desconectado correctamente' });
  } catch (err) {
    res.status(500).json({ error: 'Error al desconectar', detalle: err.message });
  }
});

// GET /agenda/ — listar eventos
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

// POST /agenda/ — crear evento + sincronizar con Google Calendar
router.post('/', requireAuth, async (req, res) => {
  try {
    const { titulo, tipo, caso, fecha, hora, lugar, descripcion } = req.body;
    if (!titulo?.trim()) return res.status(400).json({ error: 'El título es requerido' });
    if (!fecha)          return res.status(400).json({ error: 'La fecha es requerida' });

    const item = await Evento.create({
      titulo: titulo.trim(),
      tipo:   tipo || 'audiencia',
      caso:   caso        || '',
      fecha,
      hora:   hora        || '',
      lugar:  lugar       || '',
      descripcion: descripcion || '',
      creadoPor: req.user.sub
    });

    // Sincronizar con Google Calendar (no bloquea la respuesta)
    gcalCreate(req.user.sub, item).then(async (gId) => {
      if (gId) await Evento.findByIdAndUpdate(item._id, { google_event_id: gId });
    });

    console.log(`✅ Evento creado: ${item._id} por ${req.user.sub}`);
    res.status(201).json({ mensaje: 'Evento creado correctamente', data: item });
  } catch (err) {
    console.error('[AGENDA] Error al crear:', err.message);
    res.status(500).json({ error: 'Error al crear evento', detalle: err.message });
  }
});

// PATCH /agenda/:id — actualizar evento + sincronizar con Google Calendar
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

    // Sincronizar con Google Calendar
    gcalUpdate(item.creadoPor, item.google_event_id, updated);

    res.json({ mensaje: 'Evento actualizado correctamente', data: updated });
  } catch (err) {
    console.error('[AGENDA] Error al actualizar:', err.message);
    res.status(500).json({ error: 'Error al actualizar evento', detalle: err.message });
  }
});

// DELETE /agenda/:id — eliminar evento + eliminar de Google Calendar
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const item = await Evento.findById(req.params.id);
    if (!item) return res.status(404).json({ error: 'Evento no encontrado' });
    if (req.user.tipo_usuario !== 'administrador' && item.creadoPor !== req.user.sub) {
      return res.status(403).json({ error: 'Sin permiso para eliminar este evento' });
    }

    await Evento.findByIdAndDelete(req.params.id);

    // Eliminar de Google Calendar
    gcalDelete(item.creadoPor, item.google_event_id);

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
    db:      mongoose.connection.readyState === 1 ? 'conectado' : 'desconectado',
    gcal:    process.env.GOOGLE_CLIENT_ID ? 'configurado' : 'no configurado'
  });
});

// ─── Iniciar ──────────────────────────────────────────────────────────────────
mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME })
  .then(() => {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`✅ agenda-service corriendo en puerto ${PORT}`);
      console.log(`   Google Calendar: ${process.env.GOOGLE_CLIENT_ID ? 'habilitado' : 'no configurado'}`);
    });
  })
  .catch(err => {
    console.error('❌ Error al conectar MongoDB:', err.message);
    process.exit(1);
  });
