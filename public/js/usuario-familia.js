(function () {
  const root = document.querySelector(".page-usuario-minha-familia");
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

  const consultas = parseJsonScript("usuario-familia-consultas-data", []);
  const consultasMap = new Map(
    (Array.isArray(consultas) ? consultas : []).map((item) => [String(item?.id || ""), item])
  );

  const monthGroups = Array.from(root.querySelectorAll(".consulta-mes-group[data-mes-key]"));
  const monthLabelEl = root.querySelector("[data-consulta-mes-label]");
  const monthCountEl = root.querySelector("[data-consulta-mes-count]");
  const monthPrevBtn = root.querySelector("[data-consulta-mes-prev]");
  const monthNextBtn = root.querySelector("[data-consulta-mes-next]");
  const yearSelect = root.querySelector("[data-consulta-ano-select]");
  const monthSelect = root.querySelector("[data-consulta-mes-select]");

  const modalBackdrop = document.getElementById("usuario-consulta-modal-backdrop");
  const modalCloseBtn = document.getElementById("usuario-consulta-modal-close");
  const fieldTipo = document.getElementById("usuario-consulta-tipo");
  const fieldData = document.getElementById("usuario-consulta-data");
  const fieldDependente = document.getElementById("usuario-consulta-dependente");
  const fieldStatus = document.getElementById("usuario-consulta-status");
  const fieldResumo = document.getElementById("usuario-consulta-resumo");
  const fieldPassos = document.getElementById("usuario-consulta-passos");

  function setText(el, value) {
    if (!el) return;
    el.textContent = String(value || "-");
  }

  function parseMonthKey(key) {
    const match = /^(\d{4})-(\d{2})$/.exec(String(key || ""));
    if (!match) return null;
    return {
      year: Number(match[1]),
      month: Number(match[2]),
    };
  }

  if (monthGroups.length) {
    const monthNames = [
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
    let monthIndex = 0;
    const totalMonths = monthGroups.length;
    const monthKeyIndexMap = new Map();
    const years = [];

    monthGroups.forEach((group, index) => {
      const key = String(group.getAttribute("data-mes-key") || "");
      monthKeyIndexMap.set(key, index);
      const parsed = parseMonthKey(key);
      if (parsed && !years.includes(parsed.year)) years.push(parsed.year);
    });

    years.sort((a, b) => b - a);

    if (yearSelect) {
      yearSelect.innerHTML = years.map((year) => `<option value="${year}">${year}</option>`).join("");
    }

    if (monthSelect) {
      monthSelect.innerHTML = monthNames
        .map((name, idx) => {
          const monthValue = String(idx + 1).padStart(2, "0");
          return `<option value="${monthValue}">${name}</option>`;
        })
        .join("");
    }

    function updateMonthOptionsForYear(selectedYear) {
      if (!monthSelect) return;
      const options = Array.from(monthSelect.options || []);
      options.forEach((option) => {
        const key = `${selectedYear}-${String(option.value || "").padStart(2, "0")}`;
        option.disabled = !monthKeyIndexMap.has(key);
      });
    }

    function goToMonthKey(monthKey) {
      const idx = monthKeyIndexMap.get(String(monthKey || ""));
      if (typeof idx !== "number") return false;
      monthIndex = idx;
      renderMonth();
      return true;
    }

    function renderMonth() {
      monthGroups.forEach((group, index) => {
        group.hidden = index !== monthIndex;
      });

      const current = monthGroups[monthIndex];
      const label = current?.getAttribute("data-mes-label") || "-";
      const currentKey = String(current?.getAttribute("data-mes-key") || "");
      const parsedCurrent = parseMonthKey(currentKey);
      setText(monthLabelEl, label);
      setText(monthCountEl, `${monthIndex + 1} / ${totalMonths}`);

      if (monthPrevBtn) monthPrevBtn.disabled = monthIndex <= 0;
      if (monthNextBtn) monthNextBtn.disabled = monthIndex >= totalMonths - 1;

      if (parsedCurrent && yearSelect) {
        yearSelect.value = String(parsedCurrent.year);
      }
      if (parsedCurrent && monthSelect) {
        monthSelect.value = String(parsedCurrent.month).padStart(2, "0");
      }
      if (parsedCurrent) updateMonthOptionsForYear(parsedCurrent.year);
    }

    if (monthPrevBtn) {
      monthPrevBtn.addEventListener("click", () => {
        if (monthIndex <= 0) return;
        monthIndex -= 1;
        renderMonth();
      });
    }

    if (monthNextBtn) {
      monthNextBtn.addEventListener("click", () => {
        if (monthIndex >= totalMonths - 1) return;
        monthIndex += 1;
        renderMonth();
      });
    }

    if (yearSelect) {
      yearSelect.addEventListener("change", () => {
        const selectedYear = Number(yearSelect.value);
        updateMonthOptionsForYear(selectedYear);

        const current = monthGroups[monthIndex];
        const currentParsed = parseMonthKey(current?.getAttribute("data-mes-key"));
        const currentMonth = String(currentParsed?.month || 1).padStart(2, "0");

        if (goToMonthKey(`${selectedYear}-${currentMonth}`)) return;

        const firstEnabledMonth = Array.from(monthSelect?.options || []).find((option) => !option.disabled);
        if (!firstEnabledMonth) return;
        goToMonthKey(`${selectedYear}-${firstEnabledMonth.value}`);
      });
    }

    if (monthSelect) {
      monthSelect.addEventListener("change", () => {
        const selectedMonth = String(monthSelect.value || "");
        const selectedYear =
          yearSelect && yearSelect.value
            ? String(yearSelect.value)
            : String(parseMonthKey(monthGroups[monthIndex]?.getAttribute("data-mes-key"))?.year || "");
        if (!selectedYear || !selectedMonth) return;
        goToMonthKey(`${selectedYear}-${selectedMonth}`);
      });
    }

    renderMonth();
  }

  if (!modalBackdrop || !modalCloseBtn) return;

  function closeModal() {
    modalBackdrop.hidden = true;
    document.body.classList.remove("usuario-consulta-modal-open");
  }

  function openModalById(consultaId) {
    const consulta = consultasMap.get(String(consultaId || ""));
    if (!consulta) return;

    setText(fieldTipo, consulta.tipoLabel || "-");
    setText(fieldData, consulta.dataHoraLabel || "-");
    setText(fieldDependente, consulta.dependenteNome || "-");
    setText(fieldStatus, consulta.statusLabel || "-");
    setText(fieldResumo, consulta.resumo || "-");
    setText(fieldPassos, consulta.proximosPassos || "-");

    modalBackdrop.hidden = false;
    document.body.classList.add("usuario-consulta-modal-open");
  }

  root.addEventListener("click", (event) => {
    const card = event.target.closest(".consulta-card-clickable[data-consulta-id]");
    if (!card) return;
    openModalById(card.getAttribute("data-consulta-id"));
  });

  root.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const card = event.target.closest(".consulta-card-clickable[data-consulta-id]");
    if (!card) return;
    event.preventDefault();
    openModalById(card.getAttribute("data-consulta-id"));
  });

  modalCloseBtn.addEventListener("click", closeModal);
  modalBackdrop.addEventListener("click", (event) => {
    if (event.target === modalBackdrop) closeModal();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (!modalBackdrop.hidden) closeModal();
  });
})();
