(function () {
  function uniqueElements(list) {
    return Array.from(new Set((Array.isArray(list) ? list : []).filter(Boolean)));
  }

  function normalizeText(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, ".")
      .replace(/^\.+|\.+$/g, "")
      .replace(/\.{2,}/g, ".")
      .slice(0, 40);
  }

  function formatCpf(value) {
    const digits = String(value || "").replace(/\D/g, "").slice(0, 11);
    return digits
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  }

  function formatPhone(value) {
    const digits = String(value || "").replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 10) {
      return digits
        .replace(/(\d{2})(\d)/, "($1) $2")
        .replace(/(\d{4})(\d)/, "$1-$2");
    }

    return digits
      .replace(/(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{5})(\d)/, "$1-$2");
  }

  function formatBytes(value) {
    const bytes = Number(value || 0);
    if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";

    const units = ["B", "KB", "MB", "GB"];
    let unitIndex = 0;
    let current = bytes;

    while (current >= 1024 && unitIndex < units.length - 1) {
      current /= 1024;
      unitIndex += 1;
    }

    const digits = current >= 10 || unitIndex === 0 ? 0 : 1;
    return `${current.toFixed(digits)} ${units[unitIndex]}`;
  }

  function isVisibleField(field) {
    if (!field || field.disabled || field.type === "hidden") return false;
    if (field.closest("[hidden]")) return false;
    return true;
  }

  function validateFields(scope) {
    const fields = Array.from(scope?.querySelectorAll?.("input, textarea, select") || []).filter(
      isVisibleField
    );

    for (const field of fields) {
      if (!field.checkValidity()) {
        field.reportValidity();
        return false;
      }
    }

    return true;
  }

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
    const signupFieldInputs = Array.from(modal.querySelectorAll("[data-user-signup-field]"));
    const secureUploadInputs = Array.from(modal.querySelectorAll("[data-user-secure-upload-input]"));
    const secureUploadSummaryElements = Array.from(
      modal.querySelectorAll("[data-user-secure-upload-summary]")
    ).reduce((acc, element) => {
      const key = String(element.getAttribute("data-user-secure-upload-summary") || "").trim();
      if (key) acc[key] = element;
      return acc;
    }, {});
    const secureUploadNameElements = Array.from(
      modal.querySelectorAll("[data-user-secure-upload-name]")
    ).reduce((acc, element) => {
      const key = String(element.getAttribute("data-user-secure-upload-name") || "").trim();
      if (key) acc[key] = element;
      return acc;
    }, {});
    const secureUploadSizeElements = Array.from(
      modal.querySelectorAll("[data-user-secure-upload-size]")
    ).reduce((acc, element) => {
      const key = String(element.getAttribute("data-user-secure-upload-size") || "").trim();
      if (key) acc[key] = element;
      return acc;
    }, {});
    const secureUploadNoteElements = Array.from(
      modal.querySelectorAll("[data-user-secure-upload-note]")
    ).reduce((acc, element) => {
      const key = String(element.getAttribute("data-user-secure-upload-note") || "").trim();
      if (key) acc[key] = element;
      return acc;
    }, {});
    const secureUploadPreviewElements = Array.from(
      modal.querySelectorAll("[data-user-secure-upload-preview]")
    ).reduce((acc, element) => {
      const key = String(element.getAttribute("data-user-secure-upload-preview") || "").trim();
      if (key) acc[key] = element;
      return acc;
    }, {});
    const defaultTipoCadastro = String(root.dataset.defaultTipoCadastro || "voluntario")
      .trim()
      .toLowerCase();

    const wizardRoot = modal.querySelector("[data-volunteer-wizard-root]");
    const isWizardLayout = !!wizardRoot;
    const wizardStepButtons = isWizardLayout
      ? Array.from(wizardRoot.querySelectorAll("[data-wizard-step]"))
      : [];
    const wizardPanels = isWizardLayout
      ? Array.from(wizardRoot.querySelectorAll("[data-wizard-panel]"))
      : [];
    const wizardProgressFill = wizardRoot?.querySelector("[data-wizard-progress-fill]") || null;
    const wizardStepCounter = wizardRoot?.querySelector("[data-wizard-step-counter]") || null;
    const wizardStepLabel = wizardRoot?.querySelector("[data-wizard-step-label]") || null;
    const wizardBackButton = wizardRoot?.querySelector("[data-wizard-back]") || null;
    const wizardNextButton = wizardRoot?.querySelector("[data-wizard-next]") || null;

    let isSubmitting = false;
    let currentMode = "create";
    let editingUserId = null;
    let editingUserName = "";
    let currentStepIndex = 0;
    const secureUploadState = secureUploadInputs.reduce((acc, input) => {
      const kind = String(input.getAttribute("data-user-secure-upload-input") || "").trim();
      if (!kind) return acc;
      acc[kind] = {
        token: "",
        asset: null,
        existingAsset: null,
        fileFingerprint: "",
        previewUrl: "",
      };
      return acc;
    }, {});

    const resetPasswordModal = root.querySelector("[data-reset-password-modal]");
    const resetPasswordForm = resetPasswordModal?.querySelector("[data-reset-password-form]") || null;
    const resetPasswordError = resetPasswordModal?.querySelector("[data-reset-password-error]") || null;
    const resetPasswordDescription =
      resetPasswordModal?.querySelector("[data-reset-password-description]") || null;
    const resetPasswordCloseButtons =
      resetPasswordModal?.querySelectorAll("[data-reset-password-close]") || [];
    const resetPasswordSubmit = resetPasswordModal?.querySelector("[data-reset-password-submit]") || null;
    let isResettingPassword = false;

    function getWizardLastIndex() {
      return Math.max(0, wizardPanels.length - 1);
    }

    function getActiveWizardPanel() {
      return wizardPanels[currentStepIndex] || null;
    }

    function updateWizardActions() {
      if (!isWizardLayout) return;

      const lastIndex = getWizardLastIndex();

      if (wizardBackButton) {
        wizardBackButton.disabled = currentStepIndex <= 0;
      }

      if (wizardNextButton) {
        wizardNextButton.hidden = currentStepIndex >= lastIndex;
        wizardNextButton.textContent =
          currentStepIndex === lastIndex - 1 ? "Ir para finalizacao" : "Proximo";
      }

      if (submitButton) {
        submitButton.hidden = currentStepIndex !== lastIndex;
      }
    }

    function focusFirstField(scope) {
      const field = Array.from(scope?.querySelectorAll?.("input, textarea, select") || []).find(
        isVisibleField
      );
      field?.focus();
    }

    function scrollWizardToTop() {
      const dialog = modal.querySelector(".acessos-modal-dialog");
      dialog?.scrollTo?.({ top: 0, behavior: "smooth" });
    }

    function setWizardStep(index, options = {}) {
      if (!isWizardLayout) return;

      const nextIndex = Math.min(Math.max(Number(index || 0), 0), getWizardLastIndex());
      const shouldFocus = options.focus !== false;
      const shouldScroll = options.scroll !== false;
      currentStepIndex = nextIndex;

      wizardStepButtons.forEach((button, buttonIndex) => {
        button.classList.toggle("is-current", buttonIndex === nextIndex);
        button.classList.toggle("is-complete", buttonIndex < nextIndex);
        button.setAttribute("aria-current", buttonIndex === nextIndex ? "step" : "false");
      });

      wizardPanels.forEach((panel, panelIndex) => {
        const isCurrent = panelIndex === nextIndex;
        panel.hidden = !isCurrent;
        panel.classList.toggle("is-current", isCurrent);
      });

      if (wizardProgressFill) {
        const percent = wizardStepButtons.length
          ? ((nextIndex + 1) / wizardStepButtons.length) * 100
          : 100;
        wizardProgressFill.style.width = `${percent}%`;
      }

      if (wizardStepCounter) {
        wizardStepCounter.textContent = `Etapa ${nextIndex + 1} de ${wizardStepButtons.length}`;
      }

      if (wizardStepLabel) {
        const activeLabel = wizardStepButtons[nextIndex]?.querySelector("strong")?.textContent || "";
        wizardStepLabel.textContent = activeLabel;
      }

      updateWizardActions();

      const activeButton = wizardStepButtons[nextIndex];
      if (activeButton) {
        activeButton.scrollIntoView({
          block: "nearest",
          inline: "center",
          behavior: shouldScroll ? "smooth" : "auto",
        });
      }

      if (shouldScroll) {
        scrollWizardToTop();
      }

      if (shouldFocus) {
        window.setTimeout(() => focusFirstField(getActiveWizardPanel()), 30);
      }
    }

    function goToWizardStep(index) {
      if (!isWizardLayout) return;

      const targetIndex = Math.min(Math.max(Number(index || 0), 0), getWizardLastIndex());
      if (targetIndex > currentStepIndex) {
        const activePanel = getActiveWizardPanel();
        if (activePanel && !validateFields(activePanel)) return;
      }

      setWizardStep(targetIndex);
    }

    function wireWizard() {
      if (!isWizardLayout) return;

      wizardStepButtons.forEach((button) => {
        button.addEventListener("click", () => {
          goToWizardStep(Number(button.getAttribute("data-step-index") || 0));
        });
      });

      wizardBackButton?.addEventListener("click", () => {
        if (currentStepIndex <= 0) return;
        setWizardStep(currentStepIndex - 1);
      });

      wizardNextButton?.addEventListener("click", () => {
        const activePanel = getActiveWizardPanel();
        if (activePanel && !validateFields(activePanel)) return;
        setWizardStep(currentStepIndex + 1);
      });
    }

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
      const volunteerFlow = defaultTipoCadastro === "voluntario" && isWizardLayout;

      if (titleEl) {
        titleEl.textContent = volunteerFlow
          ? isEdit
            ? "Editar voluntario"
            : "Criar voluntario"
          : isEdit
            ? "Editar usuario"
            : "Criar novo usuario";
      }

      if (descriptionEl) {
        descriptionEl.textContent = volunteerFlow
          ? isEdit
            ? "Atualize o cadastro por etapas. A navegacao acompanha o ponto atual e a senha continua separada no bloco final."
            : "Monte o cadastro do voluntario em etapas, com progresso visivel e revisao de acesso so no final."
          : isEdit
            ? "Atualize os dados do acesso selecionado. Se precisar trocar a senha, use o botao de redefinicao com motivo de auditoria."
            : "Preencha os dados abaixo para liberar um novo acesso manualmente.";
      }

      if (passwordHintEl) {
        passwordHintEl.textContent = isEdit
          ? "A senha nao e alterada nesta edicao. Use o fluxo de redefinicao quando precisar trocar o acesso."
          : "Defina uma senha inicial para esse acesso.";
      }

      if (submitButton) {
        submitButton.textContent = volunteerFlow
          ? isEdit
            ? "Salvar alteracoes"
            : "Criar voluntario"
          : isEdit
            ? "Salvar alteracoes"
            : "Salvar usuario";
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

      updateWizardActions();
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
          ? "Usuarios do portal podem nascer aprovados, pendentes ou rejeitados. Se o perfil for usuario, o nivel do voluntario aparece aqui."
          : "Perfis internos sao aprovados automaticamente. Se criar ou editar admin_ORES, atendente ou tecnico, ele pode nao aparecer nesta listagem filtrada.";
      }

      Object.keys(secureUploadState).forEach((kind) => {
        syncSecureUploadRequirement(kind);
      });
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
        const value = String(field.value || "").trim();
        if (!value && !field.required) return;
        camposExtras[key] = value;
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

    function collectSignupPayload() {
      const dadosCadastro = {};
      signupFieldInputs.forEach((field) => {
        const key = String(field.getAttribute("data-user-signup-field") || "").trim();
        if (!key) return;
        const value = String(field.value || "").trim();
        if (!value) return;
        dadosCadastro[key] = value;
      });
      return dadosCadastro;
    }

    function populateSignupFields(values = {}) {
      signupFieldInputs.forEach((field) => {
        const key = String(field.getAttribute("data-user-signup-field") || "").trim();
        if (!key) return;
        const value = values?.[key];
        field.value = typeof value === "undefined" || value === null ? "" : String(value);
      });
    }

    function getSecureUploadInput(kind) {
      return secureUploadInputs.find(
        (input) => String(input.getAttribute("data-user-secure-upload-input") || "").trim() === kind
      );
    }

    function buildSecureUploadFingerprint(file) {
      if (!file) return "";
      return [file.name, file.size, file.lastModified].join("::");
    }

    function revokeSecureUploadPreview(kind) {
      const state = secureUploadState[kind];
      if (!state?.previewUrl) return;
      try {
        URL.revokeObjectURL(state.previewUrl);
      } catch (_) {
        // Ignora falhas de cleanup do preview local.
      }
      state.previewUrl = "";
    }

    function syncSecureUploadRequirement(kind) {
      const input = getSecureUploadInput(kind);
      const state = secureUploadState[kind];
      if (!input || !state) return;

      const shouldRequireOnCreate =
        String(input.getAttribute("data-user-secure-upload-required-create") || "").trim() === "true";
      const hasExistingAsset = !!state.existingAsset;
      const perfil = String(form?.elements?.perfil?.value || "usuario").trim().toLowerCase();
      const tipoCadastro = String(form?.elements?.tipoCadastro?.value || defaultTipoCadastro)
        .trim()
        .toLowerCase();
      const shouldRequire =
        currentMode === "create" &&
        shouldRequireOnCreate &&
        !hasExistingAsset &&
        perfil === "usuario" &&
        tipoCadastro === "voluntario";

      input.required = shouldRequire;
    }

    function renderSecureUploadState(kind) {
      const input = getSecureUploadInput(kind);
      const state = secureUploadState[kind];
      const nameEl = secureUploadNameElements[kind];
      const sizeEl = secureUploadSizeElements[kind];
      const noteEl = secureUploadNoteElements[kind];
      const previewEl = secureUploadPreviewElements[kind];
      const currentFile = input?.files?.[0] || null;
      const activeAsset = state?.asset || state?.existingAsset || null;

      if (!state || !nameEl || !noteEl) return;

      if (currentFile) {
        nameEl.textContent = currentFile.name;
        sizeEl.textContent = formatBytes(currentFile.size);
        noteEl.textContent =
          state.token && state.fileFingerprint === buildSecureUploadFingerprint(currentFile)
            ? "Arquivo pronto e ja preparado para envio seguro."
            : "Arquivo selecionado. O envio seguro acontece quando o cadastro for salvo.";
      } else if (activeAsset) {
        nameEl.textContent = activeAsset.originalName || "Arquivo protegido salvo";
        sizeEl.textContent = activeAsset.sizeLabel || formatBytes(activeAsset.size || 0);
        noteEl.textContent =
          currentMode === "edit"
            ? "Ja existe um arquivo protegido salvo. Se quiser, selecione outro para substituir."
            : "Arquivo protegido pronto para seguir ao fluxo de aprovacao.";
      } else {
        nameEl.textContent =
          kind === "fotoPerfil" ? "Nenhuma foto anexada." : "Nenhum documento anexado.";
        sizeEl.textContent = "";
        noteEl.textContent =
          currentMode === "create"
            ? "Obrigatorio no cadastro novo de voluntario."
            : "Opcional nesta edicao. Se quiser atualizar, selecione um novo arquivo.";
      }

      if (previewEl) {
        if (currentFile) {
          revokeSecureUploadPreview(kind);
          state.previewUrl = URL.createObjectURL(currentFile);
          previewEl.src = state.previewUrl;
          previewEl.hidden = false;
        } else {
          revokeSecureUploadPreview(kind);
          previewEl.src = "";
          previewEl.hidden = true;
        }
      }

      syncSecureUploadRequirement(kind);
    }

    function clearSecureUploadState(kind, options = {}) {
      const state = secureUploadState[kind];
      const input = getSecureUploadInput(kind);
      if (!state) return;

      revokeSecureUploadPreview(kind);
      state.token = "";
      state.asset = null;
      state.fileFingerprint = "";

      if (!options.keepExisting) {
        state.existingAsset = null;
      }

      if (input && options.clearInput !== false) {
        input.value = "";
      }

      renderSecureUploadState(kind);
    }

    function populateSecureUploadFields(bundle = {}) {
      Object.keys(secureUploadState).forEach((kind) => {
        const state = secureUploadState[kind];
        if (!state) return;

        revokeSecureUploadPreview(kind);
        state.token = "";
        state.asset = null;
        state.fileFingerprint = "";
        state.existingAsset = bundle?.[kind] || null;

        const input = getSecureUploadInput(kind);
        if (input) {
          input.value = "";
        }

        renderSecureUploadState(kind);
      });
    }

    async function uploadSecureFile(kind, file) {
      const formData = new FormData();
      formData.append("kind", kind);
      formData.append("arquivo", file);

      const response = await fetch("/usuarios/uploads/protegidos", {
        method: "POST",
        body: formData,
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
        },
      });

      let payload = null;
      try {
        payload = await response.json();
      } catch (_) {
        payload = null;
      }

      if (!response.ok) {
        throw new Error(payload?.erro || payload?.message || "Falha no upload protegido.");
      }

      return payload;
    }

    async function ensureSecureUploadsReady() {
      const tokens = {};

      for (const kind of Object.keys(secureUploadState)) {
        const state = secureUploadState[kind];
        const input = getSecureUploadInput(kind);
        const file = input?.files?.[0] || null;
        const fingerprint = buildSecureUploadFingerprint(file);

        if (!file) {
          tokens[kind] = "";
          continue;
        }

        if (state.token && state.fileFingerprint === fingerprint) {
          tokens[kind] = state.token;
          continue;
        }

        const uploaded = await uploadSecureFile(kind, file);
        state.token = String(uploaded?.token || "").trim();
        state.asset = uploaded?.asset || null;
        state.fileFingerprint = fingerprint;
        tokens[kind] = state.token;
        renderSecureUploadState(kind);
      }

      return tokens;
    }

    function clearSecureUploadTokens() {
      Object.keys(secureUploadState).forEach((kind) => {
        const state = secureUploadState[kind];
        if (!state) return;
        state.token = "";
        state.asset = null;
        state.fileFingerprint = "";
        renderSecureUploadState(kind);
      });
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

      signupFieldInputs.forEach((field) => {
        field.value = "";
      });

      Object.keys(secureUploadState).forEach((kind) => {
        clearSecureUploadState(kind);
      });

      showError("");
      applyProfileRules();
      setWizardStep(0, { focus: false, scroll: false });
    }

    function wireLoginSuggestion() {
      const nameInput = form?.querySelector('[name="nome"]');
      const emailInput = form?.querySelector('[name="email"]');
      const loginInput = form?.querySelector('[name="login"]');
      if (!loginInput) return;

      let wasEdited = String(loginInput.value || "").trim().length > 0;

      function suggestLogin() {
        if (wasEdited) return;
        const emailPrefix = String(emailInput?.value || "").split("@")[0];
        const candidate = normalizeText(emailPrefix || nameInput?.value || "");
        if (!candidate) return;
        loginInput.value = candidate;
      }

      loginInput.addEventListener("input", () => {
        wasEdited = String(loginInput.value || "").trim().length > 0;
      });

      [nameInput, emailInput].forEach((field) => {
        if (!field) return;
        field.addEventListener("input", suggestLogin);
        field.addEventListener("blur", suggestLogin);
      });

      suggestLogin();
    }

    function wireMasks() {
      const cpfFields = uniqueElements([
        ...Array.from(form?.querySelectorAll?.('[data-user-mask="cpf"]') || []),
        form?.elements?.cpf,
      ]);
      const phoneFields = uniqueElements([
        ...Array.from(form?.querySelectorAll?.('[data-user-mask="phone"]') || []),
        form?.elements?.telefone,
      ]);

      cpfFields.forEach((field) => {
        const applyMask = () => {
          field.value = formatCpf(field.value);
        };
        field.addEventListener("input", applyMask);
        applyMask();
      });

      phoneFields.forEach((field) => {
        const applyMask = () => {
          field.value = formatPhone(field.value);
        };
        field.addEventListener("input", applyMask);
        applyMask();
      });
    }

    function wireSecureUploadInputs() {
      secureUploadInputs.forEach((input) => {
        const kind = String(input.getAttribute("data-user-secure-upload-input") || "").trim();
        if (!kind || !secureUploadState[kind]) return;

        input.addEventListener("change", () => {
          const state = secureUploadState[kind];
          if (!state) return;

          state.token = "";
          state.asset = null;
          state.fileFingerprint = "";
          renderSecureUploadState(kind);
        });

        renderSecureUploadState(kind);
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
        if (isWizardLayout) {
          focusFirstField(getActiveWizardPanel());
          return;
        }
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
        form.elements.dataNascimento.value = String(usuario?.dataNascimento || "").slice(0, 10);
        form.elements.perfil.value = usuario?.perfil || "usuario";
        if (form.elements.tipoCadastro) {
          form.elements.tipoCadastro.value = usuario?.tipoCadastro || defaultTipoCadastro;
        }
        if (form.elements.papelAprovacao) {
          form.elements.papelAprovacao.value = usuario?.papelAprovacao || "membro";
        }
        if (form.elements.nivelAcessoVoluntario) {
          form.elements.nivelAcessoVoluntario.value = usuario?.nivelAcessoVoluntario || "";
        }
        if (form.elements.statusAprovacao) {
          form.elements.statusAprovacao.value = usuario?.statusAprovacao || "aprovado";
        }
        if (form.elements.ativo) {
          form.elements.ativo.value = String(
            typeof usuario?.ativo === "boolean" ? usuario.ativo : true
          );
        }
        populateCustomFields(usuario?.camposExtras || {});
        populateSignupFields(usuario?.dadosCadastro || {});
        populateSecureUploadFields(usuario?.anexosProtegidos || {});
        editingUserName = String(usuario?.nome || "").trim();
        if (form.elements.senha) form.elements.senha.value = "";
        if (form.elements.confirmarSenha) form.elements.confirmarSenha.value = "";

        applyProfileRules();
        setWizardStep(0, { focus: false, scroll: false });
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

    wireLoginSuggestion();
    wireMasks();
    wireSecureUploadInputs();
    wireWizard();
    setModalTexts("create");
    applyProfileRules();
    populateSecureUploadFields({});
    setWizardStep(0, { focus: false, scroll: false });

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (isSubmitting) return;

      if (isWizardLayout && currentStepIndex < getWizardLastIndex()) {
        const activePanel = getActiveWizardPanel();
        if (!activePanel || !validateFields(activePanel)) return;
        setWizardStep(currentStepIndex + 1);
        return;
      }

      if (isWizardLayout) {
        const activePanel = getActiveWizardPanel();
        if (activePanel && !validateFields(activePanel)) return;
      }

      const senha = String(form.elements.senha?.value || "");
      const confirmarSenha = String(form.elements.confirmarSenha?.value || "");
      const wantsPasswordChange =
        currentMode === "create" || senha.length > 0 || confirmarSenha.length > 0;

      if (wantsPasswordChange && senha !== confirmarSenha) {
        showError("As senhas informadas nao conferem.");
        return;
      }

      let secureUploadTokens = {
        documentoIdentidade: "",
        fotoPerfil: "",
      };

      isSubmitting = true;
      showError("");

      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = currentMode === "edit" ? "Salvando..." : "Criando...";
      }

      try {
        secureUploadTokens = await ensureSecureUploadsReady();

        const payload = {
          nome: String(form.elements.nome?.value || "").trim(),
          email: String(form.elements.email?.value || "").trim(),
          login: String(form.elements.login?.value || "").trim(),
          cpf: String(form.elements.cpf?.value || "").trim(),
          telefone: String(form.elements.telefone?.value || "").trim(),
          dataNascimento: String(form.elements.dataNascimento?.value || "").trim(),
          perfil: String(form.elements.perfil?.value || "usuario").trim(),
          tipoCadastro: String(form.elements.tipoCadastro?.value || defaultTipoCadastro).trim(),
          papelAprovacao: String(form.elements.papelAprovacao?.value || "membro").trim(),
          nivelAcessoVoluntario: String(form.elements.nivelAcessoVoluntario?.value || "").trim(),
          statusAprovacao: String(form.elements.statusAprovacao?.value || "aprovado").trim(),
          ativo: String(form.elements.ativo?.value || "true").trim() === "true",
          camposExtras: collectCustomFieldPayload(),
          dadosCadastro: collectSignupPayload(),
          anexosProtegidos: {
            documentoIdentidadeToken: secureUploadTokens.documentoIdentidade || "",
            fotoPerfilToken: secureUploadTokens.fotoPerfil || "",
          },
        };

        if (String(payload.perfil || "").toLowerCase() !== "usuario") {
          payload.statusAprovacao = "aprovado";
        }

        if (String(payload.tipoCadastro || "").toLowerCase() !== "voluntario") {
          payload.nivelAcessoVoluntario = "";
          payload.anexosProtegidos = {
            documentoIdentidadeToken: "",
            fotoPerfilToken: "",
          };
        }

        if (currentMode === "create") {
          payload.senha = senha;
        }

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
        clearSecureUploadTokens();
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
