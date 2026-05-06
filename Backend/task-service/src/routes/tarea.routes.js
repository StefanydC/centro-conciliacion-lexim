// ARCHIVO: backend/task-service/src/routes/tarea.routes.js
const router = require("express").Router();
const ctrl   = require("../controllers/tarea.controller");
const { verifyToken } = require("../middlewares/auth.middleware");

router.get("/",      verifyToken, ctrl.listar);
router.get("/:id",   verifyToken, ctrl.obtenerPorId);
router.post("/",     verifyToken, ctrl.crear);
router.patch("/:id", verifyToken, ctrl.actualizar);
router.delete("/:id",verifyToken, ctrl.eliminar);

module.exports = router;
