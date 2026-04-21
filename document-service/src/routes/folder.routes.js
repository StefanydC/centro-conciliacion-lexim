const router = require('express').Router();
const ctrl = require('../controllers/folder.controller');
const { verifyToken } = require('../middlewares/auth.middleware');
const { requireAdmin } = require('../middlewares/role.middleware');

// POST /folders  — crear carpeta (solo admin)
router.post('/', verifyToken, requireAdmin, ctrl.crearCarpeta);

// GET /folders/:parentId  — listar contenido de una carpeta
router.get('/:parentId', verifyToken, ctrl.listarContenido);

// GET /folders  — listar carpeta raíz
router.get('/', verifyToken, ctrl.listarContenido);

module.exports = router;
