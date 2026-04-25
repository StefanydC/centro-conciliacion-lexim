const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { ApiError } = require("../utils/apiError");
const { env } = require("../config/env");
const User = require("../models/user.model");

const signToken = (user) => jwt.sign(
  {
    sub:          user._id.toString(),
    email:        user.Email,
    tipo_usuario: user.tipo_usuario
  },
  env.JWT_SECRET,
  { expiresIn: env.JWT_EXPIRES_IN }
);

const login = async ({ email, password }) => {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  console.log("LOGIN RECIBIDO:", normalizedEmail);

  const user = await User.findOne({
    $or: [
      { Email: normalizedEmail },
      { email: normalizedEmail },
      { correo: normalizedEmail },
      { Email: String(email || "").trim() },
      { email: String(email || "").trim() },
      { correo: String(email || "").trim() }
    ]
  });
  console.log("USUARIO:", user ? "encontrado" : "NO encontrado");

  if (!user) throw new ApiError("Credenciales invalidas", 401);

  const storedPassword = user.Password || user.password;
  const valid = await bcrypt.compare(password, storedPassword);
  console.log("PASSWORD VALIDA:", valid);

  if (!valid) throw new ApiError("Credenciales invalidas", 401);

  return {
    token: signToken(user),
    usuario: {
      id:           user._id,
      nombre:       user.Nombre || user.nombre,
      apellido:     user.Apellido || user.apellido,
      correo:       user.Email || user.email || user.correo,
      tipo_usuario: user.tipo_usuario
    }
  };
};

module.exports = { login };