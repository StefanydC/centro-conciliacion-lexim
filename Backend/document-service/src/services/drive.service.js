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
    q: `'${folderId}' in parents and trashed=false`,
    fields: 'files(id, name, mimeType, size, createdTime, modifiedTime, webViewLink, webContentLink)',
    orderBy: 'folder, name',
    pageSize: 500,
  });
  return res.data.files || [];
}

/**
 * Sube un archivo a Google Drive dentro del folder indicado.
 * El caller (controller) es responsable de calcular el folderId correcto
 * y de validar que el usuario tenga permisos sobre esa carpeta.
 * Los archivos NO son públicos: heredan permisos de la carpeta padre.
 */
async function subirArchivo(buffer, nombre, mimeType, folderId) {
  const drive = getDriveClient();
  const stream = Readable.from(buffer);
  const targetFolder = folderId || process.env.DRIVE_ROOT_FOLDER_ID;

  const res = await drive.files.create({
    supportsAllDrives: true,
    requestBody: {
      name:    nombre,
      parents: [targetFolder],
    },
    media: {
      mimeType: mimeType || 'application/octet-stream',
      body:     stream,
    },
    fields: 'id, name, mimeType, size, webViewLink, webContentLink, createdTime',
  });

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

/**
 * Verifica que `folderId` sea `rootFolderId` o un descendiente directo de él.
 * Sube la cadena de padres en Drive hasta 5 niveles para evitar bucles infinitos.
 * Devuelve true si está dentro, false si no.
 */
async function estaEnCarpeta(folderId, rootFolderId) {
  if (!folderId || !rootFolderId) return false;
  if (folderId === rootFolderId) return true;

  const drive = getDriveClient();
  let current = folderId;

  for (let i = 0; i < 5; i++) {
    let parents;
    try {
      const res = await drive.files.get({
        fileId: current,
        fields: 'parents',
        supportsAllDrives: true,
      });
      parents = res.data.parents || [];
    } catch {
      return false;
    }
    if (parents.includes(rootFolderId)) return true;
    if (parents.length === 0) return false;
    current = parents[0];
  }
  return false;
}

module.exports = {
  crearCarpeta,
  listarContenidoCarpeta,
  subirArchivo,
  obtenerMetadata,
  obtenerStream,
  eliminarArchivo,
  renombrarArchivo,
  estaEnCarpeta,
};
