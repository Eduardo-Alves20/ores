(function () {
  const form = document.getElementById("conta-perfil-editar-form");
  if (!form) return;

  const inlineFeedback = document.getElementById("conta-perfil-feedback");

  const fieldFeedbackMap = new Map(
    Array.from(form.querySelectorAll("[data-feedback-for]")).map((node) => [
      String(node.getAttribute("data-feedback-for") || "").trim(),
      node,
    ]),
  );

  function onlyDigits(value) {
    return String(value || "").replace(/\D+/g, "");
  }

  function getField(name) {
    return form.elements?.[name] || null;
  }

  function setFieldFeedback(fieldName, message) {
    const input = getField(fieldName);
    const feedback = fieldFeedbackMap.get(fieldName);
    const hasMessage = Boolean(String(message || "").trim());

    if (input) {
      input.classList.toggle("conta-field-invalid", hasMessage);
      input.classList.toggle("conta-field-valid", !hasMessage && String(input.value || "").trim() !== "");
      if (typeof input.setCustomValidity === "function") {
        input.setCustomValidity(hasMessage ? String(message) : "");
      }
    }

    if (!feedback) return;
    feedback.hidden = !hasMessage;
    feedback.textContent = hasMessage ? String(message) : "";
  }

  function validateNome() {
    const input = getField("nome");
    if (!input) return "";
    const value = String(input.value || "").trim();
    if (!value) return "Informe o nome.";
    if (value.length < 3) return "Use pelo menos 3 caracteres no nome.";
    return "";
  }

  function validateEmail() {
    const input = getField("email");
    if (!input) return "";
    const value = String(input.value || "").trim();
    if (!value) return "Informe o email.";
    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    if (!ok) return "Informe um email valido. Ex.: nome@dominio.com";
    return "";
  }

  function validateLogin() {
    const input = getField("login");
    if (!input) return "";
    const value = String(input.value || "").trim();
    if (!value) return "Informe o usuario de login.";
    if (value.length < 3) return "Login deve ter pelo menos 3 caracteres.";
    if (/\s/.test(value)) return "Login nao pode conter espacos.";
    return "";
  }

  function validateTelefone() {
    const input = getField("telefone");
    if (!input) return "";
    const value = String(input.value || "").trim();
    if (!value) return "";
    const digits = onlyDigits(value);
    if (digits.length < 10 || digits.length > 11) {
      return "Telefone deve ter 10 ou 11 digitos (com DDD).";
    }
    return "";
  }

  function validateCpf() {
    const input = getField("cpf");
    if (!input) return "";
    const value = String(input.value || "").trim();
    if (!value) return "";
    const digits = onlyDigits(value);
    if (digits.length !== 11) return "CPF deve conter 11 digitos.";
    return "";
  }

  const validators = {
    nome: validateNome,
    email: validateEmail,
    login: validateLogin,
    telefone: validateTelefone,
    cpf: validateCpf,
  };

  function validateField(fieldName) {
    const validator = validators[fieldName];
    if (typeof validator !== "function") return "";
    const message = validator();
    setFieldFeedback(fieldName, message);
    return message;
  }

  function clearInlineFeedback() {
    if (!inlineFeedback) return;
    inlineFeedback.hidden = true;
    inlineFeedback.textContent = "";
  }

  function setInlineFeedback(message) {
    if (!inlineFeedback) return;
    inlineFeedback.hidden = false;
    inlineFeedback.textContent = String(message || "");
  }

  Array.from(form.querySelectorAll("[data-validate-field]")).forEach((input) => {
    const fieldName = String(input.getAttribute("data-validate-field") || "").trim();
    if (!fieldName) return;
    const handler = () => {
      clearInlineFeedback();
      validateField(fieldName);
    };
    input.addEventListener("input", handler);
    input.addEventListener("blur", handler);
  });

  form.addEventListener("submit", (event) => {
    clearInlineFeedback();

    const firstError = Object.keys(validators)
      .map((fieldName) => ({ fieldName, message: validateField(fieldName) }))
      .find((result) => result.message);

    if (!firstError) return;

    event.preventDefault();
    setInlineFeedback("Revise os campos destacados antes de salvar.");
    const input = getField(firstError.fieldName);
    if (input && typeof input.focus === "function") {
      input.focus();
    }
  });
})();
