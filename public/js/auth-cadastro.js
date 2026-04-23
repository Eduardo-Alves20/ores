(function () {
  const root = document.querySelector("[data-cadastro-root]");
  if (!root) return;

  const chooseStage = root.querySelector('[data-cadastro-stage="escolha"]');
  const forms = Array.from(root.querySelectorAll("[data-cadastro-form]"));
  const progressWrap = root.querySelector("[data-cadastro-progress]");
  const volunteerJourney = root.querySelector("[data-cadastro-volunteer-journey]");
  const progressItems = Array.from(root.querySelectorAll("[data-cadastro-progress-item]"));

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

  function normalizeText(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ".")
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
      return digits.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d)/, "$1-$2");
    }

    return digits.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2");
  }

  function formatDateLabel(value) {
    const normalized = String(value || "").trim();
    const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return normalized;
    return `${match[3]}/${match[2]}/${match[1]}`;
  }

  function getInputValue(form, name) {
    return String(form.querySelector(`[name="${name}"]`)?.value || "").trim();
  }

  function joinNonEmpty(values, separator = " · ") {
    return values.map((value) => String(value || "").trim()).filter(Boolean).join(separator);
  }

  function isVisibleField(field) {
    if (!field || field.disabled || field.type === "hidden") return false;
    if (field.closest("[hidden]")) return false;
    return true;
  }

  function validateFields(scope) {
    const fields = Array.from(scope?.querySelectorAll?.("input, textarea, select") || []).filter(isVisibleField);
    for (const field of fields) {
      if (!field.checkValidity()) {
        field.reportValidity();
        return false;
      }
    }
    return true;
  }

  function setProgress(step) {
    progressItems.forEach((item) => {
      const itemStep = Number(item.dataset.step || 0);
      item.classList.toggle("is-active", itemStep === step);
    });
  }

  function getForm(type) {
    return forms.find((form) => form.dataset.cadastroVariant === type) || null;
  }

  function getPanel(form, panelName) {
    return form.querySelector(`[data-cadastro-panel="${panelName}"]`);
  }

  function isVolunteerWizardForm(form) {
    return String(form?.dataset?.cadastroLayout || "") === "volunteer-wizard";
  }

  function getWizardRoot(form) {
    return form?.querySelector("[data-cadastro-wizard-root]") || null;
  }

  function getWizardPanels(form) {
    return Array.from(form?.querySelectorAll?.("[data-cadastro-wizard-panel]") || []);
  }

  function getWizardButtons(form) {
    return Array.from(form?.querySelectorAll?.("[data-cadastro-wizard-step]") || []);
  }

  function getWizardStepKeys(form) {
    return getWizardPanels(form).map((panel) => String(panel.dataset.stepKey || "").trim()).filter(Boolean);
  }

  function syncHeroState(activeType) {
    root.classList.remove("is-volunteer-active");
    if (progressWrap) progressWrap.hidden = false;
    if (volunteerJourney) volunteerJourney.hidden = true;
  }

  function setAccessFieldsDisabled(form, shouldDisable) {
    Array.from(form.querySelectorAll("[data-cadastro-access-input]")).forEach((field) => {
      field.disabled = !!shouldDisable;
    });
  }

  function setStandardPanel(form, panelName) {
    const stepInput = form.querySelector("[data-cadastro-step-input]");
    const dataPanel = getPanel(form, "dados");
    const accessPanel = getPanel(form, "acesso");
    if (stepInput) stepInput.value = panelName;
    if (dataPanel) dataPanel.classList.toggle("is-active", panelName === "dados");
    if (accessPanel) accessPanel.classList.toggle("is-active", panelName === "acesso");
    setAccessFieldsDisabled(form, panelName !== "acesso");
  }

  function syncReviewSummary(form) {
    const periodValue = joinNonEmpty(
      [
        formatDateLabel(getInputValue(form, "dadosCadastro_periodo_inicio")),
        formatDateLabel(getInputValue(form, "dadosCadastro_periodo_fim")),
      ],
      " a "
    );

    const summaryMap = [
      {
        selector: "[data-cadastro-review-name]",
        value: getInputValue(form, "nome"),
        fallback: "Seu nome aparecerá aqui",
      },
      {
        selector: "[data-cadastro-review-role]",
        value: joinNonEmpty(
          [
            getInputValue(form, "dadosCadastro_funcao"),
            getInputValue(form, "dadosCadastro_area_atuacao"),
          ]
        ),
        fallback: "Função e área ainda não informadas",
      },
      {
        selector: "[data-cadastro-review-activity]",
        value: getInputValue(form, "dadosCadastro_nome_atividade"),
        fallback: "Atividade ainda não detalhada",
      },
      {
        selector: "[data-cadastro-review-activity-detail]",
        value: getInputValue(form, "dadosCadastro_objetivo_geral"),
        fallback: "O objetivo principal aparecerá aqui",
      },
      {
        selector: "[data-cadastro-review-public]",
        value: getInputValue(form, "dadosCadastro_faixa_etaria"),
        fallback: "Público-alvo ainda não preenchido",
      },
      {
        selector: "[data-cadastro-review-public-detail]",
        value: joinNonEmpty(
          [
            getInputValue(form, "dadosCadastro_perfil_participantes"),
            getInputValue(form, "dadosCadastro_participantes_por_turma"),
          ]
        ),
        fallback: "Faixa etária, perfil e estimativa aparecerão aqui",
      },
      {
        selector: "[data-cadastro-review-schedule]",
        value: getInputValue(form, "dadosCadastro_dias_semana"),
        fallback: "Cronograma ainda não preenchido",
      },
      {
        selector: "[data-cadastro-review-schedule-detail]",
        value: joinNonEmpty(
          [
            getInputValue(form, "dadosCadastro_horario"),
            getInputValue(form, "dadosCadastro_duracao_atendimento"),
            periodValue,
          ]
        ),
        fallback: "Dias, horário e duração aparecerão aqui",
      },
    ];

    summaryMap.forEach(({ selector, value, fallback }) => {
      const element = form.querySelector(selector);
      if (element) element.textContent = value || fallback;
    });
  }

  function syncWizardFieldAvailability(form, activeIndex) {
    getWizardPanels(form).forEach((panel, panelIndex) => {
      const shouldDisable = panelIndex > activeIndex;
      Array.from(panel.querySelectorAll("input, textarea, select")).forEach((field) => {
        if (field.type === "hidden") return;
        field.disabled = shouldDisable;
      });
    });
  }

  function syncConditionalFields(form) {
    const supportWrap = form.querySelector("[data-cadastro-support-details-wrap]");
    const supportField = form.querySelector("[data-cadastro-support-details]");
    const supportValue = String(
      form.querySelector('[name="dadosCadastro_necessidade_apoio_outros_profissionais"]:checked')?.value || ""
    ).trim();
    const showSupportDetails = supportValue === "sim";

    if (supportWrap) supportWrap.hidden = !showSupportDetails;
    if (supportField) {
      supportField.disabled = !showSupportDetails;
      supportField.required = showSupportDetails;
      if (!showSupportDetails) supportField.setCustomValidity("");
    }

    const otherWrap = form.querySelector("[data-cadastro-evaluation-other-wrap]");
    const otherField = form.querySelector("[data-cadastro-evaluation-other]");
    const showOtherField = !!form.querySelector("[data-cadastro-evaluation-other-toggle]:checked");

    if (otherWrap) otherWrap.hidden = !showOtherField;
    if (otherField) {
      otherField.disabled = !showOtherField;
      otherField.required = showOtherField;
      if (!showOtherField) otherField.setCustomValidity("");
    }
  }

  function wireConditionalFields(form) {
    Array.from(form.querySelectorAll("[data-cadastro-support-radio], [data-cadastro-evaluation-other-toggle]")).forEach(
      (field) => {
        field.addEventListener("change", () => syncConditionalFields(form));
      }
    );

    syncConditionalFields(form);
  }

  function setVolunteerWizardStep(form, stepKey, options = {}) {
    const wizardRoot = getWizardRoot(form);
    if (!wizardRoot) return;

    const panels = getWizardPanels(form);
    const buttons = getWizardButtons(form);
    const stepKeys = getWizardStepKeys(form);
    const nextIndex = Math.max(0, stepKeys.indexOf(String(stepKey || stepKeys[0] || "")));
    const stepInput = form.querySelector("[data-cadastro-step-input]");
    const progressFill = wizardRoot.querySelector("[data-cadastro-wizard-progress-fill]");
    const counter = wizardRoot.querySelector("[data-cadastro-wizard-counter]");
    const label = wizardRoot.querySelector("[data-cadastro-wizard-label]");
    const backButton = wizardRoot.querySelector("[data-cadastro-wizard-back]");
    const nextButton = wizardRoot.querySelector("[data-cadastro-wizard-next]");
    const submitButton = wizardRoot.querySelector("[data-cadastro-wizard-submit]");
    const shouldFocus = options.focus !== false;
    const shouldScroll = options.scroll !== false;
    const currentKey = stepKeys[nextIndex] || stepKeys[0] || "profissional";

    if (stepInput) stepInput.value = currentKey;
    form.dataset.activeStep = currentKey;

    panels.forEach((panel, panelIndex) => {
      const isCurrent = panelIndex === nextIndex;
      panel.hidden = !isCurrent;
      panel.classList.toggle("is-current", isCurrent);
    });

    buttons.forEach((button, buttonIndex) => {
      button.classList.toggle("is-current", buttonIndex === nextIndex);
      button.classList.toggle("is-complete", buttonIndex < nextIndex);
      button.setAttribute("aria-current", buttonIndex === nextIndex ? "step" : "false");
    });

    syncWizardFieldAvailability(form, nextIndex);
    syncConditionalFields(form);
    syncReviewSummary(form);

    if (progressFill) {
      const percent = buttons.length ? ((nextIndex + 1) / buttons.length) * 100 : 100;
      progressFill.style.width = `${percent}%`;
    }

    if (counter) counter.textContent = `Etapa ${nextIndex + 1} de ${buttons.length}`;
    if (label) label.textContent = buttons[nextIndex]?.querySelector("strong")?.textContent || "";
    if (backButton) backButton.disabled = nextIndex <= 0;
    if (nextButton) nextButton.hidden = nextIndex >= buttons.length - 1;
    if (submitButton) submitButton.hidden = nextIndex !== buttons.length - 1;

    const activeButton = buttons[nextIndex];
    if (activeButton && shouldScroll) {
      activeButton.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
    }

    if (shouldFocus) {
      window.setTimeout(() => {
        const field = Array.from(panels[nextIndex]?.querySelectorAll?.("input, textarea, select") || []).find(isVisibleField);
        field?.focus();
      }, 30);
    }
  }

  function validateVolunteerUntil(form, targetIndex) {
    const panels = getWizardPanels(form);
    for (let index = 0; index < targetIndex; index += 1) {
      if (!validateFields(panels[index])) {
        const stepKey = String(panels[index]?.dataset?.stepKey || "profissional");
        setVolunteerWizardStep(form, stepKey, { focus: true, scroll: true });
        return false;
      }
    }
    return true;
  }

  function setState(type, panelName, options = {}) {
    const activeType = String(type || "").trim();
    const activePanel = String(panelName || "dados").trim() || "dados";

    root.dataset.activeType = activeType;
    root.dataset.activeStep = activeType ? activePanel : "escolha";
    syncHeroState(activeType);

    if (chooseStage) chooseStage.hidden = !!activeType;

    forms.forEach((form) => {
      const isActive = form.dataset.cadastroVariant === activeType;
      form.hidden = !isActive;
      if (!isActive) {
        if (!isVolunteerWizardForm(form)) setStandardPanel(form, "dados");
        return;
      }

      if (isVolunteerWizardForm(form)) {
        const stepKeys = getWizardStepKeys(form);
        const targetStep = stepKeys.includes(activePanel) ? activePanel : stepKeys[0] || "profissional";
        setVolunteerWizardStep(form, targetStep, options);
      } else {
        const hasAccessPanel = !!getPanel(form, "acesso");
        const targetPanel = activePanel === "acesso" && hasAccessPanel ? "acesso" : "dados";
        setStandardPanel(form, targetPanel);
      }
    });

    if (!activeType) {
      setProgress(1);
      return;
    }

    setProgress(activePanel === "acesso" ? 3 : 2);
  }

  function wireLoginSuggestion(form) {
    const nameInput = form.querySelector('[name="nome"]');
    const emailInput = form.querySelector('[name="email"]');
    const loginInput = form.querySelector('[name="login"]');
    const emailPreview = form.querySelector("[data-cadastro-email-preview]");
    if (!loginInput) return;

    let wasEdited = String(loginInput.value || "").trim().length > 0;

    function refreshEmailPreview() {
      if (emailPreview) {
        emailPreview.textContent = String(emailInput?.value || "").trim() || "informado abaixo";
      }
      syncReviewSummary(form);
    }

    function suggestLogin() {
      if (wasEdited) return;
      const emailPrefix = String(emailInput?.value || "").split("@")[0];
      const nextLogin = normalizeText(emailPrefix || nameInput?.value || "");
      if (!nextLogin) return;
      loginInput.value = nextLogin;
    }

    loginInput.addEventListener("input", () => {
      wasEdited = String(loginInput.value || "").trim().length > 0;
    });

    [nameInput, emailInput].forEach((field) => {
      if (!field) return;
      field.addEventListener("input", () => {
        suggestLogin();
        syncReviewSummary(form);
      });
      field.addEventListener("blur", () => {
        suggestLogin();
        syncReviewSummary(form);
      });
    });

    if (emailInput) {
      emailInput.addEventListener("input", refreshEmailPreview);
      emailInput.addEventListener("blur", refreshEmailPreview);
    }

    [
      '[name="dadosCadastro_funcao"]',
      '[name="dadosCadastro_area_atuacao"]',
      '[name="dadosCadastro_nome_atividade"]',
      '[name="dadosCadastro_objetivo_geral"]',
      '[name="dadosCadastro_faixa_etaria"]',
      '[name="dadosCadastro_perfil_participantes"]',
      '[name="dadosCadastro_participantes_por_turma"]',
      '[name="dadosCadastro_dias_semana"]',
      '[name="dadosCadastro_horario"]',
      '[name="dadosCadastro_duracao_atendimento"]',
      '[name="dadosCadastro_periodo_inicio"]',
      '[name="dadosCadastro_periodo_fim"]',
    ].forEach((selector) => {
      const field = form.querySelector(selector);
      if (!field) return;
      field.addEventListener("input", () => syncReviewSummary(form));
      field.addEventListener("change", () => syncReviewSummary(form));
    });

    suggestLogin();
    refreshEmailPreview();
    syncReviewSummary(form);
  }

  function wireMasks(form) {
    Array.from(form.querySelectorAll('[data-mask="cpf"]')).forEach((field) => {
      const applyMask = () => {
        field.value = formatCpf(field.value);
      };
      field.addEventListener("input", applyMask);
      applyMask();
    });

    Array.from(form.querySelectorAll('[data-mask="phone"]')).forEach((field) => {
      const applyMask = () => {
        field.value = formatPhone(field.value);
      };
      field.addEventListener("input", applyMask);
      applyMask();
    });
  }

  function validateSecureUploadFile(kind, file) {
    if (!file) return "";

    const extension = String(file.name || "").split(".").pop().toLowerCase();
    const mimeType = String(file.type || "").toLowerCase();
    const isDocument = kind === "documentoIdentidade";
    const allowedExtensions = isDocument ? ["pdf", "jpg", "jpeg", "png", "webp"] : ["jpg", "jpeg", "png", "webp"];
    const allowedMimeTypes = isDocument
      ? ["application/pdf", "image/jpeg", "image/png", "image/webp"]
      : ["image/jpeg", "image/png", "image/webp"];

    if (allowedExtensions.includes(extension) || allowedMimeTypes.includes(mimeType)) {
      return "";
    }

    return isDocument
      ? "Envie RG ou CNH em PDF, JPG, PNG ou WEBP."
      : "Envie a foto em JPG, PNG ou WEBP.";
  }

  function wireSecureUploads(form) {
    const uploadInputs = Array.from(form.querySelectorAll("[data-cadastro-secure-upload-input]"));
    if (!uploadInputs.length) return;

    const previewState = {};
    function revokePreview(kind) {
      const previewUrl = previewState[kind];
      if (!previewUrl) return;
      try {
        URL.revokeObjectURL(previewUrl);
      } catch (_) {
        // noop
      }
      delete previewState[kind];
    }

    uploadInputs.forEach((input) => {
      const kind = String(input.getAttribute("data-cadastro-secure-upload-input") || "").trim();
      if (!kind) return;

      const nameEl = form.querySelector(`[data-cadastro-secure-upload-name="${kind}"]`);
      const sizeEl = form.querySelector(`[data-cadastro-secure-upload-size="${kind}"]`);
      const previewEl = form.querySelector(`[data-cadastro-secure-upload-preview="${kind}"]`);
      const setVisualState = (state) => {
        input.classList.toggle("is-valid-file", state === "valid");
        input.classList.toggle("is-invalid-file", state === "invalid");
      };

      const syncState = () => {
        const file = input.files?.[0] || null;
        if (!file) {
          input.setCustomValidity("");
          setVisualState("idle");
          if (nameEl) nameEl.textContent = kind === "fotoPerfil" ? "Nenhuma foto selecionada." : "Nenhum documento selecionado.";
          if (sizeEl) sizeEl.textContent = "";
          if (previewEl) {
            revokePreview(kind);
            previewEl.src = "";
            previewEl.hidden = true;
          }
          return;
        }

        const validationMessage = validateSecureUploadFile(kind, file);
        input.setCustomValidity(validationMessage);

        if (nameEl) nameEl.textContent = file.name;
        if (sizeEl) sizeEl.textContent = validationMessage || formatBytes(file.size);

        if (validationMessage) {
          setVisualState("invalid");
          if (previewEl) {
            revokePreview(kind);
            previewEl.src = "";
            previewEl.hidden = true;
          }
          return;
        }

        setVisualState("valid");
        if (previewEl) {
          revokePreview(kind);
          previewState[kind] = URL.createObjectURL(file);
          previewEl.src = previewState[kind];
          previewEl.hidden = false;
        }
      };

      input.addEventListener("invalid", () => setVisualState("invalid"));
      input.addEventListener("change", syncState);
      syncState();
    });
  }

  forms.forEach((form) => {
    wireLoginSuggestion(form);
    wireMasks(form);
    wireConditionalFields(form);
    wireSecureUploads(form);

    Array.from(form.querySelectorAll("[data-cadastro-back]")).forEach((button) => {
      button.addEventListener("click", () => {
        const target = String(button.dataset.cadastroBack || "").trim();
        if (target === "escolha") {
          setState("", "escolha", { focus: false, scroll: false });
          return;
        }
        setState(form.dataset.cadastroVariant, target || "dados", { focus: false, scroll: false });
      });
    });

    if (isVolunteerWizardForm(form)) {
      const stepKeys = getWizardStepKeys(form);
      const wizardRoot = getWizardRoot(form);
      const backButton = wizardRoot?.querySelector("[data-cadastro-wizard-back]") || null;
      const nextButton = wizardRoot?.querySelector("[data-cadastro-wizard-next]") || null;

      getWizardButtons(form).forEach((button) => {
        button.addEventListener("click", () => {
          const targetIndex = Number(button.dataset.stepIndex || 0);
          const currentKey = String(form.querySelector("[data-cadastro-step-input]")?.value || stepKeys[0] || "");
          const currentIndex = Math.max(stepKeys.indexOf(currentKey), 0);
          if (targetIndex > currentIndex + 1) return;
          if (targetIndex > currentIndex) {
            const activePanel = getWizardPanels(form)[currentIndex];
            if (activePanel && !validateFields(activePanel)) return;
          }
          setVolunteerWizardStep(form, stepKeys[targetIndex] || stepKeys[0], { focus: true, scroll: true });
        });
      });

      backButton?.addEventListener("click", () => {
        const currentKey = String(form.querySelector("[data-cadastro-step-input]")?.value || stepKeys[0] || "");
        const currentIndex = Math.max(stepKeys.indexOf(currentKey), 0);
        if (currentIndex <= 0) return;
        setVolunteerWizardStep(form, stepKeys[currentIndex - 1], { focus: true, scroll: true });
      });

      nextButton?.addEventListener("click", () => {
        const currentKey = String(form.querySelector("[data-cadastro-step-input]")?.value || stepKeys[0] || "");
        const currentIndex = Math.max(stepKeys.indexOf(currentKey), 0);
        const activePanel = getWizardPanels(form)[currentIndex];
        if (activePanel && !validateFields(activePanel)) return;
        setVolunteerWizardStep(form, stepKeys[currentIndex + 1] || stepKeys[currentIndex], { focus: true, scroll: true });
      });

      form.addEventListener("submit", (event) => {
        const currentKey = String(form.querySelector("[data-cadastro-step-input]")?.value || stepKeys[0] || "");
        const currentIndex = Math.max(stepKeys.indexOf(currentKey), 0);
        const lastIndex = Math.max(stepKeys.length - 1, 0);

        if (currentIndex < lastIndex) {
          event.preventDefault();
          if (!validateVolunteerUntil(form, currentIndex + 1)) return;
          setVolunteerWizardStep(form, stepKeys[currentIndex + 1], { focus: true, scroll: true });
          return;
        }

        if (!validateVolunteerUntil(form, lastIndex)) {
          event.preventDefault();
          return;
        }

        const finalPanel = getWizardPanels(form)[lastIndex];
        if (finalPanel && !validateFields(finalPanel)) {
          event.preventDefault();
          return;
        }

        syncWizardFieldAvailability(form, lastIndex);
        syncConditionalFields(form);
      });
    } else {
      const hasAccessPanel = !!getPanel(form, "acesso");
      const nextButton = form.querySelector("[data-cadastro-next]");
      if (nextButton) {
        nextButton.addEventListener("click", () => {
          const panel = getPanel(form, "dados");
          if (!panel || !validateFields(panel)) return;
          setState(form.dataset.cadastroVariant, "acesso", { focus: false, scroll: false });
        });
      }

      form.addEventListener("submit", (event) => {
        if (!hasAccessPanel) return;
        const panelName = String(root.dataset.activeStep || "").trim();
        if (panelName === "acesso") return;
        event.preventDefault();
        const panel = getPanel(form, "dados");
        if (!panel || !validateFields(panel)) return;
        setState(form.dataset.cadastroVariant, "acesso", { focus: false, scroll: false });
      });
    }
  });

  root.querySelectorAll("[data-cadastro-select]").forEach((button) => {
    button.addEventListener("click", () => {
      const type = String(button.getAttribute("data-cadastro-select") || "").trim();
      if (!type) return;
      setState(type, "dados", { focus: false, scroll: false });
    });
  });

  setState(root.dataset.activeType || "", root.dataset.activeStep || "escolha", { focus: false, scroll: false });
})();
