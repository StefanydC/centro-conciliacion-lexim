// ARCHIVO: backend/finance-service/src/routes/finanza.routes.js
const router = require("express").Router();
const ctrl = require("../controllers/finanza.controller");
const { verifyToken, requireAdmin } = require("../middlewares/auth.middleware");

// Resumen y gráfica primero para evitar colisión con /:id
router.get("/resumen", verifyToken, ctrl.resumen);
router.get("/grafica",  verifyToken, ctrl.grafica);

router.get("/",     verifyToken, ctrl.listar);
router.get("/:id",  verifyToken, ctrl.obtenerPorId);
router.post("/",    verifyToken, ctrl.crear);
router.put("/:id",  verifyToken, ctrl.actualizar);
router.delete("/:id", verifyToken, ctrl.eliminar);

module.exports = router;
