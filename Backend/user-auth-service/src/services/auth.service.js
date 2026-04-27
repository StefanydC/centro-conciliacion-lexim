const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const User = require("../models/user.model");
const { ApiError } = require("../utils/apiError");
const { env } = require("../config/env");

const getUserField = (user, fieldName) =>
  user?.[fieldName] ?? user?.[fieldName.charAt(0).toUpperCase() + fieldName.slice(1)];

const isBcryptHash = (value) =>
  typeof value === "string" && /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(value);

const signToken = (user) =>
  jwt.sign(
    {
      sub: user._id.toString(),
      email: String(getUserField(user, "email") || "").toLowerCase(),
      nombre: getUserField(user, "nombre") || "",
      rol: getUserField(user, "rol") || "usuario",
      tipo_usuario: getUserField(user, "tipo_usuario") || "judicante"
    },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN }
  );

const normalizeUserResponse = (user) => ({
  id: user._id,
  nombre: getUserField(user, "nombre") || "",
  apellido: getUserField(user, "apellido") || "",
  email: String(getUserField(user, "email") || "").toLowerCase(),
  rol: getUserField(user, "rol") || "usuario",
  tipo_usuario: getUserField(user, "tipo_usuario") || "judicante",
  activo: getUserField(user, "activo") ?? true,
  ultimo_acceso: user.ultimo_acceso || null
});

const validatePassword = async (user, password) => {
  const stored = user.password || user.Password;
  if (!stored) return false;
  if (await bcrypt.compare(password, stored)) return true;
  // Contraseña en texto plano (migración legacy)
  if (!isBcryptHash(stored) && password === stored) {
    user.password = password;
    user.Password = password;
    await user.save();
    return true;
  }
  return false;
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
  }).select("+password +Password +email +Email +nombre +Nombre +apellido +Apellido +rol +tipo_usuario +activo");

  if (!user) throw new ApiError("Credenciales inválidas", 401);
  console.log("✅ Usuario encontrado");

  const isPasswordValid = await validatePassword(user, password);
  if (!isPasswordValid) throw new ApiError("Credenciales inválidas", 401);
  console.log("✅ Contraseña válida");

  // Marcar como activo (en línea) y guardar último acceso
  await User.findByIdAndUpdate(user._id, {
    activo:        true,
    ultimo_acceso: new Date()
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
