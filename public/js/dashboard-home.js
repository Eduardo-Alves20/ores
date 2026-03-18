(function () {
  const payloadNode = document.getElementById("dashboard-data");
  if (!payloadNode) return;

  let payload = {};
  try {
    payload = JSON.parse(payloadNode.textContent || "{}");
  } catch (_) {
    payload = {};
  }

  const svgNamespace = "http://www.w3.org/2000/svg";
  const chartContainer = document.querySelector("[data-dashboard-line-chart]");
  const tooltip = document.querySelector("[data-dashboard-tooltip]");
  const rangeButtons = Array.from(document.querySelectorAll("[data-dashboard-range]"));

  function createSvgElement(tag, attrs) {
    const node = document.createElementNS(svgNamespace, tag);
    Object.entries(attrs || {}).forEach(([key, value]) => {
      node.setAttribute(key, String(value));
    });
    return node;
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function initialsFromName(value, fallback) {
    const parts = String(value || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2);

    if (!parts.length) return fallback || "GS";
    return parts.map((part) => part.charAt(0).toUpperCase()).join("");
  }

  function buildLinePath(points) {
    return points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
  }

  function buildAreaPath(points, baseY) {
    if (!points.length) return "";
    return `${buildLinePath(points)} L ${points[points.length - 1].x} ${baseY} L ${points[0].x} ${baseY} Z`;
  }

  function showTooltip(event, label, seriesLabel, value) {
    if (!tooltip || !chartContainer) return;

    tooltip.hidden = false;
    tooltip.innerHTML = `
      <strong>${escapeHtml(label)}</strong>
      <div>${escapeHtml(seriesLabel)}: ${escapeHtml(value)}</div>
      <small>Passe pelos pontos para comparar meses.</small>
    `;

    const shellRect = chartContainer.getBoundingClientRect();
    const pointX = event.clientX - shellRect.left;
    const pointY = event.clientY - shellRect.top;

    tooltip.style.left = `${Math.min(pointX + 14, shellRect.width - 180)}px`;
    tooltip.style.top = `${Math.max(pointY - 76, 16)}px`;
  }

  function hideTooltip() {
    if (!tooltip) return;
    tooltip.hidden = true;
  }

  function renderLineChart(range) {
    if (!chartContainer) return;

    const seriesKey = String(range) === "12" ? "series12" : "series6";
    const data = Array.isArray(payload?.timeline?.[seriesKey]) ? payload.timeline[seriesKey] : [];

    if (!data.length) {
      chartContainer.innerHTML = `
        <div class="dashboard-empty-state">
          <i class="fa-solid fa-chart-line" aria-hidden="true"></i>
          <p>Sem dados suficientes para desenhar a evolucao agora.</p>
        </div>
      `;
      hideTooltip();
      return;
    }

    const width = Math.max(chartContainer.clientWidth || 0, 320);
    const height = chartContainer.clientHeight || 320;
    const padding = { top: 24, right: 24, bottom: 42, left: 42 };
    const chartWidth = Math.max(width - padding.left - padding.right, 40);
    const chartHeight = Math.max(height - padding.top - padding.bottom, 40);
    const maxValue = Math.max(
      1,
      ...data.map((item) => Number(item?.cadastros || 0)),
      ...data.map((item) => Number(item?.atendimentos || 0))
    );
    const baseY = padding.top + chartHeight;
    const stepX = data.length > 1 ? chartWidth / (data.length - 1) : 0;

    const chartPoints = {
      cadastros: data.map((item, index) => ({
        x: padding.left + stepX * index,
        y: padding.top + chartHeight - (Number(item?.cadastros || 0) / maxValue) * chartHeight,
        label: item?.label || "",
        value: Number(item?.cadastros || 0),
      })),
      atendimentos: data.map((item, index) => ({
        x: padding.left + stepX * index,
        y: padding.top + chartHeight - (Number(item?.atendimentos || 0) / maxValue) * chartHeight,
        label: item?.label || "",
        value: Number(item?.atendimentos || 0),
      })),
    };

    const svg = createSvgElement("svg", {
      viewBox: `0 0 ${width} ${height}`,
      role: "img",
      "aria-label": "Grafico de evolucao mensal de cadastros e atendimentos",
    });

    for (let index = 0; index <= 4; index += 1) {
      const value = Math.round((maxValue / 4) * index);
      const y = padding.top + chartHeight - (chartHeight / 4) * index;

      svg.appendChild(
        createSvgElement("line", {
          x1: padding.left,
          y1: y,
          x2: width - padding.right,
          y2: y,
          stroke: "#dbe4ec",
          "stroke-width": 1,
        })
      );

      const valueLabel = createSvgElement("text", {
        x: padding.left - 10,
        y: y + 4,
        "text-anchor": "end",
        fill: "#64748b",
        "font-size": 12,
        "font-weight": 700,
      });
      valueLabel.textContent = String(value);
      svg.appendChild(valueLabel);
    }

    data.forEach((item, index) => {
      const x = padding.left + stepX * index;
      const label = createSvgElement("text", {
        x,
        y: height - 14,
        "text-anchor": "middle",
        fill: "#64748b",
        "font-size": 12,
        "font-weight": 700,
      });
      label.textContent = item?.label || "";
      svg.appendChild(label);
    });

    const cadastroColor = "#b24a32";
    const atendimentoColor = "#d19984";

    svg.appendChild(
      createSvgElement("path", {
        d: buildAreaPath(chartPoints.cadastros, baseY),
        fill: "rgba(178, 74, 50, 0.12)",
        stroke: "none",
      })
    );

    svg.appendChild(
      createSvgElement("path", {
        d: buildAreaPath(chartPoints.atendimentos, baseY),
        fill: "rgba(209, 153, 132, 0.16)",
        stroke: "none",
      })
    );

    svg.appendChild(
      createSvgElement("path", {
        d: buildLinePath(chartPoints.cadastros),
        fill: "none",
        stroke: cadastroColor,
        "stroke-width": 3,
        "stroke-linecap": "round",
        "stroke-linejoin": "round",
      })
    );

    svg.appendChild(
      createSvgElement("path", {
        d: buildLinePath(chartPoints.atendimentos),
        fill: "none",
        stroke: atendimentoColor,
        "stroke-width": 3,
        "stroke-linecap": "round",
        "stroke-linejoin": "round",
      })
    );

    const interactiveSeries = [
      { key: "cadastros", label: "Cadastros", color: cadastroColor },
      { key: "atendimentos", label: "Atendimentos", color: atendimentoColor },
    ];

    interactiveSeries.forEach((series) => {
      chartPoints[series.key].forEach((point) => {
        const circle = createSvgElement("circle", {
          cx: point.x,
          cy: point.y,
          r: 5,
          fill: "#fff",
          stroke: series.color,
          "stroke-width": 3,
          tabindex: 0,
          style: "cursor:pointer",
        });

        circle.addEventListener("mouseenter", (event) => {
          showTooltip(event, point.label, series.label, point.value.toLocaleString("pt-BR"));
        });

        circle.addEventListener("mousemove", (event) => {
          showTooltip(event, point.label, series.label, point.value.toLocaleString("pt-BR"));
        });

        circle.addEventListener("mouseleave", hideTooltip);
        circle.addEventListener("focus", () => {
          tooltip.hidden = false;
          tooltip.innerHTML = `
            <strong>${escapeHtml(point.label)}</strong>
            <div>${escapeHtml(series.label)}: ${escapeHtml(point.value.toLocaleString("pt-BR"))}</div>
            <small>Use Tab para navegar pelos pontos.</small>
          `;
          tooltip.style.left = `${Math.max(point.x - 70, 12)}px`;
          tooltip.style.top = `${Math.max(point.y - 72, 12)}px`;
        });
        circle.addEventListener("blur", hideTooltip);
        svg.appendChild(circle);
      });
    });

    chartContainer.innerHTML = "";
    chartContainer.appendChild(svg);
  }

  let currentRange = "6";
  rangeButtons.forEach((button) => {
    button.addEventListener("click", function () {
      const nextRange = String(button.getAttribute("data-dashboard-range") || "6");
      currentRange = nextRange;
      rangeButtons.forEach((item) => item.classList.toggle("is-active", item === button));
      renderLineChart(nextRange);
    });
  });

  renderLineChart(currentRange);

  let resizeTimer = null;
  window.addEventListener("resize", function () {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(function () {
      renderLineChart(currentRange);
    }, 140);
  });

  const searchForm = document.querySelector("[data-dashboard-search]");
  const searchInput = document.querySelector("[data-dashboard-search-input]");
  const searchResults = document.querySelector("[data-dashboard-search-results]");
  const searchConfig = payload?.search || {};

  if (!searchForm || !searchInput || !searchResults || !searchConfig.enabled) {
    return;
  }

  let searchTimer = null;
  let lastRequest = 0;

  function hideSearchResults() {
    searchResults.hidden = true;
    searchResults.innerHTML = "";
  }

  function renderSearchResults(data, term) {
    const familias = Array.isArray(data?.familias) ? data.familias.slice(0, 3) : [];
    const pacientes = Array.isArray(data?.pacientes) ? data.pacientes.slice(0, 3) : [];
    const resultsMarkup = []
      .concat(
        familias.map((item) => {
          const nome = item?.responsavel?.nome || "Familia";
          const telefone = item?.responsavel?.telefone || "Sem telefone";
          return `
            <a href="/familias/${encodeURIComponent(item?._id || "")}" class="dashboard-search-result">
              <span class="dashboard-avatar soft">${escapeHtml(initialsFromName(nome, "FA"))}</span>
              <span class="dashboard-search-result-copy">
                <strong>${escapeHtml(nome)}</strong>
                <small>Familia • ${escapeHtml(telefone)}</small>
              </span>
            </a>
          `;
        })
      )
      .concat(
        pacientes.map((item) => {
          const nome = item?.nome || "Assistido";
          const familiaNome = item?.familiaId?.responsavel?.nome || "Familia nao localizada";
          const familiaId = item?.familiaId?._id;
          const href = familiaId ? `/familias/${encodeURIComponent(familiaId)}` : "#";
          return `
            <a href="${href}" class="dashboard-search-result">
              <span class="dashboard-avatar soft">${escapeHtml(initialsFromName(nome, "AS"))}</span>
              <span class="dashboard-search-result-copy">
                <strong>${escapeHtml(nome)}</strong>
                <small>Assistido • ${escapeHtml(familiaNome)}</small>
              </span>
            </a>
          `;
        })
      );

    if (!resultsMarkup.length) {
      searchResults.innerHTML = `<div class="dashboard-search-empty">Nenhum resultado encontrado para "${escapeHtml(term)}".</div>`;
      searchResults.hidden = false;
      return;
    }

    searchResults.innerHTML = resultsMarkup.join("");
    searchResults.hidden = false;
  }

  async function searchTerm(term) {
    const requestId = Date.now();
    lastRequest = requestId;

    try {
      const response = await fetch(`${searchConfig.endpoint}?termo=${encodeURIComponent(term)}`, {
        headers: {
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        hideSearchResults();
        return;
      }

      const data = await response.json();
      if (lastRequest !== requestId) return;
      renderSearchResults(data, term);
    } catch (_) {
      hideSearchResults();
    }
  }

  searchInput.addEventListener("input", function () {
    const term = String(searchInput.value || "").trim();
    window.clearTimeout(searchTimer);

    if (term.length < 2) {
      hideSearchResults();
      return;
    }

    searchTimer = window.setTimeout(function () {
      searchTerm(term);
    }, 220);
  });

  searchInput.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
      hideSearchResults();
    }
  });

  document.addEventListener("click", function (event) {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest("[data-dashboard-search]")) return;
    hideSearchResults();
  });
})();
