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
    responsavelFiltro: document.getElementById("agenda-responsavel-filtro"),
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
    familiaBusca: document.getElementById("agenda-familia-busca"),
    familiaSelect: document.getElementById("agenda-familia-select"),
    pacienteSelect: document.getElementById("agenda-paciente-select"),
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
  };

  function canMutateEvent(evento) {
    if (permissions.canViewAll) return true;
    return String(evento?.responsavel?._id || "") === String(user?.id || "");
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

    if (!eventos.length) {
      elements.diaLista.innerHTML = '<p class="empty-hint">Nenhum evento para este dia.</p>';
      return;
    }

    elements.diaLista.innerHTML = eventos
      .map((evento) => {
        const dt = new Date(evento.inicio);
        const hora = Number.isNaN(dt.getTime()) ? "--:--" : dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
        const responsavelNome = evento?.responsavel?.nome || "Sem responsável";
        const pacienteNome = evento?.paciente?.nome || "Sem paciente específico";
        const familiaNome = evento?.familia?.responsavelNome || "Sem família vinculada";
        const statusLabel = evento.ativo ? "Inativar" : "Reativar";

        return `
          <article class="agenda-event-card ${evento.ativo ? "" : "is-inactive"}" ${canMutateEvent(evento) && permissions.canMove ? 'draggable="true"' : ''} data-event-id="${evento._id}">
            <div class="agenda-event-top">
              <span class="agenda-event-time">${hora}</span>
              <span class="agenda-event-type">${normalizeTypeLabel(evento.tipoAtendimento)}</span>
            </div>
            <h4 class="agenda-event-title">${evento.titulo}</h4>
            <p class="agenda-event-line"><strong>Responsável:</strong> ${responsavelNome}</p>
            <p class="agenda-event-line"><strong>Paciente:</strong> ${pacienteNome}</p>
            <p class="agenda-event-line"><strong>Família:</strong> ${familiaNome}</p>
            ${evento.local ? `<p class="agenda-event-line"><strong>Local:</strong> ${evento.local}</p>` : ""}
            <div class="agenda-event-actions">
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
    document.body.style.overflow = open ? "hidden" : "";
  }

  function setTipoOptions() {
    elements.tipoSelect.innerHTML = tiposAtendimento
      .map((tipo) => `<option value="${tipo}">${normalizeTypeLabel(tipo)}</option>`)
      .join("");
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
  }

  function closeModal() {
    setModalOpen(false);
    elements.form.reset();
    elements.form.dataset.mode = "create";
    elements.form.dataset.eventId = "";
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
      tipoAtendimento: elements.form.elements.tipoAtendimento.value || "outro",
      local: String(elements.form.elements.local.value || "").trim(),
      observacoes: String(elements.form.elements.observacoes.value || "").trim(),
      familiaId: elements.form.elements.familiaId.value || null,
      pacienteId: elements.form.elements.pacienteId.value || null,
      responsavelId: elements.form.elements.responsavelId.value || null,
    };

    if (!payload.titulo) {
      showToast("Título é obrigatório.");
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

    elements.form.addEventListener("submit", handleFormSubmit);
    elements.diaLista.addEventListener("click", handleDayListActions);

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
