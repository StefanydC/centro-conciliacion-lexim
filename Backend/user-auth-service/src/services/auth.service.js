const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const User = require("../models/user.model");
const { ApiError } = require("../utils/apiError");
const { env } = require("../config/env");

/**
 * Generar token JWT
 */
const signToken = (user) => {
  const tokenUser = {
    _id: user._id,
    email: String(getUserField(user, "email") || "").toLowerCase(),
    nombre: getUserField(user, "nombre") || "",
    rol: getUserField(user, "rol") || "usuario",
    tipo_usuario: getUserField(user, "tipo_usuario") || "judicante"
  };

  return jwt.sign(
    {
      sub: tokenUser._id.toString(),
      email: tokenUser.email,
      nombre: tokenUser.nombre,
      rol: tokenUser.rol,
      tipo_usuario: tokenUser.tipo_usuario
    },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN }
  );
};

const isBcryptHash = (value) => typeof value === "string" && /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(value);

const getUserField = (user, fieldName) => user?.[fieldName] ?? user?.[fieldName.charAt(0).toUpperCase() + fieldName.slice(1)];

const normalizeUserResponse = (user) => ({
  id: user._id,
  nombre: getUserField(user, "nombre") || "",
  apellido: getUserField(user, "apellido") || "",
  email: String(getUserField(user, "email") || "").toLowerCase(),
  rol: getUserField(user, "rol") || "usuario",
  tipo_usuario: getUserField(user, "tipo_usuario") || "judicante",
  activo: getUserField(user, "activo") ?? true
});

const validatePassword = async (user, password) => {
  const storedPassword = user.password || user.Password;

  if (!storedPassword) return false;

  if (await bcrypt.compare(password, storedPassword)) {
    return true;
  }

  if (!isBcryptHash(storedPassword) && password === storedPassword) {
    user.password = password;
    user.Password = password;
    await user.save();
    return true;
  }

  return false;
};

/**
 * Servicio de autenticación - Login
 */
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

  if (!user) {
    throw new ApiError("Credenciales inválidas", 401);
  }

  console.log("✅ Usuario encontrado");

  // Comparar contraseña
  const isPasswordValid = await validatePassword(user, password);

  if (!isPasswordValid) {
    throw new ApiError("Credenciales inválidas", 401);
  }

  console.log("✅ Contraseña válida");

  return {
    token: signToken(user),
    usuario: normalizeUserResponse(user)
  };
};

module.exports = {
  login,
  signToken
};
