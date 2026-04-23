(function () {
  const shared = window.AgendaShared;
  if (!shared) return;

  function create(context) {
    const {
      elements,
      permissions,
      roomRequiredTypes,
      slotMinutes,
      state,
      tiposAtendimento,
      user,
      attendance,
    } = context;
    const {
      buildEndIso,
      confirmAction,
      escapeHtml,
      getVisibleRange,
      mergeDateAndTime,
      normalizeTypeLabel,
      requestJson,
      requiresRoomSelection,
      showSuccess,
      showToast,
      toDateInputValue,
      toDayString,
      toTimeInputValue,
    } = context.shared || shared;

    const resolveEndIso = (startIso) => buildEndIso(startIso, slotMinutes);
    const requiresSala = (tipoAtendimento) =>
      requiresRoomSelection(roomRequiredTypes, tipoAtendimento);
    let hasSubmitValidation = false;
    let currentWizardStep = 1;

    const TYPE_META = {
      visita_domiciliar: {
        icon: "fa-house",
        iconBg: "#fef6e8",
        description: "Atendimento realizado na residencia da familia.",
      },
      atendimento_sede: {
        icon: "fa-stethoscope",
        iconBg: "#e8f4f1",
        description: "Atendimento individual com possibilidade de sala.",
      },
      entrega_beneficio: {
        icon: "fa-box-open",
        iconBg: "#eef2ff",
        description: "Entrega de apoio social com registro simplificado.",
      },
      reuniao_equipe: {
        icon: "fa-users",
        iconBg: "#e8f8f0",
        description: "Reuniao interna de equipe e alinhamento.",
      },
      outro: {
        icon: "fa-calendar-check",
        iconBg: "#fff0f0",
        description: "Compromisso geral nao coberto pelos tipos padrao.",
      },
    };

    const TYPE_FIELDS = {
      visita_domiciliar: [
        "titulo",
        "data",
        "hora",
        "responsavel",
        "familia_busca",
        "familia",
        "paciente",
        "local",
        "observacoes",
      ],
      atendimento_sede: [
        "titulo",
        "data",
        "hora",
        "responsavel",
        "familia_busca",
        "familia",
        "paciente",
        "sala",
        "sala_hint",
        "observacoes",
      ],
      entrega_beneficio: [
        "titulo",
        "data",
        "hora",
        "responsavel",
        "familia_busca",
        "familia",
        "paciente",
        "local",
        "observacoes",
      ],
      reuniao_equipe: [
        "titulo",
        "data",
        "hora",
        "responsavel",
        "sala",
        "sala_hint",
        "observacoes",
      ],
      outro: ["titulo", "data", "hora", "responsavel", "local", "observacoes"],
    };

    const ALL_DYNAMIC_FIELDS = [
      "titulo",
      "data",
      "hora",
      "responsavel",
      "sala",
      "sala_hint",
      "familia_busca",
      "familia",
      "paciente",
      "local",
      "observacoes",
    ];

    function getFirstFocusable(container) {
      if (!container || typeof container.querySelector !== "function") return null;
      return container.querySelector(
        "button:not([disabled]), [href], input:not([disabled]):not([type='hidden']), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])",
      );
    }

    function focusElementLater(element) {
      if (!element || typeof element.focus !== "function") return;
      window.setTimeout(() => element.focus(), 0);
    }

    function shouldLockBodyScroll() {
      const availabilityBackdrop = document.getElementById(
        "agenda-disponibilidade-backdrop",
      );
      return Boolean(
        (elements.modalBackdrop && !elements.modalBackdrop.hidden) ||
          (elements.salasBackdrop && !elements.salasBackdrop.hidden) ||
          (elements.presencaBackdrop && !elements.presencaBackdrop.hidden) ||
          (availabilityBackdrop && !availabilityBackdrop.hidden),
      );
    }

    function applyBodyScrollLock() {
      document.body.style.overflow = shouldLockBodyScroll() ? "hidden" : "";
    }

    function setModalOpen(open) {
      if (open && elements.modalBackdrop.hidden) {
        state.modalReturnFocus = document.activeElement || null;
      }
      elements.modalBackdrop.hidden = !open;
      applyBodyScrollLock();

      if (open) {
        focusElementLater(
          getFirstFocusable(elements.form) || getFirstFocusable(elements.modalBackdrop),
        );
        return;
      }

      const previousFocus = state.modalReturnFocus;
      state.modalReturnFocus = null;
      focusElementLater(previousFocus);
    }

    function setSecondaryModalOpen(backdrop, open) {
      if (!backdrop) return;
      if (!state.secondaryModalReturnFocus) {
        state.secondaryModalReturnFocus = {};
      }
      const key = String(backdrop.id || "secondary");
      if (open && backdrop.hidden) {
        state.secondaryModalReturnFocus[key] = document.activeElement || null;
      }
      backdrop.hidden = !open;
      applyBodyScrollLock();

      if (open) {
        focusElementLater(getFirstFocusable(backdrop));
        return;
      }

      const previousFocus = state.secondaryModalReturnFocus[key];
      delete state.secondaryModalReturnFocus[key];
      focusElementLater(previousFocus);
    }

    function getCurrentFormStartIso() {
      return mergeDateAndTime(
        elements.form.elements.data.value,
        elements.form.elements.hora.value,
      );
    }

    function getCurrentEventId() {
      return String(elements.form.dataset.eventId || "").trim();
    }

    function setFormFeedback(message) {
      if (!elements.formFeedback) return;
      const safeMessage = String(message || "").trim();
      elements.formFeedback.hidden = !safeMessage;
      elements.formFeedback.textContent = safeMessage;
    }

    function setFieldFeedback(fieldName, message) {
      const feedbackMap = {
        titulo: elements.feedbackTitulo,
        data: elements.feedbackData,
        hora: elements.feedbackHora,
        salaId: elements.feedbackSala,
      };
      const inputMap = {
        titulo: elements.form?.elements?.titulo,
        data: elements.form?.elements?.data,
        hora: elements.form?.elements?.hora,
        salaId: elements.salaSelect,
      };

      const feedbackNode = feedbackMap[fieldName] || null;
      const inputNode = inputMap[fieldName] || null;
      const safeMessage = String(message || "").trim();
      const hasMessage = Boolean(safeMessage);
      const hasValue = Boolean(String(inputNode?.value || "").trim());

      if (feedbackNode) {
        feedbackNode.hidden = !hasMessage;
        feedbackNode.textContent = hasMessage ? safeMessage : "";
      }

      if (inputNode?.classList) {
        inputNode.classList.toggle("agenda-field-invalid", hasMessage);
        inputNode.classList.toggle("agenda-field-valid", !hasMessage && hasValue);
      }

      if (inputNode && typeof inputNode.setCustomValidity === "function") {
        inputNode.setCustomValidity(hasMessage ? safeMessage : "");
      }
    }

    function clearValidationFeedback() {
      setFormFeedback("");
      setFieldFeedback("titulo", "");
      setFieldFeedback("data", "");
      setFieldFeedback("hora", "");
      setFieldFeedback("salaId", "");
      hasSubmitValidation = false;
    }

    function getCurrentTypeValue() {
      return String(elements.tipoSelect?.value || "").trim();
    }

    function getTypeMeta(tipoAtendimento) {
      const key = String(tipoAtendimento || "").trim();
      return TYPE_META[key] || TYPE_META.outro;
    }

    function getTypeFields(tipoAtendimento) {
      const key = String(tipoAtendimento || "").trim();
      return TYPE_FIELDS[key] || TYPE_FIELDS.outro;
    }

    function resetHiddenFieldData(fieldName) {
      if (fieldName === "sala") {
        if (elements.salaSelect) elements.salaSelect.value = "";
        setFieldFeedback("salaId", "");
        return;
      }

      if (fieldName === "familia_busca") {
        if (elements.familiaBusca) elements.familiaBusca.value = "";
        return;
      }

      if (fieldName === "familia") {
        if (elements.familiaSelect) elements.familiaSelect.value = "";
        fillPatientsOptions([]);
        return;
      }

      if (fieldName === "paciente") {
        if (elements.pacienteSelect) elements.pacienteSelect.value = "";
        return;
      }

      if (fieldName === "local") {
        if (elements.form?.elements?.local) {
          elements.form.elements.local.value = "";
        }
      }
    }

    function setFieldVisibility(fieldName, visible) {
      if (!elements.form || typeof elements.form.querySelector !== "function") return;
      const fieldNode = elements.form.querySelector(
        `[data-agenda-field="${fieldName}"]`,
      );
      if (!fieldNode) return;
      const shouldShow = Boolean(visible);
      const wasHidden = fieldNode.hidden;
      fieldNode.hidden = !shouldShow;
      if (!shouldShow && !wasHidden) {
        resetHiddenFieldData(fieldName);
      }
    }

    function syncTypeSummary() {
      const tipoAtendimento = getCurrentTypeValue();
      const meta = getTypeMeta(tipoAtendimento);
      const label = normalizeTypeLabel(tipoAtendimento);

      if (elements.typeSummaryLabel) {
        elements.typeSummaryLabel.textContent = label;
      }

      if (elements.typeSummaryIcon) {
        elements.typeSummaryIcon.innerHTML = `<i class="fa-solid ${escapeHtml(
          meta.icon,
        )}"></i>`;
      }
    }

    function syncTypeCardsSelection() {
      if (!elements.typeGrid) return;
      const selected = getCurrentTypeValue();
      elements.typeGrid
        .querySelectorAll("[data-agenda-type]")
        .forEach((buttonElement) => {
          const isSelected =
            String(buttonElement.getAttribute("data-agenda-type") || "") ===
            selected;
          buttonElement.classList.toggle("is-selected", isSelected);
          buttonElement.setAttribute("aria-pressed", isSelected ? "true" : "false");
        });
    }

    function syncStepButtons() {
      const hasType = Boolean(getCurrentTypeValue());
      if (elements.stepNext) {
        elements.stepNext.disabled = !hasType;
      }
    }

    function syncTypeFieldVisibility() {
      const visibleFields = new Set(getTypeFields(getCurrentTypeValue()));
      ALL_DYNAMIC_FIELDS.forEach((fieldName) => {
        setFieldVisibility(fieldName, visibleFields.has(fieldName));
      });
    }

    function updateWizardStepUi() {
      if (elements.formStepTipo) {
        elements.formStepTipo.hidden = currentWizardStep !== 1;
      }
      if (elements.formStepDetalhes) {
        elements.formStepDetalhes.hidden = currentWizardStep !== 2;
      }
      if (elements.stepBack) {
        elements.stepBack.hidden = currentWizardStep !== 2;
      }
      if (elements.stepNext) {
        elements.stepNext.hidden = currentWizardStep !== 1;
      }
      if (elements.formSubmit) {
        elements.formSubmit.hidden = currentWizardStep !== 2;
      }
      if (elements.stepHintTipo) {
        elements.stepHintTipo.hidden = currentWizardStep !== 1;
      }
      if (elements.stepHintDetalhes) {
        elements.stepHintDetalhes.hidden = currentWizardStep !== 2;
      }

      if (elements.modalSteps) {
        const step1 = elements.modalSteps.querySelector('[data-step-item="1"]');
        const step2 = elements.modalSteps.querySelector('[data-step-item="2"]');
        const line = elements.modalSteps.querySelector("[data-step-line]");

        if (step1) {
          step1.classList.toggle("is-active", currentWizardStep === 1);
          step1.classList.toggle("is-done", currentWizardStep > 1);
          const dot1 = step1.querySelector("[data-step-dot='1']");
          if (dot1) dot1.textContent = currentWizardStep > 1 ? "v" : "1";
        }
        if (step2) {
          step2.classList.toggle("is-active", currentWizardStep === 2);
          step2.classList.toggle("is-done", false);
        }
        if (line) {
          line.classList.toggle("is-done", currentWizardStep > 1);
        }
      }

      syncStepButtons();
    }

    function setWizardStep(step) {
      const normalized = Number(step) === 2 ? 2 : 1;
      currentWizardStep = normalized;
      updateWizardStepUi();
    }

    function goToDetailsStep() {
      if (!getCurrentTypeValue()) {
        showToast("Selecione um tipo para continuar.");
        return;
      }
      setWizardStep(2);
      focusElementLater(elements.form?.elements?.titulo || elements.formSubmit);
    }

    function goToTypeStep() {
      setWizardStep(1);
      focusElementLater(
        elements.typeGrid?.querySelector("[data-agenda-type].is-selected") ||
          elements.typeGrid?.querySelector("[data-agenda-type]"),
      );
    }

    function renderTypeCards() {
      if (!elements.typeGrid) return;
      const options = Array.isArray(tiposAtendimento) ? tiposAtendimento : [];
      const selected = getCurrentTypeValue();

      elements.typeGrid.innerHTML = options
        .map((tipo) => {
          const value = String(tipo || "").trim();
          const label = normalizeTypeLabel(value);
          const meta = getTypeMeta(value);
          const isSelected = value === selected;
          return `
            <button
              type="button"
              class="agenda-type-card ${isSelected ? "is-selected" : ""}"
              data-agenda-type="${escapeHtml(value)}"
              aria-pressed="${isSelected ? "true" : "false"}"
            >
              <span class="agenda-type-card-icon" style="background:${escapeHtml(
                meta.iconBg,
              )};"><i class="fa-solid ${escapeHtml(meta.icon)}"></i></span>
              <span class="agenda-type-card-title">${escapeHtml(label)}</span>
              <span class="agenda-type-card-desc">${escapeHtml(
                meta.description,
              )}</span>
            </button>
          `;
        })
        .join("");
    }

    function chooseDefaultType() {
      if (
        Array.isArray(tiposAtendimento) &&
        tiposAtendimento.includes("visita_domiciliar")
      ) {
        return "visita_domiciliar";
      }
      return String(tiposAtendimento?.[0] || "outro");
    }

    function validateTitulo() {
      const value = String(elements.form?.elements?.titulo?.value || "").trim();
      if (!value) return "Informe um titulo para o agendamento.";
      if (value.length < 3) return "Use pelo menos 3 caracteres no titulo.";
      return "";
    }

    function validateData() {
      const value = String(elements.form?.elements?.data?.value || "").trim();
      if (!value) return "Informe a data do atendimento.";
      return "";
    }

    function validateHora() {
      const value = String(elements.form?.elements?.hora?.value || "").trim();
      if (!value) return "Informe a hora do atendimento.";
      if (!/^\d{2}:\d{2}$/.test(value)) return "Hora invalida. Use o formato HH:MM.";
      return "";
    }

    function validateDataHoraCombinada() {
      const dataValue = String(elements.form?.elements?.data?.value || "").trim();
      const horaValue = String(elements.form?.elements?.hora?.value || "").trim();
      if (!dataValue || !horaValue) return "";
      const inicio = mergeDateAndTime(dataValue, horaValue);
      if (!inicio) return "Data e hora informadas nao formam um horario valido.";
      return "";
    }

    function validateSala(fieldOptions = {}) {
      const required = requiresSala(elements.tipoSelect.value);
      if (!required) return "";
      const salaValue = String(elements.salaSelect?.value || "").trim();
      if (salaValue) return "";
      if (!fieldOptions.strict) return "";

      const hasDate = String(elements.form?.elements?.data?.value || "").trim();
      const hasTime = String(elements.form?.elements?.hora?.value || "").trim();
      if (!hasDate || !hasTime) {
        return "Informe data e hora para carregar as salas disponiveis.";
      }
      return "Selecione uma sala para esse tipo de atendimento.";
    }

    function validateForm(options = {}) {
      const strict = Boolean(options.strict);
      setFormFeedback("");

      const errors = {
        titulo: validateTitulo(),
        data: validateData(),
        hora: validateHora(),
        dataHora: validateDataHoraCombinada(),
        salaId: validateSala({ strict }),
      };

      if (!errors.hora && errors.dataHora) {
        errors.hora = errors.dataHora;
      }

      setFieldFeedback("titulo", errors.titulo);
      setFieldFeedback("data", errors.data);
      setFieldFeedback("hora", errors.hora);
      setFieldFeedback("salaId", errors.salaId);

      const firstError = [errors.titulo, errors.data, errors.hora, errors.salaId].find(
        (message) => Boolean(String(message || "").trim()),
      );
      if (firstError && strict) {
        setFormFeedback("Revise os campos destacados antes de salvar.");
      }

      return !firstError;
    }

    function setSalaHintMessage(message, tone) {
      if (!elements.salaHint) return;
      elements.salaHint.textContent = message || "";
      elements.salaHint.dataset.tone = tone || "default";
    }

    function renderSalaOptions(salas, preferredValue) {
      const list = Array.isArray(salas) ? salas : [];
      const required = requiresSala(elements.tipoSelect.value);
      const currentValue = String(
        preferredValue || elements.salaSelect.value || "",
      );
      const options = [];

      if (!required) {
        options.push('<option value="">Sem sala vinculada</option>');
      } else {
        options.push('<option value="">Selecione uma sala</option>');
      }

      list.forEach((sala) => {
        options.push(
          `<option value="${escapeHtml(String(sala?._id || ""))}">${escapeHtml(
            sala?.nome || "",
          )}</option>`,
        );
      });

      if (!list.length && required) {
        options.push(
          '<option value="" disabled>Nenhuma sala disponivel neste horario</option>',
        );
      }

      elements.salaSelect.innerHTML = options.join("");
      elements.salaSelect.required = required;

      if (
        currentValue &&
        list.some((sala) => String(sala._id) === currentValue)
      ) {
        elements.salaSelect.value = currentValue;
      } else {
        elements.salaSelect.value = "";
      }
    }

    async function loadAvailableSalas(preferredValue) {
      if (!elements.salaSelect) return;

      const inicio = getCurrentFormStartIso();
      if (!inicio) {
        elements.salaSelect.innerHTML =
          '<option value="">Informe data e hora</option>';
        elements.salaSelect.disabled = true;
        setSalaHintMessage("Informe data e hora para consultar as salas livres.");
        setFieldFeedback("salaId", validateSala({ strict: hasSubmitValidation }));
        return;
      }

      const requestId = state.salaRequestId + 1;
      state.salaRequestId = requestId;
      elements.salaSelect.disabled = true;
      elements.salaSelect.innerHTML =
        '<option value="">Consultando salas...</option>';

      const params = new URLSearchParams();
      params.set("inicio", inicio);
      params.set("fim", resolveEndIso(inicio));
      if (getCurrentEventId()) params.set("eventoId", getCurrentEventId());

      const payload = await requestJson(
        `/api/agenda/salas/disponiveis?${params.toString()}`,
      );
      if (requestId !== state.salaRequestId) return;

      state.availableSalas = Array.isArray(payload.salas) ? payload.salas : [];
      renderSalaOptions(state.availableSalas, preferredValue);
      elements.salaSelect.disabled = false;

      const required = requiresSala(elements.tipoSelect.value);
      if (!state.availableSalas.length) {
        setSalaHintMessage(
          required
            ? "Nao ha sala livre para esse horario. Troque a hora ou cadastre outra sala."
            : "Nenhuma sala livre neste horario. Voce ainda pode salvar sem sala vinculada.",
          required ? "warning" : "default",
        );
        setFieldFeedback("salaId", validateSala({ strict: hasSubmitValidation }));
        return;
      }

      setSalaHintMessage(
        `${state.availableSalas.length} sala(s) livre(s) para esse horario.`,
        "success",
      );
      setFieldFeedback("salaId", validateSala({ strict: hasSubmitValidation }));
    }

    function syncSalaRequirement() {
      const tipoAtendimento = getCurrentTypeValue();
      const required = requiresSala(tipoAtendimento);
      if (elements.salaLabel) {
        elements.salaLabel.textContent = required
          ? "Sala de atendimento *"
          : "Sala de atendimento";
      }
      elements.salaSelect.required = required;
      syncTypeFieldVisibility();
      syncTypeSummary();
      syncTypeCardsSelection();
      syncStepButtons();
      setFieldFeedback("salaId", validateSala({ strict: hasSubmitValidation }));
    }

    async function loadSalasCatalogo() {
      if (!permissions.canManageRooms || !elements.salasLista) return;
      const payload = await requestJson("/api/agenda/salas?incluirInativas=true");
      state.salasCatalogo = Array.isArray(payload.salas) ? payload.salas : [];
    }

    function renderSalasCatalogo() {
      if (!elements.salasLista) return;

      if (!state.salasCatalogo.length) {
        elements.salasLista.innerHTML =
          '<p class="empty-hint">Nenhuma sala cadastrada.</p>';
        return;
      }

      elements.salasLista.innerHTML = state.salasCatalogo
        .map((sala) => {
          const activeLabel = sala.ativo ? "Ativa" : "Inativa";
          const toggleLabel = sala.ativo ? "Inativar" : "Reativar";
          return `
            <article class="agenda-sala-card ${sala.ativo ? "" : "is-inactive"}" data-sala-id="${escapeHtml(
              String(sala?._id || ""),
            )}">
              <div class="agenda-sala-card-head">
                <div>
                  <h4>${escapeHtml(sala?.nome || "")}</h4>
                  <p>${escapeHtml(sala?.descricao || "Sem descricao cadastrada.")}</p>
                </div>
                <span class="agenda-sala-status">${escapeHtml(activeLabel)}</span>
              </div>
              <div class="agenda-sala-card-actions">
                <button type="button" class="btn-ghost" data-sala-action="editar" data-sala-id="${escapeHtml(
                  String(sala?._id || ""),
                )}">Editar</button>
                <button type="button" class="btn-ghost" data-sala-action="status" data-sala-id="${escapeHtml(
                  String(sala?._id || ""),
                )}" data-next="${String(!sala.ativo)}">${escapeHtml(toggleLabel)}</button>
              </div>
            </article>
          `;
        })
        .join("");
    }

    function resetSalaForm() {
      if (!elements.salaForm) return;
      elements.salaForm.reset();
      elements.salaForm.elements.salaId.value = "";
      if (elements.salaSubmit) {
        elements.salaSubmit.textContent = "Salvar sala";
        elements.salaSubmit.disabled = false;
      }
    }

    async function openSalasModal() {
      if (!permissions.canManageRooms || !elements.salasBackdrop) return;
      await loadSalasCatalogo();
      renderSalasCatalogo();
      resetSalaForm();
      setSecondaryModalOpen(elements.salasBackdrop, true);
    }

    function closeSalasModal() {
      if (!elements.salasBackdrop) return;
      resetSalaForm();
      setSecondaryModalOpen(elements.salasBackdrop, false);
    }

    async function handleSalaFormSubmit(event) {
      event.preventDefault();
      if (state.salaSaving || !elements.salaForm) return;

      const salaId = String(elements.salaForm.elements.salaId.value || "");
      const body = {
        nome: String(elements.salaForm.elements.nome.value || "").trim(),
        descricao: String(
          elements.salaForm.elements.descricao.value || "",
        ).trim(),
      };

      if (!body.nome) {
        showToast("Informe o nome da sala.");
        return;
      }

      state.salaSaving = true;
      if (elements.salaSubmit) elements.salaSubmit.disabled = true;

      try {
        if (salaId) {
          await requestJson(`/api/agenda/salas/${salaId}`, {
            method: "PUT",
            body,
          });
        } else {
          await requestJson("/api/agenda/salas", {
            method: "POST",
            body,
          });
        }

        await loadSalasCatalogo();
        renderSalasCatalogo();
        resetSalaForm();
        await loadAvailableSalas(elements.salaSelect.value || "");
        showSuccess("Sala salva com sucesso.");
      } catch (error) {
        showToast(error.message);
      } finally {
        state.salaSaving = false;
        if (elements.salaSubmit) elements.salaSubmit.disabled = false;
      }
    }

    async function handleSalasListActions(event) {
      const trigger = event.target.closest("button[data-sala-action]");
      if (!trigger) return;

      const action = trigger.getAttribute("data-sala-action");
      const salaId = trigger.getAttribute("data-sala-id");
      const sala = state.salasCatalogo.find(
        (item) => String(item._id) === String(salaId),
      );
      if (!sala) return;

      if (action === "editar") {
        elements.salaForm.elements.salaId.value = String(sala._id);
        elements.salaForm.elements.nome.value = sala.nome || "";
        elements.salaForm.elements.descricao.value = sala.descricao || "";
        if (elements.salaSubmit) {
          elements.salaSubmit.textContent = "Salvar alteracoes";
        }
        return;
      }

      if (action === "status") {
        const next = trigger.getAttribute("data-next") === "true";
        const ok = await confirmAction({
          title: next ? "Reativar sala?" : "Inativar sala?",
          text: next
            ? "Deseja reativar esta sala?"
            : "Deseja inativar esta sala?",
          icon: "warning",
          confirmButtonText: next ? "Reativar" : "Inativar",
        });
        if (!ok) return;

        try {
          await requestJson(`/api/agenda/salas/${sala._id}/status`, {
            method: "PATCH",
            body: { ativo: next },
          });
          await loadSalasCatalogo();
          renderSalasCatalogo();
          await loadAvailableSalas(elements.salaSelect.value || "");
          showSuccess("Status da sala atualizado com sucesso.");
        } catch (error) {
          showToast(error.message);
        }
      }
    }

    function setTipoOptions() {
      const options = Array.isArray(tiposAtendimento)
        ? tiposAtendimento
        : ["outro"];
      const currentValue = getCurrentTypeValue();

      elements.tipoSelect.innerHTML = options
        .map(
          (tipo) =>
            `<option value="${escapeHtml(String(tipo || ""))}">${escapeHtml(
              normalizeTypeLabel(tipo),
            )}</option>`,
        )
        .join("");

      if (options.includes(currentValue)) {
        elements.tipoSelect.value = currentValue;
      } else {
        elements.tipoSelect.value = chooseDefaultType();
      }

      renderTypeCards();
      syncSalaRequirement();
    }

    function setResponsavelOptions() {
      const options = state.profissionais
        .map(
          (p) =>
            `<option value="${escapeHtml(String(p?._id || ""))}">${escapeHtml(
              `${p?.nome || ""} (${p?.perfil || ""})`,
            )}</option>`,
        )
        .join("");
      elements.responsavelSelect.innerHTML = options;

      if (!permissions.canAssignOthers) {
        elements.responsavelSelect.disabled = true;
        elements.responsavelSelect.value = String(user.id || "");
      }
    }

    function setFiltroProfissionais() {
      if (!permissions.canViewAll) {
        elements.responsavelFiltro.innerHTML = `<option value="${escapeHtml(
          String(user.id || ""),
        )}">${escapeHtml(user.nome || "Meu calendario")}</option>`;
        elements.responsavelFiltro.disabled = true;
        return;
      }

      const ownId = String(user.id || "").trim();
      const options = ['<option value="">Todos os profissionais</option>'];

      if (ownId) {
        options.push(
          `<option value="${escapeHtml(ownId)}">Minha agenda</option>`,
        );
      }

      options.push(
        ...state.profissionais
          .filter((p) => String(p?._id || "") !== ownId)
          .map(
            (p) =>
              `<option value="${escapeHtml(String(p?._id || ""))}">${escapeHtml(
                `${p?.nome || ""} (${p?.perfil || ""})`,
              )}</option>`,
          ),
      );

      elements.responsavelFiltro.innerHTML = options.join("");
      elements.responsavelFiltro.value = state.responsavelFiltro || "";
    }

    async function loadProfissionais() {
      const payload = await requestJson("/api/agenda/profissionais");
      state.profissionais = Array.isArray(payload.profissionais)
        ? payload.profissionais
        : [];
      setFiltroProfissionais();
      setResponsavelOptions();
    }

    async function loadFamilies(busca) {
      const query = String(busca || "").trim();
      const params = new URLSearchParams();
      params.set("limit", "20");
      params.set("page", "1");
      params.set("ativo", "true");
      if (query) params.set("busca", query);

      const payload = await requestJson(`/api/familias?${params.toString()}`);
      const docs = Array.isArray(payload.docs) ? payload.docs : [];
      state.familias = docs;

      const options = ['<option value="">Sem familia vinculada</option>'].concat(
        docs.map((familia) => {
          const label =
            `${familia?.responsavel?.nome || "Familia"} - ${familia?.responsavel?.telefone || ""}`.trim();
          return `<option value="${escapeHtml(String(familia?._id || ""))}">${escapeHtml(
            label,
          )}</option>`;
        }),
      );

      elements.familiaSelect.innerHTML = options.join("");
    }

    function fillPatientsOptions(pacientes) {
      const docs = Array.isArray(pacientes) ? pacientes : [];
      const options = ['<option value="">Sem paciente especifico</option>'].concat(
        docs.map(
          (p) =>
            `<option value="${escapeHtml(String(p?._id || ""))}">${escapeHtml(
              p?.nome || "",
            )}</option>`,
        ),
      );
      elements.pacienteSelect.innerHTML = options.join("");
    }

    async function loadPacientesByFamilia(familiaId) {
      if (!familiaId) {
        fillPatientsOptions([]);
        return null;
      }

      const payload = await requestJson(`/api/familias/${familiaId}`);
      fillPatientsOptions(payload?.pacientes || []);
      return payload?.familia || null;
    }

    async function loadMonthEvents() {
      const { start, end } = getVisibleRange(state.viewDate);
      const params = new URLSearchParams();
      params.set("inicio", start.toISOString());
      params.set("fim", end.toISOString());
      if (state.responsavelFiltro) {
        params.set("responsavelId", state.responsavelFiltro);
      }

      const payload = await requestJson(
        `/api/agenda/eventos?${params.toString()}`,
      );
      state.eventos = Array.isArray(payload.eventos) ? payload.eventos : [];
      context.calendar.renderCalendar();
      context.calendar.renderSelectedDay();
    }

    async function openCreateModal() {
      if (!permissions.canCreate) {
        showToast("Voce tem acesso somente para visualizar a agenda.");
        return;
      }

      elements.form.reset();
      elements.form.dataset.mode = "create";
      elements.form.dataset.eventId = "";
      elements.modalTitle.textContent = "Novo Agendamento";
      elements.formSubmit.textContent = "Salvar Agendamento";

      elements.form.elements.data.value =
        state.selectedDay || toDateInputValue(new Date());
      elements.form.elements.hora.value = "09:00";
      elements.form.elements.tipoAtendimento.value = chooseDefaultType();
      syncSalaRequirement();
      renderTypeCards();

      if (permissions.canAssignOthers) {
        elements.responsavelSelect.disabled = false;
        if (state.responsavelFiltro) {
          elements.responsavelSelect.value = state.responsavelFiltro;
        } else if (user.id) {
          elements.responsavelSelect.value = String(user.id);
        }
      } else {
        elements.responsavelSelect.value = String(user.id || "");
      }

      fillPatientsOptions([]);
      await loadFamilies(elements.familiaBusca.value || "");
      clearValidationFeedback();
      setWizardStep(1);
      setModalOpen(true);
      await loadAvailableSalas("");
    }

    async function openEditModal(eventoId) {
      const evento = state.eventosById.get(String(eventoId));
      if (!evento) return;
      if (!attendance.canEditEvent(evento)) {
        showToast("Voce nao pode editar este agendamento.");
        return;
      }

      elements.form.reset();
      elements.form.dataset.mode = "edit";
      elements.form.dataset.eventId = String(evento._id);
      elements.modalTitle.textContent = "Editar Agendamento";
      elements.formSubmit.textContent = "Salvar Alteracoes";

      const dt = new Date(evento.inicio);
      elements.form.elements.titulo.value = evento.titulo || "";
      elements.form.elements.data.value = toDateInputValue(dt);
      elements.form.elements.hora.value = toTimeInputValue(dt);
      elements.form.elements.tipoAtendimento.value =
        evento.tipoAtendimento || "outro";
      syncSalaRequirement();
      renderTypeCards();
      const visibleFields = new Set(
        getTypeFields(elements.form.elements.tipoAtendimento.value),
      );
      elements.form.elements.local.value = visibleFields.has("local")
        ? evento.local || ""
        : "";
      elements.form.elements.observacoes.value = evento.observacoes || "";

      if (permissions.canAssignOthers) {
        elements.responsavelSelect.disabled = false;
        elements.responsavelSelect.value = String(evento?.responsavel?._id || "");
      } else {
        elements.responsavelSelect.value = String(user.id || "");
      }

      if (visibleFields.has("familia")) {
        await loadFamilies(evento?.familia?.responsavelNome || "");
      } else {
        elements.familiaSelect.value = "";
        fillPatientsOptions([]);
      }

      if (visibleFields.has("familia") && evento?.familia?._id) {
        const familyOption = Array.from(elements.familiaSelect.options).find(
          (opt) => opt.value === String(evento.familia._id),
        );
        if (!familyOption) {
          const opt = document.createElement("option");
          opt.value = String(evento.familia._id);
          opt.textContent = evento.familia.responsavelNome || "Familia";
          elements.familiaSelect.appendChild(opt);
        }
        elements.familiaSelect.value = String(evento.familia._id);
        if (visibleFields.has("paciente")) {
          await loadPacientesByFamilia(evento.familia._id);
        } else {
          fillPatientsOptions([]);
        }
      } else {
        fillPatientsOptions([]);
        elements.familiaSelect.value = "";
      }

      if (visibleFields.has("paciente") && evento?.paciente?._id) {
        const patientOption = Array.from(elements.pacienteSelect.options).find(
          (opt) => opt.value === String(evento.paciente._id),
        );
        if (!patientOption) {
          const opt = document.createElement("option");
          opt.value = String(evento.paciente._id);
          opt.textContent = evento.paciente.nome || "Paciente";
          elements.pacienteSelect.appendChild(opt);
        }
        elements.pacienteSelect.value = String(evento.paciente._id);
      } else {
        elements.pacienteSelect.value = "";
      }

      clearValidationFeedback();
      setWizardStep(2);
      setModalOpen(true);
      await loadAvailableSalas(String(evento?.sala?._id || ""));
    }

    function closeModal() {
      setModalOpen(false);
      elements.form.reset();
      elements.form.dataset.mode = "create";
      elements.form.dataset.eventId = "";
      state.salaRequestId += 1;
      renderSalaOptions([], "");
      setSalaHintMessage(
        "As salas livres para este horario aparecem automaticamente aqui.",
      );
      clearValidationFeedback();
      setWizardStep(1);
    }

    async function handleFormSubmit(event) {
      event.preventDefault();
      if (state.saving) return;
      if (currentWizardStep !== 2) {
        goToDetailsStep();
        return;
      }
      hasSubmitValidation = true;
      if (!validateForm({ strict: true })) return;

      const modo = elements.form.dataset.mode || "create";
      const eventoId = elements.form.dataset.eventId || "";
      if (modo === "edit" && !permissions.canUpdate) {
        showToast("Voce nao pode editar agendamentos.");
        return;
      }
      if (modo !== "edit" && !permissions.canCreate) {
        showToast("Voce nao pode criar agendamentos.");
        return;
      }

      const inicio = mergeDateAndTime(
        elements.form.elements.data.value,
        elements.form.elements.hora.value,
      );

      if (!inicio) {
        showToast("Informe uma data e hora validas.");
        return;
      }

      const payload = {
        titulo: String(elements.form.elements.titulo.value || "").trim(),
        inicio,
        fim: resolveEndIso(inicio),
        tipoAtendimento: elements.form.elements.tipoAtendimento.value || "outro",
        local: String(elements.form.elements.local.value || "").trim(),
        observacoes: String(
          elements.form.elements.observacoes.value || "",
        ).trim(),
        salaId: elements.form.elements.salaId.value || null,
        familiaId: elements.form.elements.familiaId.value || null,
        pacienteId: elements.form.elements.pacienteId.value || null,
        responsavelId: elements.form.elements.responsavelId.value || null,
      };

      if (!payload.titulo) {
        showToast("Titulo e obrigatorio.");
        return;
      }

      if (requiresSala(payload.tipoAtendimento) && !payload.salaId) {
        showToast("Selecione uma sala de atendimento para esse horario.");
        return;
      }

      state.saving = true;
      elements.formSubmit.disabled = true;

      try {
        if (modo === "edit" && eventoId) {
          await requestJson(`/api/agenda/eventos/${eventoId}`, {
            method: "PUT",
            body: payload,
          });
        } else {
          await requestJson("/api/agenda/eventos", {
            method: "POST",
            body: payload,
          });
        }

        state.selectedDay = toDayString(inicio);
        hasSubmitValidation = false;
        closeModal();
        await loadMonthEvents();
      } catch (error) {
        showToast(error.message);
      } finally {
        state.saving = false;
        elements.formSubmit.disabled = false;
      }
    }

    function bindTypeGridSelection() {
      if (!elements.typeGrid) return;
      const selectTypeFromCard = (cardElement) => {
        if (!cardElement || !elements.typeGrid.contains(cardElement)) return "";
        const tipoAtendimento = String(
          cardElement.getAttribute("data-agenda-type") || "",
        ).trim();
        if (!tipoAtendimento || !elements.tipoSelect) return "";
        elements.tipoSelect.value = tipoAtendimento;
        elements.tipoSelect.dispatchEvent(new Event("change", { bubbles: true }));
        return tipoAtendimento;
      };

      elements.typeGrid.addEventListener("click", (event) => {
        const card = event.target.closest("[data-agenda-type]");
        selectTypeFromCard(card);
      });

      elements.typeGrid.addEventListener("dblclick", (event) => {
        const card = event.target.closest("[data-agenda-type]");
        const tipoAtendimento = selectTypeFromCard(card);
        if (!tipoAtendimento) return;
        goToDetailsStep();
      });
    }

    function bindRealtimeValidation() {
      const tituloInput = elements.form?.elements?.titulo;
      const dataInput = elements.form?.elements?.data;
      const horaInput = elements.form?.elements?.hora;
      const salaInput = elements.salaSelect;

      if (tituloInput && typeof tituloInput.addEventListener === "function") {
        tituloInput.addEventListener("input", () => {
          setFormFeedback("");
          setFieldFeedback("titulo", validateTitulo());
        });
      }

      if (dataInput && typeof dataInput.addEventListener === "function") {
        dataInput.addEventListener("change", () => {
          setFormFeedback("");
          setFieldFeedback("data", validateData());
          setFieldFeedback("hora", validateDataHoraCombinada());
        });
      }

      if (horaInput && typeof horaInput.addEventListener === "function") {
        horaInput.addEventListener("change", () => {
          setFormFeedback("");
          setFieldFeedback("hora", validateHora() || validateDataHoraCombinada());
        });
      }

      if (salaInput && typeof salaInput.addEventListener === "function") {
        salaInput.addEventListener("change", () => {
          setFormFeedback("");
          setFieldFeedback("salaId", validateSala({ strict: hasSubmitValidation }));
        });
      }
    }

    bindTypeGridSelection();
    bindRealtimeValidation();

    async function handleDayListActions(event) {
      const target = event.target.closest("button[data-action]");
      if (!target) return;

      const action = target.getAttribute("data-action");
      const id = target.getAttribute("data-id");
      if (!id) return;
      const evento = state.eventosById.get(String(id));

      if (action === "editar") {
        await openEditModal(id);
        return;
      }

      if (action === "presenca") {
        if (!evento || !attendance.canManageAttendance(evento)) {
          showToast("Voce nao pode registrar presenca neste agendamento.");
          return;
        }
        await attendance.openAttendanceModal(id);
        return;
      }

      if (
        ["marcar-presente", "marcar-falta", "marcar-falta-justificada"].includes(
          action,
        )
      ) {
        if (!evento || !attendance.canManageAttendance(evento)) {
          showToast("Voce nao pode registrar presenca neste agendamento.");
          return;
        }

        const nextStatus =
          action === "marcar-presente"
            ? "presente"
            : action === "marcar-falta"
              ? "falta"
              : "falta_justificada";

        const actionLabel =
          nextStatus === "presente"
            ? "presente"
            : nextStatus === "falta"
              ? "falta"
              : "falta justificada";

        const ok = await confirmAction({
          title: `Marcar como ${actionLabel}?`,
          text: `Deseja registrar "${evento.titulo || "Agendamento"}" como ${actionLabel}?`,
          icon: nextStatus === "presente" ? "question" : "warning",
          confirmButtonText: "Confirmar",
        });
        if (!ok) return;

        await attendance.submitAttendance(nextStatus, {
          eventId: id,
          observacao: String(evento?.presencaObservacao || ""),
        });
        return;
      }

      if (action === "status") {
        if (!evento || !attendance.canToggleEventStatus(evento)) {
          showToast("Voce nao pode alterar o status deste agendamento.");
          return;
        }
        const next = target.getAttribute("data-next") === "true";
        const ok = await confirmAction({
          title: next ? "Reativar evento?" : "Inativar evento?",
          text: next
            ? "Deseja reativar este evento?"
            : "Deseja inativar este evento?",
          icon: "warning",
          confirmButtonText: next ? "Reativar" : "Inativar",
        });
        if (!ok) return;

        try {
          await requestJson(`/api/agenda/eventos/${id}/status`, {
            method: "PATCH",
            body: { ativo: next },
          });
          await loadMonthEvents();
          showSuccess("Status do evento atualizado com sucesso.");
        } catch (error) {
          showToast(error.message);
        }
      }
    }

    return {
      closeModal,
      closeSalasModal,
      fillPatientsOptions,
      goToDetailsStep,
      goToTypeStep,
      getCurrentEventId,
      getCurrentFormStartIso,
      handleDayListActions,
      handleFormSubmit,
      handleSalaFormSubmit,
      handleSalasListActions,
      loadAvailableSalas,
      loadFamilies,
      loadMonthEvents,
      loadPacientesByFamilia,
      loadProfissionais,
      openCreateModal,
      openEditModal,
      openSalasModal,
      renderSalaOptions,
      renderSalasCatalogo,
      resetSalaForm,
      setFiltroProfissionais,
      setModalOpen,
      setResponsavelOptions,
      setSalaHintMessage,
      setSecondaryModalOpen,
      setTipoOptions,
      syncSalaRequirement,
      validateForm,
    };
  }

  window.AgendaForm = { create };
})();
