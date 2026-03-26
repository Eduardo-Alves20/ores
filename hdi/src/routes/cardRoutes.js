const express = require("express");
const { uploadAttachment } = require("../config/multerMaches");
const router = express.Router();
const cardController = require("./../controllers/cardController");
const checkPermission = require("../middlewares/checkRole");

router.post(
  "/card/:cardId/attachment",
  checkPermission("editor"),
  uploadAttachment.single("file"),
  cardController.uploadAttachment,
);

router.post(
  "/card/:cardId/attachment/:filename",
  checkPermission("editor"),
  cardController.deleteAttachment,
);

module.exports = router;
