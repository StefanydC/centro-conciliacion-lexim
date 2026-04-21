const { google } = require('googleapis');
const path = require('path');
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
    // Fallback: Service Account (solo sirve para carpetas, no para subir archivos)
    auth = new google.auth.GoogleAuth({
      keyFile: path.resolve(env.GOOGLE_CREDENTIALS_PATH),
      scopes: ['https://www.googleapis.com/auth/drive'],
    });
    console.log('[Drive] Cliente inicializado con Service Account (ADVERTENCIA: sin cuota para archivos)');
  }

  _driveClient = google.drive({ version: 'v3', auth });
  return _driveClient;
}

module.exports = { getDriveClient };
