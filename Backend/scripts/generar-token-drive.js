// ARCHIVO: scripts/generar-token-drive.js
/**
 * Ejecutar desde la raíz del proyecto:
 *   node scripts/generar-token-drive.js
 */

const path = require('path');

// Usa las dependencias del document-service (ya instaladas)
const SERVICE_DIR = path.join(__dirname, '..', 'backend', 'document-service');
require(path.join(SERVICE_DIR, 'node_modules', 'dotenv')).config();
const { google } = require(path.join(SERVICE_DIR, 'node_modules', 'googleapis'));
const http  = require('http');
const { URL } = require('url');

const CLIENT_ID     = process.env.GOOGLE_OAUTH_CLIENT_ID     || process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI  = 'http://localhost:3000/oauth2callback';

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('\n❌ Faltan las variables en el .env:');
  console.error('   GOOGLE_OAUTH_CLIENT_ID');
  console.error('   GOOGLE_OAUTH_CLIENT_SECRET\n');
  process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  prompt:      'consent',
  scope: [
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/drive.file'
  ]
});

console.log('\n══════════════════════════════════════════════════════════');
console.log('  REGENERADOR DE REFRESH TOKEN — Google Drive');
console.log('══════════════════════════════════════════════════════════');
console.log('\n1️⃣  Abre esta URL en tu navegador:\n');
console.log('   ' + authUrl);
console.log('\n2️⃣  Inicia sesión con la cuenta Google dueña de la carpeta de Drive.');
console.log('3️⃣  Acepta todos los permisos.');
console.log('4️⃣  Este script capturará el token automáticamente.\n');
console.log('══════════════════════════════════════════════════════════\n');

const server = http.createServer(async (req, res) => {
  try {
    const reqUrl = new URL(req.url, 'http://localhost:3000');
    const code   = reqUrl.searchParams.get('code');
    const error  = reqUrl.searchParams.get('error');

    if (error) {
      res.end(`<h2>Error: ${error}</h2>`);
      console.error('❌ Error de autorización:', error);
      server.close();
      return;
    }

    if (!code) { res.end('<h2>Esperando código...</h2>'); return; }

    res.end('<h2>✅ Listo. Puedes cerrar esta ventana y volver a la terminal.</h2>');

    const { tokens } = await oauth2Client.getToken(code);

    console.log('\n✅ TOKEN GENERADO EXITOSAMENTE');
    console.log('══════════════════════════════════════════════════════════');
    console.log('\nCopia este valor en tu .env:\n');
    console.log(`GOOGLE_OAUTH_REFRESH_TOKEN=${tokens.refresh_token}`);
    console.log('\n══════════════════════════════════════════════════════════');
    console.log('\nLuego ejecuta:');
    console.log('   docker-compose restart document-service\n');

    server.close();
  } catch (err) {
    res.end(`<h2>Error: ${err.message}</h2>`);
    console.error('❌ Error al obtener token:', err.message);
    server.close();
  }
});

server.listen(3000, () => {
  console.log('🔌 Servidor temporal en http://localhost:3000 (se cierra al recibir el token)\n');
});
