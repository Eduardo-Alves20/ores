const express = require("express");
const router = express.Router();
const authController = require("./../controllers/authController");

router.get("/login", authController.loginPage);
router.post("/login", authController.login);
router.post("/bridge/sso", authController.bridgeLogin);
router.get("/register", authController.registerPage);
router.post("/register", authController.register);
router.post("/logout", authController.logout);

module.exports = router;
