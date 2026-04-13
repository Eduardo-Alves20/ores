(function () {
  const root = document.querySelector("[data-page='agenda']");
  if (!root) return;

  const shared = window.AgendaShared;
  if (!shared) return;

  const elements = {
    openBtn: document.getElementById("agenda-disponibilidade-btn"),
    backdrop: document.getElementById("agenda-disponibilidade-backdrop"),
    closeBtn: document.getElementById("agenda-disponibilidade-close"),
    cancelBtn: document.getElementById("agenda-disponibilidade-cancel"),
    submitBtn: document.getElementById("agenda-disponibilidade-submit"),
    enabledToggle: document.getElementById("agenda-disponibilidade-ativo"),
    grid: document.getElementById("agenda-disponibilidade-grid"),
  };

  if (!elements.openBtn || !elements.backdrop || !elements.grid) return;

  const dayCards = Array.from(
    elements.grid.querySelectorAll("[data-availability-day-card]")
  );

  const state = {
    loading: false,
    saving: false,
  };

  function setModalOpen(open) {
    elements.backdrop.hidden = !open;
    document.body.style.overflow = open ? "hidden" : "";
  }

  function toggleDayCard(card) {
    if (!card) return;
    const checked = !!card.querySelector("[data-availability-enabled]")?.checked;
    const globallyEnabled = !!elements.enabledToggle?.checked;
    const disabled = !checked || !globallyEnabled;

    card.classList.toggle("is-disabled", disabled);
    card
      .querySelectorAll("[data-availability-start], [data-availability-end]")
      .forEach((input) => {
        input.disabled = disabled;
      });
  }

  function applyAvailability(disponibilidade) {
    const config = disponibilidade || {};
    const daysMap = new Map(
      (Array.isArray(config?.dias) ? config.dias : []).map((item) => [
        String(item?.diaSemana),
        item,
      ])
    );

    elements.enabledToggle.checked = config?.ativo !== false;

    dayCards.forEach((card) => {
      const dayKey = String(card.getAttribute("data-dia-semana") || "");
      const checkbox = card.querySelector("[data-availability-enabled]");
      const startInput = card.querySelector("[data-availability-start]");
      const endInput = card.querySelector("[data-availability-end]");
      const dayConfig = daysMap.get(dayKey) || null;

      checkbox.checked = !!dayConfig;
      startInput.value = dayConfig?.inicio || startInput.value || "08:00";
      endInput.value = dayConfig?.fim || endInput.value || "12:00";
      toggleDayCard(card);
    });
  }

  function collectPayload() {
    const dias = dayCards
      .map((card) => {
        const enabled = !!card.querySelector("[data-availability-enabled]")?.checked;
        if (!enabled) return null;

        const inicio = String(
          card.querySelector("[data-availability-start]")?.value || ""
        ).trim();
        const fim = String(
          card.querySelector("[data-availability-end]")?.value || ""
        ).trim();

        return {
          diaSemana: Number(card.getAttribute("data-dia-semana")),
          inicio,
          fim,
          ativo: true,
        };
      })
      .filter(Boolean);

    dias.forEach((item) => {
      if (!item.inicio || !item.fim || item.inicio >= item.fim) {
        throw new Error("Revise os horarios configurados na disponibilidade.");
      }
    });

    return {
      ativo: !!elements.enabledToggle.checked,
      dias,
    };
  }

  async function loadAvailability() {
    if (state.loading) return;
    state.loading = true;

    try {
      const data = await shared.requestJson("/api/agenda/disponibilidade/me");
      applyAvailability(data?.disponibilidade || {});
    } finally {
      state.loading = false;
    }
  }

  async function openModal() {
    await loadAvailability();
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
  }

  async function saveAvailability() {
    if (state.saving) return;
    state.saving = true;
    elements.submitBtn.disabled = true;

    try {
      const payload = collectPayload();
      const data = await shared.requestJson("/api/agenda/disponibilidade/me", {
        method: "PUT",
        body: payload,
      });
      applyAvailability(data?.disponibilidade || payload);
      shared.showSuccess(
        data?.mensagem || "Disponibilidade atualizada com sucesso."
      );
      closeModal();
    } catch (error) {
      shared.showToast(error.message || "Nao foi possivel salvar a disponibilidade.");
    } finally {
      state.saving = false;
      elements.submitBtn.disabled = false;
    }
  }

  elements.openBtn.addEventListener("click", () => {
    openModal().catch((error) => shared.showToast(error.message));
  });

  elements.closeBtn?.addEventListener("click", closeModal);
  elements.cancelBtn?.addEventListener("click", closeModal);

  elements.backdrop.addEventListener("click", (event) => {
    if (event.target === elements.backdrop) closeModal();
  });

  elements.enabledToggle?.addEventListener("change", () => {
    dayCards.forEach(toggleDayCard);
  });

  dayCards.forEach((card) => {
    card
      .querySelector("[data-availability-enabled]")
      ?.addEventListener("change", () => toggleDayCard(card));
  });

  elements.submitBtn?.addEventListener("click", () => {
    saveAvailability().catch(() => {});
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !elements.backdrop.hidden) {
      closeModal();
    }
  });

  const query = new URLSearchParams(window.location.search || "");
  if (query.get("modal") === "disponibilidade") {
    openModal()
      .then(() => {
        query.delete("modal");
        const nextQuery = query.toString();
        const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}${window.location.hash || ""}`;
        window.history.replaceState({}, document.title, nextUrl);
      })
      .catch((error) => shared.showToast(error.message));
  }
})();
