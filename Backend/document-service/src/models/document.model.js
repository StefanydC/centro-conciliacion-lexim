const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema(
  {
    nombre:      { type: String, required: true },
    driveFileId: { type: String, required: true, unique: true },
    mimeType:    { type: String, default: 'application/octet-stream' },
    tamaño:      { type: Number, default: 0 },
    folderId:    { type: String, required: true },
    ruta:        { type: String },
    subidoPor:   { type: String },
    activo:      { type: Boolean, default: true },
  },
  { timestamps: true, collection: 'documentos' }
);

module.exports = mongoose.model('Document', documentSchema);
