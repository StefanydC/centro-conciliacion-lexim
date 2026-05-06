// ARCHIVO: backend/user-auth-service/src/services/auth.service.js
const jwt    = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const User   = require("../models/user.model");
const { ApiError } = require("../utils/apiError");
const { env } = require("../config/env");

const getUserField = (user, fieldName) =>
  user?.[fieldName] ?? user?.[fieldName.charAt(0).toUpperCase() + fieldName.slice(1)];

const isBcryptHash = (value) =>
  typeof value === "string" && /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(value);

const signToken = (user) =>
  jwt.sign(
    {
      sub:          user._id.toString(),
      email:        String(getUserField(user, "email") || "").toLowerCase(),
      nombre:       getUserField(user, "nombre") || "",
      rol:          getUserField(user, "rol")    || "usuario",
      tipo_usuario: getUserField(user, "tipo_usuario") || "judicante"
    },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN }
  );

const normalizeUserResponse = (user) => ({
  id:           user._id,
  nombre:       getUserField(user, "nombre")   || "",
  apellido:     getUserField(user, "apellido") || "",
  email:        String(getUserField(user, "email") || "").toLowerCase(),
  rol:          getUserField(user, "rol")         || "usuario",
  tipo_usuario: getUserField(user, "tipo_usuario") || "judicante",
  activo:       getUserField(user, "activo") ?? true,
  ultimo_acceso: user.ultimo_acceso || null,
  requiere_cambio_password: user.requiere_cambio_password || false
});

/**
 * Ley 1581 Art. 17 literal f — Seguridad técnica:
 * Si la contraseña almacenada NO es un hash bcrypt se exige restablecimiento.
 * El bloque de comparación de texto plano legacy ha sido eliminado.
 */
const validatePassword = async (user, password) => {
  const stored = user.password || user.Password;
  if (!stored) return false;

  // Ley 1581 — si la contraseña no está cifrada, forzar restablecimiento
  if (!isBcryptHash(stored)) {
    await User.findByIdAndUpdate(user._id, { requiere_cambio_password: true });
    throw new ApiError(
      "Por seguridad, su contraseña debe ser restablecida. Contacte al administrador.",
      403
    );
  }

  return await bcrypt.compare(password, stored);
};

// ─── Login ────────────────────────────────────────────────────────────────────
const login = async ({ email, password }) => {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  console.log(`🔍 Buscando usuario: ${normalizedEmail}`);

  const user = await User.findOne({
    $or: [
      { email: normalizedEmail },
      { Email: normalizedEmail },
      { correo: normalizedEmail }
    ]
  }).select("+password +Password +email +Email +nombre +Nombre +apellido +Apellido +rol +tipo_usuario +activo +requiere_cambio_password");

  if (!user) throw new ApiError("Credenciales inválidas", 401);
  console.log("✅ Usuario encontrado");

  const isPasswordValid = await validatePassword(user, password);
  if (!isPasswordValid) throw new ApiError("Credenciales inválidas", 401);
  console.log("✅ Contraseña válida");

  // Actualizar último acceso y fecha de retención (Ley 1581 — 5 años desde último acceso)
  const nuevaFechaRetencion = new Date();
  nuevaFechaRetencion.setFullYear(nuevaFechaRetencion.getFullYear() + 5);

  await User.findByIdAndUpdate(user._id, {
    activo:                true,
    ultimo_acceso:         new Date(),
    fecha_retencion_hasta: nuevaFechaRetencion
  });

  return {
    token:   signToken(user),
    usuario: normalizeUserResponse(user)
  };
};

// ─── Logout ───────────────────────────────────────────────────────────────────
const logout = async (userId) => {
  if (!userId) return;
  await User.findByIdAndUpdate(userId, {
    activo:        false,
    ultimo_logout: new Date()
  });
  console.log(`👋 Logout: usuario ${userId} marcado como inactivo`);
};

module.exports = { login, logout, signToken };
