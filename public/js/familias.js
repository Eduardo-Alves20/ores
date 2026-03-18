(function () {
  const root = document.querySelector("[data-page]");
  if (!root) return;

  const page = String(root.getAttribute("data-page") || "").trim();
  const registry = {
    "familias-lista": window.FamiliasListaPage,
    "familias-form": window.FamiliasFormPage,
    "familia-detalhe": window.FamiliaDetalhePage,
  };

  const module = registry[page];
  if (!module || typeof module.init !== "function") return;
  module.init(root);
})();
