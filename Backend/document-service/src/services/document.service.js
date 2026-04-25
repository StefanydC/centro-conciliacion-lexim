const Document = require('../models/document.model');

async function guardarMetadata({ nombre, driveFileId, mimeType, tamaño, folderId, ruta, subidoPor }) {
  return Document.create({ nombre, driveFileId, mimeType, tamaño, folderId, ruta, subidoPor });
}

async function listarPorCarpeta(folderId) {
  return Document.find({ folderId, activo: true }).sort({ createdAt: -1 });
}

async function obtenerPorDriveId(driveFileId) {
  return Document.findOne({ driveFileId, activo: true });
}

async function marcarEliminado(driveFileId) {
  return Document.findOneAndUpdate(
    { driveFileId },
    { activo: false },
    { new: true }
  );
}

module.exports = { guardarMetadata, listarPorCarpeta, obtenerPorDriveId, marcarEliminado };
