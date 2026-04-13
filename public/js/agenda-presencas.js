(function () {
  const ROOT_SELECTOR = "[data-presenca-app]";
  const state = {
    currentEventId: "",
    lastFilterUrl: "",
    lastModalFocus: null,
    lastSheetFocus: null,
    touchStartX: 0,
    touchStartY: 0,
    touchTarget: null,
  };

  function getRoot() {
    return document.querySelector(ROOT_SELECTOR);
  }

  function getElements() {
    return {
      backdrop: document.getElementById("agenda-presenca-backdrop"),
      closeBtn: document.getElementById("agenda-presenca-close"),
      subtitle: document.getElementById("agenda-presenca-subtitle"),
      statusAgendamento: document.getElementById("agenda-presenca-status-agendamento"),
      statusPresenca: document.getElementById("agenda-presenca-status-presenca"),
      justificativa: document.getElementById("agenda-presenca-justificativa"),
      observacao: document.getElementById("agenda-presenca-observacao"),
      historyList: document.getElementById("agenda-presenca-history-list"),
      mobileSheetBackdrop: document.getElementById("presenca-mobile-sheet-backdrop"),
    };
  }

  function isMobileViewport() {
    return window.matchMedia("(max-width: 767px)").matches;
  }

  function restoreBodyScroll() {
    const elements = getElements();
    const modalOpen = elements.backdrop && !elements.backdrop.hidden;
    const sheetOpen = elements.mobileSheetBackdrop && !elements.mobileSheetBackdrop.hidden;
    if (!modalOpen && !sheetOpen) {
      document.body.style.overflow = "";
    }
  }

  function getFocusableElements(container) {
    if (!container || typeof container.querySelectorAll !== "function") return [];
    return Array.from(
      container.querySelectorAll(
        "button:not([disabled]), [href], input:not([disabled]):not([type='hidden']), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])"
      )
    ).filter((node) => node.offsetParent !== null || node === document.activeElement);
  }

  function trapTabNavigation(event, container) {
    if (!event || event.key !== "Tab") return;
    const focusables = getFocusableElements(container);
    if (!focusables.length) return;

    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement;

    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
      return;
    }

    if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function openMobileFilters() {
    const elements = getElements();
    if (!elements.mobileSheetBackdrop) return;
    state.lastSheetFocus = document.activeElement || null;
    elements.mobileSheetBackdrop.hidden = false;
    document.body.style.overflow = "hidden";
    const firstFocusable =
      elements.mobileSheetBackdrop.querySelector("[data-presenca-mobile-filters-close]") ||
      getFocusableElements(elements.mobileSheetBackdrop)[0] ||
      null;
    if (firstFocusable && typeof firstFocusable.focus === "function") {
      window.setTimeout(() => firstFocusable.focus(), 0);
    }
  }

  function closeMobileFilters() {
    const elements = getElements();
    if (!elements.mobileSheetBackdrop) return;
    elements.mobileSheetBackdrop.hidden = true;
    restoreBodyScroll();
    const previousFocus = state.lastSheetFocus;
    state.lastSheetFocus = null;
    if (previousFocus && typeof previousFocus.focus === "function") {
      window.setTimeout(() => previousFocus.focus(), 0);
    }
  }

  function syncMonthField(form) {
    if (!form) return;
    const monthSelect =
      form.querySelector("[data-presenca-month-select], [data-presenca-mobile-month-select]") ||
      document.querySelector("[data-presenca-month-select]");
    const yearSelect =
      form.querySelector("[data-presenca-year-select], [data-presenca-mobile-year-select]") ||
      document.querySelector("[data-presenca-year-select]");
    const hiddenField = form.querySelector("[data-presenca-month-hidden]");
    if (!monthSelect || !yearSelect || !hiddenField) return;

    const month = String(monthSelect.value || "").trim();
    const year = String(yearSelect.value || "").trim();
    hiddenField.value = month && year ? `${year}-${month}` : "";
  }

  function buildFilterUrl(form) {
    if (!form) return "/agenda/presencas";
    syncMonthField(form);
    const action = String(form.getAttribute("action") || "/agenda/presencas").trim();
    const params = new URLSearchParams(new FormData(form));
    const query = params.toString();
    return query ? `${action}?${query}` : action;
  }

  function navigateFilters(form, options = {}) {
    const url = buildFilterUrl(form);
    if (!url) return;

    if (!options.force && state.lastFilterUrl === url) {
      return;
    }

    state.lastFilterUrl = url;
    navigate(url, options).catch(() => {});
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
      throw new Error(payload?.erro || payload?.message || "Nao foi possivel processar a requisicao.");
    }

    return payload;
  }

  async function fetchPage(url) {
    const response = await fetch(url, {
      credentials: "same-origin",
      headers: {
        "X-Requested-With": "fetch",
      },
    });

    if (!response.ok) {
      throw new Error("Nao foi possivel atualizar a agenda de presenca.");
    }

    return response.text();
  }

  function replaceRootFromHtml(html) {
    const parser = new DOMParser();
    const nextDocument = parser.parseFromString(html, "text/html");
    const currentRoot = getRoot();
    const nextRoot = nextDocument.querySelector(ROOT_SELECTOR);
    if (!currentRoot || !nextRoot) {
      window.location.reload();
      return;
    }

    currentRoot.replaceWith(nextRoot);
    document.title = nextDocument.title || document.title;
  }

  async function navigate(url, options = {}) {
    const root = getRoot();
    if (!root) return;

    root.classList.add("is-loading");

    try {
      const html = await fetchPage(url);
      replaceRootFromHtml(html);
      const method = options.replace ? "replaceState" : "pushState";
      window.history[method]({}, "", url);
    } catch (error) {
      window.appNotifyError?.(error?.message || "Nao foi possivel atualizar a agenda de presenca.");
    } finally {
      getRoot()?.classList.remove("is-loading");
    }
  }

  function formatDateTime(value) {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "-";
    return parsed.toLocaleString("pt-BR");
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function renderHistoryItems(items) {
    const elements = getElements();
    if (!elements.historyList) return;
    const list = Array.isArray(items) ? items : [];

    if (!list.length) {
      elements.historyList.innerHTML = '<p class="empty-hint">Nenhum historico registrado ainda.</p>';
      return;
    }

    elements.historyList.innerHTML = list
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

  function fillModal(evento, historico) {
    const elements = getElements();
    if (!elements.subtitle || !elements.statusAgendamento || !elements.statusPresenca || !elements.observacao) return;

    elements.subtitle.textContent = evento
      ? `${evento.titulo || "Agendamento"} · ${formatDateTime(evento.inicio)}`
      : "Agendamento";
    elements.statusAgendamento.textContent = evento?.statusAgendamentoLabel || "Agendado";
    elements.statusPresenca.textContent = evento?.statusPresencaLabel || "Pendente";
    if (elements.justificativa) {
      elements.justificativa.value = evento?.presencaJustificativaLabel || "";
    }
    elements.observacao.value = evento?.presencaObservacao || "";
    renderHistoryItems(historico);
  }

  function closeModal() {
    const elements = getElements();
    state.currentEventId = "";
    if (elements.backdrop) {
      elements.backdrop.hidden = true;
    }
    if (elements.observacao) {
      elements.observacao.value = "";
    }
    if (elements.justificativa) {
      elements.justificativa.value = "";
    }
    if (elements.historyList) {
      elements.historyList.innerHTML = '<p class="empty-hint">Nenhum historico carregado.</p>';
    }
    restoreBodyScroll();
    const previousFocus = state.lastModalFocus;
    state.lastModalFocus = null;
    if (previousFocus && typeof previousFocus.focus === "function") {
      window.setTimeout(() => previousFocus.focus(), 0);
    }
  }

  async function openModal(eventId) {
    const elements = getElements();
    if (!eventId || !elements.backdrop) return;

    closeMobileFilters();
    state.lastModalFocus = document.activeElement || null;
    state.currentEventId = String(eventId);
    elements.backdrop.hidden = false;
    document.body.style.overflow = "hidden";

    if (elements.subtitle) elements.subtitle.textContent = "Carregando detalhes do agendamento...";
    if (elements.statusAgendamento) elements.statusAgendamento.textContent = "Carregando";
    if (elements.statusPresenca) elements.statusPresenca.textContent = "Carregando";
    if (elements.historyList) elements.historyList.innerHTML = '<p class="empty-hint">Carregando historico...</p>';
    if (elements.closeBtn && typeof elements.closeBtn.focus === "function") {
      window.setTimeout(() => elements.closeBtn.focus(), 0);
    }

    try {
      const data = await requestJson(`/api/agenda/eventos/${eventId}`);
      fillModal(data?.evento || null, data?.historico || []);
    } catch (error) {
      window.appNotifyError?.(error?.message || "Nao foi possivel carregar a ficha de presenca.");
      closeModal();
    }
  }

  async function submitAttendance(statusPresenca) {
    if (!state.currentEventId) return;

    const elements = getElements();
    const observacao = String(elements.observacao?.value || "").trim();
    const justificativaKey = String(elements.justificativa?.value || "").trim();

    try {
      const data = await requestJson(`/api/agenda/eventos/${state.currentEventId}/presenca`, {
        method: "PATCH",
        body: JSON.stringify({
          statusPresenca,
          observacao,
          justificativaKey,
        }),
      });

      fillModal(data?.evento || null, data?.historico || []);
      await navigate(window.location.pathname + window.location.search, { replace: true });
      window.appNotifySuccess?.(data?.mensagem || "Presenca atualizada com sucesso.");
    } catch (error) {
      window.appNotifyError?.(error?.message || "Nao foi possivel atualizar a presenca.");
    }
  }

  document.addEventListener("click", (event) => {
    const openMobileFiltersBtn = event.target.closest("[data-presenca-mobile-filters-open]");
    if (openMobileFiltersBtn) {
      event.preventDefault();
      openMobileFilters();
      return;
    }

    const closeMobileFiltersBtn = event.target.closest("[data-presenca-mobile-filters-close]");
    if (closeMobileFiltersBtn) {
      event.preventDefault();
      closeMobileFilters();
      return;
    }

    const closeModalBtn = event.target.closest("#agenda-presenca-close");
    if (closeModalBtn) {
      event.preventDefault();
      closeModal();
      return;
    }

    const link = event.target.closest("[data-presenca-nav]");
    if (link) {
      const href = String(link.getAttribute("href") || "").trim();
      if (!href) return;
      event.preventDefault();
      closeMobileFilters();
      navigate(href).catch(() => {});
      return;
    }

    if (event.target === getElements().mobileSheetBackdrop) {
      closeMobileFilters();
      return;
    }

    if (event.target === getElements().backdrop) {
      closeModal();
      return;
    }

    const attendanceAction = event.target.closest("[data-agenda-presenca-action]");
    if (attendanceAction) {
      event.preventDefault();
      submitAttendance(String(attendanceAction.getAttribute("data-agenda-presenca-action") || "")).catch(() => {});
      return;
    }

    const card = event.target.closest("[data-presenca-event-id]");
    if (card) {
      const eventId = String(card.getAttribute("data-presenca-event-id") || "").trim();
      if (!eventId) return;
      event.preventDefault();
      openModal(eventId).catch(() => {});
      return;
    }
  });

  document.addEventListener("keydown", (event) => {
    const elements = getElements();
    if (elements.backdrop && !elements.backdrop.hidden) {
      const modal = elements.backdrop.querySelector("[role='dialog']");
      trapTabNavigation(event, modal);
    }
    if (elements.mobileSheetBackdrop && !elements.mobileSheetBackdrop.hidden) {
      const sheet = elements.mobileSheetBackdrop.querySelector("[role='dialog']");
      trapTabNavigation(event, sheet);
    }

    if (event.key === "Escape") {
      if (elements.backdrop && !elements.backdrop.hidden) {
        closeModal();
        return;
      }

      if (elements.mobileSheetBackdrop && !elements.mobileSheetBackdrop.hidden) {
        closeMobileFilters();
        return;
      }
    }

    if (event.key !== "Enter" && event.key !== " ") return;
    const card = event.target.closest("[data-presenca-event-id]");
    if (!card) return;

    const eventId = String(card.getAttribute("data-presenca-event-id") || "").trim();
    if (!eventId) return;

    event.preventDefault();
    openModal(eventId).catch(() => {});
  });

  document.addEventListener("submit", (event) => {
    const form = event.target.closest("[data-presenca-filter-form], [data-presenca-mobile-filter-form]");
    if (!form) return;

    event.preventDefault();
    if (form.matches("[data-presenca-mobile-filter-form]")) {
      closeMobileFilters();
    }
    navigateFilters(form, { force: true });
  });

  document.addEventListener("change", (event) => {
    const monthSelect = event.target.closest("[data-presenca-month-select]");
    const yearSelect = event.target.closest("[data-presenca-year-select]");
    let form = null;

    if (monthSelect || yearSelect) {
      form = document.querySelector("[data-presenca-filter-form]");
      if (!form) return;
    } else {
      const field = event.target.closest("[data-presenca-filter-form] select, [data-presenca-filter-form] input[type='date'], [data-presenca-filter-form] input[type='month']");
      if (!field) return;
      form = field.closest("[data-presenca-filter-form]");
      if (!form) return;
    }

    if (!form) return;
    navigateFilters(form);
  });

  document.addEventListener(
    "touchstart",
    (event) => {
      if (!isMobileViewport()) return;
      const weekShell = event.target.closest("[data-presenca-mobile-week]");
      if (!weekShell) return;
      const touch = event.changedTouches?.[0];
      if (!touch) return;
      state.touchStartX = touch.clientX;
      state.touchStartY = touch.clientY;
      state.touchTarget = weekShell;
    },
    { passive: true }
  );

  document.addEventListener(
    "touchend",
    (event) => {
      if (!isMobileViewport() || !state.touchTarget) return;
      const touch = event.changedTouches?.[0];
      if (!touch) return;

      const diffX = touch.clientX - state.touchStartX;
      const diffY = touch.clientY - state.touchStartY;
      const absX = Math.abs(diffX);
      const absY = Math.abs(diffY);

      if (absX > 42 && absX > absY * 1.25) {
        const href = diffX < 0
          ? String(state.touchTarget.getAttribute("data-next-week-href") || "").trim()
          : String(state.touchTarget.getAttribute("data-prev-week-href") || "").trim();

        if (href) {
          navigate(href).catch(() => {});
        }
      }

      state.touchTarget = null;
    },
    { passive: true }
  );

  window.addEventListener("popstate", () => {
    state.lastFilterUrl = window.location.pathname + window.location.search;
    navigate(window.location.pathname + window.location.search, { replace: true }).catch(() => {});
  });

  state.lastFilterUrl = window.location.pathname + window.location.search;
})();
