(function () {
  const root = document.querySelector("[data-page='agenda']");
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
    const headers = Object.assign(
      { Accept: "application/json" },
      options.body ? { "Content-Type": "application/json" } : {},
      options.headers || {}
    );

    const response = await fetch(url, {
      method: options.method || "GET",
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    const contentType = response.headers.get("content-type") || "";
    const payload = contentType.includes("application/json") ? await response.json() : await response.text();

    if (!response.ok) {
      const message = payload?.erro || payload?.message?.[0] || "Erro na requisição.";
      throw new Error(message);
    }

    return payload;
  }

  function showToast(message) {
    if (typeof window.appNotifyError === "function") {
      window.appNotifyError(message);
      return;
    }
    window.alert(message);
  }

  function showSuccess(message) {
    const text = String(message || "").trim();
    if (!text) return;
    if (typeof window.appNotifySuccess === "function") {
      window.appNotifySuccess(text);
      return;
    }
  }

  async function confirmAction(options = {}) {
    const defaults = {
      title: "Confirmar acao",
      text: "Deseja continuar?",
      icon: "question",
      confirmButtonText: "Sim",
      cancelButtonText: "Cancelar",
    };

    const payload = Object.assign({}, defaults, options);
    if (typeof window.appConfirm === "function") {
      return window.appConfirm(payload);
    }

    return window.confirm(payload.text || defaults.text);
  }

  const DAY_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

  function parseDayKeyLocal(dayKey) {
    const raw = String(dayKey || "").trim();
    if (!DAY_KEY_PATTERN.test(raw)) return null;
    const [year, month, day] = raw.split("-").map(Number);
    const dt = new Date(year, month - 1, day, 12, 0, 0, 0);
    if (Number.isNaN(dt.getTime())) return null;
    return dt;
  }

  function toDayString(dateLike) {
    const dayKey = String(dateLike || "").trim();
    if (DAY_KEY_PATTERN.test(dayKey)) return dayKey;

    const dt = new Date(dateLike);
    if (Number.isNaN(dt.getTime())) return "";
    const year = dt.getFullYear();
    const month = String(dt.getMonth() + 1).padStart(2, "0");
    const day = String(dt.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function toMonthLabel(dateLike) {
    const dt = new Date(dateLike);
    if (Number.isNaN(dt.getTime())) return "";
    return new Intl.DateTimeFormat("pt-BR", {
      month: "long",
      year: "numeric",
    }).format(dt);
  }

  function toDayLabel(dateLike) {
    const dt = parseDayKeyLocal(dateLike) || new Date(dateLike);
    if (Number.isNaN(dt.getTime())) return "-";
    return new Intl.DateTimeFormat("pt-BR", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    }).format(dt);
  }

  function formatDateTime(dateLike) {
    const dt = new Date(dateLike);
    if (Number.isNaN(dt.getTime())) return "-";
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(dt);
  }

  function toDateInputValue(dateLike) {
    return toDayString(dateLike);
  }

  function toTimeInputValue(dateLike) {
    const dt = new Date(dateLike);
    if (Number.isNaN(dt.getTime())) return "09:00";
    const h = String(dt.getHours()).padStart(2, "0");
    const m = String(dt.getMinutes()).padStart(2, "0");
    return `${h}:${m}`;
  }

  function toHourLabel(dateLike) {
    const dt = new Date(dateLike);
    if (Number.isNaN(dt.getTime())) return "--:--";
    return dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }

  function mergeDateAndTime(dateStr, timeStr) {
    if (!dateStr || !timeStr) return null;
    const raw = `${dateStr}T${timeStr}:00`;
    const dt = new Date(raw);
    if (Number.isNaN(dt.getTime())) return null;
    return dt.toISOString();
  }

  function addMinutes(dateLike, minutes) {
    const dt = new Date(dateLike);
    if (Number.isNaN(dt.getTime())) return null;
    return new Date(dt.getTime() + minutes * 60 * 1000);
  }

  function buildEndIso(startIso) {
    const end = addMinutes(startIso, slotMinutes);
    return end ? end.toISOString() : null;
  }

  function startOfCalendarGrid(monthDate) {
    const first = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
    const diff = first.getDay();
    return new Date(first.getFullYear(), first.getMonth(), first.getDate() - diff);
  }

  function getVisibleRange(monthDate) {
    const start = startOfCalendarGrid(monthDate);
    const end = new Date(start);
    end.setDate(end.getDate() + 42);
    return { start, end };
  }

  function normalizeTypeLabel(value) {
    const labels = {
      visita_domiciliar: "Visita Domiciliar",
      atendimento_sede: "Atendimento na Sede",
      entrega_beneficio: "Entrega de Benefício",
      reuniao_equipe: "Reunião de Equipe",
      outro: "Outro",
    };
    return labels[value] || value || "Outro";
  }

  function requiresRoomSelection(tipoAtendimento) {
    return roomRequiredTypes.includes(String(tipoAtendimento || "").trim());
  }

  function toTimeRangeLabel(inicioLike, fimLike) {
    const inicio = new Date(inicioLike);
    const fim = new Date(fimLike);
    if (Number.isNaN(inicio.getTime())) return "--:--";
    if (Number.isNaN(fim.getTime())) return toHourLabel(inicio);
    return `${toHourLabel(inicio)} - ${toHourLabel(fim)}`;
  }

  const MONTH_NAMES = [
    "Janeiro",
    "Fevereiro",
    "Marco",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro",
  ];

  const config = parseJsonScript("agenda-config", {});
  const user = config.user || {};
  const permissions = config.permissions || {};
  const tiposAtendimento = Array.isArray(config.tiposAtendimento) ? config.tiposAtendimento : [];
  const roomRequiredTypes = Array.isArray(config.roomRequiredTypes) ? config.roomRequiredTypes : [];
  const slotMinutes = Number(config.slotMinutes) > 0 ? Number(config.slotMinutes) : 30;

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
    presencaSemanaTitulo: document.getElementById("agenda-presenca-semana-titulo"),
    presencaKpis: document.getElementById("agenda-presenca-kpis"),
    presencaSemanaLista: document.getElementById("agenda-presenca-semana-lista"),
    diaTitulo: document.getElementById("agenda-dia-titulo"),
    diaLista: document.getElementById("agenda-dia-lista"),
    novoBtn: document.getElementById("agenda-novo-btn"),
    modalBackdrop: document.getElementById("agenda-modal-backdrop"),
    modalCloseBtn: document.getElementById("agenda-modal-close"),
    modalTitle: document.getElementById("agenda-modal-title"),
    form: document.getElementById("agenda-form"),
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
    presencaStatusAgendamento: document.getElementById("agenda-presenca-status-agendamento"),
    presencaStatusPresenca: document.getElementById("agenda-presenca-status-presenca"),
    presencaJustificativa: document.getElementById("agenda-presenca-justificativa"),
    presencaObservacao: document.getElementById("agenda-presenca-observacao"),
    presencaHistoryList: document.getElementById("agenda-presenca-history-list"),
    salasBackdrop: document.getElementById("agenda-salas-backdrop"),
    salasCloseBtn: document.getElementById("agenda-salas-close"),
    salaForm: document.getElementById("agenda-sala-form"),
    salaSubmit: document.getElementById("agenda-sala-submit"),
    salaReset: document.getElementById("agenda-sala-reset"),
    salasLista: document.getElementById("agenda-salas-lista"),
  };

  const state = {
    viewDate: new Date(),
    selectedDay: toDayString(new Date()),
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

  function canMutateEvent(evento) {
    if (permissions.canViewAll) return true;
    return String(evento?.responsavel?._id || "") === String(user?.id || "");
  }

  function canManageAttendance(evento) {
    return permissions.canRegisterAttendance && canMutateEvent(evento);
  }

  function buildAttendanceQuickActions(evento) {
    if (!canManageAttendance(evento)) return "";

    const currentStatus = String(evento?.statusPresenca || "pendente").trim();
    const actionButtons = [
      {
        action: "marcar-presente",
        tone: "presente",
        icon: "fa-thumbs-up",
        label: "Marcar presente",
        active: currentStatus === "presente",
      },
      {
        action: "marcar-falta",
        tone: "falta",
        icon: "fa-thumbs-down",
        label: "Marcar falta",
        active: currentStatus === "falta",
      },
      {
        action: "marcar-falta-justificada",
        tone: "justificada",
        icon: "fa-file-circle-check",
        label: "Marcar falta justificada",
        active: currentStatus === "falta_justificada",
      },
      {
        action: "presenca",
        tone: "detalhe",
        icon: "fa-clipboard-list",
        label: "Abrir ficha de presenca",
        active: false,
      },
    ];

    return `
      <div class="agenda-attendance-quick">
        <span class="agenda-attendance-quick-label">Registrar:</span>
        <div class="agenda-attendance-quick-buttons">
          ${actionButtons
            .map(
              (button) => `
                <button
                  type="button"
                  class="agenda-attendance-quick-btn is-${button.tone} ${button.active ? "is-active" : ""}"
                  data-action="${button.action}"
                  data-id="${evento._id}"
                  title="${button.label}"
                  aria-label="${button.label}"
                >
                  <i class="fa-solid ${button.icon}" aria-hidden="true"></i>
                </button>
              `
            )
            .join("")}
        </div>
      </div>
    `;
  }

  function startOfWeek(dateLike) {
    const base = parseDayKeyLocal(dateLike) || new Date(dateLike);
    if (Number.isNaN(base.getTime())) return new Date();
    const normalized = new Date(base.getFullYear(), base.getMonth(), base.getDate(), 12, 0, 0, 0);
    const day = normalized.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    normalized.setDate(normalized.getDate() + diff);
    return normalized;
  }

  function endOfWeek(dateLike) {
    const start = startOfWeek(dateLike);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return end;
  }

  function buildPresenceCounters(events) {
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
      if (status === "presente") {
        counters.presente += 1;
      } else if (status === "falta") {
        counters.falta += 1;
      } else if (status === "falta_justificada") {
        counters.faltaJustificada += 1;
      } else {
        counters.pendente += 1;
      }
    });

    return counters;
  }

  function buildPresenceInlineBadges(counters) {
    const badges = [];
    if (counters.presente) badges.push(`<span class="agenda-day-presence-pill is-presente">${counters.presente} P</span>`);
    if (counters.falta) badges.push(`<span class="agenda-day-presence-pill is-falta">${counters.falta} F</span>`);
    if (counters.faltaJustificada) {
      badges.push(`<span class="agenda-day-presence-pill is-falta-justificada">${counters.faltaJustificada} J</span>`);
    }
    if (counters.pendente) badges.push(`<span class="agenda-day-presence-pill is-pendente">${counters.pendente} Pend</span>`);
    return badges.join("");
  }

  function toShortDayLabel(dateLike) {
    const dt = parseDayKeyLocal(dateLike) || new Date(dateLike);
    if (Number.isNaN(dt.getTime())) return "-";
    return new Intl.DateTimeFormat("pt-BR", {
      weekday: "short",
      day: "2-digit",
      month: "2-digit",
    }).format(dt);
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatHistoryItems(items) {
    const list = Array.isArray(items) ? items : [];
    if (!list.length) {
      elements.presencaHistoryList.innerHTML = '<p class="empty-hint">Nenhum historico registrado ainda.</p>';
      return;
    }

    elements.presencaHistoryList.innerHTML = list
      .map(
        (item) => `
          <article class="agenda-history-card">
            <header>
              <strong>${escapeHtml(item?.titulo || "Atualizacao")}</strong>
              <span>${escapeHtml(item?.createdAtLabel || "-")}</span>
            </header>
            <p>${escapeHtml(item?.descricao || "-")}</p>
            <small>${escapeHtml(item?.atorNome || "Sistema")}</small>
          </article>
        `
      )
      .join("");
  }

  function fillAttendanceModal(evento, historico) {
    state.attendanceEvent = evento || null;
    state.attendanceHistory = Array.isArray(historico) ? historico : [];
    elements.presencaSubtitle.textContent = evento
      ? `${evento.titulo || "Agendamento"} · ${formatDateTime(evento.inicio)}`
      : "Agendamento";
    elements.presencaStatusAgendamento.textContent = evento?.statusAgendamentoLabel || "Agendado";
    elements.presencaStatusPresenca.textContent = evento?.statusPresencaLabel || "Pendente";
    if (elements.presencaJustificativa) {
      elements.presencaJustificativa.value = evento?.presencaJustificativaLabel || "";
    }
    elements.presencaObservacao.value = evento?.presencaObservacao || "";
    formatHistoryItems(state.attendanceHistory);
  }

  function closeAttendanceModal() {
    state.attendanceEventId = "";
    state.attendanceEvent = null;
    state.attendanceHistory = [];
    elements.presencaBackdrop.hidden = true;
    if (elements.presencaJustificativa) {
      elements.presencaJustificativa.value = "";
    }
    elements.presencaObservacao.value = "";
    elements.presencaHistoryList.innerHTML = '<p class="empty-hint">Nenhum historico carregado.</p>';
    document.body.style.overflow =
      !elements.modalBackdrop.hidden || (elements.salasBackdrop && !elements.salasBackdrop.hidden) ? "hidden" : "";
  }

  async function openAttendanceModal(eventId) {
    if (!eventId) return;

    state.attendanceEventId = String(eventId);
    elements.presencaBackdrop.hidden = false;
    document.body.style.overflow = "hidden";
    elements.presencaSubtitle.textContent = "Carregando detalhes do agendamento...";
    elements.presencaStatusAgendamento.textContent = "Carregando";
    elements.presencaStatusPresenca.textContent = "Carregando";
    elements.presencaHistoryList.innerHTML = '<p class="empty-hint">Carregando historico...</p>';

    try {
      const data = await requestJson(`/api/agenda/eventos/${eventId}`);
      fillAttendanceModal(data?.evento || null, data?.historico || []);
    } catch (error) {
      showToast(error.message || "Nao foi possivel carregar o historico do agendamento.", "error");
      closeAttendanceModal();
    }
  }

  async function submitAttendance(statusPresenca, options = {}) {
    const eventId = options.eventId || state.attendanceEventId || state.attendanceEvent?._id;
    if (!eventId) return;

    const observacao =
      typeof options.observacao === "string"
        ? String(options.observacao).trim()
        : String(elements.presencaObservacao?.value || "").trim();
    const justificativaKey = String(elements.presencaJustificativa?.value || "").trim();

    try {
      const data = await requestJson(`/api/agenda/eventos/${eventId}/presenca`, {
        method: "PATCH",
        body: {
          statusPresenca,
          observacao,
          justificativaKey,
        },
      });

      if (data?.evento?._id) {
        state.eventosById.set(String(data.evento._id), data.evento);
        state.eventos = state.eventos.map((item) =>
          String(item._id) === String(data.evento._id) ? data.evento : item
        );
      }

      if (state.attendanceEventId && String(state.attendanceEventId) === String(eventId)) {
        fillAttendanceModal(data?.evento || null, data?.historico || []);
      }
      renderCalendar();
      renderSelectedDay();
      showSuccess(data?.mensagem || "Presenca registrada com sucesso.");
    } catch (error) {
      showToast(error.message || "Nao foi possivel atualizar a presenca.");
    }
  }

  function buildEventosByDay() {
    const map = new Map();
    state.eventosById = new Map();
    state.eventos.forEach((evento) => {
      const dia = toDayString(evento.inicio);
      if (!map.has(dia)) map.set(dia, []);
      map.get(dia).push(evento);
      state.eventosById.set(String(evento._id), evento);
    });

    for (const [, list] of map) {
      list.sort((a, b) => new Date(a.inicio).getTime() - new Date(b.inicio).getTime());
    }

    return map;
  }

  function renderWeeklyPresence() {
    if (!elements.presencaSemanaTitulo || !elements.presencaSemanaLista || !elements.presencaKpis) return;

    const selectedBase = parseDayKeyLocal(state.selectedDay) || new Date();
    const weekStart = startOfWeek(selectedBase);
    const weekEnd = endOfWeek(selectedBase);
    const weekDays = [];

    for (let index = 0; index < 7; index += 1) {
      const current = new Date(weekStart);
      current.setDate(weekStart.getDate() + index);
      const dayKey = toDayString(current);
      const eventos = state.eventos
        .filter((evento) => toDayString(evento.inicio) === dayKey)
        .sort((a, b) => new Date(a.inicio).getTime() - new Date(b.inicio).getTime());
      weekDays.push({
        dayKey,
        date: current,
        eventos,
        counters: buildPresenceCounters(eventos),
      });
    }

    const weekCounters = buildPresenceCounters(weekDays.flatMap((item) => item.eventos));
    elements.presencaSemanaTitulo.textContent = `${toShortDayLabel(weekStart)} a ${toShortDayLabel(weekEnd)}`;
    elements.presencaKpis.innerHTML = `
      <span class="agenda-presenca-kpi is-total">${weekCounters.total} agendados</span>
      <span class="agenda-presenca-kpi is-presente">${weekCounters.presente} presentes</span>
      <span class="agenda-presenca-kpi is-falta">${weekCounters.falta + weekCounters.faltaJustificada} faltas</span>
      <span class="agenda-presenca-kpi is-pendente">${weekCounters.pendente} pendentes</span>
    `;

    elements.presencaSemanaLista.innerHTML = weekDays
      .map((item) => {
        const badges = buildPresenceInlineBadges(item.counters);
        return `
          <button
            type="button"
            class="agenda-presenca-day-card ${item.dayKey === state.selectedDay ? "is-active" : ""}"
            data-presenca-day="${item.dayKey}"
          >
            <div class="agenda-presenca-day-top">
              <strong>${toShortDayLabel(item.date)}</strong>
              <span>${item.counters.total} agenda(s)</span>
            </div>
            <div class="agenda-presenca-day-stats">
              <span><b>${item.counters.presente}</b> presentes</span>
              <span><b>${item.counters.falta}</b> faltas</span>
              <span><b>${item.counters.faltaJustificada}</b> justificadas</span>
              <span><b>${item.counters.pendente}</b> pendentes</span>
            </div>
            <div class="agenda-presenca-day-badges">
              ${badges || '<span class="agenda-day-presence-pill is-empty">Sem registros</span>'}
            </div>
          </button>
        `;
      })
      .join("");
  }

  function ensureSelectedDayVisible() {
    const month = state.viewDate.getMonth();
    const year = state.viewDate.getFullYear();
    const selected = parseDayKeyLocal(state.selectedDay) || new Date(state.selectedDay);
    if (Number.isNaN(selected.getTime())) {
      state.selectedDay = toDayString(new Date(year, month, 1));
      return;
    }
    if (selected.getMonth() !== month || selected.getFullYear() !== year) {
      state.selectedDay = toDayString(new Date(year, month, 1));
    }
  }

  function renderCalendar() {
    ensureSelectedDayVisible();
    const eventosByDay = buildEventosByDay();
    const gridStart = startOfCalendarGrid(state.viewDate);
    const today = toDayString(new Date());

    elements.mesTitulo.textContent = toMonthLabel(state.viewDate).toUpperCase();
    syncMonthPickerControls();
    elements.calendarGrid.innerHTML = "";

    for (let i = 0; i < 42; i += 1) {
      const day = new Date(gridStart);
      day.setDate(gridStart.getDate() + i);
      const dayKey = toDayString(day);
      const dayEvents = eventosByDay.get(dayKey) || [];
      const dayCounters = buildPresenceCounters(dayEvents);
      const hasMultipleEvents = dayEvents.length > 1;
      const movableEvents = dayEvents.filter((evento) => canMutateEvent(evento) && permissions.canMove);
      const dragCandidate = !hasMultipleEvents && movableEvents.length === 1 ? movableEvents[0] : null;
      const outside = day.getMonth() !== state.viewDate.getMonth();

      const cell = document.createElement("div");
      cell.className = "agenda-day-cell";
      cell.dataset.day = dayKey;
      cell.setAttribute("role", "button");
      cell.setAttribute("tabindex", "0");
      cell.setAttribute("aria-label", `Selecionar dia ${day.getDate()}`);
      cell.innerHTML = `
        <div class="agenda-day-number">${day.getDate()}</div>
        <div class="agenda-day-meta">
          ${dayEvents.length ? `<span class="agenda-day-pill">${dayEvents.length} evento(s)</span>` : ""}
          ${dayEvents.length ? `<div class="agenda-day-presence-inline">${buildPresenceInlineBadges(dayCounters)}</div>` : ""}
        </div>
      `;

      if (outside) cell.classList.add("is-outside");
      if (dayKey === today) cell.classList.add("is-today");
      if (dayKey === state.selectedDay) cell.classList.add("is-selected");
      if (hasMultipleEvents) cell.classList.add("has-multi-events");
      if (state.openPopoverDay === dayKey && hasMultipleEvents) cell.classList.add("is-popover-open");

      if (dragCandidate) {
        cell.setAttribute("draggable", "true");
        cell.classList.add("is-draggable-event");
        cell.dataset.eventId = String(dragCandidate._id);
        cell.title = "Arraste para mover este evento para outro dia.";
      } else if (hasMultipleEvents) {
        cell.title = "Passe o mouse ou clique no balao de eventos para escolher o item e arrastar.";

        const popover = document.createElement("div");
        popover.className = "agenda-day-events-popover";
        popover.setAttribute("data-no-day-select", "true");

        const popoverTitle = document.createElement("p");
        popoverTitle.className = "agenda-day-events-title";
        popoverTitle.textContent = "Arraste o evento desejado";
        popover.appendChild(popoverTitle);

        const popoverList = document.createElement("div");
        popoverList.className = "agenda-day-events-list";

        dayEvents.forEach((evento) => {
          const canMoveThis = canMutateEvent(evento) && permissions.canMove;
          const item = document.createElement("div");
          item.className = `agenda-day-events-item ${canMoveThis ? "is-draggable" : "is-locked"}`;
          item.setAttribute("data-no-day-select", "true");
          item.dataset.eventId = String(evento._id);

          if (canMoveThis) {
            item.setAttribute("draggable", "true");
            item.title = "Arraste para mover este evento.";
          } else {
            item.title = "Sem permissao para mover este evento.";
          }

          const head = document.createElement("div");
          head.className = "agenda-day-events-item-head";

          const time = document.createElement("strong");
          time.textContent = toHourLabel(evento.inicio);

          const tipo = document.createElement("span");
          tipo.textContent = normalizeTypeLabel(evento.tipoAtendimento);

          head.appendChild(time);
          head.appendChild(tipo);

          const title = document.createElement("p");
          title.className = "agenda-day-events-item-title";
          title.textContent = String(evento.titulo || "Sem titulo");

          const meta = document.createElement("p");
          meta.className = "agenda-day-events-item-meta";
          meta.textContent = `Resp: ${evento?.responsavel?.nome || "-"}`;

          item.appendChild(head);
          item.appendChild(title);
          item.appendChild(meta);
          popoverList.appendChild(item);
        });

        popover.appendChild(popoverList);

        popover.addEventListener("dragstart", (event) => {
          const item = event.target.closest(".agenda-day-events-item[draggable='true']");
          if (!item) return;
          const eventId = item.dataset.eventId;
          if (!eventId) return;
          event.stopPropagation();
          state.draggingEventId = String(eventId);
          event.dataTransfer.setData("text/plain", eventId);
          event.dataTransfer.effectAllowed = "move";
          cell.classList.add("is-dragging");
        });

        popover.addEventListener("dragend", (event) => {
          event.stopPropagation();
          state.draggingEventId = "";
          cell.classList.remove("is-dragging");
        });

        cell.appendChild(popover);
      }

      cell.addEventListener("click", (event) => {
        if (event.target.closest("[data-no-day-select='true']")) return;
        if (event.target.closest(".agenda-day-pill") && hasMultipleEvents) {
          state.openPopoverDay = state.openPopoverDay === dayKey ? null : dayKey;
          renderCalendar();
          return;
        }
        state.openPopoverDay = null;
        state.selectedDay = dayKey;
        renderCalendar();
        renderSelectedDay();
      });

      cell.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        state.openPopoverDay = null;
        state.selectedDay = dayKey;
        renderCalendar();
        renderSelectedDay();
      });

      cell.addEventListener("dragstart", (event) => {
        if (event.target !== cell) return;
        const eventId = cell.dataset.eventId;
        if (!eventId) {
          event.preventDefault();
          return;
        }
        state.draggingEventId = String(eventId);
        event.dataTransfer.setData("text/plain", eventId);
        event.dataTransfer.effectAllowed = "move";
        cell.classList.add("is-dragging");
      });

      cell.addEventListener("dragend", () => {
        state.draggingEventId = "";
        cell.classList.remove("is-dragging");
      });

      cell.addEventListener("dragover", (event) => {
        event.preventDefault();
        cell.classList.add("is-drop-target");
      });

      cell.addEventListener("dragleave", () => {
        cell.classList.remove("is-drop-target");
      });

      cell.addEventListener("drop", async (event) => {
        event.preventDefault();
        cell.classList.remove("is-drop-target");
        const eventId = event.dataTransfer.getData("text/plain") || state.draggingEventId;
        if (!eventId) return;

        const agendaEvent = state.eventosById.get(String(eventId));
        if (!agendaEvent || !canMutateEvent(agendaEvent) || !permissions.canMove) return;
        if (toDayString(agendaEvent.inicio) === dayKey) return;

        try {
          state.openPopoverDay = null;
          await requestJson(`/api/agenda/eventos/${eventId}/mover`, {
            method: "PATCH",
            body: { novaData: dayKey },
          });
          await loadMonthEvents();
        } catch (error) {
          showToast(error.message);
        } finally {
          state.draggingEventId = "";
        }
      });

      elements.calendarGrid.appendChild(cell);
    }
  }

  function renderSelectedDay() {
    const dayDate = parseDayKeyLocal(state.selectedDay) || new Date(state.selectedDay);
    const eventos = state.eventos
      .filter((evento) => toDayString(evento.inicio) === state.selectedDay)
      .sort((a, b) => new Date(a.inicio).getTime() - new Date(b.inicio).getTime());

    elements.diaTitulo.textContent = toDayLabel(dayDate);
    renderWeeklyPresence();

    if (!eventos.length) {
      elements.diaLista.innerHTML = '<p class="empty-hint">Nenhum evento para este dia.</p>';
      return;
    }

    elements.diaLista.innerHTML = eventos
      .map((evento) => {
        const hora = toTimeRangeLabel(evento.inicio, evento.fim);
        const responsavelNome = evento?.responsavel?.nome || "Sem responsável";
        const pacienteNome = evento?.paciente?.nome || "Sem paciente específico";
        const familiaNome = evento?.familia?.responsavelNome || "Sem família vinculada";
        const salaNome = evento?.sala?.nome || "";
        const statusLabel = evento.ativo ? "Inativar" : "Reativar";

        return `
          <article class="agenda-event-card ${evento.ativo ? "" : "is-inactive"}" ${canMutateEvent(evento) && permissions.canMove ? 'draggable="true"' : ''} data-event-id="${evento._id}">
            <div class="agenda-event-top">
              <span class="agenda-event-time">${hora}</span>
              <span class="agenda-event-type">${normalizeTypeLabel(evento.tipoAtendimento)}</span>
            </div>
            <h4 class="agenda-event-title">${evento.titulo}</h4>
            <div class="agenda-event-status-row">
              <span class="agenda-event-badge status-${evento.statusAgendamento || "agendado"}">${evento.statusAgendamentoLabel || "Agendado"}</span>
              <span class="agenda-event-badge status-${evento.statusPresenca || "pendente"}">${evento.statusPresencaLabel || "Pendente"}</span>
            </div>
            <p class="agenda-event-line"><strong>Responsável:</strong> ${responsavelNome}</p>
            <p class="agenda-event-line"><strong>Paciente:</strong> ${pacienteNome}</p>
            <p class="agenda-event-line"><strong>Família:</strong> ${familiaNome}</p>
            ${salaNome ? `<p class="agenda-event-line"><strong>Sala:</strong> ${salaNome}</p>` : ""}
            ${evento.local ? `<p class="agenda-event-line"><strong>Local:</strong> ${evento.local}</p>` : ""}
            ${evento.presencaRegistradaEmLabel && evento.presencaRegistradaEmLabel !== "-" ? `<p class="agenda-event-line"><strong>Ultimo registro:</strong> ${evento.presencaRegistradaEmLabel}${evento?.presencaRegistradaPor?.nome ? ` · ${evento.presencaRegistradaPor.nome}` : ""}</p>` : ""}
            ${buildAttendanceQuickActions(evento)}
            ${evento.presencaObservacao ? `<p class="agenda-event-note"><strong>Obs. presenca:</strong> ${evento.presencaObservacao}</p>` : ""}
            <div class="agenda-event-actions">
              ${canManageAttendance(evento) ? `<button type="button" class="btn-ghost" data-action="presenca" data-id="${evento._id}">Ficha da presenca</button>` : ""}
              ${canMutateEvent(evento) ? `<button type="button" class="btn-ghost" data-action="editar" data-id="${evento._id}">Editar</button>` : ""}
              ${canMutateEvent(evento) ? `<button type="button" class="btn-ghost" data-action="status" data-id="${evento._id}" data-next="${String(!evento.ativo)}">${statusLabel}</button>` : ""}
            </div>
          </article>
        `;
      })
      .join("");
  }

  function setModalOpen(open) {
    elements.modalBackdrop.hidden = !open;
    document.body.style.overflow = open || (elements.salasBackdrop && !elements.salasBackdrop.hidden) ? "hidden" : "";
  }

  function setSecondaryModalOpen(backdrop, open) {
    if (!backdrop) return;
    backdrop.hidden = !open;
    document.body.style.overflow = open || !elements.modalBackdrop.hidden ? "hidden" : "";
  }

  function getCurrentFormStartIso() {
    return mergeDateAndTime(elements.form.elements.data.value, elements.form.elements.hora.value);
  }

  function getCurrentEventId() {
    return String(elements.form.dataset.eventId || "").trim();
  }

  function setSalaHintMessage(message, tone) {
    if (!elements.salaHint) return;
    elements.salaHint.textContent = message || "";
    elements.salaHint.dataset.tone = tone || "default";
  }

  function renderSalaOptions(salas, preferredValue) {
    const list = Array.isArray(salas) ? salas : [];
    const requiresRoom = requiresRoomSelection(elements.tipoSelect.value);
    const currentValue = String(preferredValue || elements.salaSelect.value || "");
    const options = [];

    if (!requiresRoom) {
      options.push('<option value="">Sem sala vinculada</option>');
    } else {
      options.push('<option value="">Selecione uma sala</option>');
    }

    list.forEach((sala) => {
      options.push(`<option value="${sala._id}">${sala.nome}</option>`);
    });

    if (!list.length && requiresRoom) {
      options.push('<option value="" disabled>Nenhuma sala disponivel neste horario</option>');
    }

    elements.salaSelect.innerHTML = options.join("");
    elements.salaSelect.required = requiresRoom;

    if (currentValue && list.some((sala) => String(sala._id) === currentValue)) {
      elements.salaSelect.value = currentValue;
    } else if (!requiresRoom) {
      elements.salaSelect.value = "";
    } else {
      elements.salaSelect.value = "";
    }
  }

  async function loadAvailableSalas(preferredValue) {
    if (!elements.salaSelect) return;

    const inicio = getCurrentFormStartIso();
    if (!inicio) {
      elements.salaSelect.innerHTML = '<option value="">Informe data e hora</option>';
      elements.salaSelect.disabled = true;
      setSalaHintMessage("Informe data e hora para consultar as salas livres.");
      return;
    }

    const requestId = state.salaRequestId + 1;
    state.salaRequestId = requestId;
    elements.salaSelect.disabled = true;
    elements.salaSelect.innerHTML = '<option value="">Consultando salas...</option>';

    const params = new URLSearchParams();
    params.set("inicio", inicio);
    params.set("fim", buildEndIso(inicio));
    if (getCurrentEventId()) params.set("eventoId", getCurrentEventId());

    const payload = await requestJson(`/api/agenda/salas/disponiveis?${params.toString()}`);
    if (requestId !== state.salaRequestId) return;

    state.availableSalas = Array.isArray(payload.salas) ? payload.salas : [];
    renderSalaOptions(state.availableSalas, preferredValue);
    elements.salaSelect.disabled = false;

    const requiresRoom = requiresRoomSelection(elements.tipoSelect.value);
    if (!state.availableSalas.length) {
      setSalaHintMessage(
        requiresRoom
          ? "Nao ha sala livre para esse horario. Troque a hora ou cadastre outra sala."
          : "Nenhuma sala livre neste horario. Voce ainda pode salvar sem sala vinculada.",
        requiresRoom ? "warning" : "default"
      );
      return;
    }

    setSalaHintMessage(`${state.availableSalas.length} sala(s) livre(s) para esse horario.`, "success");
  }

  function syncSalaRequirement() {
    const requiresRoom = requiresRoomSelection(elements.tipoSelect.value);
    if (elements.salaLabel) {
      elements.salaLabel.textContent = requiresRoom ? "Sala de atendimento *" : "Sala de atendimento";
    }
    elements.salaSelect.required = requiresRoom;
  }

  async function loadSalasCatalogo() {
    if (!permissions.canManageRooms || !elements.salasLista) return;
    const payload = await requestJson("/api/agenda/salas?incluirInativas=true");
    state.salasCatalogo = Array.isArray(payload.salas) ? payload.salas : [];
  }

  function renderSalasCatalogo() {
    if (!elements.salasLista) return;

    if (!state.salasCatalogo.length) {
      elements.salasLista.innerHTML = '<p class="empty-hint">Nenhuma sala cadastrada.</p>';
      return;
    }

    elements.salasLista.innerHTML = state.salasCatalogo
      .map((sala) => {
        const activeLabel = sala.ativo ? "Ativa" : "Inativa";
        const toggleLabel = sala.ativo ? "Inativar" : "Reativar";
        return `
          <article class="agenda-sala-card ${sala.ativo ? "" : "is-inactive"}" data-sala-id="${sala._id}">
            <div class="agenda-sala-card-head">
              <div>
                <h4>${sala.nome}</h4>
                <p>${sala.descricao || "Sem descricao cadastrada."}</p>
              </div>
              <span class="agenda-sala-status">${activeLabel}</span>
            </div>
            <div class="agenda-sala-card-actions">
              <button type="button" class="btn-ghost" data-sala-action="editar" data-sala-id="${sala._id}">Editar</button>
              <button type="button" class="btn-ghost" data-sala-action="status" data-sala-id="${sala._id}" data-next="${String(!sala.ativo)}">${toggleLabel}</button>
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
      descricao: String(elements.salaForm.elements.descricao.value || "").trim(),
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
    const sala = state.salasCatalogo.find((item) => String(item._id) === String(salaId));
    if (!sala) return;

    if (action === "editar") {
      elements.salaForm.elements.salaId.value = String(sala._id);
      elements.salaForm.elements.nome.value = sala.nome || "";
      elements.salaForm.elements.descricao.value = sala.descricao || "";
      if (elements.salaSubmit) elements.salaSubmit.textContent = "Salvar alteracoes";
      return;
    }

    if (action === "status") {
      const next = trigger.getAttribute("data-next") === "true";
      const ok = await confirmAction({
        title: next ? "Reativar sala?" : "Inativar sala?",
        text: next ? "Deseja reativar esta sala?" : "Deseja inativar esta sala?",
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
    elements.tipoSelect.innerHTML = tiposAtendimento
      .map((tipo) => `<option value="${tipo}">${normalizeTypeLabel(tipo)}</option>`)
      .join("");
    syncSalaRequirement();
  }

  function setResponsavelOptions() {
    const options = state.profissionais
      .map((p) => `<option value="${p._id}">${p.nome} (${p.perfil})</option>`)
      .join("");
    elements.responsavelSelect.innerHTML = options;

    if (!permissions.canAssignOthers) {
      elements.responsavelSelect.disabled = true;
      elements.responsavelSelect.value = String(user.id || "");
    }
  }

  function setFiltroProfissionais() {
    if (!permissions.canViewAll) {
      elements.responsavelFiltro.innerHTML = `<option value="${String(user.id || "")}">${user.nome || "Meu calendário"}</option>`;
      elements.responsavelFiltro.disabled = true;
      return;
    }

    const options = ['<option value="">Todos os profissionais</option>']
      .concat(state.profissionais.map((p) => `<option value="${p._id}">${p.nome} (${p.perfil})</option>`));

    elements.responsavelFiltro.innerHTML = options.join("");
    elements.responsavelFiltro.value = state.responsavelFiltro || "";
  }

  async function loadProfissionais() {
    const payload = await requestJson("/api/agenda/profissionais");
    state.profissionais = Array.isArray(payload.profissionais) ? payload.profissionais : [];
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

    const options = ['<option value="">Sem família vinculada</option>']
      .concat(
        docs.map((familia) => {
          const label = `${familia?.responsavel?.nome || "Família"} - ${familia?.responsavel?.telefone || ""}`.trim();
          return `<option value="${familia._id}">${label}</option>`;
        })
      );

    elements.familiaSelect.innerHTML = options.join("");
  }

  function fillPatientsOptions(pacientes) {
    const docs = Array.isArray(pacientes) ? pacientes : [];
    const options = ['<option value="">Sem paciente específico</option>']
      .concat(docs.map((p) => `<option value="${p._id}">${p.nome}</option>`));
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
    if (state.responsavelFiltro) params.set("responsavelId", state.responsavelFiltro);

    const payload = await requestJson(`/api/agenda/eventos?${params.toString()}`);
    state.eventos = Array.isArray(payload.eventos) ? payload.eventos : [];
    renderCalendar();
    renderSelectedDay();
  }

  async function openCreateModal() {
    elements.form.reset();
    elements.form.dataset.mode = "create";
    elements.form.dataset.eventId = "";
    elements.modalTitle.textContent = "Novo Agendamento";
    elements.formSubmit.textContent = "Salvar Agendamento";

    elements.form.elements.data.value = state.selectedDay || toDateInputValue(new Date());
    elements.form.elements.hora.value = "09:00";
    elements.form.elements.tipoAtendimento.value = "visita_domiciliar";
    syncSalaRequirement();

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
    setModalOpen(true);
    await loadAvailableSalas("");
  }

  async function openEditModal(eventoId) {
    const evento = state.eventosById.get(String(eventoId));
    if (!evento) return;
    if (!canMutateEvent(evento)) {
      showToast("Você não pode editar este agendamento.");
      return;
    }

    elements.form.reset();
    elements.form.dataset.mode = "edit";
    elements.form.dataset.eventId = String(evento._id);
    elements.modalTitle.textContent = "Editar Agendamento";
    elements.formSubmit.textContent = "Salvar Alterações";

    const dt = new Date(evento.inicio);
    elements.form.elements.titulo.value = evento.titulo || "";
    elements.form.elements.data.value = toDateInputValue(dt);
    elements.form.elements.hora.value = toTimeInputValue(dt);
    elements.form.elements.tipoAtendimento.value = evento.tipoAtendimento || "outro";
    syncSalaRequirement();
    elements.form.elements.local.value = evento.local || "";
    elements.form.elements.observacoes.value = evento.observacoes || "";

    if (permissions.canAssignOthers) {
      elements.responsavelSelect.disabled = false;
      elements.responsavelSelect.value = String(evento?.responsavel?._id || "");
    } else {
      elements.responsavelSelect.value = String(user.id || "");
    }

    await loadFamilies(evento?.familia?.responsavelNome || "");
    if (evento?.familia?._id) {
      const familyOption = Array.from(elements.familiaSelect.options).find((opt) => opt.value === String(evento.familia._id));
      if (!familyOption) {
        const opt = document.createElement("option");
        opt.value = String(evento.familia._id);
        opt.textContent = evento.familia.responsavelNome || "Família";
        elements.familiaSelect.appendChild(opt);
      }
      elements.familiaSelect.value = String(evento.familia._id);
      await loadPacientesByFamilia(evento.familia._id);
    } else {
      fillPatientsOptions([]);
      elements.familiaSelect.value = "";
    }

    if (evento?.paciente?._id) {
      const patientOption = Array.from(elements.pacienteSelect.options).find((opt) => opt.value === String(evento.paciente._id));
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
    setSalaHintMessage("As salas livres para este horario aparecem automaticamente aqui.");
  }

  async function handleFormSubmit(event) {
    event.preventDefault();
    if (state.saving) return;

    const modo = elements.form.dataset.mode || "create";
    const eventoId = elements.form.dataset.eventId || "";
    const inicio = mergeDateAndTime(elements.form.elements.data.value, elements.form.elements.hora.value);

    if (!inicio) {
      showToast("Informe uma data e hora válidas.");
      return;
    }

    const payload = {
      titulo: String(elements.form.elements.titulo.value || "").trim(),
      inicio,
      fim: buildEndIso(inicio),
      tipoAtendimento: elements.form.elements.tipoAtendimento.value || "outro",
      local: String(elements.form.elements.local.value || "").trim(),
      observacoes: String(elements.form.elements.observacoes.value || "").trim(),
      salaId: elements.form.elements.salaId.value || null,
      familiaId: elements.form.elements.familiaId.value || null,
      pacienteId: elements.form.elements.pacienteId.value || null,
      responsavelId: elements.form.elements.responsavelId.value || null,
    };

    if (!payload.titulo) {
      showToast("Título é obrigatório.");
      return;
    }

    if (requiresRoomSelection(payload.tipoAtendimento) && !payload.salaId) {
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
      closeModal();
      await loadMonthEvents();
    } catch (error) {
      showToast(error.message);
    } finally {
      state.saving = false;
      elements.formSubmit.disabled = false;
    }
  }

  async function handleDayListActions(event) {
    const target = event.target.closest("button[data-action]");
    if (!target) return;

    const action = target.getAttribute("data-action");
    const id = target.getAttribute("data-id");
    if (!id) return;

    if (action === "editar") {
      await openEditModal(id);
      return;
    }

    if (action === "presenca") {
      await openAttendanceModal(id);
      return;
    }

    if (["marcar-presente", "marcar-falta", "marcar-falta-justificada"].includes(action)) {
      const evento = state.eventosById.get(String(id));
      if (!evento) return;

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

      await submitAttendance(nextStatus, {
        eventId: id,
        observacao: String(evento?.presencaObservacao || ""),
      });
      return;
    }

    if (action === "status") {
      const next = target.getAttribute("data-next") === "true";
      const ok = await confirmAction({
        title: next ? "Reativar evento?" : "Inativar evento?",
        text: next ? "Deseja reativar este evento?" : "Deseja inativar este evento?",
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

  function bindDayCardDragAndDrop() {
    elements.diaLista.addEventListener("dragstart", (event) => {
      const card = event.target.closest(".agenda-event-card[draggable='true']");
      if (!card) return;
      const id = card.getAttribute("data-event-id");
      if (!id) return;
      event.dataTransfer.setData("text/plain", id);
      event.dataTransfer.effectAllowed = "move";
    });
  }

  function setMonthPickerOpen(open) {
    if (!elements.mesPickerPopover || !elements.mesPickerToggle) return;
    const next = !!open;
    elements.mesPickerPopover.hidden = !next;
    elements.mesPickerToggle.setAttribute("aria-expanded", String(next));
    if (next) {
      syncMonthPickerControls();
      if (elements.mesPickerMes) elements.mesPickerMes.focus();
    }
  }

  function syncMonthPickerControls() {
    if (!elements.mesPickerMes || !elements.mesPickerAno) return;

    if (!elements.mesPickerMes.dataset.ready) {
      elements.mesPickerMes.innerHTML = MONTH_NAMES.map(
        (label, index) => `<option value="${index}">${label}</option>`
      ).join("");
      elements.mesPickerMes.dataset.ready = "1";
    }

    const viewYear = state.viewDate.getFullYear();
    const nowYear = new Date().getFullYear();
    const yearStart = Math.min(viewYear - 5, nowYear - 15);
    const yearEnd = Math.max(viewYear + 5, nowYear + 15);
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

  async function applyMonthPickerSelection() {
    if (!elements.mesPickerMes || !elements.mesPickerAno) return;

    const nextMonth = Number.parseInt(elements.mesPickerMes.value, 10);
    const nextYear = Number.parseInt(elements.mesPickerAno.value, 10);
    if (Number.isNaN(nextMonth) || Number.isNaN(nextYear)) return;

    state.viewDate = new Date(nextYear, nextMonth, 1);
    state.selectedDay = toDayString(new Date(nextYear, nextMonth, 1));
    state.openPopoverDay = null;
    setMonthPickerOpen(false);
    await loadMonthEvents();
  }

  function changeMonth(step) {
    state.viewDate = new Date(state.viewDate.getFullYear(), state.viewDate.getMonth() + step, 1);
    state.selectedDay = toDayString(new Date(state.viewDate.getFullYear(), state.viewDate.getMonth(), 1));
    state.openPopoverDay = null;
    setMonthPickerOpen(false);
    loadMonthEvents().catch((error) => showToast(error.message));
  }

  function bindEvents() {
    elements.prevBtn.addEventListener("click", () => changeMonth(-1));
    elements.nextBtn.addEventListener("click", () => changeMonth(1));
    elements.hojeBtn.addEventListener("click", () => {
      state.viewDate = new Date();
      state.selectedDay = toDayString(new Date());
      state.openPopoverDay = null;
      setMonthPickerOpen(false);
      loadMonthEvents().catch((error) => showToast(error.message));
    });

    if (elements.mesPickerToggle) {
      elements.mesPickerToggle.addEventListener("click", () => {
        const isOpen = !elements.mesPickerPopover?.hidden;
        setMonthPickerOpen(!isOpen);
      });
    }

    if (elements.mesPickerCancel) {
      elements.mesPickerCancel.addEventListener("click", () => {
        setMonthPickerOpen(false);
      });
    }

    if (elements.mesPickerApply) {
      elements.mesPickerApply.addEventListener("click", () => {
        applyMonthPickerSelection().catch((error) => showToast(error.message));
      });
    }

    if (elements.mesPickerAno) {
      elements.mesPickerAno.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        applyMonthPickerSelection().catch((error) => showToast(error.message));
      });
    }

    elements.responsavelFiltro.addEventListener("change", () => {
      state.responsavelFiltro = elements.responsavelFiltro.value || "";
      state.openPopoverDay = null;
      loadMonthEvents().catch((error) => showToast(error.message));
    });

    elements.novoBtn.addEventListener("click", () => {
      openCreateModal().catch((error) => showToast(error.message));
    });

    if (elements.salasBtn) {
      elements.salasBtn.addEventListener("click", () => {
        openSalasModal().catch((error) => showToast(error.message));
      });
    }

    elements.modalCloseBtn.addEventListener("click", (event) => {
      event.preventDefault();
      closeModal();
    });
    elements.formCancel.addEventListener("click", (event) => {
      event.preventDefault();
      closeModal();
    });
    elements.modalBackdrop.addEventListener("click", (event) => {
      if (event.target === elements.modalBackdrop) closeModal();
    });

    if (elements.presencaCloseBtn) {
      elements.presencaCloseBtn.addEventListener("click", (event) => {
        event.preventDefault();
        closeAttendanceModal();
      });
    }

    if (elements.presencaBackdrop) {
      elements.presencaBackdrop.addEventListener("click", (event) => {
        if (event.target === elements.presencaBackdrop) closeAttendanceModal();
      });
    }

    if (elements.salasCloseBtn) {
      elements.salasCloseBtn.addEventListener("click", (event) => {
        event.preventDefault();
        closeSalasModal();
      });
    }

    if (elements.salasBackdrop) {
      elements.salasBackdrop.addEventListener("click", (event) => {
        if (event.target === elements.salasBackdrop) closeSalasModal();
      });
    }

    elements.form.addEventListener("submit", handleFormSubmit);
    elements.diaLista.addEventListener("click", handleDayListActions);
    if (elements.presencaSemanaLista) {
      elements.presencaSemanaLista.addEventListener("click", (event) => {
        const card = event.target.closest("[data-presenca-day]");
        if (!card) return;
        const dayKey = String(card.getAttribute("data-presenca-day") || "");
        if (!dayKey) return;
        state.selectedDay = dayKey;
        renderCalendar();
        renderSelectedDay();
      });
    }
    document.querySelectorAll("[data-agenda-presenca-action]").forEach((button) => {
      button.addEventListener("click", () => {
        submitAttendance(button.getAttribute("data-agenda-presenca-action")).catch((error) => showToast(error.message));
      });
    });
    if (elements.salaForm) elements.salaForm.addEventListener("submit", handleSalaFormSubmit);
    if (elements.salaReset) {
      elements.salaReset.addEventListener("click", (event) => {
        event.preventDefault();
        resetSalaForm();
      });
    }
    if (elements.salasLista) {
      elements.salasLista.addEventListener("click", (event) => {
        handleSalasListActions(event).catch((error) => showToast(error.message));
      });
    }

    ["data", "hora"].forEach((fieldName) => {
      const field = elements.form.elements[fieldName];
      if (!field) return;
      field.addEventListener("change", () => {
        loadAvailableSalas(elements.salaSelect.value || "").catch((error) => showToast(error.message));
      });
    });

    elements.tipoSelect.addEventListener("change", () => {
      syncSalaRequirement();
      loadAvailableSalas(elements.salaSelect.value || "").catch((error) => showToast(error.message));
    });

    document.addEventListener("click", (event) => {
      let shouldRender = false;

      if (state.openPopoverDay && !event.target.closest(".agenda-day-cell.has-multi-events")) {
        state.openPopoverDay = null;
        shouldRender = true;
      }

      if (
        elements.mesPickerPopover &&
        !elements.mesPickerPopover.hidden &&
        elements.mesPickerWrap &&
        !elements.mesPickerWrap.contains(event.target)
      ) {
        setMonthPickerOpen(false);
      }

      if (shouldRender) renderCalendar();
    });

    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      if (elements.mesPickerPopover && !elements.mesPickerPopover.hidden) {
        setMonthPickerOpen(false);
      }
      if (elements.salasBackdrop && !elements.salasBackdrop.hidden) {
        closeSalasModal();
      }
      if (elements.modalBackdrop && !elements.modalBackdrop.hidden) {
        closeModal();
      }
    });

    elements.familiaBusca.addEventListener("input", () => {
      window.clearTimeout(state.searchTimer);
      state.searchTimer = window.setTimeout(() => {
        loadFamilies(elements.familiaBusca.value).catch((error) => showToast(error.message));
      }, 350);
    });

    elements.familiaSelect.addEventListener("change", async () => {
      try {
        const familia = await loadPacientesByFamilia(elements.familiaSelect.value);
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
        showToast(error.message);
      }
    });
  }

  async function init() {
    setTipoOptions();
    renderSalaOptions([], "");
    setSalaHintMessage("As salas livres para este horario aparecem automaticamente aqui.");
    bindEvents();
    bindDayCardDragAndDrop();

    try {
      await loadProfissionais();
      await loadFamilies("");
      await loadMonthEvents();
    } catch (error) {
      showToast(error.message);
      elements.diaLista.innerHTML = `<p class="empty-hint">${error.message}</p>`;
    }
  }

  init();
})();
