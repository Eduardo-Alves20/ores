(function () {
  window.initAdministracaoActions = function initAdministracaoActions({
    root,
    confirmAction,
    notifyError,
    parsePayloadAttribute,
    reloadSoon,
    requestJson,
    forms,
  }) {
    const {
      birthdayForm,
      collectBirthdayPayload,
      collectFieldPayload,
      collectFilterPayload,
      collectReasonPayload,
      fieldForm,
      filterAreas,
      filterForm,
      reasonForm,
      resetBirthdayForm,
      resetFieldForm,
      resetFilterForm,
      resetReasonForm,
      resetRoomForm,
      roomForm,
      setCheckedValues,
      syncFieldTypeOptions,
      syncFilterFields,
    } = forms;

    function getFeedbackNode(form, fieldName) {
      if (!form) return null;
      return form.querySelector(`[data-admin-feedback-for='${fieldName}']`);
    }

    function getFormFeedbackNode(form) {
      if (!form) return null;
      return form.querySelector("[data-admin-form-feedback]");
    }

    function getFormFieldNode(form, fieldName) {
      if (!form) return null;
      if (form === filterForm && fieldName === "valor") {
        const valueInput = filterForm.querySelector("[data-admin-filter-value-input]");
        const valueSelect = filterForm.querySelector("[data-admin-filter-value-select]");
        return valueSelect && !valueSelect.hidden ? valueSelect : valueInput;
      }

      const direct = form.elements?.[fieldName];
      if (!direct) return null;

      if (typeof direct.length === "number" && !direct.tagName) {
        return direct[0] || null;
      }
      return direct;
    }

    function hasFieldValue(inputNode) {
      if (!inputNode) return false;
      const type = String(inputNode.type || "").toLowerCase();
      if (type === "checkbox" || type === "radio") {
        return inputNode.checked === true;
      }
      return String(inputNode.value || "").trim() !== "";
    }

    function setFormFeedback(form, message) {
      const node = getFormFeedbackNode(form);
      if (!node) return;
      const safeMessage = String(message || "").trim();
      const hasMessage = Boolean(safeMessage);
      node.hidden = !hasMessage;
      node.textContent = hasMessage ? safeMessage : "";
    }

    function setFieldFeedback(form, fieldName, message) {
      const inputNode = getFormFieldNode(form, fieldName);
      const feedbackNode = getFeedbackNode(form, fieldName);
      const safeMessage = String(message || "").trim();
      const hasMessage = Boolean(safeMessage);

      if (feedbackNode) {
        feedbackNode.hidden = !hasMessage;
        feedbackNode.textContent = hasMessage ? safeMessage : "";
      }

      if (inputNode?.classList) {
        inputNode.classList.toggle("administracao-field-invalid", hasMessage);
        inputNode.classList.toggle("administracao-field-valid", !hasMessage && hasFieldValue(inputNode));
      }

      if (inputNode && typeof inputNode.setCustomValidity === "function") {
        inputNode.setCustomValidity(hasMessage ? safeMessage : "");
      }
    }

    function clearFormValidation(form, fields) {
      setFormFeedback(form, "");
      (fields || []).forEach((fieldName) => setFieldFeedback(form, fieldName, ""));
    }

    function getFilterValue() {
      if (!filterForm) return "";
      const valueInput = filterForm.querySelector("[data-admin-filter-value-input]");
      const valueSelect = filterForm.querySelector("[data-admin-filter-value-select]");
      return String(
        valueSelect && !valueSelect.hidden
          ? valueSelect.value
          : valueInput?.value,
      ).trim();
    }

    function validateRoomName() {
      const value = String(roomForm?.elements?.nome?.value || "").trim();
      if (!value) return "Informe o nome da sala.";
      if (value.length < 3) return "Use pelo menos 3 caracteres no nome da sala.";
      return "";
    }

    function validateReasonName() {
      const value = String(reasonForm?.elements?.nome?.value || "").trim();
      if (!value) return "Informe o nome da justificativa.";
      if (value.length < 3) return "Use pelo menos 3 caracteres no nome.";
      return "";
    }

    function validateFieldArea() {
      const value = String(fieldForm?.elements?.area?.value || "").trim();
      if (!value) return "Selecione a area do campo.";
      return "";
    }

    function validateFieldType() {
      const value = String(fieldForm?.elements?.tipo?.value || "").trim();
      if (!value) return "Selecione o tipo do campo.";
      return "";
    }

    function validateFieldLabel() {
      const value = String(fieldForm?.elements?.label?.value || "").trim();
      if (!value) return "Informe o nome do campo.";
      if (value.length < 3) return "Use pelo menos 3 caracteres no nome do campo.";
      return "";
    }

    function validateFieldOptions() {
      const type = String(fieldForm?.elements?.tipo?.value || "").trim();
      if (type !== "select") return "";
      const options = String(fieldForm?.elements?.opcoes?.value || "")
        .split(/\r?\n/)
        .map((item) => item.trim())
        .filter(Boolean);
      if (!options.length) {
        return "Informe pelo menos uma opcao quando o tipo for seletor.";
      }
      return "";
    }

    function validateFilterArea() {
      const value = String(filterForm?.elements?.area?.value || "").trim();
      if (!value) return "Selecione a area do filtro.";
      return "";
    }

    function validateFilterField() {
      const value = String(filterForm?.elements?.campo?.value || "").trim();
      if (!value) return "Selecione o campo que sera filtrado.";
      return "";
    }

    function validateFilterValue() {
      const value = getFilterValue();
      if (!value) return "Informe o valor do filtro.";
      return "";
    }

    function validateFilterName() {
      const value = String(filterForm?.elements?.nome?.value || "").trim();
      if (!value) return "Informe o nome do atalho.";
      if (value.length < 3) return "Use pelo menos 3 caracteres no nome do atalho.";
      return "";
    }

    const validationConfig = {
      room: {
        form: roomForm,
        fields: ["nome"],
        validators: {
          nome: validateRoomName,
        },
      },
      reason: {
        form: reasonForm,
        fields: ["nome"],
        validators: {
          nome: validateReasonName,
        },
      },
      field: {
        form: fieldForm,
        fields: ["area", "tipo", "label", "opcoes"],
        validators: {
          area: validateFieldArea,
          tipo: validateFieldType,
          label: validateFieldLabel,
          opcoes: validateFieldOptions,
        },
      },
      filter: {
        form: filterForm,
        fields: ["area", "campo", "valor", "nome"],
        validators: {
          area: validateFilterArea,
          campo: validateFilterField,
          valor: validateFilterValue,
          nome: validateFilterName,
        },
      },
    };

    function validateAdminForm(formKey, options = {}) {
      const strict = Boolean(options.strict);
      const config = validationConfig[formKey];
      if (!config?.form) return true;

      const errors = config.fields.map((fieldName) => {
        const validator = config.validators[fieldName];
        const message = typeof validator === "function" ? validator() : "";
        setFieldFeedback(config.form, fieldName, message);
        return { fieldName, message };
      });

      const firstError = errors.find((item) => Boolean(String(item.message || "").trim()));
      setFormFeedback(
        config.form,
        firstError && strict ? "Revise os campos destacados antes de salvar." : "",
      );

      if (firstError && strict) {
        const inputNode = getFormFieldNode(config.form, firstError.fieldName);
        if (inputNode && typeof inputNode.focus === "function") {
          inputNode.focus();
        }
      }

      return !firstError;
    }

    function clearAdminFormValidation(formKey) {
      const config = validationConfig[formKey];
      if (!config?.form) return;
      clearFormValidation(config.form, config.fields);
    }

    root.addEventListener("click", async (event) => {
      const roomEdit = event.target.closest("[data-room-edit]");
      if (roomEdit && roomForm) {
        const payload = parsePayloadAttribute(roomEdit.getAttribute("data-room-payload"));
        roomForm.elements.id.value = payload?._id || "";
        roomForm.elements.nome.value = payload?.nome || "";
        roomForm.elements.descricao.value = payload?.descricao || "";
        roomForm.elements.ativo.value = String(
          typeof payload?.ativo === "boolean" ? payload.ativo : true
        );
        clearAdminFormValidation("room");
        roomForm.elements.nome.focus();
        return;
      }

      const roomToggle = event.target.closest("[data-room-toggle]");
      if (roomToggle) {
        const next = roomToggle.getAttribute("data-room-next") === "true";
        const roomId = String(roomToggle.getAttribute("data-room-id") || "").trim();
        if (!roomId) return;
        const ok = await confirmAction({
          title: next ? "Ativar sala?" : "Inativar sala?",
          text: next ? "Deseja reativar esta sala?" : "Deseja inativar esta sala?",
          icon: "warning",
          confirmButtonText: next ? "Ativar" : "Inativar",
        });
        if (!ok) return;

        try {
          await requestJson(`/api/agenda/salas/${roomId}/status`, {
            method: "PATCH",
            body: JSON.stringify({ ativo: next }),
          });
          reloadSoon("Status da sala atualizado com sucesso.");
        } catch (error) {
          notifyError(error.message);
        }
        return;
      }

      const reasonEdit = event.target.closest("[data-reason-edit]");
      if (reasonEdit && reasonForm) {
        const payload = parsePayloadAttribute(reasonEdit.getAttribute("data-reason-payload"));
        reasonForm.elements.id.value = payload?._id || "";
        reasonForm.elements.nome.value = payload?.nome || "";
        reasonForm.elements.descricao.value = payload?.descricao || "";
        reasonForm.elements.ativo.value = String(
          typeof payload?.ativo === "boolean" ? payload.ativo : true
        );
        reasonForm.elements.ordem.value = String(payload?.ordem || 0);
        Array.from(reasonForm.querySelectorAll("input[name='aplicaEm']")).forEach((input) => {
          input.checked = Array.isArray(payload?.aplicaEm) && payload.aplicaEm.includes(input.value);
        });
        clearAdminFormValidation("reason");
        reasonForm.elements.nome.focus();
        return;
      }

      const reasonToggle = event.target.closest("[data-reason-toggle]");
      if (reasonToggle) {
        const next = reasonToggle.getAttribute("data-reason-next") === "true";
        const itemId = String(reasonToggle.getAttribute("data-reason-id") || "").trim();
        if (!itemId) return;
        const ok = await confirmAction({
          title: next ? "Ativar justificativa?" : "Inativar justificativa?",
          text: next
            ? "Deseja reativar esta justificativa?"
            : "Deseja inativar esta justificativa?",
          icon: "warning",
          confirmButtonText: next ? "Ativar" : "Inativar",
        });
        if (!ok) return;

        try {
          await requestJson(`/api/administracao/justificativas/${itemId}/status`, {
            method: "PATCH",
            body: JSON.stringify({ ativo: next }),
          });
          reloadSoon("Status da justificativa atualizado com sucesso.");
        } catch (error) {
          notifyError(error.message);
        }
        return;
      }

      const fieldEdit = event.target.closest("[data-field-edit]");
      if (fieldEdit && fieldForm) {
        const payload = parsePayloadAttribute(fieldEdit.getAttribute("data-field-payload"));
        fieldForm.elements.id.value = payload?._id || "";
        fieldForm.elements.area.value = payload?.area || "familia";
        fieldForm.elements.tipo.value = payload?.tipo || "texto";
        fieldForm.elements.label.value = payload?.label || "";
        fieldForm.elements.chave.value = payload?.chave || "";
        fieldForm.elements.placeholder.value = payload?.placeholder || "";
        fieldForm.elements.ajuda.value = payload?.ajuda || "";
        fieldForm.elements.obrigatorio.checked = payload?.obrigatorio === true;
        fieldForm.elements.ativo.value = String(
          typeof payload?.ativo === "boolean" ? payload.ativo : true
        );
        fieldForm.elements.ordem.value = String(payload?.ordem || 0);
        fieldForm.elements.opcoes.value = Array.isArray(payload?.opcoes)
          ? payload.opcoes.join("\n")
          : "";
        syncFieldTypeOptions();
        clearAdminFormValidation("field");
        fieldForm.elements.label.focus();
        return;
      }

      const fieldToggle = event.target.closest("[data-field-toggle]");
      if (fieldToggle) {
        const next = fieldToggle.getAttribute("data-field-next") === "true";
        const itemId = String(fieldToggle.getAttribute("data-field-id") || "").trim();
        if (!itemId) return;
        const ok = await confirmAction({
          title: next ? "Ativar campo?" : "Inativar campo?",
          text: next ? "Deseja reativar este campo extra?" : "Deseja inativar este campo extra?",
          icon: "warning",
          confirmButtonText: next ? "Ativar" : "Inativar",
        });
        if (!ok) return;

        try {
          await requestJson(`/api/administracao/campos/${itemId}/status`, {
            method: "PATCH",
            body: JSON.stringify({ ativo: next }),
          });
          reloadSoon("Status do campo extra atualizado com sucesso.");
        } catch (error) {
          notifyError(error.message);
        }
        return;
      }

      const filterEdit = event.target.closest("[data-filter-edit]");
      if (filterEdit && filterForm) {
        const payload = parsePayloadAttribute(filterEdit.getAttribute("data-filter-payload"));
        filterForm.elements.id.value = payload?._id || "";
        filterForm.elements.area.value = payload?.area || filterAreas[0]?.value || "";
        syncFilterFields(payload?.campo || "", payload?.valor || "");
        filterForm.elements.nome.value = payload?.nome || "";
        filterForm.elements.descricao.value = payload?.descricao || "";
        filterForm.elements.ativo.value = String(
          typeof payload?.ativo === "boolean" ? payload.ativo : true
        );
        filterForm.elements.ordem.value = String(payload?.ordem || 0);
        filterForm.elements.destaque.checked = payload?.destaque === true;
        clearAdminFormValidation("filter");
        filterForm.elements.nome.focus();
        return;
      }

      const filterToggle = event.target.closest("[data-filter-toggle]");
      if (filterToggle) {
        const next = filterToggle.getAttribute("data-filter-next") === "true";
        const itemId = String(filterToggle.getAttribute("data-filter-id") || "").trim();
        if (!itemId) return;
        const ok = await confirmAction({
          title: next ? "Ativar filtro?" : "Inativar filtro?",
          text: next ? "Deseja reativar este filtro rapido?" : "Deseja inativar este filtro rapido?",
          icon: "warning",
          confirmButtonText: next ? "Ativar" : "Inativar",
        });
        if (!ok) return;

        try {
          await requestJson(`/api/administracao/filtros/${itemId}/status`, {
            method: "PATCH",
            body: JSON.stringify({ ativo: next }),
          });
          reloadSoon("Status do filtro rapido atualizado com sucesso.");
        } catch (error) {
          notifyError(error.message);
        }
        return;
      }

      if (event.target.closest("[data-admin-room-reset]")) {
        resetRoomForm();
        clearAdminFormValidation("room");
      }
      if (event.target.closest("[data-admin-reason-reset]")) {
        resetReasonForm();
        clearAdminFormValidation("reason");
      }
      if (event.target.closest("[data-admin-field-reset]")) {
        resetFieldForm();
        clearAdminFormValidation("field");
      }
      if (event.target.closest("[data-admin-filter-reset]")) {
        resetFilterForm();
        clearAdminFormValidation("filter");
      }
      if (event.target.closest("[data-admin-birthday-reset]")) {
        resetBirthdayForm();
      }

      const birthdayEdit = event.target.closest("[data-birthday-edit]");
      if (birthdayEdit && birthdayForm) {
        const payload = parsePayloadAttribute(birthdayEdit.getAttribute("data-birthday-payload"));
        birthdayForm.elements.id.value = payload?._id || "";
        birthdayForm.elements.nome.value = payload?.nome || "";
        birthdayForm.elements.descricao.value = payload?.descricao || "";
        birthdayForm.elements.status.value = payload?.status || "rascunho";
        birthdayForm.elements.acaoPrimaria.value = payload?.acaoPrimaria || "exibir_dashboard";
        birthdayForm.elements.diasAntecedencia.value = String(payload?.diasAntecedencia || 7);
        birthdayForm.elements.prioridade.value = String(payload?.prioridade || 0);
        birthdayForm.elements.requerAprovacao.checked = payload?.requerAprovacao === true;
        birthdayForm.elements.variarPorPerfil.checked =
          payload?.personalizacao?.variarPorPerfil !== false;
        birthdayForm.elements.variarPorHistorico.checked =
          payload?.personalizacao?.variarPorHistorico !== false;
        birthdayForm.elements.evitarRepeticaoAnual.checked =
          payload?.personalizacao?.evitarRepeticaoAnual !== false;
        setCheckedValues(birthdayForm, "publico", payload?.publico || []);
        setCheckedValues(birthdayForm, "canais", payload?.canais || []);
        birthdayForm.elements.sistemaAssunto.value = payload?.mensagens?.sistema?.assunto || "";
        birthdayForm.elements.sistemaAberturas.value = Array.isArray(payload?.mensagens?.sistema?.aberturas)
          ? payload.mensagens.sistema.aberturas.join("\n")
          : "";
        birthdayForm.elements.sistemaMensagens.value = Array.isArray(payload?.mensagens?.sistema?.mensagens)
          ? payload.mensagens.sistema.mensagens.join("\n")
          : "";
        birthdayForm.elements.sistemaFechamentos.value = Array.isArray(payload?.mensagens?.sistema?.fechamentos)
          ? payload.mensagens.sistema.fechamentos.join("\n")
          : "";
        birthdayForm.elements.whatsappAberturas.value = Array.isArray(payload?.mensagens?.whatsapp?.aberturas)
          ? payload.mensagens.whatsapp.aberturas.join("\n")
          : "";
        birthdayForm.elements.whatsappMensagens.value = Array.isArray(payload?.mensagens?.whatsapp?.mensagens)
          ? payload.mensagens.whatsapp.mensagens.join("\n")
          : "";
        birthdayForm.elements.whatsappFechamentos.value = Array.isArray(payload?.mensagens?.whatsapp?.fechamentos)
          ? payload.mensagens.whatsapp.fechamentos.join("\n")
          : "";
        birthdayForm.elements.emailAssunto.value = payload?.mensagens?.email?.assunto || "";
        birthdayForm.elements.emailAberturas.value = Array.isArray(payload?.mensagens?.email?.aberturas)
          ? payload.mensagens.email.aberturas.join("\n")
          : "";
        birthdayForm.elements.emailMensagens.value = Array.isArray(payload?.mensagens?.email?.mensagens)
          ? payload.mensagens.email.mensagens.join("\n")
          : "";
        birthdayForm.elements.emailFechamentos.value = Array.isArray(payload?.mensagens?.email?.fechamentos)
          ? payload.mensagens.email.fechamentos.join("\n")
          : "";
        birthdayForm.elements.nome.focus();
        return;
      }

      const birthdayToggle = event.target.closest("[data-birthday-toggle]");
      if (birthdayToggle) {
        const next = String(birthdayToggle.getAttribute("data-birthday-next") || "").trim();
        const itemId = String(birthdayToggle.getAttribute("data-birthday-id") || "").trim();
        if (!itemId || !next) return;
        const ok = await confirmAction({
          title: next === "ativa" ? "Ativar campanha?" : "Pausar campanha?",
          text:
            next === "ativa"
              ? "Deseja ativar esta campanha de aniversario?"
              : "Deseja pausar esta campanha de aniversario?",
          icon: "warning",
          confirmButtonText: next === "ativa" ? "Ativar" : "Pausar",
        });
        if (!ok) return;

        try {
          await requestJson(`/api/administracao/campanhas-aniversario/${itemId}/status`, {
            method: "PATCH",
            body: JSON.stringify({ status: next }),
          });
          reloadSoon("Status da campanha atualizado com sucesso.");
        } catch (error) {
          notifyError(error.message);
        }
        return;
      }
    });

    roomForm?.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!validateAdminForm("room", { strict: true })) return;
      const roomId = String(roomForm.elements.id.value || "").trim();
      const payload = {
        nome: String(roomForm.elements.nome.value || "").trim(),
        descricao: String(roomForm.elements.descricao.value || "").trim(),
        ativo: roomForm.elements.ativo.value === "true",
      };

      try {
        if (roomId) {
          await requestJson(`/api/agenda/salas/${roomId}`, {
            method: "PUT",
            body: JSON.stringify(payload),
          });
          reloadSoon("Sala atualizada com sucesso.");
          return;
        }

        await requestJson("/api/agenda/salas", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        reloadSoon("Sala criada com sucesso.");
      } catch (error) {
        notifyError(error.message);
      }
    });

    reasonForm?.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!validateAdminForm("reason", { strict: true })) return;
      const reasonId = String(reasonForm.elements.id.value || "").trim();
      const payload = collectReasonPayload();

      try {
        if (reasonId) {
          await requestJson(`/api/administracao/justificativas/${reasonId}`, {
            method: "PUT",
            body: JSON.stringify(payload),
          });
          reloadSoon("Justificativa atualizada com sucesso.");
          return;
        }

        await requestJson("/api/administracao/justificativas", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        reloadSoon("Justificativa criada com sucesso.");
      } catch (error) {
        notifyError(error.message);
      }
    });

    fieldForm?.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!validateAdminForm("field", { strict: true })) return;
      const fieldId = String(fieldForm.elements.id.value || "").trim();
      const payload = collectFieldPayload();

      try {
        if (fieldId) {
          await requestJson(`/api/administracao/campos/${fieldId}`, {
            method: "PUT",
            body: JSON.stringify(payload),
          });
          reloadSoon("Campo extra atualizado com sucesso.");
          return;
        }

        await requestJson("/api/administracao/campos", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        reloadSoon("Campo extra criado com sucesso.");
      } catch (error) {
        notifyError(error.message);
      }
    });

    filterForm?.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!validateAdminForm("filter", { strict: true })) return;
      const filterId = String(filterForm.elements.id.value || "").trim();
      const payload = collectFilterPayload();

      try {
        if (filterId) {
          await requestJson(`/api/administracao/filtros/${filterId}`, {
            method: "PUT",
            body: JSON.stringify(payload),
          });
          reloadSoon("Filtro rapido atualizado com sucesso.");
          return;
        }

        await requestJson("/api/administracao/filtros", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        reloadSoon("Filtro rapido criado com sucesso.");
      } catch (error) {
        notifyError(error.message);
      }
    });

    birthdayForm?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const birthdayId = String(birthdayForm.elements.id.value || "").trim();
      const payload = collectBirthdayPayload();

      try {
        if (birthdayId) {
          await requestJson(`/api/administracao/campanhas-aniversario/${birthdayId}`, {
            method: "PUT",
            body: JSON.stringify(payload),
          });
          reloadSoon("Campanha atualizada com sucesso.");
          return;
        }

        await requestJson("/api/administracao/campanhas-aniversario", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        reloadSoon("Campanha criada com sucesso.");
      } catch (error) {
        notifyError(error.message);
      }
    });

    roomForm?.elements?.nome?.addEventListener("input", () => {
      setFormFeedback(roomForm, "");
      validateAdminForm("room", { strict: false });
    });
    roomForm?.elements?.nome?.addEventListener("blur", () => {
      validateAdminForm("room", { strict: false });
    });

    reasonForm?.elements?.nome?.addEventListener("input", () => {
      setFormFeedback(reasonForm, "");
      validateAdminForm("reason", { strict: false });
    });
    reasonForm?.elements?.nome?.addEventListener("blur", () => {
      validateAdminForm("reason", { strict: false });
    });

    fieldForm?.elements?.area?.addEventListener("change", () => {
      setFormFeedback(fieldForm, "");
      validateAdminForm("field", { strict: false });
    });
    fieldForm?.elements?.tipo?.addEventListener("change", () => {
      syncFieldTypeOptions();
      setFormFeedback(fieldForm, "");
      validateAdminForm("field", { strict: false });
    });
    fieldForm?.elements?.label?.addEventListener("input", () => {
      setFormFeedback(fieldForm, "");
      validateAdminForm("field", { strict: false });
    });
    fieldForm?.elements?.label?.addEventListener("blur", () => {
      validateAdminForm("field", { strict: false });
    });
    fieldForm?.elements?.opcoes?.addEventListener("input", () => {
      setFormFeedback(fieldForm, "");
      validateAdminForm("field", { strict: false });
    });
    fieldForm?.elements?.opcoes?.addEventListener("blur", () => {
      validateAdminForm("field", { strict: false });
    });

    filterForm?.elements?.area?.addEventListener("change", () => {
      syncFilterFields("", "");
      setFormFeedback(filterForm, "");
      validateAdminForm("filter", { strict: false });
    });
    filterForm?.querySelector("[data-admin-filter-field]")?.addEventListener("change", () => {
      syncFilterFields(filterForm.elements.campo.value, "");
      setFormFeedback(filterForm, "");
      validateAdminForm("filter", { strict: false });
    });
    filterForm?.querySelector("[data-admin-filter-value-input]")?.addEventListener("input", (event) => {
      filterForm.elements.valor.value = event.target.value;
      setFormFeedback(filterForm, "");
      validateAdminForm("filter", { strict: false });
    });
    filterForm?.querySelector("[data-admin-filter-value-input]")?.addEventListener("blur", () => {
      validateAdminForm("filter", { strict: false });
    });
    filterForm?.querySelector("[data-admin-filter-value-select]")?.addEventListener("change", (event) => {
      filterForm.elements.valor.value = event.target.value;
      setFormFeedback(filterForm, "");
      validateAdminForm("filter", { strict: false });
    });
    filterForm?.elements?.nome?.addEventListener("input", () => {
      setFormFeedback(filterForm, "");
      validateAdminForm("filter", { strict: false });
    });
    filterForm?.elements?.nome?.addEventListener("blur", () => {
      validateAdminForm("filter", { strict: false });
    });

    resetRoomForm();
    resetReasonForm();
    resetFieldForm();
    resetFilterForm();
    resetBirthdayForm();
    clearAdminFormValidation("room");
    clearAdminFormValidation("reason");
    clearAdminFormValidation("field");
    clearAdminFormValidation("filter");
  };
})();
