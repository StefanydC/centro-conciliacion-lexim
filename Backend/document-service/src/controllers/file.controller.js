const driveService = require('../services/drive.service');
const documentService = require('../services/document.service');
const env = require('../config/env');

function esJudicante(req) {
  const roles = [req.user?.tipo_usuario, req.user?.tipoUsuario, req.user?.rol]
    .map(v => String(v || '').trim().toLowerCase())
    .filter(Boolean);
  return roles.includes('judicante');
}

function carpetaJudicantes() {
  return env.FOLDER_ID_JUDICANTES || env.JUDICANTE_FOLDER_ID || '';
}

function rootPorRol(req) {
  if (esJudicante(req)) return carpetaJudicantes() || null;
  return env.DRIVE_ROOT_FOLDER_ID;
}

async function validarAccesoJudicante(req, folderId) {
  if (!esJudicante(req)) return true;
  const root = carpetaJudicantes();
  if (!root) return false;
  return folderId === root || await driveService.estaEnCarpeta(folderId, root);
}

/**
 * POST /upload
 * Body (multipart/form-data): file, folderId?
 * Admin y judicante. Sube un archivo a Drive y guarda metadata en MongoDB.
 * Judicante: solo puede subir dentro de JUDICANTE_FOLDER_ID (o sus subcarpetas).
 */
const subirArchivo = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se recibió ningún archivo' });
    }

    const usuarioEsJudicante = esJudicante(req);
    const judicanteRoot = carpetaJudicantes();

    let targetFolder;

    if (usuarioEsJudicante) {
      if (!judicanteRoot) {
        return res.status(503).json({ error: 'Carpeta de judicantes no configurada' });
      }
      const solicitado = req.body.folderId;
      if (solicitado) {
        const permitido = await driveService.estaEnCarpeta(solicitado, judicanteRoot);
        if (!permitido) {
          return res.status(403).json({ error: 'No puedes subir archivos fuera de tu espacio asignado' });
        }
        targetFolder = solicitado;
      } else {
        targetFolder = judicanteRoot;
      }
    } else {
      targetFolder = req.body.folderId || env.DRIVE_ROOT_FOLDER_ID;
    }

    const driveFile = await driveService.subirArchivo(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      targetFolder
    );

    const metadata = await documentService.guardarMetadata({
      nombre:      req.file.originalname,
      driveFileId: driveFile.id,
      mimeType:    req.file.mimetype,
      tamaño:      req.file.size,
      folderId:    targetFolder,
      subidoPor:   req.user.sub,
    });

    console.log(`[Files] Archivo subido: "${driveFile.name}" (${driveFile.id}) por ${req.user.sub} en carpeta ${targetFolder}`);
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
 * Judicante: solo puede listar dentro de JUDICANTE_FOLDER_ID.
 */
const listarArchivos = async (req, res) => {
  try {
    const folderRaiz = rootPorRol(req);
    if (esJudicante(req) && !folderRaiz) {
      return res.status(503).json({ error: 'Carpeta de judicantes no configurada' });
    }

    let folderId;
    if (esJudicante(req)) {
      folderId = req.params.folderId || folderRaiz;
    } else {
      folderId = req.params.folderId || env.DRIVE_ROOT_FOLDER_ID;
    }

    if (esJudicante(req) && req.params.folderId) {
      const permitido = await validarAccesoJudicante(req, folderId);
      if (!permitido) {
        return res.status(403).json({ error: 'Acceso denegado' });
      }
    }

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
 * Admin puede eliminar cualquier archivo.
 * Judicante solo puede eliminar archivos dentro de su espacio asignado.
 */
const eliminarArchivo = async (req, res) => {
  try {
    const { id } = req.params;

    if (esJudicante(req)) {
      const permitido = await validarAccesoJudicante(req, id);
      if (!permitido) {
        return res.status(403).json({ error: 'No puedes eliminar archivos fuera de tu espacio asignado' });
      }
    }

    await driveService.eliminarArchivo(id);
    await documentService.marcarEliminado(id);

    console.log(`[Files] Archivo eliminado: ${id} por ${req.user.sub} (${req.user.tipo_usuario || req.user.rol})`);
    res.json({ mensaje: 'Archivo eliminado correctamente' });
  } catch (err) {
    console.error('[Files] Error al eliminar archivo:', err.message);
    res.status(500).json({ error: 'Error al eliminar el archivo', detalle: err.message });
  }
};

/**
 * PATCH /file/:id
 * Admin puede renombrar cualquier archivo.
 * Judicante solo puede renombrar archivos dentro de su espacio asignado.
 */
const renombrarArchivo = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre } = req.body;
    if (!nombre?.trim()) {
      return res.status(400).json({ error: 'El nuevo nombre es requerido' });
    }

    if (esJudicante(req)) {
      const permitido = await validarAccesoJudicante(req, id);
      if (!permitido) {
        return res.status(403).json({ error: 'No puedes renombrar archivos fuera de tu espacio asignado' });
      }
    }

    const archivo = await driveService.renombrarArchivo(id, nombre.trim());
    await documentService.obtenerPorDriveId(id).then(doc => {
      if (doc) doc.set({ nombre: nombre.trim() }).save().catch(() => {});
    });
    console.log(`[Files] Renombrado: ${id} → "${nombre}" por ${req.user.sub} (${req.user.tipo_usuario || req.user.rol})`);
    res.json({ data: archivo });
  } catch (err) {
    console.error('[Files] Error al renombrar:', err.message);
    res.status(500).json({ error: 'Error al renombrar el archivo', detalle: err.message });
  }
};

/**
 * PUT /file/:id/move
 * Admin puede mover cualquier archivo.
 * Judicante solo puede mover archivos dentro de su espacio asignado.
 * Si destinationFolderId es null/vacío, se mueve a la raíz correspondiente al rol.
 */
const moverArchivo = async (req, res) => {
  try {
    const { id } = req.params;
    const destinationFolderId = String(req.body.destinationFolderId || '').trim();
    
    const usuarioEsJudicante = esJudicante(req);
    const judicanteRoot = carpetaJudicantes();
    
    // Determinar carpeta de destino
    let targetFolder;
    if (!destinationFolderId) {
      // Si no se especifica destino, ir a la raíz del rol
      if (usuarioEsJudicante) {
        if (!judicanteRoot) {
          return res.status(503).json({ error: 'Carpeta de judicantes no configurada' });
        }
        targetFolder = judicanteRoot;
      } else {
        targetFolder = env.DRIVE_ROOT_FOLDER_ID;
      }
    } else {
      targetFolder = destinationFolderId;
    }

    if (usuarioEsJudicante) {
      const permitido1 = await validarAccesoJudicante(req, id);
      const permitido2 = await validarAccesoJudicante(req, targetFolder);
      if (!permitido1 || !permitido2) {
        return res.status(403).json({ error: 'No puedes mover archivos fuera de tu espacio asignado' });
      }
    }

    const archivo = await driveService.moverArchivo(id, targetFolder);
    console.log(`[Files] Movido: ${id} → ${targetFolder} por ${req.user.sub} (${req.user.tipo_usuario || req.user.rol})`);
    res.json({ data: archivo });
  } catch (err) {
    console.error('[Files] Error al mover archivo:', err.message);
    res.status(500).json({ error: 'Error al mover el archivo', detalle: err.message });
  }
};

module.exports = { subirArchivo, listarArchivos, obtenerArchivo, eliminarArchivo, renombrarArchivo, moverArchivo };
