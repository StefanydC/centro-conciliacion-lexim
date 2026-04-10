// ==============================
// CONFIGURACIÓN INICIAL
// ==============================
require('dotenv').config({
  path: require('path').resolve(__dirname, '../../.env')
});

const bcrypt = require('bcrypt');
const { client } = require('../db');

// ==============================
// LOGIN
// ==============================
async function login(req, res) {
  try {
    const { Email, Contraseña } = req.body;

    const emailNormalizado = (Email || '').trim().toLowerCase();
    const passwordIngresada = Contraseña ?? '';
    const passwordSinEspacios = String(Contraseña ?? '').trim();

    console.log("📩 Datos recibidos login:", { Email: emailNormalizado });

    // ==============================
    // VALIDACIÓN DE ENTRADA
    // ==============================
    if (!emailNormalizado || !String(passwordIngresada).length) {
      return res.status(400).json({
        mensaje: 'Correo o contraseña incorrectos',
        code: 'INVALID_INPUT'
      });
    }

    // ==============================
    // CONEXIÓN A DB
    // ==============================
    const db = client.db(process.env.DB_NAME);
    const usuarios = db.collection('usuarios');

    // ==============================
    // BUSCAR USUARIO
    // ==============================
    const usuario = await usuarios.findOne({
      $or: [
        { Email: Email },
        { Email: { $regex: `^${emailNormalizado.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } },
        { Email: emailNormalizado },
        { email: { $regex: `^${emailNormalizado.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } },
        { email: Email },
        { email: emailNormalizado }
      ]
    });

    console.log("👤 Usuario encontrado:", usuario);

    if (!usuario) {
      return res.status(404).json({
        mensaje: 'Usuario inexistente',
        code: 'USER_NOT_FOUND'
      });
    }

    // ==============================
    // VALIDAR CONTRASEÑA EN DB
    // ==============================
    const contraseñaDB = usuario.Contraseña || usuario.contraseña || usuario.password || usuario.Password;

    if (!contraseñaDB) {
      console.error("❌ Usuario sin contraseña en la base de datos");
      return res.status(500).json({
        mensaje: 'Error interno: contraseña no definida',
        code: 'NO_PASSWORD'
      });
    }

    // ==============================
    // COMPARAR CONTRASEÑA
    // ==============================
    let contraseñaValida = false;

    try {
      const pareceHashBcrypt = /^\$2[aby]\$\d{2}\$/.test(contraseñaDB);

      if (pareceHashBcrypt) {
        contraseñaValida = await bcrypt.compare(String(passwordIngresada), contraseñaDB);
        if (!contraseñaValida && passwordSinEspacios !== String(passwordIngresada)) {
          contraseñaValida = await bcrypt.compare(passwordSinEspacios, contraseñaDB);
        }
      } else {
        // Compatibilidad con usuarios legacy que tengan contraseña en texto plano.
        const contraseñaTextoPlano = String(contraseñaDB).trim();
        contraseñaValida = String(passwordIngresada) === contraseñaTextoPlano || passwordSinEspacios === contraseñaTextoPlano;
      }
    } catch (err) {
      console.error("❌ Error en bcrypt:", err.message);
      return res.status(500).json({
        mensaje: 'Error validando contraseña',
        code: 'BCRYPT_ERROR'
      });
    }

    console.log("🔑 Contraseña válida:", contraseñaValida);

    if (!contraseñaValida) {
      return res.status(401).json({
        mensaje: 'Contraseña incorrecta',
        code: 'INVALID_PASSWORD'
      });
    }

    // ==============================
    // OBTENER TIPO DE USUARIO
    // ==============================
    const tipoUsuario =
      usuario.tipo_usuario ||
      usuario.Tipo_usuario ||
      usuario.tipoUsuario ||
      usuario.rol ||
      'administrador';

    // ==============================
    // RESPUESTA EXITOSA
    // ==============================
    return res.json({
      mensaje: '✅ Login exitoso',
      usuario: {
        nombre: usuario.Nombre || usuario.nombre || '',
        apellido: usuario.Apellido || usuario.apellido || '',
        Email: usuario.Email || usuario.email || '',
        tipo_usuario: tipoUsuario
      }
    });

  } catch (error) {
    console.error('❌ Error en login:', error);
    return res.status(500).json({
      mensaje: 'Error interno del servidor',
      code: 'SERVER_ERROR'
    });
  }
}

// ==============================
// EXPORTACIÓN
// ==============================
module.exports = {
  login
};