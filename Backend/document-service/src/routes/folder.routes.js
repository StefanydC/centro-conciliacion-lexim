const router = require('express').Router();
const ctrl = require('../controllers/folder.controller');
const { verifyToken } = require('../middlewares/auth.middleware');

// POST /folders  — crear carpeta (admin y judicante; el controller restringe el scope)
router.post('/', verifyToken, ctrl.crearCarpeta);

// GET /folders/:parentId  — listar contenido de una carpeta
router.get('/:parentId', verifyToken, ctrl.listarContenido);

// GET /folders  — listar carpeta raíz
router.get('/', verifyToken, ctrl.listarContenido);

module.exports = router;
