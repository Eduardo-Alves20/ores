const express = require("express");
const multer = require("multer");
const FamiliaController = require("../../Controllers/familia/FamiliaController");
const { requirePermission } = require("../../middlewares/authSession");
const { PERMISSIONS } = require("../../config/permissions");

const router = express.Router();
const familyUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 30,
    fileSize: 10 * 1024 * 1024,
  },
});

function handleFamilyAttachmentUpload(req, res, next) {
  familyUpload.any()(req, res, (error) => {
    if (!error) return next();

    if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        erro: "Um dos anexos excede o limite de 10MB.",
      });
    }

    if (error instanceof multer.MulterError) {
      return res.status(400).json({
        erro: "Falha ao receber os anexos.",
      });
    }

    return res.status(400).json({
      erro: error?.message || "Falha ao receber os anexos.",
    });
  });
}

router.get("/", requirePermission(PERMISSIONS.FAMILIAS_VIEW), FamiliaController.listar);
router.get("/:id", requirePermission(PERMISSIONS.FAMILIAS_VIEW), FamiliaController.detalhar);

router.post(
  "/",
  requirePermission(PERMISSIONS.FAMILIAS_CREATE),
  FamiliaController.criar
);

router.put(
  "/:id",
  requirePermission(PERMISSIONS.FAMILIAS_UPDATE),
  FamiliaController.atualizar
);

router.post(
  "/:id/anexos",
  requirePermission(PERMISSIONS.FAMILIAS_UPDATE),
  handleFamilyAttachmentUpload,
  FamiliaController.uploadAnexos
);

router.get(
  "/:id/anexos/:attachmentId",
  requirePermission(PERMISSIONS.FAMILIAS_VIEW),
  FamiliaController.visualizarAnexo
);

router.patch(
  "/:id/status",
  requirePermission(PERMISSIONS.FAMILIAS_STATUS),
  FamiliaController.alterarStatus
);

module.exports = router;
