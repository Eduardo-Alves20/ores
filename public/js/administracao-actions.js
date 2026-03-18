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
      collectFieldPayload,
      collectFilterPayload,
      collectReasonPayload,
      fieldForm,
      filterAreas,
      filterForm,
      reasonForm,
      resetFieldForm,
      resetFilterForm,
      resetReasonForm,
      resetRoomForm,
      roomForm,
      syncFieldTypeOptions,
      syncFilterFields,
    } = forms;

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
      }
      if (event.target.closest("[data-admin-reason-reset]")) {
        resetReasonForm();
      }
      if (event.target.closest("[data-admin-field-reset]")) {
        resetFieldForm();
      }
      if (event.target.closest("[data-admin-filter-reset]")) {
        resetFilterForm();
      }
    });

    roomForm?.addEventListener("submit", async (event) => {
      event.preventDefault();
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

    fieldForm?.elements?.tipo?.addEventListener("change", syncFieldTypeOptions);
    filterForm?.elements?.area?.addEventListener("change", () => {
      syncFilterFields("", "");
    });
    filterForm?.querySelector("[data-admin-filter-field]")?.addEventListener("change", () => {
      syncFilterFields(filterForm.elements.campo.value, "");
    });
    filterForm?.querySelector("[data-admin-filter-value-input]")?.addEventListener("input", (event) => {
      filterForm.elements.valor.value = event.target.value;
    });
    filterForm?.querySelector("[data-admin-filter-value-select]")?.addEventListener("change", (event) => {
      filterForm.elements.valor.value = event.target.value;
    });

    resetRoomForm();
    resetReasonForm();
    resetFieldForm();
    resetFilterForm();
  };
})();
