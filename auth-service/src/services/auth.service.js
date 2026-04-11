const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const { ApiError } = require("../utils/apiError");
const { env } = require("../config/env");

const userSchema = new mongoose.Schema({}, { 
  strict: false, 
  collection: "usuarios" 
});

const User = mongoose.models.User || mongoose.model("User", userSchema);

const signToken = (user) => jwt.sign(
  { sub: user._id.toString(), email: user.Email },
  env.JWT_SECRET,
  { expiresIn: env.JWT_EXPIRES_IN }
);

const login = async ({ email, password }) => {
  console.log("LOGIN RECIBIDO:", email);

  const user = await User.findOne({ Email: email });
  console.log("USUARIO:", user ? "encontrado" : "NO encontrado");

  if (!user) throw new ApiError("Credenciales invalidas", 401);

  const valid = await bcrypt.compare(password, user.Password);
  console.log("PASSWORD VALIDA:", valid);

  if (!valid) throw new ApiError("Credenciales invalidas", 401);

  return {
    token: signToken(user),
    usuario: {
      id:           user._id,
      nombre:       user.Nombre,
      apellido:     user.Apellido,
      correo:       user.Email,
      tipo_usuario: user.tipo_usuario
    }
  };
};

module.exports = { login };