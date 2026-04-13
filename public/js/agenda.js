(function () {
  const root = document.querySelector("[data-page='agenda']");
  if (!root) return;

  const shared = window.AgendaShared;
  const attendanceModule = window.AgendaAttendance;
  const calendarModule = window.AgendaCalendar;
  const formModule = window.AgendaForm;
  if (!shared || !attendanceModule || !calendarModule || !formModule) return;

  const config = shared.parseJsonScript("agenda-config", {});
  const user = config.user || {};
  const permissions = config.permissions || {};
  const tiposAtendimento = Array.isArray(config.tiposAtendimento)
    ? config.tiposAtendimento
    : [];
  const roomRequiredTypes = Array.isArray(config.roomRequiredTypes)
    ? config.roomRequiredTypes
    : [];
  const slotMinutes =
    Number(config.slotMinutes) > 0 ? Number(config.slotMinutes) : 30;

  const elements = {
    mesTitulo: document.getElementById("agenda-mes-titulo"),
    mesPickerWrap: document.getElementById("agenda-mes-picker-wrap"),
    mesPickerToggle: document.getElementById("agenda-mes-picker-toggle"),
    mesPickerPopover: document.getElementById("agenda-mes-picker-popover"),
    mesPickerMes: document.getElementById("agenda-mes-picker-mes"),
    mesPickerAno: document.getElementById("agenda-mes-picker-ano"),
    mesPickerApply: document.getElementById("agenda-mes-picker-aplicar"),
    mesPickerCancel: document.getElementById("agenda-mes-picker-cancelar"),
    calendarGrid: document.getElementById("agenda-calendar-grid"),
    prevBtn: document.getElementById("agenda-mes-prev"),
    nextBtn: document.getElementById("agenda-mes-next"),
    hojeBtn: document.getElementById("agenda-hoje-btn"),
    salasBtn: document.getElementById("agenda-salas-btn"),
    responsavelFiltro: document.getElementById("agenda-responsavel-filtro"),
    presencaSemanaTitulo: document.getElementById(
      "agenda-presenca-semana-titulo",
    ),
    presencaKpis: document.getElementById("agenda-presenca-kpis"),
    presencaSemanaLista: document.getElementById(
      "agenda-presenca-semana-lista",
    ),
    diaTitulo: document.getElementById("agenda-dia-titulo"),
    diaLista: document.getElementById("agenda-dia-lista"),
    novoBtn: document.getElementById("agenda-novo-btn"),
    modalBackdrop: document.getElementById("agenda-modal-backdrop"),
    modalCloseBtn: document.getElementById("agenda-modal-close"),
    modalTitle: document.getElementById("agenda-modal-title"),
    form: document.getElementById("agenda-form"),
    formFeedback: document.getElementById("agenda-form-feedback"),
    feedbackTitulo: document.getElementById("agenda-feedback-titulo"),
    feedbackData: document.getElementById("agenda-feedback-data"),
    feedbackHora: document.getElementById("agenda-feedback-hora"),
    feedbackSala: document.getElementById("agenda-feedback-sala"),
    formCancel: document.getElementById("agenda-form-cancel"),
    formSubmit: document.getElementById("agenda-form-submit"),
    tipoSelect: document.getElementById("agenda-tipo-select"),
    responsavelSelect: document.getElementById("agenda-responsavel-select"),
    salaLabel: document.getElementById("agenda-sala-label"),
    salaSelect: document.getElementById("agenda-sala-select"),
    salaHint: document.getElementById("agenda-sala-hint"),
    familiaBusca: document.getElementById("agenda-familia-busca"),
    familiaSelect: document.getElementById("agenda-familia-select"),
    pacienteSelect: document.getElementById("agenda-paciente-select"),
    presencaBackdrop: document.getElementById("agenda-presenca-backdrop"),
    presencaCloseBtn: document.getElementById("agenda-presenca-close"),
    presencaSubtitle: document.getElementById("agenda-presenca-subtitle"),
    presencaStatusAgendamento: document.getElementById(
      "agenda-presenca-status-agendamento",
    ),
    presencaStatusPresenca: document.getElementById(
      "agenda-presenca-status-presenca",
    ),
    presencaJustificativa: document.getElementById(
      "agenda-presenca-justificativa",
    ),
    presencaObservacao: document.getElementById("agenda-presenca-observacao"),
    presencaHistoryList: document.getElementById(
      "agenda-presenca-history-list",
    ),
    salasBackdrop: document.getElementById("agenda-salas-backdrop"),
    salasCloseBtn: document.getElementById("agenda-salas-close"),
    salaForm: document.getElementById("agenda-sala-form"),
    salaSubmit: document.getElementById("agenda-sala-submit"),
    salaReset: document.getElementById("agenda-sala-reset"),
    salasLista: document.getElementById("agenda-salas-lista"),
  };

  const state = {
    viewDate: new Date(),
    selectedDay: shared.toDayString(new Date()),
    openPopoverDay: null,
    draggingEventId: "",
    responsavelFiltro: permissions.canViewAll ? "" : String(user.id || ""),
    profissionais: [],
    eventos: [],
    eventosById: new Map(),
    familias: [],
    searchTimer: null,
    saving: false,
    salaSaving: false,
    salaRequestId: 0,
    availableSalas: [],
    salasCatalogo: [],
    attendanceEventId: "",
    attendanceEvent: null,
    attendanceHistory: [],
  };

  const agendaContext = {
    elements,
    permissions,
    roomRequiredTypes,
    shared,
    slotMinutes,
    state,
    tiposAtendimento,
    user,
  };

  const attendance = {
    buildAttendanceQuickActions: (evento) =>
      attendanceModule.buildAttendanceQuickActions(agendaContext, evento),
    buildPresenceCounters: (events) =>
      attendanceModule.buildPresenceCounters(events),
    buildPresenceInlineBadges: (counters) =>
      attendanceModule.buildPresenceInlineBadges(counters),
    canEditEvent: (evento) =>
      attendanceModule.canEditEvent(agendaContext, evento),
    canManageAttendance: (evento) =>
      attendanceModule.canManageAttendance(agendaContext, evento),
    canManageOwnEvent: (evento) =>
      attendanceModule.canManageOwnEvent(agendaContext, evento),
    canMoveEvent: (evento) =>
      attendanceModule.canMoveEvent(agendaContext, evento),
    canMutateEvent: (evento) =>
      attendanceModule.canMutateEvent(agendaContext, evento),
    canToggleEventStatus: (evento) =>
      attendanceModule.canToggleEventStatus(agendaContext, evento),
    closeAttendanceModal: () =>
      attendanceModule.closeAttendanceModal(agendaContext),
    openAttendanceModal: (eventId) =>
      attendanceModule.openAttendanceModal(agendaContext, eventId),
    renderWeeklyPresence: () =>
      attendanceModule.renderWeeklyPresence(agendaContext),
    submitAttendance: (statusPresenca, options) =>
      attendanceModule.submitAttendance(agendaContext, statusPresenca, options),
    toShortDayLabel: (dateLike) => attendanceModule.toShortDayLabel(dateLike),
  };

  agendaContext.attendance = attendance;

  const calendar = calendarModule.create(agendaContext);
  agendaContext.calendar = calendar;
  agendaContext.renderCalendar = calendar.renderCalendar;
  agendaContext.renderSelectedDay = calendar.renderSelectedDay;

  const form = formModule.create(agendaContext);
  agendaContext.form = form;
  agendaContext.loadMonthEvents = form.loadMonthEvents;

  function bindEvents() {
    elements.prevBtn.addEventListener("click", () => calendar.changeMonth(-1));
    elements.nextBtn.addEventListener("click", () => calendar.changeMonth(1));
    elements.hojeBtn.addEventListener("click", () => {
      state.viewDate = new Date();
      state.selectedDay = shared.toDayString(new Date());
      state.openPopoverDay = null;
      calendar.setMonthPickerOpen(false);
      form.loadMonthEvents().catch((error) => shared.showToast(error.message));
    });

    if (elements.mesPickerToggle) {
      elements.mesPickerToggle.addEventListener("click", () => {
        const isOpen = !elements.mesPickerPopover?.hidden;
        calendar.setMonthPickerOpen(!isOpen);
      });
    }

    if (elements.mesPickerCancel) {
      elements.mesPickerCancel.addEventListener("click", () => {
        calendar.setMonthPickerOpen(false);
      });
    }

    if (elements.mesPickerApply) {
      elements.mesPickerApply.addEventListener("click", () => {
        calendar
          .applyMonthPickerSelection()
          .catch((error) => shared.showToast(error.message));
      });
    }

    if (elements.mesPickerAno) {
      elements.mesPickerAno.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        calendar
          .applyMonthPickerSelection()
          .catch((error) => shared.showToast(error.message));
      });
    }

    elements.responsavelFiltro.addEventListener("change", () => {
      state.responsavelFiltro = elements.responsavelFiltro.value || "";
      state.openPopoverDay = null;
      form.loadMonthEvents().catch((error) => shared.showToast(error.message));
    });

    if (elements.novoBtn) {
      elements.novoBtn.addEventListener("click", () => {
        form.openCreateModal().catch((error) => shared.showToast(error.message));
      });
    }

    if (elements.salasBtn) {
      elements.salasBtn.addEventListener("click", () => {
        form.openSalasModal().catch((error) => shared.showToast(error.message));
      });
    }

    elements.modalCloseBtn.addEventListener("click", (event) => {
      event.preventDefault();
      form.closeModal();
    });
    elements.formCancel.addEventListener("click", (event) => {
      event.preventDefault();
      form.closeModal();
    });
    elements.modalBackdrop.addEventListener("click", (event) => {
      if (event.target === elements.modalBackdrop) form.closeModal();
    });

    if (elements.presencaCloseBtn) {
      elements.presencaCloseBtn.addEventListener("click", (event) => {
        event.preventDefault();
        attendance.closeAttendanceModal();
      });
    }

    if (elements.presencaBackdrop) {
      elements.presencaBackdrop.addEventListener("click", (event) => {
        if (event.target === elements.presencaBackdrop) {
          attendance.closeAttendanceModal();
        }
      });
    }

    if (elements.salasCloseBtn) {
      elements.salasCloseBtn.addEventListener("click", (event) => {
        event.preventDefault();
        form.closeSalasModal();
      });
    }

    if (elements.salasBackdrop) {
      elements.salasBackdrop.addEventListener("click", (event) => {
        if (event.target === elements.salasBackdrop) form.closeSalasModal();
      });
    }

    elements.form.addEventListener("submit", form.handleFormSubmit);
    elements.diaLista.addEventListener("click", form.handleDayListActions);
    if (elements.presencaSemanaLista) {
      elements.presencaSemanaLista.addEventListener("click", (event) => {
        const card = event.target.closest("[data-presenca-day]");
        if (!card) return;
        const dayKey = String(card.getAttribute("data-presenca-day") || "");
        if (!dayKey) return;
        state.selectedDay = dayKey;
        calendar.renderCalendar();
        calendar.renderSelectedDay();
      });
    }

    document
      .querySelectorAll("[data-agenda-presenca-action]")
      .forEach((button) => {
        button.addEventListener("click", () => {
          attendance
            .submitAttendance(
              button.getAttribute("data-agenda-presenca-action"),
            )
            .catch((error) => shared.showToast(error.message));
        });
      });

    if (elements.salaForm) {
      elements.salaForm.addEventListener("submit", form.handleSalaFormSubmit);
    }
    if (elements.salaReset) {
      elements.salaReset.addEventListener("click", (event) => {
        event.preventDefault();
        form.resetSalaForm();
      });
    }
    if (elements.salasLista) {
      elements.salasLista.addEventListener("click", (event) => {
        form
          .handleSalasListActions(event)
          .catch((error) => shared.showToast(error.message));
      });
    }

    ["data", "hora"].forEach((fieldName) => {
      const field = elements.form.elements[fieldName];
      if (!field) return;
      field.addEventListener("change", () => {
        form.loadAvailableSalas(elements.salaSelect.value || "").catch((error) =>
          shared.showToast(error.message),
        );
      });
    });

    elements.tipoSelect.addEventListener("change", () => {
      form.syncSalaRequirement();
      form.loadAvailableSalas(elements.salaSelect.value || "").catch((error) =>
        shared.showToast(error.message),
      );
    });

    document.addEventListener("click", (event) => {
      let shouldRender = false;

      if (
        state.openPopoverDay &&
        !event.target.closest(".agenda-day-cell.has-multi-events")
      ) {
        state.openPopoverDay = null;
        shouldRender = true;
      }

      if (
        elements.mesPickerPopover &&
        !elements.mesPickerPopover.hidden &&
        elements.mesPickerWrap &&
        !elements.mesPickerWrap.contains(event.target)
      ) {
        calendar.setMonthPickerOpen(false);
      }

      if (shouldRender) calendar.renderCalendar();
    });

    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      if (elements.mesPickerPopover && !elements.mesPickerPopover.hidden) {
        calendar.setMonthPickerOpen(false);
      }
      if (elements.salasBackdrop && !elements.salasBackdrop.hidden) {
        form.closeSalasModal();
      }
      if (elements.modalBackdrop && !elements.modalBackdrop.hidden) {
        form.closeModal();
      }
    });

    elements.familiaBusca.addEventListener("input", () => {
      window.clearTimeout(state.searchTimer);
      state.searchTimer = window.setTimeout(() => {
        form.loadFamilies(elements.familiaBusca.value).catch((error) =>
          shared.showToast(error.message),
        );
      }, 350);
    });

    elements.familiaSelect.addEventListener("change", async () => {
      try {
        const familia = await form.loadPacientesByFamilia(
          elements.familiaSelect.value,
        );
        if (!elements.form.elements.local.value && familia?.endereco) {
          const endereco = [
            familia.endereco.rua,
            familia.endereco.numero,
            familia.endereco.bairro,
            familia.endereco.cidade,
            familia.endereco.estado,
          ]
            .filter(Boolean)
            .join(", ");
          elements.form.elements.local.value = endereco || "";
        }
      } catch (error) {
        shared.showToast(error.message);
      }
    });
  }

  async function init() {
    form.setTipoOptions();
    form.renderSalaOptions([], "");
    form.setSalaHintMessage(
      "As salas livres para este horario aparecem automaticamente aqui.",
    );
    bindEvents();
    calendar.bindDayCardDragAndDrop();

    try {
      await form.loadProfissionais();
      await form.loadFamilies("");
      await form.loadMonthEvents();
    } catch (error) {
      shared.showToast(error.message);
      elements.diaLista.innerHTML = `<p class="empty-hint">${shared.escapeHtml(
        error.message,
      )}</p>`;
    }
  }

  init();
})();
