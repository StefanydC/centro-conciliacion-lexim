require('dotenv').config();

const env = {
  PORT:                    process.env.PORT                    || 3004,
  MONGO_URI:               process.env.MONGO_URI,
  MONGO_DB_NAME:           process.env.MONGO_DB_NAME           || 'Lexim_db',
  JWT_SECRET:              process.env.JWT_SECRET,
  GOOGLE_CREDENTIALS_PATH: process.env.GOOGLE_CREDENTIALS_PATH || '/app/credentials/lexim-493421-e71af6001af4.json',
  GOOGLE_OAUTH_CLIENT_ID:  process.env.GOOGLE_OAUTH_CLIENT_ID  || '',
  GOOGLE_OAUTH_CLIENT_SECRET: process.env.GOOGLE_OAUTH_CLIENT_SECRET || '',
  GOOGLE_OAUTH_REFRESH_TOKEN: process.env.GOOGLE_OAUTH_REFRESH_TOKEN || '',
  DRIVE_ROOT_FOLDER_ID:    process.env.DRIVE_ROOT_FOLDER_ID    || '1se9ekY8ULFvUu9DWsD1axrH_gW-2e3ca',
  FOLDER_ID_JUDICANTES:    process.env.FOLDER_ID_JUDICANTES    || process.env.JUDICANTE_FOLDER_ID || '',
  JUDICANTE_FOLDER_ID:     process.env.JUDICANTE_FOLDER_ID     || '',
};

['MONGO_URI', 'JWT_SECRET'].forEach(key => {
  if (!env[key]) throw new Error(`[Config] Variable de entorno requerida faltante: ${key}`);
});

module.exports = env;
