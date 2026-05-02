const path = require('path');
const fs = require('fs');
const http = require('http');
const { google } = require('googleapis');

function loadRootEnv() {
  const envPath = path.resolve(__dirname, '../../../../.env');
  try {
    require('dotenv').config({ path: envPath, override: true });
    return;
  } catch (_) {}

  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

loadRootEnv();

const clientId     = process.env.GOOGLE_OAUTH_CLIENT_ID;
const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;

if (!clientId || !clientSecret) {
  console.error('[OAuth] Faltan GOOGLE_OAUTH_CLIENT_ID o GOOGLE_OAUTH_CLIENT_SECRET en .env');
  process.exit(1);
}

const PORT        = 3456;
const REDIRECT    = `http://localhost:${PORT}/oauth/callback`;
const oAuth2Client = new google.auth.OAuth2(clientId, clientSecret, REDIRECT);

const authUrl = oAuth2Client.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent',
  scope: ['https://www.googleapis.com/auth/drive'],
});

console.log('\n[OAuth] Abre esta URL en tu navegador (copia y pega):');
console.log('\n' + authUrl + '\n');
console.log('[OAuth] Esperando callback en http://localhost:' + PORT + ' ...\n');

// Abrir el navegador automáticamente si es posible
try {
  const { execSync } = require('child_process');
  const cmd = process.platform === 'win32' ? `start "" "${authUrl}"` : `open "${authUrl}"`;
  execSync(cmd);
} catch (_) {}

const server = http.createServer(async (req, res) => {
  if (!req.url.startsWith('/oauth/callback')) return;

  const url    = new URL(req.url, `http://localhost:${PORT}`);
  const code   = url.searchParams.get('code');
  const error  = url.searchParams.get('error');

  if (error) {
    res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<h2>Error: ${error}</h2><p>Cierra esta pestaña.</p>`);
    server.close();
    process.exit(1);
  }

  if (!code) {
    res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<h2>No se recibió código. Intenta de nuevo.</h2>');
    server.close();
    return;
  }

  try {
    const { tokens } = await oAuth2Client.getToken(code);

    if (!tokens.refresh_token) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<h2>No se recibió refresh_token.</h2><p>Revoca el acceso en <a href="https://myaccount.google.com/permissions">myaccount.google.com/permissions</a> y vuelve a ejecutar el script.</p>');
      server.close();
      process.exit(1);
    }

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<h2>✅ Token generado. Puedes cerrar esta pestaña y volver a la terminal.</h2>');

    console.log('\n[OAuth] ✅ Refresh token generado con éxito!\n');
    console.log('Agrega esta línea en tu archivo .env (raíz del proyecto):\n');
    console.log(`GOOGLE_OAUTH_REFRESH_TOKEN=${tokens.refresh_token}\n`);

    server.close();
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<h2>Error al intercambiar código: ${err.message}</h2>`);
    console.error('\n[OAuth] Error:', err.message);
    server.close();
    process.exit(1);
  }
});

server.listen(PORT, () => {});
