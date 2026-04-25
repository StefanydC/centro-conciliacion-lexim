const router = require("express").Router();
const ctrl = require("../controllers/task.controller");
const { verifyToken } = require("../middlewares/auth.middleware");

router.get("/judicantes",   verifyToken, ctrl.listarJudicantes);
router.get("/",             verifyToken, ctrl.listar);
router.post("/",            verifyToken, ctrl.crear);
router.patch("/:id/estado", verifyToken, ctrl.actualizarEstado);

module.exports = router;