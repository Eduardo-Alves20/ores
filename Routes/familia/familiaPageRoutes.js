const express = require("express");
const multer = require("multer");
const FamiliaPageController = require("../../Controllers/familia/FamiliaPageController");
const { requirePermission } = require("../../middlewares/authSession");
const { PERMISSIONS } = require("../../config/permissions");

const router = express.Router();
const familyFormUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 30,
    fileSize: 10 * 1024 * 1024,
    fields: 8000,
    fieldSize: 5 * 1024 * 1024,
  },
});

function handleFamilyFormUpload(req, res, next) {
  const contentType = String(req.headers["content-type"] || "").toLowerCase();
  if (!contentType.includes("multipart/form-data")) {
    return next();
  }

  return familyFormUpload.any()(req, res, (error) => {
    if (!error) return next();

    if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
      req.flash("error", "Um dos anexos excede o limite de 10MB.");
      return res.redirect(req.originalUrl || "/familias");
    }

    if (error instanceof multer.MulterError) {
      req.flash("error", "Falha ao receber anexos do formulario.");
      return res.redirect(req.originalUrl || "/familias");
    }

    req.flash("error", error?.message || "Falha ao receber anexos do formulario.");
    return res.redirect(req.originalUrl || "/familias");
  });
}

router.get("/", FamiliaPageController.listar);
router.get("/nova", requirePermission(PERMISSIONS.FAMILIAS_CREATE), FamiliaPageController.novo);
router.post(
  "/nova",
  requirePermission(PERMISSIONS.FAMILIAS_CREATE),
  handleFamilyFormUpload,
  FamiliaPageController.criarViaFormulario
);
router.get("/:id/editar", requirePermission(PERMISSIONS.FAMILIAS_UPDATE), FamiliaPageController.editar);
router.post(
  "/:id/editar",
  requirePermission(PERMISSIONS.FAMILIAS_UPDATE),
  handleFamilyFormUpload,
  FamiliaPageController.atualizarViaFormulario
);
router.get("/:id", FamiliaPageController.detalhar);

module.exports = router;
