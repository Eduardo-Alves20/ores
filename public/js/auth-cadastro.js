(function () {
  const root = document.querySelector("[data-cadastro-root]");
  if (!root) return;

  const chooseStage = root.querySelector('[data-cadastro-stage="escolha"]');
  const forms = Array.from(root.querySelectorAll("[data-cadastro-form]"));
  const progressItems = Array.from(root.querySelectorAll("[data-cadastro-progress-item]"));

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
      return digits
        .replace(/(\d{2})(\d)/, "($1) $2")
        .replace(/(\d{4})(\d)/, "$1-$2");
    }

    return digits
      .replace(/(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{5})(\d)/, "$1-$2");
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

  function setAccessFieldsDisabled(form, shouldDisable) {
    const accessInputs = Array.from(form.querySelectorAll("[data-cadastro-access-input]"));
    accessInputs.forEach((field) => {
      field.disabled = !!shouldDisable;
    });
  }

  function setPanel(form, panelName) {
    const stepInput = form.querySelector("[data-cadastro-step-input]");
    const dataPanel = getPanel(form, "dados");
    const accessPanel = getPanel(form, "acesso");

    if (stepInput) stepInput.value = panelName;
    if (dataPanel) dataPanel.classList.toggle("is-active", panelName === "dados");
    if (accessPanel) accessPanel.classList.toggle("is-active", panelName === "acesso");
    setAccessFieldsDisabled(form, panelName !== "acesso");
  }

  function setState(type, panelName) {
    const activeType = String(type || "").trim();
    const activePanel = String(panelName || "dados").trim() || "dados";

    root.dataset.activeType = activeType;
    root.dataset.activeStep = activeType ? activePanel : "escolha";

    if (chooseStage) {
      chooseStage.hidden = !!activeType;
    }

    forms.forEach((form) => {
      const isActive = form.dataset.cadastroVariant === activeType;
      form.hidden = !isActive;
      if (isActive) {
        setPanel(form, activePanel);
      } else {
        setPanel(form, "dados");
      }
    });

    if (!activeType) {
      setProgress(1);
      return;
    }

    setProgress(activePanel === "acesso" ? 3 : 2);
  }

  function validateFields(panel) {
    const fields = Array.from(panel.querySelectorAll("input, textarea, select")).filter(
      (field) => !field.disabled
    );

    for (const field of fields) {
      if (!field.checkValidity()) {
        field.reportValidity();
        return false;
      }
    }

    return true;
  }

  function wireLoginSuggestion(form) {
    const nameInput = form.querySelector('[name="nome"]');
    const emailInput = form.querySelector('[name="email"]');
    const loginInput = form.querySelector('[name="login"]');
    const emailPreview = form.querySelector("[data-cadastro-email-preview]");
    if (!loginInput) return;

    let wasEdited = String(loginInput.value || "").trim().length > 0;

    function refreshEmailPreview() {
      if (!emailPreview) return;
      emailPreview.textContent = String(emailInput?.value || "").trim() || "informado acima";
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
      field.addEventListener("input", suggestLogin);
      field.addEventListener("blur", suggestLogin);
    });

    if (emailInput) {
      emailInput.addEventListener("input", refreshEmailPreview);
      emailInput.addEventListener("blur", refreshEmailPreview);
    }

    suggestLogin();
    refreshEmailPreview();
  }

  function wireMasks(form) {
    const cpfFields = Array.from(form.querySelectorAll('[data-mask="cpf"]'));
    const phoneFields = Array.from(form.querySelectorAll('[data-mask="phone"]'));

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

  forms.forEach((form) => {
    wireLoginSuggestion(form);
    wireMasks(form);

    const nextButton = form.querySelector("[data-cadastro-next]");
    const backButtons = Array.from(form.querySelectorAll("[data-cadastro-back]"));

    if (nextButton) {
      nextButton.addEventListener("click", () => {
        const panel = getPanel(form, "dados");
        if (!panel || !validateFields(panel)) return;
        setState(form.dataset.cadastroVariant, "acesso");
      });
    }

    backButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const target = String(button.dataset.cadastroBack || "").trim();
        if (target === "escolha") {
          setState("", "escolha");
          return;
        }

        setState(form.dataset.cadastroVariant, target || "dados");
      });
    });

    form.addEventListener("submit", (event) => {
      const panelName = String(root.dataset.activeStep || "").trim();
      if (panelName === "acesso") return;

      event.preventDefault();
      const panel = getPanel(form, "dados");
      if (!panel || !validateFields(panel)) return;
      setState(form.dataset.cadastroVariant, "acesso");
    });
  });

  root.querySelectorAll("[data-cadastro-select]").forEach((button) => {
    button.addEventListener("click", () => {
      const type = String(button.getAttribute("data-cadastro-select") || "").trim();
      if (!type) return;
      setState(type, "dados");
    });
  });

  setState(root.dataset.activeType || "", root.dataset.activeStep || "escolha");
})();
