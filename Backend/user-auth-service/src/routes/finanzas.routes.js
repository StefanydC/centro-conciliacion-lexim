const router = require("express").Router();
const ctrl = require("../controllers/finanzas.controller");
const { verifyToken } = require("../middlewares/auth.middleware");
const { requireAdmin } = require("../middlewares/role.middleware");

router.get("/resumen", verifyToken, ctrl.resumen);
router.get("/grafica", verifyToken, ctrl.grafica);
router.get("/", verifyToken, ctrl.listar);
router.post("/", verifyToken, requireAdmin, ctrl.crear);
router.delete("/:id", verifyToken, requireAdmin, ctrl.eliminar);

module.exports = router;