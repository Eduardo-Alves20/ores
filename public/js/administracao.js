(function () {
  const root = document.querySelector("[data-page='administracao']");
  if (!root) return;

  const shared = window.AlentoAdministracaoShared;
  if (
    !shared ||
    typeof shared.parseJsonScript !== "function" ||
    typeof shared.requestJson !== "function" ||
    typeof shared.confirmAction !== "function" ||
    typeof shared.notifyError !== "function" ||
    typeof shared.reloadSoon !== "function" ||
    typeof shared.parsePayloadAttribute !== "function" ||
    typeof window.initAdministracaoForms !== "function" ||
    typeof window.initAdministracaoActions !== "function"
  ) {
    return;
  }

  const initial = shared.parseJsonScript("administracao-initial", {});
  const forms = window.initAdministracaoForms({ root, initial });

  window.initAdministracaoActions({
    root,
    confirmAction: shared.confirmAction,
    notifyError: shared.notifyError,
    parsePayloadAttribute: shared.parsePayloadAttribute,
    reloadSoon: shared.reloadSoon,
    requestJson: shared.requestJson,
    forms,
  });
})();
