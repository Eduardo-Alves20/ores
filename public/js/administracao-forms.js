(function () {
  window.initAdministracaoForms = function initAdministracaoForms({ root, initial }) {
    const filterAreas = Array.isArray(initial?.options?.quickFilterAreas)
      ? initial.options.quickFilterAreas
      : [];

    const roomForm = root.querySelector("[data-admin-room-form]");
    const reasonForm = root.querySelector("[data-admin-reason-form]");
    const fieldForm = root.querySelector("[data-admin-field-form]");
    const filterForm = root.querySelector("[data-admin-filter-form]");
    const birthdayForm = root.querySelector("[data-admin-birthday-form]");

    function getCheckedValues(form, name) {
      if (!form) return [];
      return Array.from(form.querySelectorAll(`input[name='${name}']:checked`)).map(
        (input) => input.value
      );
    }

    function setCheckedValues(form, name, values) {
      if (!form) return;
      const allowed = Array.isArray(values) ? values.map((item) => String(item || "")) : [];
      Array.from(form.querySelectorAll(`input[name='${name}']`)).forEach((input) => {
        input.checked = allowed.includes(String(input.value || ""));
      });
    }

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

      const currentField =
        fields.find((item) => item.value === fieldSelect.value) || fields[0] || null;
      if (!currentField) {
        valueInput.hidden = false;
        valueSelect.hidden = true;
        valueInput.disabled = false;
        valueSelect.disabled = true;
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
        if (
          preferredValue &&
          (currentField.options || []).some((item) => item.value === preferredValue)
        ) {
          valueSelect.value = preferredValue;
        }
        filterForm.elements.valor.value = valueSelect.value || "";
        return;
      }

      valueInput.hidden = false;
      valueInput.disabled = false;
      valueSelect.hidden = true;
      valueSelect.disabled = true;
      valueSelect.innerHTML = "";
      valueInput.placeholder = currentField.placeholder || "";
      valueInput.value = preferredValue || "";
      filterForm.elements.valor.value = valueInput.value || "";
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

    function resetBirthdayForm() {
      if (!birthdayForm) return;
      birthdayForm.reset();
      birthdayForm.elements.id.value = "";
      birthdayForm.elements.status.value = "rascunho";
      birthdayForm.elements.acaoPrimaria.value = "exibir_dashboard";
      birthdayForm.elements.diasAntecedencia.value = "7";
      birthdayForm.elements.prioridade.value = "1";
      birthdayForm.elements.requerAprovacao.checked = false;
      birthdayForm.elements.variarPorPerfil.checked = true;
      birthdayForm.elements.variarPorHistorico.checked = true;
      birthdayForm.elements.evitarRepeticaoAnual.checked = true;
      setCheckedValues(birthdayForm, "publico", ["familia", "voluntario"]);
      setCheckedValues(birthdayForm, "canais", ["sistema"]);
    }

    function collectReasonPayload() {
      const applies = Array.from(
        reasonForm.querySelectorAll("input[name='aplicaEm']:checked")
      ).map((input) => input.value);
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

    function collectBirthdayPayload() {
      return {
        nome: String(birthdayForm.elements.nome.value || "").trim(),
        descricao: String(birthdayForm.elements.descricao.value || "").trim(),
        status: String(birthdayForm.elements.status.value || "rascunho").trim(),
        publico: getCheckedValues(birthdayForm, "publico"),
        canais: getCheckedValues(birthdayForm, "canais"),
        acaoPrimaria: String(birthdayForm.elements.acaoPrimaria.value || "exibir_dashboard").trim(),
        diasAntecedencia: Number(birthdayForm.elements.diasAntecedencia.value || 0),
        prioridade: Number(birthdayForm.elements.prioridade.value || 0),
        requerAprovacao: birthdayForm.elements.requerAprovacao.checked,
        personalizacao: {
          variarPorPerfil: birthdayForm.elements.variarPorPerfil.checked,
          variarPorHistorico: birthdayForm.elements.variarPorHistorico.checked,
          evitarRepeticaoAnual: birthdayForm.elements.evitarRepeticaoAnual.checked,
        },
        mensagens: {
          sistema: {
            assunto: String(birthdayForm.elements.sistemaAssunto.value || "").trim(),
            aberturas: String(birthdayForm.elements.sistemaAberturas.value || ""),
            mensagens: String(birthdayForm.elements.sistemaMensagens.value || ""),
            fechamentos: String(birthdayForm.elements.sistemaFechamentos.value || ""),
          },
          whatsapp: {
            aberturas: String(birthdayForm.elements.whatsappAberturas.value || ""),
            mensagens: String(birthdayForm.elements.whatsappMensagens.value || ""),
            fechamentos: String(birthdayForm.elements.whatsappFechamentos.value || ""),
          },
          email: {
            assunto: String(birthdayForm.elements.emailAssunto.value || "").trim(),
            aberturas: String(birthdayForm.elements.emailAberturas.value || ""),
            mensagens: String(birthdayForm.elements.emailMensagens.value || ""),
            fechamentos: String(birthdayForm.elements.emailFechamentos.value || ""),
          },
        },
      };
    }

    return {
      birthdayForm,
      collectBirthdayPayload,
      collectFieldPayload,
      collectFilterPayload,
      collectReasonPayload,
      fieldForm,
      filterAreas,
      filterForm,
      getFilterAreaDefinition,
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
    };
  };
})();
