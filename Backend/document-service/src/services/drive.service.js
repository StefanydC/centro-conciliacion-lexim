const { getDriveClient } = require('../config/drive');
const { Readable } = require('stream');

/**
 * Crea una carpeta en Google Drive dentro de un padre dado.
 */
async function crearCarpeta(nombre, parentId) {
  const drive = getDriveClient();
  const res = await drive.files.create({
    supportsAllDrives: true,
    requestBody: {
      name: nombre,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    },
    fields: 'id, name, mimeType, createdTime',
  });
  return res.data;
}

/**
 * Lista archivos y subcarpetas dentro de una carpeta.
 * Ordena: carpetas primero, luego por nombre.
 */
async function listarContenidoCarpeta(folderId) {
  const drive = getDriveClient();
  const res = await drive.files.list({
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    q: `'${folderId}' in parents and trashed = false`,
    fields: 'files(id, name, mimeType, size, createdTime, modifiedTime, webViewLink, webContentLink)',
    orderBy: 'folder, name',
    pageSize: 500,
  });
  return res.data.files || [];
}

/**
 * Sube un archivo a Google Drive dentro del folder indicado.
 * @param {Buffer} buffer  - Contenido del archivo
 * @param {string} nombre  - Nombre original del archivo
 * @param {string} mimeType
 * @param {string} folderId
 */
async function subirArchivo(buffer, nombre, mimeType, folderId) {
  const drive = getDriveClient();
  const stream = Readable.from(buffer);

  const res = await drive.files.create({
    supportsAllDrives: true,
    requestBody: {
      name: nombre,
      parents: [folderId],
    },
    media: {
      mimeType: mimeType || 'application/octet-stream',
      body: stream,
    },
    fields: 'id, name, mimeType, size, webViewLink, webContentLink, createdTime',
  });

  // Hacer el archivo accesible para vista previa (anyone with link can view)
  try {
    await drive.permissions.create({
      fileId: res.data.id,
      supportsAllDrives: true,
      requestBody: { role: 'reader', type: 'anyone' },
    });
  } catch (_) {
    // Si falla el permiso público no bloquea la subida
  }

  return res.data;
}

/**
 * Obtiene metadata de un archivo por su Drive ID.
 */
async function obtenerMetadata(fileId) {
  const drive = getDriveClient();
  const res = await drive.files.get({
    fileId,
    supportsAllDrives: true,
    fields: 'id, name, mimeType, size, webViewLink, webContentLink, createdTime, modifiedTime',
  });
  return res.data;
}

/**
 * Retorna un stream del contenido del archivo (para descarga directa).
 */
async function obtenerStream(fileId) {
  const drive = getDriveClient();
  const res = await drive.files.get(
    { fileId, alt: 'media', supportsAllDrives: true },
    { responseType: 'stream' }
  );
  return res.data;
}

/**
 * Elimina permanentemente un archivo de Google Drive.
 */
async function eliminarArchivo(fileId) {
  const drive = getDriveClient();
  await drive.files.delete({ fileId, supportsAllDrives: true });
}

/**
 * Renombra un archivo o carpeta en Google Drive.
 */
async function renombrarArchivo(fileId, nuevoNombre) {
  const drive = getDriveClient();
  const res = await drive.files.update({
    fileId,
    supportsAllDrives: true,
    requestBody: { name: nuevoNombre },
    fields: 'id, name, mimeType, modifiedTime',
  });
  return res.data;
}

module.exports = {
  crearCarpeta,
  listarContenidoCarpeta,
  subirArchivo,
  obtenerMetadata,
  obtenerStream,
  eliminarArchivo,
  renombrarArchivo,
};
