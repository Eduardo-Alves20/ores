(function () {
  window.initAcessosUserModal = function initAcessosUserModal({
    root,
    requestJson,
    closeAllMenus,
    syncBodyModalState,
  }) {
    const createBtn = root.querySelector("[data-create-user-open]");
    const modal = root.querySelector("[data-create-user-modal]");
    if (!createBtn || !modal) {
      return {
        openEditModal: async () => {},
      };
    }

    const form = modal.querySelector("[data-create-user-form]");
    const errorBox = modal.querySelector("[data-create-user-error]");
    const closeButtons = modal.querySelectorAll("[data-create-user-close]");
    const statusWrap = modal.querySelector("[data-create-user-status-wrap]");
    const accessWrap = modal.querySelector("[data-create-user-access-wrap]");
    const approvalRoleWrap = modal.querySelector("[data-create-user-approval-role-wrap]");
    const hint = modal.querySelector("[data-create-user-hint]");
    const titleEl = modal.querySelector("[data-user-modal-title]");
    const descriptionEl = modal.querySelector("[data-user-modal-description]");
    const passwordHintEl = modal.querySelector("[data-user-password-hint]");
    const passwordFields = Array.from(modal.querySelectorAll("[data-user-password-field]"));
    const passwordResetWrap = modal.querySelector("[data-user-password-reset-wrap]");
    const passwordResetOpenButton = modal.querySelector("[data-user-password-reset-open]");
    const submitButton = modal.querySelector("[data-user-modal-submit]");
    const customFieldInputs = Array.from(modal.querySelectorAll("[data-user-custom-field]"));
    const defaultTipoCadastro = String(root.dataset.defaultTipoCadastro || "voluntario")
      .trim()
      .toLowerCase();

    let isSubmitting = false;
    let currentMode = "create";
    let editingUserId = null;
    let editingUserName = "";

    const resetPasswordModal = root.querySelector("[data-reset-password-modal]");
    const resetPasswordForm = resetPasswordModal?.querySelector("[data-reset-password-form]") || null;
    const resetPasswordError = resetPasswordModal?.querySelector("[data-reset-password-error]") || null;
    const resetPasswordDescription =
      resetPasswordModal?.querySelector("[data-reset-password-description]") || null;
    const resetPasswordCloseButtons =
      resetPasswordModal?.querySelectorAll("[data-reset-password-close]") || [];
    const resetPasswordSubmit = resetPasswordModal?.querySelector("[data-reset-password-submit]") || null;
    let isResettingPassword = false;

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
          ? "Atualize os dados do acesso selecionado. Se precisar trocar a senha, use o botao de redefinicao com motivo de auditoria."
          : "Preencha os dados abaixo para liberar um novo acesso manualmente.";
      }

      if (passwordHintEl) {
        passwordHintEl.textContent = isEdit
          ? "A senha nao e alterada nesta edicao. Use o fluxo de redefinicao quando precisar trocar o acesso."
          : "Defina uma senha inicial para esse acesso.";
      }

      if (submitButton) {
        submitButton.textContent = isEdit ? "Salvar alteracoes" : "Salvar usuario";
      }

      passwordFields.forEach((field) => {
        field.hidden = isEdit;
      });

      if (passwordResetWrap) {
        passwordResetWrap.hidden = !isEdit;
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
      const tipoCadastro = String(form.elements.tipoCadastro?.value || defaultTipoCadastro)
        .trim()
        .toLowerCase();
      const isPortalUser = perfil === "usuario";
      const showAccessLevel = isPortalUser && tipoCadastro === "voluntario";
      const showApprovalRole = ["admin", "superadmin"].includes(perfil);

      if (statusWrap) {
        statusWrap.hidden = !isPortalUser;
      }

      if (accessWrap) {
        accessWrap.hidden = !showAccessLevel;
      }

      if (approvalRoleWrap) {
        approvalRoleWrap.hidden = !showApprovalRole;
      }

      if (!isPortalUser && form.elements.statusAprovacao) {
        form.elements.statusAprovacao.value = "aprovado";
      }

      if (!showAccessLevel && form.elements.nivelAcessoVoluntario) {
        form.elements.nivelAcessoVoluntario.value = "";
      }

      if (!showApprovalRole && form.elements.papelAprovacao) {
        form.elements.papelAprovacao.value = "membro";
      }

      if (hint) {
        hint.textContent = isPortalUser
          ? "Para usuario do portal, voce pode escolher se o cadastro nasce aprovado, pendente ou rejeitado."
          : "Perfis internos sao aprovados automaticamente. Se criar ou editar admin_alento, atendente ou tecnico, ele pode nao aparecer nesta listagem filtrada.";
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
      if (form.elements.papelAprovacao) {
        form.elements.papelAprovacao.value = "membro";
      }
      if (form.elements.ativo) {
        form.elements.ativo.value = "true";
      }
      if (form.elements.nivelAcessoVoluntario) {
        form.elements.nivelAcessoVoluntario.value = "";
      }
      customFieldInputs.forEach((field) => {
        const type = String(field.getAttribute("data-user-custom-type") || "texto").trim();
        if (type === "booleano") {
          field.value = "false";
          return;
        }
        field.value = "";
      });
      showError("");
      applyProfileRules();
    }

    function collectCustomFieldPayload() {
      const camposExtras = {};
      customFieldInputs.forEach((field) => {
        const key = String(field.getAttribute("data-user-custom-field") || "").trim();
        const type = String(field.getAttribute("data-user-custom-type") || "texto").trim();
        if (!key) return;
        if (type === "booleano") {
          camposExtras[key] = String(field.value || "").trim() === "true";
          return;
        }
        camposExtras[key] = String(field.value || "").trim();
      });
      return camposExtras;
    }

    function populateCustomFields(values = {}) {
      customFieldInputs.forEach((field) => {
        const key = String(field.getAttribute("data-user-custom-field") || "").trim();
        const type = String(field.getAttribute("data-user-custom-type") || "texto").trim();
        if (!key) return;
        const value = values?.[key];
        if (type === "booleano") {
          field.value = value === true ? "true" : "false";
          return;
        }
        field.value = typeof value === "undefined" || value === null ? "" : String(value);
      });
    }

    function showResetPasswordError(message) {
      if (!resetPasswordError) return;
      const text = String(message || "").trim();
      if (!text) {
        resetPasswordError.hidden = true;
        resetPasswordError.textContent = "";
        return;
      }
      resetPasswordError.hidden = false;
      resetPasswordError.textContent = text;
    }

    function closeResetPasswordModal(force = false) {
      if (!resetPasswordModal) return;
      if (isResettingPassword && !force) return;
      resetPasswordModal.hidden = true;
      if (resetPasswordForm) {
        resetPasswordForm.reset();
      }
      showResetPasswordError("");
      syncBodyModalState();
    }

    function openResetPasswordModal() {
      if (!resetPasswordModal || !editingUserId || currentMode !== "edit") return;
      if (resetPasswordForm) {
        resetPasswordForm.reset();
      }
      if (resetPasswordDescription) {
        resetPasswordDescription.textContent = editingUserName
          ? `Defina a nova senha de ${editingUserName} e registre o motivo para auditoria.`
          : "Defina a nova senha e registre o motivo para auditoria.";
      }
      showResetPasswordError("");
      resetPasswordModal.hidden = false;
      syncBodyModalState();
      window.setTimeout(() => {
        resetPasswordForm?.elements?.senha?.focus();
      }, 30);
    }

    function openCreateUserModal() {
      modal.hidden = false;
      syncBodyModalState();
      window.setTimeout(() => {
        form?.elements?.nome?.focus();
      }, 30);
    }

    function closeCreateUserModal(force = false) {
      if (isSubmitting && !force) return;
      modal.hidden = true;
      closeResetPasswordModal(true);
      syncBodyModalState();
      showError("");
    }

    function openCreateModal() {
      currentMode = "create";
      editingUserId = null;
      editingUserName = "";
      closeAllMenus();
      resetForm();
      setModalTexts("create");
      openCreateUserModal();
    }

    async function openEditModal(userId) {
      if (!userId) return;
      currentMode = "edit";
      editingUserId = userId;
      editingUserName = "";
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
        if (form.elements.papelAprovacao) {
          form.elements.papelAprovacao.value = usuario?.papelAprovacao || "membro";
        }
        if (form.elements.nivelAcessoVoluntario) {
          form.elements.nivelAcessoVoluntario.value = usuario?.nivelAcessoVoluntario || "";
        }
        form.elements.statusAprovacao.value = usuario?.statusAprovacao || "aprovado";
        form.elements.ativo.value = String(
          typeof usuario?.ativo === "boolean" ? usuario.ativo : true
        );
        populateCustomFields(usuario?.camposExtras || {});
        editingUserName = String(usuario?.nome || "").trim();
        form.elements.senha.value = "";
        form.elements.confirmarSenha.value = "";

        applyProfileRules();
        openCreateUserModal();
      } catch (error) {
        window.appNotifyError?.(error?.message || "Erro ao carregar usuario para edicao.");
      }
    }

    createBtn.addEventListener("click", openCreateModal);

    closeButtons.forEach((button) => {
      button.addEventListener("click", () => closeCreateUserModal());
    });

    modal.addEventListener("click", (event) => {
      if (event.target === modal.querySelector(".acessos-modal-backdrop")) {
        closeCreateUserModal(true);
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !modal.hidden) {
        if (resetPasswordModal && !resetPasswordModal.hidden) {
          closeResetPasswordModal();
          return;
        }
        closeCreateUserModal();
      }
    });

    if (passwordResetOpenButton) {
      passwordResetOpenButton.addEventListener("click", () => {
        openResetPasswordModal();
      });
    }

    resetPasswordCloseButtons.forEach((button) => {
      button.addEventListener("click", () => closeResetPasswordModal());
    });

    resetPasswordModal?.addEventListener("click", (event) => {
      if (event.target === resetPasswordModal.querySelector(".acessos-modal-backdrop")) {
        closeResetPasswordModal(true);
      }
    });

    form.elements.perfil?.addEventListener("change", applyProfileRules);
    form.elements.tipoCadastro?.addEventListener("change", applyProfileRules);
    setModalTexts("create");
    applyProfileRules();

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (isSubmitting) return;

      const senha = String(form.elements.senha?.value || "");
      const confirmarSenha = String(form.elements.confirmarSenha?.value || "");
      const wantsPasswordChange =
        currentMode === "create" || senha.length > 0 || confirmarSenha.length > 0;

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
        papelAprovacao: String(form.elements.papelAprovacao?.value || "membro").trim(),
        nivelAcessoVoluntario: String(form.elements.nivelAcessoVoluntario?.value || "").trim(),
        statusAprovacao: String(form.elements.statusAprovacao?.value || "aprovado").trim(),
        ativo: String(form.elements.ativo?.value || "true").trim() === "true",
        camposExtras: collectCustomFieldPayload(),
      };

      if (String(payload.perfil || "").toLowerCase() !== "usuario") {
        payload.statusAprovacao = "aprovado";
      }

      if (String(payload.tipoCadastro || "").toLowerCase() !== "voluntario") {
        payload.nivelAcessoVoluntario = "";
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

          closeCreateUserModal(true);
          await window.appNotifySuccess(
            "Usuario atualizado com sucesso. A lista sera recarregada."
          );
          window.location.reload();
          return;
        }

        const result = await requestJson("/usuarios", {
          method: "POST",
          body: JSON.stringify({ ...payload, senha }),
        });

        const createdPerfil = String(result?.usuario?.perfil || payload.perfil)
          .trim()
          .toLowerCase();
        closeCreateUserModal(true);

        if (createdPerfil === "usuario" || payload.tipoCadastro === defaultTipoCadastro) {
          await window.appNotifySuccess(
            "Usuario criado com sucesso. A lista sera atualizada agora."
          );
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

    resetPasswordForm?.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (isResettingPassword || !editingUserId) return;

      const senha = String(resetPasswordForm.elements.senha?.value || "");
      const confirmarSenha = String(resetPasswordForm.elements.confirmarSenha?.value || "");
      const motivo = String(resetPasswordForm.elements.motivo?.value || "").trim();

      if (!senha || !confirmarSenha) {
        showResetPasswordError("Preencha e confirme a nova senha.");
        return;
      }

      if (senha !== confirmarSenha) {
        showResetPasswordError("As senhas informadas nao conferem.");
        return;
      }

      if (!motivo) {
        showResetPasswordError("Informe o motivo da redefinicao para auditoria.");
        return;
      }

      isResettingPassword = true;
      showResetPasswordError("");
      if (resetPasswordSubmit) {
        resetPasswordSubmit.disabled = true;
        resetPasswordSubmit.textContent = "Salvando...";
      }

      try {
        await requestJson(`/usuarios/${editingUserId}/senha`, {
          method: "PATCH",
          body: JSON.stringify({ senha, motivo }),
        });

        closeResetPasswordModal(true);
        await window.appNotifySuccess(
          "Senha redefinida com sucesso e motivo registrado na auditoria."
        );
      } catch (error) {
        showResetPasswordError(error?.message || "Erro ao redefinir a senha.");
      } finally {
        isResettingPassword = false;
        if (resetPasswordSubmit) {
          resetPasswordSubmit.disabled = false;
          resetPasswordSubmit.textContent = "Salvar nova senha";
        }
      }
    });

    return {
      openEditModal,
    };
  };
})();
