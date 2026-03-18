(function () {
  const root = document.querySelector(".page-acessos");
  if (!root) return;

  const shared = window.AlentoAcessosShared;
  if (
    !shared ||
    typeof shared.createPageHelpers !== "function" ||
    typeof shared.requestJson !== "function" ||
    typeof window.initAcessosUserModal !== "function" ||
    typeof window.initAcessosApprovalModal !== "function"
  ) {
    return;
  }

  const { requestJson, createPageHelpers } = shared;
  const { closeAllMenus, syncBodyModalState } = createPageHelpers(root);

  const userModal = window.initAcessosUserModal({
    root,
    requestJson,
    closeAllMenus,
    syncBodyModalState,
  });
  const approvalModal = window.initAcessosApprovalModal({
    root,
    requestJson,
    syncBodyModalState,
  });

  const openEditModal = userModal?.openEditModal || (() => {});
  const openApprovalModal = approvalModal?.openApprovalModal || (() => {});

  root.addEventListener("click", (event) => {
    const editBtn = event.target.closest("[data-action='edit-user']");
    if (editBtn) {
      event.preventDefault();
      event.stopPropagation();
      closeAllMenus();
      openEditModal(String(editBtn.getAttribute("data-user-id") || "").trim());
      return;
    }

    const approvalBtn = event.target.closest("[data-approval-open]");
    if (approvalBtn) {
      event.preventDefault();
      event.stopPropagation();
      closeAllMenus();
      openApprovalModal(String(approvalBtn.getAttribute("data-user-id") || "").trim());
      return;
    }

    const row = event.target.closest("[data-user-row-open]");
    if (row) {
      if (event.target.closest("button, a, form, input, select, textarea, label")) return;
      event.preventDefault();
      event.stopPropagation();
      closeAllMenus();
      openEditModal(String(row.getAttribute("data-user-row-open") || "").trim());
      return;
    }

    const toggleBtn = event.target.closest("[data-action='menu-toggle']");
    if (!toggleBtn) return;

    event.preventDefault();
    event.stopPropagation();

    const menu = toggleBtn.closest(".acesso-actions-menu");
    if (!menu) return;

    const willOpen = !menu.classList.contains("is-open");
    closeAllMenus(menu);
    menu.classList.toggle("is-open", willOpen);
    toggleBtn.setAttribute("aria-expanded", String(willOpen));
  });

  document.addEventListener("click", (event) => {
    if (event.target.closest(".acesso-actions-menu")) return;
    closeAllMenus();
  });

  document.addEventListener("keydown", (event) => {
    const row = event.target.closest?.("[data-user-row-open]");
    if (row && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      closeAllMenus();
      openEditModal(String(row.getAttribute("data-user-row-open") || "").trim());
      return;
    }

    if (event.key !== "Escape") return;
    closeAllMenus();
  });
})();
