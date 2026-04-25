const driveService = require('../services/drive.service');
const documentService = require('../services/document.service');
const env = require('../config/env');

/**
 * POST /upload
 * Body (multipart/form-data): file, folderId?
 * Admin y judicante. Sube un archivo a Drive y guarda metadata en MongoDB.
 */
const subirArchivo = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se recibió ningún archivo' });
    }

    const folderId = req.body.folderId || env.DRIVE_ROOT_FOLDER_ID;

    const driveFile = await driveService.subirArchivo(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      folderId
    );

    const metadata = await documentService.guardarMetadata({
      nombre:      req.file.originalname,
      driveFileId: driveFile.id,
      mimeType:    req.file.mimetype,
      tamaño:      req.file.size,
      folderId,
      subidoPor:   req.user.sub,
    });

    console.log(`[Files] Archivo subido: "${driveFile.name}" (${driveFile.id}) por ${req.user.sub}`);
    res.status(201).json({ data: { drive: driveFile, metadata } });
  } catch (err) {
    console.error('[Files] Error al subir archivo:', err.message);
    if (String(err.message || '').includes('Service Accounts do not have storage quota')) {
      return res.status(507).json({
        error: 'La cuenta de servicio no tiene cuota en Mi unidad de Google Drive.',
        detalle: 'Comparte la carpeta de destino con la service account o usa una carpeta dentro de una Unidad compartida.'
      });
    }
    res.status(500).json({ error: 'Error al subir el archivo', detalle: err.message });
  }
};

/**
 * GET /files/:folderId?
 * Lista archivos dentro de una carpeta en Drive.
 * Si no se pasa folderId, usa la raíz.
 */
const listarArchivos = async (req, res) => {
  try {
    const folderId = req.params.folderId || env.DRIVE_ROOT_FOLDER_ID;
    const archivos = await driveService.listarContenidoCarpeta(folderId);

    console.log(`[Files] Listado en carpeta ${folderId}: ${archivos.length} archivos`);
    res.json({ data: archivos, folderId });
  } catch (err) {
    console.error('[Files] Error al listar archivos:', err.message);
    res.status(500).json({ error: 'Error al listar archivos', detalle: err.message });
  }
};

/**
 * GET /file/:id
 * Retorna metadata + links del archivo (webViewLink, webContentLink).
 * Con query ?download=true hace streaming directo del archivo.
 */
const obtenerArchivo = async (req, res) => {
  try {
    const { id } = req.params;

    if (req.query.download === 'true') {
      const metadata = await driveService.obtenerMetadata(id);
      const stream = await driveService.obtenerStream(id);

      res.setHeader('Content-Disposition', `attachment; filename="${metadata.name}"`);
      res.setHeader('Content-Type', metadata.mimeType || 'application/octet-stream');
      stream.pipe(res);

      console.log(`[Files] Descarga iniciada: "${metadata.name}" (${id})`);
      return;
    }

    const archivo = await driveService.obtenerMetadata(id);
    res.json({ data: archivo });
  } catch (err) {
    console.error('[Files] Error al obtener archivo:', err.message);
    res.status(500).json({ error: 'Error al obtener el archivo', detalle: err.message });
  }
};

/**
 * DELETE /file/:id
 * Solo admin. Elimina el archivo de Drive y lo marca inactivo en MongoDB.
 */
const eliminarArchivo = async (req, res) => {
  try {
    const { id } = req.params;

    await driveService.eliminarArchivo(id);
    await documentService.marcarEliminado(id);

    console.log(`[Files] Archivo eliminado: ${id} por admin ${req.user.sub}`);
    res.json({ mensaje: 'Archivo eliminado correctamente' });
  } catch (err) {
    console.error('[Files] Error al eliminar archivo:', err.message);
    res.status(500).json({ error: 'Error al eliminar el archivo', detalle: err.message });
  }
};

/**
 * PATCH /file/:id
 * Solo admin. Renombra un archivo en Drive y actualiza MongoDB.
 */
const renombrarArchivo = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre } = req.body;
    if (!nombre?.trim()) {
      return res.status(400).json({ error: 'El nuevo nombre es requerido' });
    }
    const archivo = await driveService.renombrarArchivo(id, nombre.trim());
    await documentService.obtenerPorDriveId(id).then(doc => {
      if (doc) doc.set({ nombre: nombre.trim() }).save().catch(() => {});
    });
    console.log(`[Files] Renombrado: ${id} → "${nombre}" por admin ${req.user.sub}`);
    res.json({ data: archivo });
  } catch (err) {
    console.error('[Files] Error al renombrar:', err.message);
    res.status(500).json({ error: 'Error al renombrar el archivo', detalle: err.message });
  }
};

module.exports = { subirArchivo, listarArchivos, obtenerArchivo, eliminarArchivo, renombrarArchivo };
