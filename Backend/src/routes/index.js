const express = require("express");
const { health } = require("../controllers/health.controller");
const { getMyProfile } = require("../controllers/profile.controller");
const { authenticate } = require("../middlewares/auth.middleware");

const router = express.Router();

router.get("/health", health);
router.get("/profile", authenticate, getMyProfile);

module.exports = router;
