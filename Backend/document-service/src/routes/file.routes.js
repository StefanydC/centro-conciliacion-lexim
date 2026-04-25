const router = require('express').Router();
const multer = require('multer');
const ctrl = require('../controllers/file.controller');
const { verifyToken } = require('../middlewares/auth.middleware');
const { requireAdmin } = require('../middlewares/role.middleware');

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

// DELETE /file/:id  — eliminar archivo (solo admin)
router.delete('/file/:id', verifyToken, requireAdmin, ctrl.eliminarArchivo);

// PATCH /file/:id  — renombrar archivo (solo admin)
router.patch('/file/:id', verifyToken, requireAdmin, ctrl.renombrarArchivo);

module.exports = router;
