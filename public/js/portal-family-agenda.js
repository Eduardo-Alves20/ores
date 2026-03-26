(function () {
  const root = document.querySelector("[data-page='family-agenda']");
  if (!root) return;

  const shared = window.AgendaShared;
  if (!shared) return;

  const attendanceModule = window.AgendaAttendance || {};
  const config = shared.parseJsonScript("family-agenda-config", {});

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
    presencaSemanaTitulo: document.getElementById(
      "agenda-presenca-semana-titulo"
    ),
    presencaKpis: document.getElementById("agenda-presenca-kpis"),
    presencaSemanaLista: document.getElementById("agenda-presenca-semana-lista"),
    diaTitulo: document.getElementById("agenda-dia-titulo"),
    diaLista: document.getElementById("agenda-dia-lista"),
    summaryCards: Array.from(
      document.querySelectorAll("[data-family-agenda-summary]")
    ),
    faltaBackdrop: document.getElementById("family-agenda-falta-backdrop"),
    faltaClose: document.getElementById("family-agenda-falta-close"),
    faltaCancel: document.getElementById("family-agenda-falta-cancel"),
    faltaSubmit: document.getElementById("family-agenda-falta-submit"),
    faltaSubtitle: document.getElementById("family-agenda-falta-subtitle"),
    faltaJustificativa: document.getElementById("family-agenda-falta-justificativa"),
    faltaObservacao: document.getElementById("family-agenda-falta-observacao"),
    remarcarBackdrop: document.getElementById("family-agenda-remarcacao-backdrop"),
    remarcarClose: document.getElementById("family-agenda-remarcacao-close"),
    remarcarCancel: document.getElementById("family-agenda-remarcacao-cancel"),
    remarcarSubmit: document.getElementById("family-agenda-remarcacao-submit"),
    remarcarSubtitle: document.getElementById("family-agenda-remarcacao-subtitle"),
    remarcarMotivo: document.getElementById("family-agenda-remarcacao-motivo"),
  };

  if (!elements.calendarGrid || !elements.diaLista) return;

  const buildPresenceCounters =
    typeof attendanceModule.buildPresenceCounters === "function"
      ? attendanceModule.buildPresenceCounters
      : function buildFallbackCounters(events) {
          const counters = {
            total: 0,
            presente: 0,
            falta: 0,
            faltaJustificada: 0,
            pendente: 0,
          };

          (Array.isArray(events) ? events : []).forEach((evento) => {
            counters.total += 1;
            const status = String(evento?.statusPresenca || "pendente").trim();
            if (status === "presente") counters.presente += 1;
            else if (status === "falta") counters.falta += 1;
            else if (status === "falta_justificada") counters.faltaJustificada += 1;
            else counters.pendente += 1;
          });

          return counters;
        };

  const buildPresenceInlineBadges =
    typeof attendanceModule.buildPresenceInlineBadges === "function"
      ? attendanceModule.buildPresenceInlineBadges
      : function buildFallbackBadges(counters) {
          const badges = [];
          if (counters.presente) {
            badges.push(
              `<span class="agenda-day-presence-pill is-presente">${counters.presente} P</span>`
            );
          }
          if (counters.falta) {
            badges.push(
              `<span class="agenda-day-presence-pill is-falta">${counters.falta} F</span>`
            );
          }
          if (counters.faltaJustificada) {
            badges.push(
              `<span class="agenda-day-presence-pill is-falta-justificada">${counters.faltaJustificada} J</span>`
            );
          }
          if (counters.pendente) {
            badges.push(
              `<span class="agenda-day-presence-pill is-pendente">${counters.pendente} Pend</span>`
            );
          }
          return badges.join("");
        };

  const state = {
    viewDate: normalizeMonthDate(config.referenceDate),
    selectedDay: "",
    eventos: Array.isArray(config?.initialData?.eventos)
      ? config.initialData.eventos
      : [],
    resumo: config?.initialData?.resumo || {},
    highlightEventId: String(config?.highlightEventId || "").trim(),
    actionEventId: "",
  };

  const sanitizeClassToken =
    typeof shared.sanitizeClassToken === "function"
      ? shared.sanitizeClassToken
      : function fallbackSanitizeClassToken(value, fallback) {
          const normalized = String(value || "")
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9_-]+/g, "-")
            .replace(/-{2,}/g, "-")
            .replace(/^-|-$/g, "");
          return normalized || String(fallback || "").trim().toLowerCase();
        };

  function normalizeMonthDate(value) {
    const parsed = new Date(value || Date.now());
    if (Number.isNaN(parsed.getTime())) return new Date();
    return new Date(parsed.getFullYear(), parsed.getMonth(), 1, 12, 0, 0, 0);
  }

  function getMonthReferenceValue() {
    return shared.toDayString(
      new Date(
        state.viewDate.getFullYear(),
        state.viewDate.getMonth(),
        1,
        12,
        0,
        0,
        0
      )
    );
  }

  function buildEventsByDay() {
    const map = new Map();

    state.eventos.forEach((evento) => {
      const dayKey = shared.toDayString(evento?.inicio);
      if (!dayKey) return;
      if (!map.has(dayKey)) map.set(dayKey, []);
      map.get(dayKey).push(evento);
    });

    for (const [, list] of map) {
      list.sort(
        (left, right) =>
          new Date(left?.inicio || 0).getTime() - new Date(right?.inicio || 0).getTime()
      );
    }

    return map;
  }

  function isSelectedDayVisible() {
    const selected = shared.parseDayKeyLocal(state.selectedDay);
    if (!selected || Number.isNaN(selected.getTime())) return false;
    return (
      selected.getMonth() === state.viewDate.getMonth() &&
      selected.getFullYear() === state.viewDate.getFullYear()
    );
  }

  function syncSelectedDay() {
    const highlighted = state.highlightEventId
      ? state.eventos.find(
          (evento) => String(evento?.id || "") === String(state.highlightEventId)
        )
      : null;

    if (highlighted?.inicio) {
      state.selectedDay = shared.toDayString(highlighted.inicio);
      state.highlightEventId = "";
      return;
    }

    if (isSelectedDayVisible()) return;

    const today = new Date();
    const todayKey = shared.toDayString(today);
    if (
      state.viewDate.getFullYear() === today.getFullYear() &&
      state.viewDate.getMonth() === today.getMonth()
    ) {
      state.selectedDay = todayKey;
      return;
    }

    if (state.eventos.length > 0) {
      state.selectedDay = shared.toDayString(state.eventos[0].inicio);
      return;
    }

    state.selectedDay = shared.toDayString(
      new Date(state.viewDate.getFullYear(), state.viewDate.getMonth(), 1, 12, 0, 0, 0)
    );
  }

  function renderSummary() {
    const resumo = state.resumo || {};
    elements.summaryCards.forEach((card) => {
      const key = card.getAttribute("data-family-agenda-summary");
      card.textContent = String(Number(resumo?.[key] || 0));
    });
  }

  function renderWeeklyOverview() {
    if (
      typeof attendanceModule.renderWeeklyPresence === "function" &&
      elements.presencaSemanaTitulo &&
      elements.presencaSemanaLista &&
      elements.presencaKpis
    ) {
      attendanceModule.renderWeeklyPresence({
        state: {
          selectedDay: state.selectedDay,
          eventos: state.eventos,
        },
        elements: {
          presencaSemanaTitulo: elements.presencaSemanaTitulo,
          presencaSemanaLista: elements.presencaSemanaLista,
          presencaKpis: elements.presencaKpis,
        },
      });
    }
  }

  function renderCalendar() {
    const eventosByDay = buildEventsByDay();
    const gridStart = shared.startOfCalendarGrid(state.viewDate);
    const todayKey = shared.toDayString(new Date());

    elements.mesTitulo.textContent = shared.toMonthLabel(state.viewDate).toUpperCase();
    syncMonthPickerControls();
    elements.calendarGrid.innerHTML = "";

    for (let index = 0; index < 42; index += 1) {
      const day = new Date(gridStart);
      day.setDate(gridStart.getDate() + index);

      const dayKey = shared.toDayString(day);
      const dayEvents = eventosByDay.get(dayKey) || [];
      const dayCounters = buildPresenceCounters(dayEvents);
      const outside = day.getMonth() !== state.viewDate.getMonth();

      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "agenda-day-cell";
      cell.dataset.day = dayKey;
      cell.innerHTML = `
        <div class="agenda-day-number">${day.getDate()}</div>
        <div class="agenda-day-meta">
          ${dayEvents.length ? `<span class="agenda-day-pill">${dayEvents.length} consulta(s)</span>` : ""}
          ${dayEvents.length ? `<div class="agenda-day-presence-inline">${buildPresenceInlineBadges(dayCounters)}</div>` : ""}
        </div>
      `;

      if (outside) cell.classList.add("is-outside");
      if (dayKey === todayKey) cell.classList.add("is-today");
      if (dayKey === state.selectedDay) cell.classList.add("is-selected");

      cell.addEventListener("click", () => {
        state.selectedDay = dayKey;
        renderCalendar();
        renderSelectedDay();
        renderWeeklyOverview();
      });

      elements.calendarGrid.appendChild(cell);
    }
  }

  function renderSelectedDay() {
    const selectedDate =
      shared.parseDayKeyLocal(state.selectedDay) || new Date(state.selectedDay);
    const events = state.eventos
      .filter((evento) => shared.toDayString(evento?.inicio) === state.selectedDay)
      .sort(
        (left, right) =>
          new Date(left?.inicio || 0).getTime() - new Date(right?.inicio || 0).getTime()
      );

    elements.diaTitulo.textContent = shared.toDayLabel(selectedDate);

    if (!events.length) {
      elements.diaLista.innerHTML = `
        <div class="family-agenda-empty-day">
          <p class="empty-hint">Nenhuma consulta registrada para este dia.</p>
        </div>
      `;
      return;
    }

    elements.diaLista.innerHTML = events
      .map((evento) => {
        const highlighted =
          String(evento?.id || "") === String(config?.highlightEventId || "");
        const hora = shared.toTimeRangeLabel(evento?.inicio, evento?.fim);
        const actions = buildFamilyActions(evento);

        return `
          <article class="agenda-event-card ${highlighted ? "is-highlight" : ""}">
            <div class="agenda-event-top">
              <span class="agenda-event-time">${shared.escapeHtml(hora)}</span>
              <span class="agenda-event-type">${shared.escapeHtml(evento?.tipoAtendimentoLabel || "Consulta")}</span>
            </div>
            <h4 class="agenda-event-title">${shared.escapeHtml(evento?.titulo || "Consulta")}</h4>
            <div class="agenda-event-status-row">
              <span class="agenda-event-badge status-${sanitizeClassToken(evento?.statusAgendamento, "agendado")}">${shared.escapeHtml(evento?.statusAgendamentoLabel || "Agendada")}</span>
              <span class="agenda-event-badge status-${sanitizeClassToken(evento?.statusPresenca, "pendente")}">${shared.escapeHtml(evento?.statusPresencaLabel || "Pendente")}</span>
            </div>
            <p class="agenda-event-line"><strong>Dependente:</strong> ${shared.escapeHtml(evento?.dependenteNome || "-")}</p>
            <p class="agenda-event-line"><strong>Profissional:</strong> ${shared.escapeHtml(evento?.profissionalNome || "-")}</p>
            ${evento?.salaNome && evento.salaNome !== "-" ? `<p class="agenda-event-line"><strong>Sala:</strong> ${shared.escapeHtml(evento.salaNome)}</p>` : ""}
            ${evento?.local && evento.local !== "-" ? `<p class="agenda-event-line"><strong>Local:</strong> ${shared.escapeHtml(evento.local)}</p>` : ""}
            ${actions}
          </article>
        `;
      })
      .join("");
  }

  function getEventById(eventId) {
    return state.eventos.find((item) => String(item?.id || "") === String(eventId));
  }

  function canMarkAbsence(evento) {
    if (!evento || evento?.ativo === false) return false;
    if (String(evento?.statusAgendamento || "") === "cancelado") return false;
    const inicio = new Date(evento?.inicio);
    if (Number.isNaN(inicio.getTime())) return false;
    const todayKey = shared.toDayString(new Date());
    const eventKey = shared.toDayString(inicio);
    if (!todayKey || !eventKey) return false;
    if (eventKey < todayKey) return true;
    if (eventKey > todayKey) return false;
    return inicio <= new Date();
  }

  function canRequestReschedule(evento) {
    if (!evento || evento?.ativo === false) return false;
    const statusAgendamento = String(evento?.statusAgendamento || "");
    if (statusAgendamento === "cancelado") return false;
    if (statusAgendamento === "em_negociacao_remarcacao") return false;
    if (statusAgendamento === "encerrado") return false;
    const inicio = new Date(evento?.inicio);
    if (Number.isNaN(inicio.getTime())) return false;
    const todayKey = shared.toDayString(new Date());
    const eventKey = shared.toDayString(inicio);
    if (!todayKey || !eventKey) return false;
    if (eventKey > todayKey) return true;
    if (eventKey < todayKey) return false;
    return inicio >= new Date();
  }

  function buildFamilyActions(evento) {
    const actions = [];
    const eventId = String(evento?.id || "");

    if (canMarkAbsence(evento)) {
      actions.push(
        `<button type="button" class="btn-ghost" data-family-action="falta" data-event-id="${shared.escapeHtml(eventId)}">Marcar falta</button>`
      );
    }

    if (canRequestReschedule(evento)) {
      actions.push(
        `<button type="button" class="btn-ghost" data-family-action="remarcar" data-event-id="${shared.escapeHtml(eventId)}">Solicitar remarcacao</button>`
      );
    }

    if (String(evento?.statusAgendamento || "") === "em_negociacao_remarcacao") {
      actions.push(
        `<p class="agenda-event-note">Remarcacao solicitada. Aguarde o retorno da equipe.</p>`
      );
    }

    if (!actions.length) return "";
    return `<div class="agenda-event-actions family-agenda-actions">${actions.join("")}</div>`;
  }

  function setModalOpen(backdrop, open) {
    if (!backdrop) return;
    const shouldOpen = Boolean(open);
    backdrop.hidden = !shouldOpen;
    document.body.style.overflow = shouldOpen ? "hidden" : "";
  }

  function closeAbsenceModal() {
    state.actionEventId = "";
    if (elements.faltaJustificativa) elements.faltaJustificativa.value = "";
    if (elements.faltaObservacao) elements.faltaObservacao.value = "";
    if (elements.faltaSubtitle) elements.faltaSubtitle.textContent = "Selecione a consulta.";
    setModalOpen(elements.faltaBackdrop, false);
  }

  function closeRescheduleModal() {
    state.actionEventId = "";
    if (elements.remarcarMotivo) elements.remarcarMotivo.value = "";
    if (elements.remarcarSubtitle) {
      elements.remarcarSubtitle.textContent = "Explique o motivo da remarcacao.";
    }
    setModalOpen(elements.remarcarBackdrop, false);
  }

  function openAbsenceModal(eventId) {
    const evento = getEventById(eventId);
    if (!evento) return;
    state.actionEventId = String(eventId);
    if (elements.faltaSubtitle) {
      elements.faltaSubtitle.textContent = `${evento?.titulo || "Consulta"} · ${shared.formatDateTime(evento?.inicio)}`;
    }
    setModalOpen(elements.faltaBackdrop, true);
  }

  function openRescheduleModal(eventId) {
    const evento = getEventById(eventId);
    if (!evento) return;
    state.actionEventId = String(eventId);
    if (elements.remarcarSubtitle) {
      elements.remarcarSubtitle.textContent = `${evento?.titulo || "Consulta"} · ${shared.formatDateTime(evento?.inicio)}`;
    }
    setModalOpen(elements.remarcarBackdrop, true);
  }

  async function submitAbsence() {
    const eventId = state.actionEventId;
    if (!eventId) return;
    const justificativaKey = String(elements.faltaJustificativa?.value || "").trim();
    const observacao = String(elements.faltaObservacao?.value || "").trim();

    try {
      const data = await shared.requestJson(
        `${config.absenceEndpoint}/${encodeURIComponent(eventId)}/falta`,
        {
          method: "PATCH",
          body: { justificativaKey, observacao },
        }
      );
      shared.showSuccess(data?.mensagem || "Falta registrada com sucesso.");
      closeAbsenceModal();
      await loadMonthEvents();
    } catch (error) {
      shared.showToast(error.message || "Nao foi possivel registrar a falta.");
    }
  }

  async function submitReschedule() {
    const eventId = state.actionEventId;
    if (!eventId) return;
    const motivo = String(elements.remarcarMotivo?.value || "").trim();
    if (!motivo || motivo.length < 3) {
      shared.showToast("Informe o motivo da remarcacao.");
      return;
    }

    try {
      const data = await shared.requestJson(
        `${config.rescheduleEndpoint}/${encodeURIComponent(eventId)}/remarcacao`,
        {
          method: "POST",
          body: { motivo },
        }
      );
      shared.showSuccess(data?.mensagem || "Solicitacao enviada.");
      closeRescheduleModal();
      await loadMonthEvents();
    } catch (error) {
      shared.showToast(error.message || "Nao foi possivel solicitar a remarcacao.");
    }
  }

  function syncMonthPickerControls() {
    if (!elements.mesPickerMes || !elements.mesPickerAno) return;

    if (!elements.mesPickerMes.dataset.ready) {
      elements.mesPickerMes.innerHTML = shared.MONTH_NAMES.map(
        (label, index) => `<option value="${index}">${label}</option>`
      ).join("");
      elements.mesPickerMes.dataset.ready = "1";
    }

    const viewYear = state.viewDate.getFullYear();
    const nowYear = new Date().getFullYear();
    const yearStart = Math.min(viewYear - 5, nowYear - 10);
    const yearEnd = Math.max(viewYear + 5, nowYear + 10);
    const expectedRange = `${yearStart}:${yearEnd}`;

    if (elements.mesPickerAno.dataset.range !== expectedRange) {
      const years = [];
      for (let year = yearStart; year <= yearEnd; year += 1) {
        years.push(`<option value="${year}">${year}</option>`);
      }
      elements.mesPickerAno.innerHTML = years.join("");
      elements.mesPickerAno.dataset.range = expectedRange;
    }

    elements.mesPickerMes.value = String(state.viewDate.getMonth());
    elements.mesPickerAno.value = String(viewYear);
  }

  function setMonthPickerOpen(open) {
    if (!elements.mesPickerPopover || !elements.mesPickerToggle) return;
    const next = !!open;
    elements.mesPickerPopover.hidden = !next;
    elements.mesPickerToggle.setAttribute("aria-expanded", String(next));
    if (next && elements.mesPickerMes) {
      syncMonthPickerControls();
      elements.mesPickerMes.focus();
    }
  }

  async function applyMonthPickerSelection() {
    if (!elements.mesPickerMes || !elements.mesPickerAno) return;

    const nextMonth = Number.parseInt(elements.mesPickerMes.value, 10);
    const nextYear = Number.parseInt(elements.mesPickerAno.value, 10);
    if (Number.isNaN(nextMonth) || Number.isNaN(nextYear)) return;

    state.viewDate = new Date(nextYear, nextMonth, 1, 12, 0, 0, 0);
    state.selectedDay = "";
    setMonthPickerOpen(false);
    await loadMonthEvents();
  }

  async function loadMonthEvents() {
    try {
      const data = await shared.requestJson(
        `${config.eventsEndpoint}?referencia=${encodeURIComponent(getMonthReferenceValue())}`
      );

      state.eventos = Array.isArray(data?.eventos) ? data.eventos : [];
      state.resumo = data?.resumo || {};
      syncSelectedDay();
      renderSummary();
      renderCalendar();
      renderSelectedDay();
      renderWeeklyOverview();
    } catch (error) {
      shared.showToast(error.message || "Nao foi possivel carregar a agenda.");
      elements.diaLista.innerHTML = `<p class="empty-hint">${shared.escapeHtml(
        error.message || "Erro ao carregar a agenda."
      )}</p>`;
    }
  }

  function changeMonth(step) {
    state.viewDate = new Date(
      state.viewDate.getFullYear(),
      state.viewDate.getMonth() + step,
      1,
      12,
      0,
      0,
      0
    );
    state.selectedDay = "";
    loadMonthEvents();
  }

  function bindEvents() {
    if (elements.prevBtn) {
      elements.prevBtn.addEventListener("click", () => changeMonth(-1));
    }

    if (elements.nextBtn) {
      elements.nextBtn.addEventListener("click", () => changeMonth(1));
    }

    if (elements.hojeBtn) {
      elements.hojeBtn.addEventListener("click", () => {
        state.viewDate = normalizeMonthDate(new Date());
        state.selectedDay = "";
        loadMonthEvents();
      });
    }

    if (elements.mesPickerToggle) {
      elements.mesPickerToggle.addEventListener("click", () => {
        const isOpen = !elements.mesPickerPopover?.hidden;
        setMonthPickerOpen(!isOpen);
      });
    }

    if (elements.mesPickerCancel) {
      elements.mesPickerCancel.addEventListener("click", () => setMonthPickerOpen(false));
    }

    if (elements.mesPickerApply) {
      elements.mesPickerApply.addEventListener("click", () => {
        applyMonthPickerSelection().catch((error) => shared.showToast(error.message));
      });
    }

    if (elements.mesPickerAno) {
      elements.mesPickerAno.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        applyMonthPickerSelection().catch((error) => shared.showToast(error.message));
      });
    }

    if (elements.presencaSemanaLista) {
      elements.presencaSemanaLista.addEventListener("click", (event) => {
        const card = event.target.closest("[data-presenca-day]");
        if (!card) return;
        const dayKey = String(card.getAttribute("data-presenca-day") || "");
        if (!dayKey) return;
        state.selectedDay = dayKey;
        renderCalendar();
        renderSelectedDay();
        renderWeeklyOverview();
      });
    }

    if (elements.faltaClose) {
      elements.faltaClose.addEventListener("click", closeAbsenceModal);
    }

    if (elements.faltaCancel) {
      elements.faltaCancel.addEventListener("click", closeAbsenceModal);
    }

    if (elements.faltaSubmit) {
      elements.faltaSubmit.addEventListener("click", () => {
        submitAbsence().catch(() => {});
      });
    }

    if (elements.remarcarClose) {
      elements.remarcarClose.addEventListener("click", closeRescheduleModal);
    }

    if (elements.remarcarCancel) {
      elements.remarcarCancel.addEventListener("click", closeRescheduleModal);
    }

    if (elements.remarcarSubmit) {
      elements.remarcarSubmit.addEventListener("click", () => {
        submitReschedule().catch(() => {});
      });
    }

    document.addEventListener("click", (event) => {
      if (
        elements.mesPickerPopover &&
        !elements.mesPickerPopover.hidden &&
        elements.mesPickerWrap &&
        !elements.mesPickerWrap.contains(event.target)
      ) {
        setMonthPickerOpen(false);
      }

      const actionBtn = event.target.closest("[data-family-action]");
      if (actionBtn) {
        const action = String(actionBtn.getAttribute("data-family-action") || "");
        const eventId = String(actionBtn.getAttribute("data-event-id") || "");
        if (action === "falta") openAbsenceModal(eventId);
        if (action === "remarcar") openRescheduleModal(eventId);
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        setMonthPickerOpen(false);
        if (elements.faltaBackdrop && !elements.faltaBackdrop.hidden) {
          closeAbsenceModal();
        }
        if (elements.remarcarBackdrop && !elements.remarcarBackdrop.hidden) {
          closeRescheduleModal();
        }
      }
    });
  }

  bindEvents();
  syncSelectedDay();
  renderSummary();
  renderCalendar();
  renderSelectedDay();
  renderWeeklyOverview();
  loadMonthEvents();
})();
