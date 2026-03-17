(function () {
  const root = document.querySelector("[data-page='administracao']");
  if (!root) return;

  function parseJsonScript(id, fallback) {
    const el = document.getElementById(id);
    if (!el) return fallback;
    try {
      return JSON.parse(el.textContent || "");
    } catch (_) {
      return fallback;
    }
  }

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
      throw new Error(payload?.erro || payload?.message || "Erro ao processar a requisicao.");
    }

    return payload;
  }

  async function confirmAction(options = {}) {
    const defaults = {
      title: "Confirmar acao",
      text: "Deseja continuar?",
      icon: "question",
      confirmButtonText: "Confirmar",
      cancelButtonText: "Cancelar",
    };

    if (typeof window.appConfirm === "function") {
      return window.appConfirm({ ...defaults, ...options });
    }

    return window.confirm(options?.text || defaults.text);
  }

  function notifySuccess(message) {
    if (typeof window.appNotifySuccess === "function") {
      window.appNotifySuccess(message);
      return;
    }
    window.alert(message);
  }

  function notifyError(message) {
    if (typeof window.appNotifyError === "function") {
      window.appNotifyError(message);
      return;
    }
    window.alert(message);
  }

  function reloadSoon(message) {
    notifySuccess(message);
    window.setTimeout(() => {
      window.location.reload();
    }, 250);
  }

  function parsePayloadAttribute(value) {
    try {
      return JSON.parse(decodeURIComponent(String(value || "")));
    } catch (_) {
      return {};
    }
  }

  const initial = parseJsonScript("administracao-initial", {});
  const filterAreas = Array.isArray(initial?.options?.quickFilterAreas) ? initial.options.quickFilterAreas : [];

  const roomForm = root.querySelector("[data-admin-room-form]");
  const reasonForm = root.querySelector("[data-admin-reason-form]");
  const fieldForm = root.querySelector("[data-admin-field-form]");
  const filterForm = root.querySelector("[data-admin-filter-form]");

  function resetRoomForm() {
    if (!roomForm) return;
    roomForm.reset();
    roomForm.elements.id.value = "";
    roomForm.elements.ativo.value = "true";
  }

  function resetReasonForm() {
    if (!reasonForm) return;
    reasonForm.reset();
    reasonForm.elements.id.value = "";
    reasonForm.elements.ativo.value = "true";
    reasonForm.elements.ordem.value = "0";
  }

  function syncFieldTypeOptions() {
    if (!fieldForm) return;
    const type = String(fieldForm.elements.tipo?.value || "texto").trim();
    const optionsWrap = fieldForm.querySelector("[data-admin-field-options-wrap]");
    if (!optionsWrap) return;
    const shouldShow = type === "select";
    optionsWrap.hidden = !shouldShow;
    fieldForm.elements.opcoes.disabled = !shouldShow;
    if (!shouldShow) {
      fieldForm.elements.opcoes.value = "";
    }
  }

  function resetFieldForm() {
    if (!fieldForm) return;
    fieldForm.reset();
    fieldForm.elements.id.value = "";
    fieldForm.elements.ativo.value = "true";
    fieldForm.elements.ordem.value = "0";
    syncFieldTypeOptions();
  }

  function getFilterAreaDefinition(area) {
    return filterAreas.find((item) => String(item?.value || "") === String(area || "")) || null;
  }

  function syncFilterFields(preferredField, preferredValue) {
    if (!filterForm) return;
    const area = String(filterForm.elements.area?.value || "").trim();
    const areaDef = getFilterAreaDefinition(area);
    const fieldSelect = filterForm.querySelector("[data-admin-filter-field]");
    const valueInput = filterForm.querySelector("[data-admin-filter-value-input]");
    const valueSelect = filterForm.querySelector("[data-admin-filter-value-select]");

    if (!fieldSelect || !valueInput || !valueSelect) return;

    const fields = Array.isArray(areaDef?.fields) ? areaDef.fields : [];
    fieldSelect.innerHTML = fields
      .map((item) => `<option value="${item.value}">${item.label}</option>`)
      .join("");

    if (preferredField && fields.some((item) => item.value === preferredField)) {
      fieldSelect.value = preferredField;
    }

    const currentField = fields.find((item) => item.value === fieldSelect.value) || fields[0] || null;
    if (!currentField) {
      valueInput.hidden = false;
      valueSelect.hidden = true;
      valueSelect.innerHTML = "";
      valueInput.value = preferredValue || "";
      return;
    }

    if (currentField.type === "select") {
      valueSelect.innerHTML = (currentField.options || [])
        .map((item) => `<option value="${item.value}">${item.label}</option>`)
        .join("");
      valueInput.hidden = true;
      valueInput.disabled = true;
      valueSelect.hidden = false;
      valueSelect.disabled = false;
      if (preferredValue && (currentField.options || []).some((item) => item.value === preferredValue)) {
        valueSelect.value = preferredValue;
      }
      filterForm.elements.valor.value = valueSelect.value || "";
    } else {
      valueInput.hidden = false;
      valueInput.disabled = false;
      valueSelect.hidden = true;
      valueSelect.disabled = true;
      valueSelect.innerHTML = "";
      valueInput.placeholder = currentField.placeholder || "";
      valueInput.value = preferredValue || "";
      filterForm.elements.valor.value = valueInput.value || "";
    }
  }

  function resetFilterForm() {
    if (!filterForm) return;
    filterForm.reset();
    filterForm.elements.id.value = "";
    filterForm.elements.ativo.value = "true";
    filterForm.elements.ordem.value = "0";
    const firstArea = filterAreas[0]?.value || "";
    if (firstArea) {
      filterForm.elements.area.value = firstArea;
    }
    syncFilterFields("", "");
  }

  function collectReasonPayload() {
    const applies = Array.from(reasonForm.querySelectorAll("input[name='aplicaEm']:checked")).map((input) => input.value);
    return {
      nome: String(reasonForm.elements.nome.value || "").trim(),
      descricao: String(reasonForm.elements.descricao.value || "").trim(),
      ativo: reasonForm.elements.ativo.value === "true",
      ordem: Number(reasonForm.elements.ordem.value || 0),
      aplicaEm: applies,
    };
  }

  function collectFieldPayload() {
    return {
      area: String(fieldForm.elements.area.value || "").trim(),
      tipo: String(fieldForm.elements.tipo.value || "texto").trim(),
      label: String(fieldForm.elements.label.value || "").trim(),
      chave: String(fieldForm.elements.chave.value || "").trim(),
      placeholder: String(fieldForm.elements.placeholder.value || "").trim(),
      ajuda: String(fieldForm.elements.ajuda.value || "").trim(),
      obrigatorio: fieldForm.elements.obrigatorio.checked,
      ativo: fieldForm.elements.ativo.value === "true",
      ordem: Number(fieldForm.elements.ordem.value || 0),
      opcoes: String(fieldForm.elements.opcoes.value || "")
        .split(/\r?\n/)
        .map((item) => item.trim())
        .filter(Boolean),
    };
  }

  function collectFilterPayload() {
    const valueInput = filterForm.querySelector("[data-admin-filter-value-input]");
    const valueSelect = filterForm.querySelector("[data-admin-filter-value-select]");
    const value = valueSelect.hidden ? valueInput.value : valueSelect.value;

    return {
      area: String(filterForm.elements.area.value || "").trim(),
      campo: String(filterForm.elements.campo.value || "").trim(),
      valor: String(value || "").trim(),
      nome: String(filterForm.elements.nome.value || "").trim(),
      descricao: String(filterForm.elements.descricao.value || "").trim(),
      ativo: filterForm.elements.ativo.value === "true",
      destaque: filterForm.elements.destaque.checked,
      ordem: Number(filterForm.elements.ordem.value || 0),
    };
  }

  root.addEventListener("click", async (event) => {
    const roomEdit = event.target.closest("[data-room-edit]");
    if (roomEdit && roomForm) {
      const payload = parsePayloadAttribute(roomEdit.getAttribute("data-room-payload"));
      roomForm.elements.id.value = payload?._id || "";
      roomForm.elements.nome.value = payload?.nome || "";
      roomForm.elements.descricao.value = payload?.descricao || "";
      roomForm.elements.ativo.value = String(typeof payload?.ativo === "boolean" ? payload.ativo : true);
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
      reasonForm.elements.ativo.value = String(typeof payload?.ativo === "boolean" ? payload.ativo : true);
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
        text: next ? "Deseja reativar esta justificativa?" : "Deseja inativar esta justificativa?",
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
      fieldForm.elements.ativo.value = String(typeof payload?.ativo === "boolean" ? payload.ativo : true);
      fieldForm.elements.ordem.value = String(payload?.ordem || 0);
      fieldForm.elements.opcoes.value = Array.isArray(payload?.opcoes) ? payload.opcoes.join("\n") : "";
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
      filterForm.elements.ativo.value = String(typeof payload?.ativo === "boolean" ? payload.ativo : true);
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
})();
