const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');
const env = require('./env');

let _driveClient = null;

function getDriveClient() {
  if (_driveClient) return _driveClient;

  let auth;

  if (env.GOOGLE_OAUTH_REFRESH_TOKEN) {
    // OAuth2: archivos se suben como el usuario dueño del Drive → usa su cuota (2TB)
    const oAuth2 = new google.auth.OAuth2(
      env.GOOGLE_OAUTH_CLIENT_ID,
      env.GOOGLE_OAUTH_CLIENT_SECRET,
    );
    oAuth2.setCredentials({ refresh_token: env.GOOGLE_OAUTH_REFRESH_TOKEN });
    auth = oAuth2;
    console.log('[Drive] Cliente inicializado con OAuth2 (credenciales de usuario)');
  } else {
    const scopes = ['https://www.googleapis.com/auth/drive'];

    if (env.GOOGLE_CREDENTIALS_JSON) {
      let credentials;
      try {
        credentials = JSON.parse(env.GOOGLE_CREDENTIALS_JSON);
      } catch {
        throw new Error('[Drive] GOOGLE_CREDENTIALS_JSON no es un JSON valido');
      }

      auth = new google.auth.GoogleAuth({ credentials, scopes });
      console.log('[Drive] Cliente inicializado con Service Account desde GOOGLE_CREDENTIALS_JSON');
    } else {
      const keyFile = path.resolve(env.GOOGLE_CREDENTIALS_PATH);
      if (!fs.existsSync(keyFile)) {
        throw new Error(`[Drive] Credenciales no encontradas en ${keyFile}. Configure GOOGLE_OAUTH_REFRESH_TOKEN o GOOGLE_CREDENTIALS_JSON`);
      }

      // Fallback: Service Account (solo sirve para carpetas, no para subir archivos)
      auth = new google.auth.GoogleAuth({
        keyFile,
        scopes,
      });
      console.log(`[Drive] Cliente inicializado con Service Account desde archivo: ${keyFile}`);
    }
    console.log('[Drive] Cliente inicializado con Service Account (ADVERTENCIA: sin cuota para archivos)');
  }

  _driveClient = google.drive({ version: 'v3', auth });
  return _driveClient;
}

module.exports = { getDriveClient };
