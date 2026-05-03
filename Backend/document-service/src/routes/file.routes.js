const router = require('express').Router();
const multer = require('multer');
const ctrl = require('../controllers/file.controller');
const { verifyToken } = require('../middlewares/auth.middleware');

// Almacenamiento en memoria (buffer), sin límite de tamaño
const upload = multer({ storage: multer.memoryStorage() });

// POST /upload  — subir archivo (admin y judicante)
router.post('/upload', verifyToken, upload.single('file'), ctrl.subirArchivo);

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

module.exports = router;
