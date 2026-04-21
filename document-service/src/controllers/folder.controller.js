const driveService = require('../services/drive.service');
const env = require('../config/env');

/**
 * POST /folders
 * Body: { nombre, parentId? }
 * Solo admin. Crea una carpeta en Drive (en parentId o en la raíz).
 */
const crearCarpeta = async (req, res) => {
  try {
    const { nombre, parentId } = req.body;

    if (!nombre || !nombre.trim()) {
      return res.status(400).json({ error: 'El nombre de la carpeta es requerido' });
    }

    const parent = parentId || env.DRIVE_ROOT_FOLDER_ID;
    const carpeta = await driveService.crearCarpeta(nombre.trim(), parent);

    console.log(`[Folders] Carpeta creada: "${carpeta.name}" (${carpeta.id}) por admin ${req.user.sub}`);
    res.status(201).json({ data: carpeta });
  } catch (err) {
    console.error('[Folders] Error al crear carpeta:', err.message);
    res.status(500).json({ error: 'Error al crear la carpeta', detalle: err.message });
  }
};

/**
 * GET /folders/:parentId?
 * Lista el contenido (archivos + subcarpetas) de una carpeta.
 * Si no se pasa parentId, usa la carpeta raíz configurada.
 */
const listarContenido = async (req, res) => {
  try {
    const folderId = req.params.parentId || env.DRIVE_ROOT_FOLDER_ID;
    const items = await driveService.listarContenidoCarpeta(folderId);

    console.log(`[Folders] Listado de carpeta ${folderId}: ${items.length} items`);
    res.json({ data: items, folderId });
  } catch (err) {
    console.error('[Folders] Error al listar contenido:', err.message);
    res.status(500).json({ error: 'Error al listar la carpeta', detalle: err.message });
  }
};

module.exports = { crearCarpeta, listarContenido };
