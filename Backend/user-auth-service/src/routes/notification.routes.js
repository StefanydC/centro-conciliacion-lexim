const router = require("express").Router();
const ctrl = require("../controllers/notification.controller");
const { verifyToken } = require("../middlewares/auth.middleware");

router.get("/", verifyToken, ctrl.listar);
router.patch("/read-all", verifyToken, ctrl.marcarTodasLeidas);
router.patch("/:id/read", verifyToken, ctrl.marcarLeida);

module.exports = router;