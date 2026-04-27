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
    next();
  } catch (error) {
    next(error);
  }
});

// Método para comparar contraseñas
userSchema.methods.comparePassword = async function (password) {
  return await bcrypt.compare(password, this.password);
};

// Evitar redefinir el modelo
module.exports = mongoose.models.User || mongoose.model("User", userSchema, "usuarios");
