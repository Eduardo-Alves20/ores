(function () {
  const shared = window.AgendaShared;
  if (!shared) return;

  function create(context) {
    const { elements, permissions, state, attendance } = context;
    const {
      MONTH_NAMES,
      normalizeTypeLabel,
      parseDayKeyLocal,
      requestJson,
      showToast,
      startOfCalendarGrid,
      toDayLabel,
      toDayString,
      toHourLabel,
      toMonthLabel,
      toTimeRangeLabel,
    } = context.shared || shared;

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
        list.sort(
          (a, b) => new Date(a.inicio).getTime() - new Date(b.inicio).getTime(),
        );
      }

      return map;
    }

    function ensureSelectedDayVisible() {
      const month = state.viewDate.getMonth();
      const year = state.viewDate.getFullYear();
      const selected =
        parseDayKeyLocal(state.selectedDay) || new Date(state.selectedDay);
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
        const dayCounters = attendance.buildPresenceCounters(dayEvents);
        const hasMultipleEvents = dayEvents.length > 1;
        const movableEvents = dayEvents.filter((evento) => attendance.canMoveEvent(evento));
        const dragCandidate =
          !hasMultipleEvents && movableEvents.length === 1
            ? movableEvents[0]
            : null;
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
            ${dayEvents.length ? `<div class="agenda-day-presence-inline">${attendance.buildPresenceInlineBadges(dayCounters)}</div>` : ""}
          </div>
        `;

        if (outside) cell.classList.add("is-outside");
        if (dayKey === today) cell.classList.add("is-today");
        if (dayKey === state.selectedDay) cell.classList.add("is-selected");
        if (hasMultipleEvents) cell.classList.add("has-multi-events");
        if (state.openPopoverDay === dayKey && hasMultipleEvents) {
          cell.classList.add("is-popover-open");
        }

        if (dragCandidate) {
          cell.setAttribute("draggable", "true");
          cell.classList.add("is-draggable-event");
          cell.dataset.eventId = String(dragCandidate._id);
          cell.title = "Arraste para mover este evento para outro dia.";
        } else if (hasMultipleEvents) {
          cell.title =
            "Passe o mouse ou clique no balao de eventos para escolher o item e arrastar.";

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
            const canMoveThis = attendance.canMoveEvent(evento);
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
            const item = event.target.closest(
              ".agenda-day-events-item[draggable='true']",
            );
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
            state.openPopoverDay =
              state.openPopoverDay === dayKey ? null : dayKey;
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
          const eventId =
            event.dataTransfer.getData("text/plain") || state.draggingEventId;
          if (!eventId) return;

          const agendaEvent = state.eventosById.get(String(eventId));
          if (!agendaEvent || !attendance.canMoveEvent(agendaEvent)) {
            return;
          }
          if (toDayString(agendaEvent.inicio) === dayKey) return;

          try {
            state.openPopoverDay = null;
            await requestJson(`/api/agenda/eventos/${eventId}/mover`, {
              method: "PATCH",
              body: { novaData: dayKey },
            });
            await context.loadMonthEvents();
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
      const dayDate =
        parseDayKeyLocal(state.selectedDay) || new Date(state.selectedDay);
      const eventos = state.eventos
        .filter((evento) => toDayString(evento.inicio) === state.selectedDay)
        .sort(
          (a, b) => new Date(a.inicio).getTime() - new Date(b.inicio).getTime(),
        );

      elements.diaTitulo.textContent = toDayLabel(dayDate);
      attendance.renderWeeklyPresence();

      if (!eventos.length) {
        elements.diaLista.innerHTML =
          '<p class="empty-hint">Nenhum evento para este dia.</p>';
        return;
      }

      elements.diaLista.innerHTML = eventos
        .map((evento) => {
          const hora = toTimeRangeLabel(evento.inicio, evento.fim);
          const responsavelNome = evento?.responsavel?.nome || "Sem responsavel";
          const pacienteNome =
            evento?.paciente?.nome || "Sem paciente especifico";
          const familiaNome =
            evento?.familia?.responsavelNome || "Sem familia vinculada";
          const salaNome = evento?.sala?.nome || "";
          const statusLabel = evento.ativo ? "Inativar" : "Reativar";

          return `
            <article class="agenda-event-card ${evento.ativo ? "" : "is-inactive"}" ${attendance.canMoveEvent(evento) ? 'draggable="true"' : ""} data-event-id="${evento._id}">
              <div class="agenda-event-top">
                <span class="agenda-event-time">${hora}</span>
                <span class="agenda-event-type">${normalizeTypeLabel(evento.tipoAtendimento)}</span>
              </div>
              <h4 class="agenda-event-title">${evento.titulo}</h4>
              <div class="agenda-event-status-row">
                <span class="agenda-event-badge status-${evento.statusAgendamento || "agendado"}">${evento.statusAgendamentoLabel || "Agendado"}</span>
                <span class="agenda-event-badge status-${evento.statusPresenca || "pendente"}">${evento.statusPresencaLabel || "Pendente"}</span>
              </div>
              <p class="agenda-event-line"><strong>Responsavel:</strong> ${responsavelNome}</p>
              <p class="agenda-event-line"><strong>Paciente:</strong> ${pacienteNome}</p>
              <p class="agenda-event-line"><strong>Familia:</strong> ${familiaNome}</p>
              ${salaNome ? `<p class="agenda-event-line"><strong>Sala:</strong> ${salaNome}</p>` : ""}
              ${evento.local ? `<p class="agenda-event-line"><strong>Local:</strong> ${evento.local}</p>` : ""}
              ${evento.presencaRegistradaEmLabel && evento.presencaRegistradaEmLabel !== "-" ? `<p class="agenda-event-line"><strong>Ultimo registro:</strong> ${evento.presencaRegistradaEmLabel}${evento?.presencaRegistradaPor?.nome ? ` · ${evento.presencaRegistradaPor.nome}` : ""}</p>` : ""}
              ${attendance.buildAttendanceQuickActions(evento)}
              ${evento.presencaObservacao ? `<p class="agenda-event-note"><strong>Obs. presenca:</strong> ${evento.presencaObservacao}</p>` : ""}
              <div class="agenda-event-actions">
                ${attendance.canManageAttendance(evento) ? `<button type="button" class="btn-ghost" data-action="presenca" data-id="${evento._id}">Ficha da presenca</button>` : ""}
                ${attendance.canEditEvent(evento) ? `<button type="button" class="btn-ghost" data-action="editar" data-id="${evento._id}">Editar</button>` : ""}
                ${attendance.canToggleEventStatus(evento) ? `<button type="button" class="btn-ghost" data-action="status" data-id="${evento._id}" data-next="${String(!evento.ativo)}">${statusLabel}</button>` : ""}
              </div>
            </article>
          `;
        })
        .join("");
    }

    function bindDayCardDragAndDrop() {
      elements.diaLista.addEventListener("dragstart", (event) => {
        const card = event.target.closest(
          ".agenda-event-card[draggable='true']",
        );
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
          (label, index) => `<option value="${index}">${label}</option>`,
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
      await context.loadMonthEvents();
    }

    function changeMonth(step) {
      state.viewDate = new Date(
        state.viewDate.getFullYear(),
        state.viewDate.getMonth() + step,
        1,
      );
      state.selectedDay = toDayString(
        new Date(state.viewDate.getFullYear(), state.viewDate.getMonth(), 1),
      );
      state.openPopoverDay = null;
      setMonthPickerOpen(false);
      context.loadMonthEvents().catch((error) => showToast(error.message));
    }

    return {
      applyMonthPickerSelection,
      bindDayCardDragAndDrop,
      buildEventosByDay,
      changeMonth,
      ensureSelectedDayVisible,
      renderCalendar,
      renderSelectedDay,
      setMonthPickerOpen,
      syncMonthPickerControls,
    };
  }

  window.AgendaCalendar = { create };
})();
