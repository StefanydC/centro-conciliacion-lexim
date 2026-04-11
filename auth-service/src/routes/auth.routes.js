const express = require("express");
const authController = require("../controllers/auth.controller");
const { validateRequest } = require("../middlewares/validate.middleware");
const { loginValidator } = require("../validators/auth.validator");

const router = express.Router();

router.post("/login", loginValidator, validateRequest, authController.login);

module.exports = router;