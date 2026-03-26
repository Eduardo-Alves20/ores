(function () {
  const shared = window.AgendaShared;
  if (!shared) return;

  const {
    escapeHtml,
    formatDateTime,
    parseDayKeyLocal,
    requestJson,
    showSuccess,
    showToast,
    toDayString,
  } = shared;

  function canManageOwnEvent(context, evento) {
    const user = context?.user || {};
    if (context?.permissions?.canViewAll) return true;
    return String(evento?.responsavel?._id || "") === String(user?.id || "");
  }

  function canEditEvent(context, evento) {
    return Boolean(context?.permissions?.canUpdate) && canManageOwnEvent(context, evento);
  }

  function canMoveEvent(context, evento) {
    return Boolean(context?.permissions?.canMove) && canManageOwnEvent(context, evento);
  }

  function canToggleEventStatus(context, evento) {
    return Boolean(context?.permissions?.canChangeStatus) && canManageOwnEvent(context, evento);
  }

  function canManageAttendance(context, evento) {
    return Boolean(context?.permissions?.canRegisterAttendance) && canManageOwnEvent(context, evento);
  }

  function canMutateEvent(context, evento) {
    return canEditEvent(context, evento);
  }

  function buildAttendanceQuickActions(context, evento) {
    if (!canManageAttendance(context, evento)) return "";

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
                  data-id="${escapeHtml(String(evento?._id || ""))}"
                  title="${button.label}"
                  aria-label="${button.label}"
                >
                  <i class="fa-solid ${button.icon}" aria-hidden="true"></i>
                </button>
              `,
            )
            .join("")}
        </div>
      </div>
    `;
  }

  function startOfWeek(dateLike) {
    const base = parseDayKeyLocal(dateLike) || new Date(dateLike);
    if (Number.isNaN(base.getTime())) return new Date();
    const normalized = new Date(
      base.getFullYear(),
      base.getMonth(),
      base.getDate(),
      12,
      0,
      0,
      0,
    );
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
    if (counters.presente) {
      badges.push(
        `<span class="agenda-day-presence-pill is-presente">${counters.presente} P</span>`,
      );
    }
    if (counters.falta) {
      badges.push(
        `<span class="agenda-day-presence-pill is-falta">${counters.falta} F</span>`,
      );
    }
    if (counters.faltaJustificada) {
      badges.push(
        `<span class="agenda-day-presence-pill is-falta-justificada">${counters.faltaJustificada} J</span>`,
      );
    }
    if (counters.pendente) {
      badges.push(
        `<span class="agenda-day-presence-pill is-pendente">${counters.pendente} Pend</span>`,
      );
    }
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

  function formatHistoryItems(context, items) {
    const elements = context?.elements || {};
    const list = Array.isArray(items) ? items : [];
    if (!list.length) {
      elements.presencaHistoryList.innerHTML =
        '<p class="empty-hint">Nenhum historico registrado ainda.</p>';
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
        `,
      )
      .join("");
  }

  function fillAttendanceModal(context, evento, historico) {
    const state = context?.state || {};
    const elements = context?.elements || {};
    state.attendanceEvent = evento || null;
    state.attendanceHistory = Array.isArray(historico) ? historico : [];
    elements.presencaSubtitle.textContent = evento
      ? `${evento.titulo || "Agendamento"} · ${formatDateTime(evento.inicio)}`
      : "Agendamento";
    elements.presencaStatusAgendamento.textContent =
      evento?.statusAgendamentoLabel || "Agendado";
    elements.presencaStatusPresenca.textContent =
      evento?.statusPresencaLabel || "Pendente";
    if (elements.presencaJustificativa) {
      elements.presencaJustificativa.value =
        evento?.presencaJustificativaLabel || "";
    }
    elements.presencaObservacao.value = evento?.presencaObservacao || "";
    formatHistoryItems(context, state.attendanceHistory);
  }

  function closeAttendanceModal(context) {
    const state = context?.state || {};
    const elements = context?.elements || {};
    state.attendanceEventId = "";
    state.attendanceEvent = null;
    state.attendanceHistory = [];
    elements.presencaBackdrop.hidden = true;
    if (elements.presencaJustificativa) {
      elements.presencaJustificativa.value = "";
    }
    elements.presencaObservacao.value = "";
    elements.presencaHistoryList.innerHTML =
      '<p class="empty-hint">Nenhum historico carregado.</p>';
    document.body.style.overflow =
      !elements.modalBackdrop.hidden ||
      (elements.salasBackdrop && !elements.salasBackdrop.hidden)
        ? "hidden"
        : "";
  }

  async function openAttendanceModal(context, eventId) {
    const state = context?.state || {};
    const elements = context?.elements || {};
    if (!eventId) return;

    state.attendanceEventId = String(eventId);
    elements.presencaBackdrop.hidden = false;
    document.body.style.overflow = "hidden";
    elements.presencaSubtitle.textContent =
      "Carregando detalhes do agendamento...";
    elements.presencaStatusAgendamento.textContent = "Carregando";
    elements.presencaStatusPresenca.textContent = "Carregando";
    elements.presencaHistoryList.innerHTML =
      '<p class="empty-hint">Carregando historico...</p>';

    try {
      const data = await requestJson(`/api/agenda/eventos/${eventId}`);
      fillAttendanceModal(context, data?.evento || null, data?.historico || []);
    } catch (error) {
      showToast(
        error.message ||
          "Nao foi possivel carregar o historico do agendamento.",
      );
      closeAttendanceModal(context);
    }
  }

  async function submitAttendance(context, statusPresenca, options = {}) {
    const state = context?.state || {};
    const elements = context?.elements || {};
    const eventId =
      options.eventId || state.attendanceEventId || state.attendanceEvent?._id;
    if (!eventId) return;

    const observacao =
      typeof options.observacao === "string"
        ? String(options.observacao).trim()
        : String(elements.presencaObservacao?.value || "").trim();
    const justificativaKey = String(
      elements.presencaJustificativa?.value || "",
    ).trim();

    try {
      const data = await requestJson(
        `/api/agenda/eventos/${eventId}/presenca`,
        {
          method: "PATCH",
          body: {
            statusPresenca,
            observacao,
            justificativaKey,
          },
        },
      );

      if (data?.evento?._id) {
        state.eventosById.set(String(data.evento._id), data.evento);
        state.eventos = state.eventos.map((item) =>
          String(item._id) === String(data.evento._id) ? data.evento : item,
        );
      }

      if (
        state.attendanceEventId &&
        String(state.attendanceEventId) === String(eventId)
      ) {
        fillAttendanceModal(context, data?.evento || null, data?.historico || []);
      }

      if (typeof context?.renderCalendar === "function") {
        context.renderCalendar();
      }
      if (typeof context?.renderSelectedDay === "function") {
        context.renderSelectedDay();
      }
      showSuccess(data?.mensagem || "Presenca registrada com sucesso.");
    } catch (error) {
      showToast(error.message || "Nao foi possivel atualizar a presenca.");
    }
  }

  function renderWeeklyPresence(context) {
    const state = context?.state || {};
    const elements = context?.elements || {};
    if (
      !elements.presencaSemanaTitulo ||
      !elements.presencaSemanaLista ||
      !elements.presencaKpis
    ) {
      return;
    }

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
        .sort(
          (a, b) => new Date(a.inicio).getTime() - new Date(b.inicio).getTime(),
        );
      weekDays.push({
        dayKey,
        date: current,
        eventos,
        counters: buildPresenceCounters(eventos),
      });
    }

    const weekCounters = buildPresenceCounters(
      weekDays.flatMap((item) => item.eventos),
    );
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

  window.AgendaAttendance = {
    buildAttendanceQuickActions,
    buildPresenceCounters,
    buildPresenceInlineBadges,
    canEditEvent,
    canManageAttendance,
    canManageOwnEvent,
    canMoveEvent,
    canMutateEvent,
    canToggleEventStatus,
    closeAttendanceModal,
    openAttendanceModal,
    renderWeeklyPresence,
    submitAttendance,
    toShortDayLabel,
  };
})();
