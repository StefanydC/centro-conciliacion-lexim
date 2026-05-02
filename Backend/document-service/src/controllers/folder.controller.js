const driveService = require('../services/drive.service');
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
 * POST /folders
 * Body: { nombre, parentId? }
 * Admin: cualquier parentId o raíz admin.
 * Judicante: parentId debe estar dentro de JUDICANTE_FOLDER_ID (o usa esa raíz).
 */
const crearCarpeta = async (req, res) => {
  try {
    const { nombre, parentId } = req.body;

    if (!nombre || !nombre.trim()) {
      return res.status(400).json({ error: 'El nombre de la carpeta es requerido' });
    }

    const usuarioEsJudicante = esJudicante(req);
    let parent;

    if (usuarioEsJudicante) {
      const judicanteRoot = carpetaJudicantes();
      if (!judicanteRoot) {
        return res.status(503).json({ error: 'Carpeta de judicantes no configurada' });
      }
      if (parentId) {
        const permitido = await driveService.estaEnCarpeta(parentId, judicanteRoot);
        if (!permitido) {
          return res.status(403).json({ error: 'No puedes crear carpetas fuera de tu espacio asignado' });
        }
        parent = parentId;
      } else {
        parent = judicanteRoot;
      }
    } else {
      parent = parentId || env.DRIVE_ROOT_FOLDER_ID;
    }

    const carpeta = await driveService.crearCarpeta(nombre.trim(), parent);

    console.log(`[Folders] Carpeta creada: "${carpeta.name}" (${carpeta.id}) por ${req.user.sub} (${req.user.tipo_usuario})`);
    res.status(201).json({ data: carpeta });
  } catch (err) {
    console.error('[Folders] Error al crear carpeta:', err.message);
    res.status(500).json({ error: 'Error al crear la carpeta', detalle: err.message });
  }
};

/**
 * GET /folders/:parentId?
 * Lista el contenido de una carpeta.
 * Judicante: solo puede listar dentro de JUDICANTE_FOLDER_ID.
 * Si no se pasa parentId, se devuelve la raíz correspondiente al rol.
 */
const listarContenido = async (req, res) => {
  try {
    const folderRaiz = rootPorRol(req);
    if (esJudicante(req) && !folderRaiz) {
      return res.status(503).json({ error: 'Carpeta de judicantes no configurada' });
    }

    let folderId;
    if (esJudicante(req)) {
      folderId = req.params.parentId || folderRaiz;
    } else {
      folderId = req.params.parentId || env.DRIVE_ROOT_FOLDER_ID;
    }

    if (esJudicante(req) && req.params.parentId) {
      const permitido = await validarAccesoJudicante(req, folderId);
      if (!permitido) {
        return res.status(403).json({ error: 'Acceso denegado' });
      }
    }

    const items = await driveService.listarContenidoCarpeta(folderId);

    console.log(`[Folders] Listado de carpeta ${folderId}: ${items.length} items`);
    res.json({ data: items, folderId });
  } catch (err) {
    console.error('[Folders] Error al listar contenido:', err.message);
    res.status(500).json({ error: 'Error al listar la carpeta', detalle: err.message });
  }
};

module.exports = { crearCarpeta, listarContenido };
