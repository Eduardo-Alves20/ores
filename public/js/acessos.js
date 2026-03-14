(function () {
  const root = document.querySelector(".page-acessos");
  if (!root) return;

  async function requestJson(url, options = {}) {
    const response = await fetch(url, {
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
      ...options,
    });

    let payload = null;
    try {
      payload = await response.json();
    } catch (_) {
      payload = null;
    }

    if (!response.ok) {
      const message = payload?.erro || payload?.message || "Erro ao processar a requisicao.";
      throw new Error(message);
    }

    return payload;
  }

  function closeAllMenus(exceptMenu) {
    root.querySelectorAll(".acesso-actions-menu.is-open").forEach((menu) => {
      if (exceptMenu && menu === exceptMenu) return;
      menu.classList.remove("is-open");
      const trigger = menu.querySelector("[data-action='menu-toggle']");
      if (trigger) trigger.setAttribute("aria-expanded", "false");
    });
  }

  root.addEventListener("click", (event) => {
    const editBtn = event.target.closest("[data-action='edit-user']");
    if (editBtn) {
      event.preventDefault();
      event.stopPropagation();
      closeAllMenus();
      openEditModal(String(editBtn.getAttribute("data-user-id") || "").trim());
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
    if (event.key !== "Escape") return;
    closeAllMenus();
  });

  const createBtn = root.querySelector("[data-create-user-open]");
  const modal = root.querySelector("[data-create-user-modal]");
  if (!createBtn || !modal) return;

  const form = modal.querySelector("[data-create-user-form]");
  const errorBox = modal.querySelector("[data-create-user-error]");
  const closeButtons = modal.querySelectorAll("[data-create-user-close]");
  const statusWrap = modal.querySelector("[data-create-user-status-wrap]");
  const hint = modal.querySelector("[data-create-user-hint]");
  const titleEl = modal.querySelector("[data-user-modal-title]");
  const descriptionEl = modal.querySelector("[data-user-modal-description]");
  const passwordHintEl = modal.querySelector("[data-user-password-hint]");
  const submitButton = modal.querySelector("[data-user-modal-submit]");
  const defaultTipoCadastro = String(root.dataset.defaultTipoCadastro || "voluntario").trim().toLowerCase();

  let isSubmitting = false;
  let currentMode = "create";
  let editingUserId = null;

  function showError(message) {
    if (!errorBox) return;
    const text = String(message || "").trim();
    if (!text) {
      errorBox.hidden = true;
      errorBox.textContent = "";
      return;
    }
    errorBox.hidden = false;
    errorBox.textContent = text;
  }

  function setModalTexts(mode) {
    const isEdit = mode === "edit";

    if (titleEl) {
      titleEl.textContent = isEdit ? "Editar usuario" : "Criar novo usuario";
    }

    if (descriptionEl) {
      descriptionEl.textContent = isEdit
        ? "Atualize os dados do acesso selecionado. A senha so muda se voce preencher os campos abaixo."
        : "Preencha os dados abaixo para liberar um novo acesso manualmente.";
    }

    if (passwordHintEl) {
      passwordHintEl.textContent = isEdit
        ? "Senha opcional na edicao. Deixe em branco para manter a senha atual."
        : "Defina uma senha inicial para esse acesso.";
    }

    if (submitButton) {
      submitButton.textContent = isEdit ? "Salvar alteracoes" : "Salvar usuario";
    }

    if (form?.elements?.senha) {
      form.elements.senha.required = !isEdit;
    }

    if (form?.elements?.confirmarSenha) {
      form.elements.confirmarSenha.required = !isEdit;
    }
  }

  function applyProfileRules() {
    if (!form) return;

    const perfil = String(form.elements.perfil?.value || "usuario").trim().toLowerCase();
    const isPortalUser = perfil === "usuario";

    if (statusWrap) {
      statusWrap.hidden = !isPortalUser;
    }

    if (!isPortalUser && form.elements.statusAprovacao) {
      form.elements.statusAprovacao.value = "aprovado";
    }

    if (hint) {
      hint.textContent = isPortalUser
        ? "Para usuario do portal, voce pode escolher se o cadastro nasce aprovado, pendente ou rejeitado."
        : "Perfis internos sao aprovados automaticamente. Se criar ou editar admin, atendente ou tecnico, ele pode nao aparecer nesta listagem filtrada.";
    }
  }

  function resetForm() {
    if (!form) return;
    form.reset();
    if (form.elements.tipoCadastro) {
      form.elements.tipoCadastro.value = defaultTipoCadastro;
    }
    if (form.elements.perfil) {
      form.elements.perfil.value = "usuario";
    }
    if (form.elements.statusAprovacao) {
      form.elements.statusAprovacao.value = "aprovado";
    }
    if (form.elements.ativo) {
      form.elements.ativo.value = "true";
    }
    showError("");
    applyProfileRules();
  }

  function openModal() {
    modal.hidden = false;
    document.body.classList.add("acessos-modal-open");
    window.setTimeout(() => {
      form?.elements?.nome?.focus();
    }, 30);
  }

  function closeModal(force = false) {
    if (isSubmitting && !force) return;
    modal.hidden = true;
    document.body.classList.remove("acessos-modal-open");
    showError("");
  }

  function openCreateModal() {
    currentMode = "create";
    editingUserId = null;
    closeAllMenus();
    resetForm();
    setModalTexts("create");
    openModal();
  }

  async function openEditModal(userId) {
    if (!userId) return;
    currentMode = "edit";
    editingUserId = userId;
    resetForm();
    setModalTexts("edit");
    showError("");

    try {
      const usuario = await requestJson(`/usuarios/${userId}`);

      form.elements.nome.value = usuario?.nome || "";
      form.elements.email.value = usuario?.email || "";
      form.elements.login.value = usuario?.login || "";
      form.elements.cpf.value = usuario?.cpf || "";
      form.elements.telefone.value = usuario?.telefone || "";
      form.elements.perfil.value = usuario?.perfil || "usuario";
      form.elements.tipoCadastro.value = usuario?.tipoCadastro || defaultTipoCadastro;
      form.elements.statusAprovacao.value = usuario?.statusAprovacao || "aprovado";
      form.elements.ativo.value = String(
        typeof usuario?.ativo === "boolean" ? usuario.ativo : true
      );
      form.elements.senha.value = "";
      form.elements.confirmarSenha.value = "";

      applyProfileRules();
      openModal();
    } catch (error) {
      window.appNotifyError?.(error?.message || "Erro ao carregar usuario para edicao.");
    }
  }

  createBtn.addEventListener("click", openCreateModal);

  closeButtons.forEach((button) => {
    button.addEventListener("click", () => closeModal());
  });

  modal.addEventListener("click", (event) => {
    if (event.target === modal.querySelector(".acessos-modal-backdrop")) {
      closeModal(true);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !modal.hidden) {
      closeModal();
    }
  });

  form.elements.perfil?.addEventListener("change", applyProfileRules);
  setModalTexts("create");
  applyProfileRules();

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (isSubmitting) return;

    const senha = String(form.elements.senha?.value || "");
    const confirmarSenha = String(form.elements.confirmarSenha?.value || "");
    const wantsPasswordChange = currentMode === "create" || senha.length > 0 || confirmarSenha.length > 0;

    if (wantsPasswordChange && senha !== confirmarSenha) {
      showError("As senhas informadas nao conferem.");
      return;
    }

    const payload = {
      nome: String(form.elements.nome?.value || "").trim(),
      email: String(form.elements.email?.value || "").trim(),
      login: String(form.elements.login?.value || "").trim(),
      cpf: String(form.elements.cpf?.value || "").trim(),
      telefone: String(form.elements.telefone?.value || "").trim(),
      perfil: String(form.elements.perfil?.value || "usuario").trim(),
      tipoCadastro: String(form.elements.tipoCadastro?.value || defaultTipoCadastro).trim(),
      statusAprovacao: String(form.elements.statusAprovacao?.value || "aprovado").trim(),
      ativo: String(form.elements.ativo?.value || "true").trim() === "true",
    };

    if (String(payload.perfil || "").toLowerCase() !== "usuario") {
      payload.statusAprovacao = "aprovado";
    }

    if (currentMode === "create") {
      payload.senha = senha;
    }

    isSubmitting = true;
    showError("");

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = currentMode === "edit" ? "Salvando..." : "Criando...";
    }

    try {
      if (currentMode === "edit" && editingUserId) {
        await requestJson(`/usuarios/${editingUserId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });

        if (wantsPasswordChange && senha) {
          await requestJson(`/usuarios/${editingUserId}/senha`, {
            method: "PATCH",
            body: JSON.stringify({ senha }),
          });
        }

        closeModal(true);
        await window.appNotifySuccess("Usuario atualizado com sucesso. A lista sera recarregada.");
        window.location.reload();
        return;
      }

      const result = await requestJson("/usuarios", {
        method: "POST",
        body: JSON.stringify({ ...payload, senha }),
      });

      const createdPerfil = String(result?.usuario?.perfil || payload.perfil).trim().toLowerCase();
      closeModal(true);

      if (createdPerfil === "usuario" || payload.tipoCadastro === defaultTipoCadastro) {
        await window.appNotifySuccess("Usuario criado com sucesso. A lista sera atualizada agora.");
        window.location.reload();
        return;
      }

      await window.appNotifySuccess("Usuario criado com sucesso.");
    } catch (error) {
      showError(error?.message || "Erro ao salvar usuario.");
      window.appNotifyError?.(error?.message || "Erro ao salvar usuario.");
    } finally {
      isSubmitting = false;
      setModalTexts(currentMode);
      if (submitButton) {
        submitButton.disabled = false;
      }
    }
  });
})();
