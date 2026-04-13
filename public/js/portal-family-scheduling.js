(function () {
  const root = document.querySelector("[data-page='family-agenda']");
  if (!root) return;

  const shared = window.AgendaShared;
  if (!shared) return;

  const config = shared.parseJsonScript("family-agenda-config", {});
  const elements = {
    openBtn: document.getElementById("family-agenda-book-btn"),
    backdrop: document.getElementById("family-agenda-book-backdrop"),
    closeBtn: document.getElementById("family-agenda-book-close"),
    cancelBtn: document.getElementById("family-agenda-book-cancel"),
    submitBtn: document.getElementById("family-agenda-book-submit"),
    pacienteSelect: document.getElementById("family-agenda-book-paciente"),
    profissionalSelect: document.getElementById("family-agenda-book-profissional"),
    weekTitle: document.getElementById("family-agenda-book-week-title"),
    weekPrev: document.getElementById("family-agenda-book-week-prev"),
    weekNext: document.getElementById("family-agenda-book-week-next"),
    slots: document.getElementById("family-agenda-book-slots"),
    selection: document.getElementById("family-agenda-book-selection"),
  };

  if (!elements.openBtn || !elements.backdrop || !elements.slots) return;
  if (!config.professionalsEndpoint || !config.bookingEndpoint) return;

  const state = {
    loadingProfessionals: false,
    loadingSlots: false,
    saving: false,
    professionals: [],
    currentWeek: startOfWeek(new Date()),
    selectedProfessionalId: "",
    selectedPacienteId: "",
    selectedSlot: null,
  };

  function startOfWeek(dateLike) {
    const base = new Date(dateLike || Date.now());
    if (Number.isNaN(base.getTime())) return new Date();
    const normalized = new Date(
      base.getFullYear(),
      base.getMonth(),
      base.getDate(),
      12,
      0,
      0,
      0
    );
    const day = normalized.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    normalized.setDate(normalized.getDate() + diff);
    return normalized;
  }

  function setModalOpen(open) {
    elements.backdrop.hidden = !open;
    document.body.style.overflow = open ? "hidden" : "";
  }

  function getProfessionalName(id) {
    return (
      state.professionals.find((item) => String(item?._id || "") === String(id || ""))
        ?.nome || "Profissional"
    );
  }

  function getPacienteName(id) {
    return (
      (Array.isArray(config?.dependentes) ? config.dependentes : []).find(
        (item) => String(item?.id || "") === String(id || "")
      )?.nome || "Dependente"
    );
  }

  function renderPacienteOptions() {
    const dependentes = Array.isArray(config?.dependentes) ? config.dependentes : [];
    elements.pacienteSelect.innerHTML = dependentes.length
      ? dependentes
          .map(
            (item) =>
              `<option value="${shared.escapeHtml(item.id)}">${shared.escapeHtml(
                item.nome
              )}</option>`
          )
          .join("")
      : '<option value="">Nenhum dependente vinculado</option>';

    state.selectedPacienteId =
      String(elements.pacienteSelect.value || dependentes?.[0]?.id || "").trim();
    if (state.selectedPacienteId) {
      elements.pacienteSelect.value = state.selectedPacienteId;
    }
  }

  function renderProfessionalOptions() {
    elements.profissionalSelect.innerHTML = [
      '<option value="">Selecione um profissional</option>',
    ]
      .concat(
        state.professionals.map(
          (item) =>
            `<option value="${shared.escapeHtml(String(item?._id || ""))}">${shared.escapeHtml(
              item?.nome || "Profissional"
            )}</option>`
        )
      )
      .join("");

    if (
      state.selectedProfessionalId &&
      state.professionals.some(
        (item) => String(item?._id || "") === String(state.selectedProfessionalId)
      )
    ) {
      elements.profissionalSelect.value = state.selectedProfessionalId;
      return;
    }

    const firstId = String(state.professionals?.[0]?._id || "").trim();
    state.selectedProfessionalId = firstId;
    elements.profissionalSelect.value = firstId;
  }

  function renderSelection() {
    if (!state.selectedSlot?.inicio) {
      elements.selection.innerHTML = `
        <strong>Nenhum horario selecionado.</strong>
        <p>Toque em um horario disponivel para concluir o agendamento.</p>
      `;
      elements.submitBtn.disabled = true;
      return;
    }

    elements.selection.innerHTML = `
      <strong>${shared.escapeHtml(shared.formatDateTime(state.selectedSlot.inicio))}</strong>
      <p>${shared.escapeHtml(getProfessionalName(state.selectedProfessionalId))} com ${shared.escapeHtml(
        getPacienteName(state.selectedPacienteId)
      )}.</p>
    `;
    elements.submitBtn.disabled = false;
  }

  function renderSlots(data = {}) {
    const weekReference = startOfWeek(data?.referencia || state.currentWeek);
    const weekEnd = new Date(weekReference);
    weekEnd.setDate(weekReference.getDate() + 6);
    state.currentWeek = weekReference;

    elements.weekTitle.textContent = `${new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
    }).format(weekReference)} a ${new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
    }).format(weekEnd)}`;

    const dias = Array.isArray(data?.dias) ? data.dias : [];
    if (!dias.length) {
      elements.slots.innerHTML = `
        <div class="family-booking-day">
          <p class="empty-hint">Esse profissional ainda nao tem horarios livres nesta semana.</p>
        </div>
      `;
      return;
    }

    elements.slots.innerHTML = dias
      .map((dia) => {
        const slots = Array.isArray(dia?.slots) ? dia.slots : [];
        return `
          <article class="family-booking-day">
            <div class="family-booking-day-head">
              <strong>${shared.escapeHtml(dia?.label || "-")}</strong>
              <span class="family-booking-day-count">${slots.length} horario(s)</span>
            </div>
            <div class="family-booking-slot-list">
              ${slots
                .map((slot) => {
                  const isSelected =
                    String(slot?.inicio || "") === String(state.selectedSlot?.inicio || "");
                  return `
                    <button
                      type="button"
                      class="family-booking-slot-btn ${isSelected ? "is-selected" : ""}"
                      data-book-slot
                      data-slot-inicio="${shared.escapeHtml(slot?.inicio || "")}"
                      data-slot-fim="${shared.escapeHtml(slot?.fim || "")}"
                    >
                      <span>${shared.escapeHtml(slot?.horaLabel || "--:--")}</span>
                      <small>${Number(slot?.freeRooms || 0)} sala(s) livre(s)</small>
                    </button>
                  `;
                })
                .join("")}
            </div>
          </article>
        `;
      })
      .join("");
  }

  async function loadProfessionals() {
    if (state.loadingProfessionals) return;
    state.loadingProfessionals = true;

    try {
      const data = await shared.requestJson(config.professionalsEndpoint);
      state.professionals = Array.isArray(data?.profissionais) ? data.profissionais : [];
      renderProfessionalOptions();
    } finally {
      state.loadingProfessionals = false;
    }
  }

  async function loadSlots() {
    state.selectedSlot = null;
    renderSelection();

    if (!state.selectedProfessionalId) {
      elements.weekTitle.textContent = "Selecione um profissional";
      elements.slots.innerHTML =
        '<p class="empty-hint">Selecione um profissional para ver os horarios.</p>';
      return;
    }

    state.loadingSlots = true;
    elements.slots.innerHTML = '<p class="empty-hint">Carregando horarios livres...</p>';

    try {
      const data = await shared.requestJson(
        `${config.professionalsEndpoint}/${encodeURIComponent(
          state.selectedProfessionalId
        )}/horarios?referencia=${encodeURIComponent(state.currentWeek.toISOString())}`
      );
      renderSlots(data);
    } catch (error) {
      elements.slots.innerHTML = `<p class="empty-hint">${shared.escapeHtml(
        error.message || "Nao foi possivel carregar os horarios."
      )}</p>`;
    } finally {
      state.loadingSlots = false;
    }
  }

  async function openModal() {
    renderPacienteOptions();
    await loadProfessionals();
    setModalOpen(true);
    await loadSlots();
  }

  function closeModal() {
    setModalOpen(false);
  }

  async function submitBooking() {
    if (state.saving) return;
    if (!state.selectedPacienteId) {
      shared.showToast("Selecione o dependente.");
      return;
    }
    if (!state.selectedProfessionalId) {
      shared.showToast("Selecione o profissional.");
      return;
    }
    if (!state.selectedSlot?.inicio) {
      shared.showToast("Selecione um horario disponivel.");
      return;
    }

    state.saving = true;
    elements.submitBtn.disabled = true;

    try {
      const data = await shared.requestJson(config.bookingEndpoint, {
        method: "POST",
        body: {
          pacienteId: state.selectedPacienteId,
          profissionalId: state.selectedProfessionalId,
          slotInicio: state.selectedSlot.inicio,
        },
      });
      const eventId = String(data?.evento?.id || data?.evento?._id || "").trim();
      shared.showSuccess(data?.mensagem || "Consulta agendada com sucesso.");
      closeModal();

      if (eventId) {
        window.location.href = `/minha-familia/consultas?evento=${encodeURIComponent(
          eventId
        )}`;
        return;
      }

      window.location.reload();
    } catch (error) {
      shared.showToast(error.message || "Nao foi possivel agendar a consulta.");
    } finally {
      state.saving = false;
      renderSelection();
    }
  }

  function shiftWeek(step) {
    const next = new Date(state.currentWeek);
    next.setDate(next.getDate() + step * 7);
    state.currentWeek = startOfWeek(next);
    loadSlots().catch((error) => shared.showToast(error.message));
  }

  renderPacienteOptions();
  renderSelection();

  elements.openBtn.addEventListener("click", () => {
    openModal().catch((error) => shared.showToast(error.message));
  });

  elements.closeBtn?.addEventListener("click", closeModal);
  elements.cancelBtn?.addEventListener("click", closeModal);
  elements.backdrop.addEventListener("click", (event) => {
    if (event.target === elements.backdrop) closeModal();
  });

  elements.profissionalSelect?.addEventListener("change", () => {
    state.selectedProfessionalId = String(elements.profissionalSelect.value || "").trim();
    loadSlots().catch((error) => shared.showToast(error.message));
  });

  elements.pacienteSelect?.addEventListener("change", () => {
    state.selectedPacienteId = String(elements.pacienteSelect.value || "").trim();
    renderSelection();
  });

  elements.weekPrev?.addEventListener("click", () => shiftWeek(-1));
  elements.weekNext?.addEventListener("click", () => shiftWeek(1));
  elements.submitBtn?.addEventListener("click", () => {
    submitBooking().catch(() => {});
  });

  elements.slots.addEventListener("click", (event) => {
    const button = event.target.closest("[data-book-slot]");
    if (!button) return;

    state.selectedSlot = {
      inicio: String(button.getAttribute("data-slot-inicio") || ""),
      fim: String(button.getAttribute("data-slot-fim") || ""),
    };
    renderSelection();

    elements
      .slots.querySelectorAll("[data-book-slot]")
      .forEach((item) => item.classList.remove("is-selected"));
    button.classList.add("is-selected");
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !elements.backdrop.hidden) {
      closeModal();
    }
  });
})();
