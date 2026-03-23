const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const { MongoClient, ServerApiVersion } = require('mongodb');

const app = express();
const PORT = 3000;

const uri = "mongodb://santiagomartinezaaz009_db_user:406iDuSgqgOQvkgX@ac-cl3k5su-shard-00-00.9joqo3s.mongodb.net:27017,ac-cl3k5su-shard-00-01.9joqo3s.mongodb.net:27017,ac-cl3k5su-shard-00-02.9joqo3s.mongodb.net:27017/?ssl=true&replicaSet=atlas-14lg3a-shard-0&authSource=admin&appName=ProyectoLexim";

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

app.use(cors({ origin: 'http://127.0.0.1:5500' }));
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ mensaje: '✅ Servidor Lexim funcionando' });
});

app.post('/login', async (req, res) => {
  const { Email, Contraseña } = req.body;

  console.log("📩 Datos recibidos:", { Email, Contraseña });

  try {
    const db = client.db('Lexim_db');
    const usuarios = db.collection('usuarios');

    const usuario = await usuarios.findOne({ Email: Email });

    console.log("👤 Usuario encontrado:", usuario);

    if (!usuario) {
      return res.status(401).json({ error: 'Correo o contraseña incorrectos' });
    }

    const passwordValida = await bcrypt.compare(Contraseña, usuario.Contraseña);

    console.log("🔑 Password válida:", passwordValida);

    if (!passwordValida) {
      return res.status(401).json({ error: 'Correo o contraseña incorrectos' });
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
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

async function iniciar() {
  try {
    console.log("⏳ Conectando a MongoDB...");
    await client.connect();
    await client.db("admin").command({ ping: 1 });
    console.log("✅ Conectado correctamente a MongoDB");

    app.listen(PORT, () => {
      console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
    });

  } catch (error) {
    console.error("❌ Error al conectar:", error.message);
    process.exit(1);
  }
}

iniciar();