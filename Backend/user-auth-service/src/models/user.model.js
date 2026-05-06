// ARCHIVO: backend/user-auth-service/src/models/user.model.js
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    nombre: {
      type: String,
      required: true
    },
    Nombre: {
      type: String
    },
    apellido: {
      type: String
    },
    Apellido: {
      type: String
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    Email: {
      type: String,
      trim: true
    },
    password: {
      type: String,
      required: true,
      select: false
    },
    Password: {
      type: String,
      select: false
    },
    rol: {
      type: String,
      enum: ["admin", "conciliador", "usuario", "administrador", "judicante"],
      default: "usuario"
    },
    tipo_usuario: {
      type: String,
      enum: ["administrador", "judicante"],
      default: "judicante"
    },
    activo: {
      type: Boolean,
      default: true
    },
    en_linea: {
      type: Boolean,
      default: false
    },
    ultimo_acceso: {
      type: Date,
      default: null
    },
    ultimo_logout: {
      type: Date,
      default: null
    },
    fecha_ingreso: {
      type: Date,
      default: Date.now
    },
    google_connected:     { type: Boolean, default: false },
    google_email:         { type: String,  default: null  },
    google_access_token:  { type: String,  default: null, select: false },
    google_refresh_token: { type: String,  default: null, select: false },
    google_token_expiry:  { type: Date,    default: null  },

    // ─── Ley 1581 Art. 9 — Consentimiento expreso del titular ────────────────
    consentimiento_datos: {
      aceptado: { type: Boolean, default: false },
      fecha:    { type: Date,   default: null   },
      version:  { type: String, default: null   }
    },

    // ─── Ley 1581 Art. 17 lit. f — Seguridad técnica ─────────────────────────
    // Fuerza restablecimiento si la contraseña venía en texto plano (legacy)
    requiere_cambio_password: {
      type: Boolean,
      default: false
    },

    // Indica si los campos sensibles han sido procesados/cifrados
    datos_sensibles_cifrados: {
      type: Boolean,
      default: true
    },

    // ─── Ley 1581 Art. 8 lit. c — Derecho de cancelación ─────────────────────
    estado_cuenta: {
      type: String,
      enum: ["activa", "inactiva", "eliminacion_solicitada"],
      default: "activa"
    },
    fecha_solicitud_eliminacion: {
      type: Date,
      default: null
    },

    // ─── Ley 1581 Art. 11 — Retención de datos ───────────────────────────────
    // Calculada: 5 años desde último acceso (se actualiza en cada login)
    fecha_retencion_hasta: {
      type: Date,
      default: () => {
        const d = new Date();
        d.setFullYear(d.getFullYear() + 5);
        return d;
      }
    }
  },
  {
    timestamps: true,
    strict: false
  }
);

// Pre-save hook: hashear password solo si se modifica
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    // Una vez hasheada, marcar que no requiere cambio por texto plano
    this.requiere_cambio_password = false;
    next();
  } catch (error) {
    next(error);
  }
});

userSchema.methods.comparePassword = async function (password) {
  return await bcrypt.compare(password, this.password);
};

module.exports = mongoose.models.User || mongoose.model("User", userSchema, "usuarios");
