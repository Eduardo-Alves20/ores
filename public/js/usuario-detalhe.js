(function () {
  "use strict";

  function getCsrfToken() {
    const meta = document.querySelector('meta[name="csrf-token"]');
    return meta ? meta.getAttribute("content") : "";
  }

  function showToast(message, type) {
    const existing = document.querySelector(".ficha-toast");
    if (existing) existing.remove();

    const toast = document.createElement("div");
    toast.className = "ficha-toast ficha-toast-" + (type || "info");
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.classList.add("ficha-toast-visible");
    }, 10);

    setTimeout(() => {
      toast.classList.remove("ficha-toast-visible");
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  function initTabs(root) {
    const tabs = Array.from(root.querySelectorAll("[data-ficha-tab]"));
    const panels = Array.from(root.querySelectorAll("[data-ficha-panel]"));

    function activateTab(key) {
      tabs.forEach((tab) => {
        const isMatch = tab.getAttribute("data-ficha-tab") === key;
        tab.classList.toggle("is-active", isMatch);
        tab.setAttribute("aria-selected", isMatch ? "true" : "false");
      });

      panels.forEach((panel) => {
        const isMatch = panel.getAttribute("data-ficha-panel") === key;
        panel.hidden = !isMatch;
      });
    }

    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        activateTab(tab.getAttribute("data-ficha-tab"));
      });
    });
  }

  function initEditMode(root) {
    const editToggle = root.querySelector("[data-ficha-edit-toggle]");
    const viewMode = root.querySelector("[data-ficha-view]");
    const editMode = root.querySelector("[data-ficha-edit]");
    const cancelBtn = root.querySelector("[data-ficha-cancel-btn]");
    const editForm = root.querySelector("[data-ficha-edit-form]");
    const saveBtn = root.querySelector("[data-ficha-save-btn]");

    if (!editToggle || !viewMode || !editMode) return;

    function enterEdit() {
      viewMode.hidden = true;
      editMode.hidden = false;
      editToggle.setAttribute("aria-pressed", "true");
      editToggle.title = "Cancelar edicao";
    }

    function exitEdit() {
      viewMode.hidden = false;
      editMode.hidden = true;
      editToggle.setAttribute("aria-pressed", "false");
      editToggle.title = "Editar";
    }

    editToggle.addEventListener("click", () => {
      if (editMode.hidden) {
        enterEdit();
      } else {
        exitEdit();
      }
    });

    if (cancelBtn) {
      cancelBtn.addEventListener("click", exitEdit);
    }

    if (editForm) {
      editForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const pageEl = root.closest("[data-ficha-page]") || root;
        const userId = pageEl.getAttribute("data-usuario-id") || "";

        if (!userId) {
          showToast("ID do usuario nao encontrado.", "error");
          return;
        }

        if (saveBtn) saveBtn.disabled = true;

        const formData = new FormData(editForm);
        const body = {};
        formData.forEach((value, key) => {
          body[key] = value;
        });

        try {
          const response = await fetch("/usuarios/" + userId, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              "X-CSRF-Token": getCsrfToken(),
            },
            body: JSON.stringify(body),
          });

          const data = await response.json().catch(() => ({}));

          if (!response.ok) {
            showToast(data?.erro || "Erro ao salvar alteracoes.", "error");
            return;
          }

          showToast("Alteracoes salvas com sucesso.", "success");
          exitEdit();

          setTimeout(() => {
            window.location.reload();
          }, 800);
        } catch (err) {
          showToast("Erro de conexao ao salvar.", "error");
        } finally {
          if (saveBtn) saveBtn.disabled = false;
        }
      });
    }
  }

  function initApproveLevel(root) {
    const levelSelect = root.querySelector("[data-ficha-approve-level]");
    const levelHiddenInputs = Array.from(root.querySelectorAll("[data-ficha-approve-level-hidden]"));
    const approveForm = root.querySelector("[data-ficha-approve-form]");

    if (!levelSelect || !approveForm) return;

    levelSelect.addEventListener("change", () => {
      levelHiddenInputs.forEach((input) => {
        input.value = levelSelect.value;
      });
    });

    approveForm.addEventListener("submit", (event) => {
      if (!levelSelect.value) {
        event.preventDefault();
        showToast("Selecione o nivel do voluntario antes de aprovar.", "error");
        levelSelect.focus();
      }
    });
  }

  function init() {
    const root = document.querySelector("[data-ficha-page]");
    if (!root) return;

    initTabs(root);
    initEditMode(root);
    initApproveLevel(root);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
