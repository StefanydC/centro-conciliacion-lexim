const router = require('express').Router();
const ctrl = require('../controllers/finanzas.controller');
const { verifyToken } = require('../middlewares/auth.middleware');
const { requireAdmin } = require('../middlewares/role.middleware');

// GET /finanzas/resumen — debe estar antes de /:id
router.get('/resumen', verifyToken, ctrl.resumen);

// GET /finanzas/grafica — debe estar antes de /:id
router.get('/grafica', verifyToken, ctrl.grafica);

// GET /finanzas?tipo=ingreso|egreso — listar registros
router.get('/', verifyToken, ctrl.listar);

// POST /finanzas — crear registro (solo admin)
router.post('/', verifyToken, requireAdmin, ctrl.crear);

// DELETE /finanzas/:id — eliminar registro (solo admin)
router.delete('/:id', verifyToken, requireAdmin, ctrl.eliminar);

module.exports = router;
