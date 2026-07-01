const router = require('express').Router();
const multer = require('multer');
const ctrl = require('../controllers/file.controller');
const { verifyToken } = require('../middlewares/auth.middleware');

// Almacenamiento en memoria (buffer), límite de 200MB por archivo
// (debe coincidir con client_max_body_size de Nginx)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 * 1024 },
});

// POST /upload  — subir archivo (admin y judicante)
router.post('/upload', verifyToken, upload.array('file', 10), ctrl.subirArchivo);

// GET /files/:folderId  — listar archivos en una carpeta
router.get('/files/:folderId', verifyToken, ctrl.listarArchivos);

// GET /files  — listar archivos en carpeta raíz
router.get('/files', verifyToken, ctrl.listarArchivos);

// GET /file/:id  — obtener metadata + links del archivo
//                  Añadir ?download=true para descarga directa (stream)
router.get('/file/:id', verifyToken, ctrl.obtenerArchivo);

// DELETE /file/:id  — eliminar archivo (admin o judicante en su espacio)
router.delete('/file/:id', verifyToken, ctrl.eliminarArchivo);

// PATCH /file/:id  — renombrar archivo (admin o judicante en su espacio)
router.patch('/file/:id', verifyToken, ctrl.renombrarArchivo);

// PUT /file/:id/move  — mover archivo a otra carpeta (admin o judicante en su espacio)
router.put('/file/:id/move', verifyToken, ctrl.moverArchivo);
// Manejo específico de errores de Multer (ej. archivo demasiado grande)
router.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'El archivo supera el límite de 200MB' });
  }
  next(err);
});

module.exports = router;
