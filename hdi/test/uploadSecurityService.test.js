const test = require("node:test");
const assert = require("node:assert/strict");

const {
  getSanitizedExtension,
  isAllowedFile,
  resolveUploadUrlToAbsolutePath,
  sanitizeOriginalFilename,
} = require("../src/services/uploadSecurityService");

test("sanitizeOriginalFilename remove traversal e caracteres inseguros", () => {
  const sanitized = sanitizeOriginalFilename("..\\..\\evil<script>.pdf");
  assert.equal(sanitized.includes(".."), false);
  assert.equal(sanitized.includes("<"), false);
  assert.match(sanitized, /\.pdf$/);
});

test("resolveUploadUrlToAbsolutePath rejeita caminho fora de /uploads", () => {
  assert.throws(
    () => resolveUploadUrlToAbsolutePath("/../segredo.txt"),
    /invalida|permitida|upload/i,
  );
});

test("isAllowedFile cruza extensao e mimetype", () => {
  const allowed = isAllowedFile(
    { originalname: "relatorio.pdf", mimetype: "application/pdf" },
    {
      allowedExtensions: new Set([".pdf"]),
      allowedMimeTypes: new Set(["application/pdf"]),
    },
  );
  const denied = isAllowedFile(
    { originalname: "shell.sh", mimetype: "text/plain" },
    {
      allowedExtensions: new Set([".pdf"]),
      allowedMimeTypes: new Set(["application/pdf"]),
    },
  );

  assert.equal(allowed, true);
  assert.equal(denied, false);
  assert.equal(getSanitizedExtension("foto.PNG"), ".png");
});
