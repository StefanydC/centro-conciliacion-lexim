require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const express = require('express');
const cors = require('cors');
const { conectarDB } = require('./db');
const authRoutes = require('./Routes/auth');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: ['http://127.0.0.1:5500', 'http://localhost:5000'] }));
app.use(express.json());

app.use('/auth', authRoutes);

app.get('/', (req, res) => {
  res.json({ mensaje: '✅ Servidor Lexim funcionando' });
});

async function iniciar() {
  try {
    console.log("⏳ Conectando a MongoDB...");
    await conectarDB();

    app.listen(PORT, () => {
      console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
    });

  } catch (error) {
    console.error("❌ Error al conectar:", error.message);
    process.exit(1);
  }
}

// Log temporal para ver rutas registradas
app.get('/test', (req, res) => {
  res.json({ mensaje: 'Backend funcionando en 3001' });
});

iniciar();