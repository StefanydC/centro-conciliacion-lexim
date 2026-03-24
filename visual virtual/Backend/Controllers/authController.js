require('dotenv').config({ path: require('path').resolve(__dirname, '../../../.env') });
const bcrypt = require('bcrypt');
const { client } = require('../db');

async function login(req, res) {
  const { Email, Contraseña } = req.body;

  console.log("📩 Datos recibidos:", { Email, Contraseña });

  try {
    if (!Email || !Contraseña) {
      return res.status(400).json({
        mensaje: 'Correo o contraseña incorrectos',
        code: 'INVALID_INPUT'
      });
    }

    const db = client.db(process.env.DB_NAME);
    const usuarios = db.collection('usuarios');

    const usuario = await usuarios.findOne({ Email });

    console.log("👤 Usuario encontrado:", usuario);

    if (!usuario) {
      return res.status(404).json({
        mensaje: 'Usuario inexistente',
        code: 'USER_NOT_FOUND'
      });
    }

    const passwordValida = await bcrypt.compare(Contraseña, usuario.Contraseña);

    console.log("🔑 Password válida:", passwordValida);

    if (!passwordValida) {
      return res.status(401).json({
        mensaje: 'Contraseña incorrecta',
        code: 'INVALID_PASSWORD'
      });
    }

    res.json({
      mensaje: '✅ Login exitoso',
      usuario: {
        nombre: usuario.Nombre,
        apellido: usuario.Apellido,
        email: usuario.Email
      }
    });

  } catch (error) {
    console.error('❌ Error en login:', error.message);
    res.status(500).json({
      mensaje: 'Error interno del servidor',
      code: 'SERVER_ERROR'
    });
  }
}

module.exports = { login };