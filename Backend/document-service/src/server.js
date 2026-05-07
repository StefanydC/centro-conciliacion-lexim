const app       = require('./app');
const connectDB = require('./config/db');
const env       = require('./config/env');
const { registerService, deregisterService } = require('./utils/consulRegister');

async function start() {
  await connectDB();

  app.listen(env.PORT, () => {
    console.log(`[Server] document-service corriendo en puerto ${env.PORT}`);
    console.log(`[Server] Carpeta raíz Drive: ${env.DRIVE_ROOT_FOLDER_ID}`);
    setTimeout(registerService, 3000);
  });
}

process.on('SIGTERM', async () => { await deregisterService(); process.exit(0); });
process.on('SIGINT',  async () => { await deregisterService(); process.exit(0); });

start().catch(err => {
  console.error('[Server] Error fatal al iniciar:', err.message);
  process.exit(1);
});
