(function () {
  const payloadNode = document.getElementById("consultation-dashboard-data");
  const chartContainer = document.querySelector("[data-consulta-line-chart]");
  const tooltip = document.querySelector("[data-consulta-line-tooltip]");
  if (!payloadNode || !chartContainer) return;

  let payload = {};
  try {
    payload = JSON.parse(payloadNode.textContent || "{}");
  } catch (_) {
    payload = {};
  }

  const svgNamespace = "http://www.w3.org/2000/svg";
  const series = Array.isArray(payload?.timeline?.series) ? payload.timeline.series : [];
  const meta = payload?.timeline?.meta || {};

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

  function buildLinePath(points) {
    return points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
  }

  function showTooltip(event, item, label) {
    if (!tooltip || !chartContainer) return;
    const shellRect = chartContainer.getBoundingClientRect();
    const pointX = event.clientX - shellRect.left;
    const pointY = event.clientY - shellRect.top;

    tooltip.hidden = false;
    tooltip.innerHTML = `
      <strong>${escapeHtml(item?.label || "")}</strong>
      <div>${escapeHtml(label)}: ${escapeHtml(Number(item?.value || 0).toLocaleString("pt-BR"))}</div>
      <small>Total: ${escapeHtml(Number(item?.total || 0).toLocaleString("pt-BR"))} consulta(s)</small>
    `;
    tooltip.style.left = `${Math.min(pointX + 14, shellRect.width - 180)}px`;
    tooltip.style.top = `${Math.max(pointY - 76, 16)}px`;
  }

  function hideTooltip() {
    if (!tooltip) return;
    tooltip.hidden = true;
  }

  function renderEmptyState() {
    chartContainer.innerHTML = `
      <div class="dashboard-empty-state">
        <i class="fa-solid fa-chart-line" aria-hidden="true"></i>
        <p>Sem dados suficientes para desenhar a evolução das consultas.</p>
      </div>
    `;
    hideTooltip();
  }

  function renderChart() {
    if (!series.length) {
      renderEmptyState();
      return;
    }

    const width = Math.max(chartContainer.clientWidth || 0, 320);
    const height = Math.max(chartContainer.clientHeight || 0, 320);
    const padding = { top: 24, right: 20, bottom: 42, left: 42 };
    const chartWidth = Math.max(width - padding.left - padding.right, 40);
    const chartHeight = Math.max(height - padding.top - padding.bottom, 40);
    const baseY = padding.top + chartHeight;

    const keys = ["total", "presentes", "faltas"].filter((key) => meta?.[key]);
    const maxValue = Math.max(
      1,
      ...series.flatMap((item) => keys.map((key) => Number(item?.[key] || 0)))
    );
    const stepX = series.length > 1 ? chartWidth / (series.length - 1) : 0;

    const pointsBySeries = {};
    keys.forEach((key) => {
      pointsBySeries[key] = series.map((item, index) => ({
        x: padding.left + stepX * index,
        y: padding.top + chartHeight - (Number(item?.[key] || 0) / maxValue) * chartHeight,
        label: item?.label || "",
        value: Number(item?.[key] || 0),
        total: Number(item?.total || 0),
      }));
    });

    const svg = createSvgElement("svg", {
      viewBox: `0 0 ${width} ${height}`,
      role: "img",
      "aria-label": "Gráfico de evolução das consultas, presenças e faltas",
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

      const label = createSvgElement("text", {
        x: padding.left - 10,
        y: y + 4,
        "text-anchor": "end",
        fill: "#64748b",
        "font-size": 12,
        "font-weight": 700,
      });
      label.textContent = String(value);
      svg.appendChild(label);
    }

    series.forEach((item, index) => {
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

    keys.forEach((key, index) => {
      const color = String(meta?.[key]?.color || "#b24a32");
      const points = pointsBySeries[key];

      if (index === 0) {
        svg.appendChild(
          createSvgElement("path", {
            d: `${buildLinePath(points)} L ${points[points.length - 1].x} ${baseY} L ${points[0].x} ${baseY} Z`,
            fill: "rgba(178, 74, 50, 0.10)",
            stroke: "none",
          })
        );
      }

      svg.appendChild(
        createSvgElement("path", {
          d: buildLinePath(points),
          fill: "none",
          stroke: color,
          "stroke-width": 3,
          "stroke-linecap": "round",
          "stroke-linejoin": "round",
        })
      );

      points.forEach((point) => {
        const circle = createSvgElement("circle", {
          cx: point.x,
          cy: point.y,
          r: 5,
          fill: "#fff",
          stroke: color,
          "stroke-width": 3,
          tabindex: 0,
          style: "cursor:pointer",
        });

        circle.addEventListener("mouseenter", (event) => {
          showTooltip(event, point, meta[key].label);
        });
        circle.addEventListener("mousemove", (event) => {
          showTooltip(event, point, meta[key].label);
        });
        circle.addEventListener("mouseleave", hideTooltip);
        circle.addEventListener("focus", () => {
          if (!tooltip) return;
          tooltip.hidden = false;
          tooltip.innerHTML = `
            <strong>${escapeHtml(point.label)}</strong>
            <div>${escapeHtml(meta[key].label)}: ${escapeHtml(point.value.toLocaleString("pt-BR"))}</div>
            <small>Total: ${escapeHtml(point.total.toLocaleString("pt-BR"))} consulta(s)</small>
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

  renderChart();

  let resizeTimer = null;
  window.addEventListener("resize", function () {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(renderChart, 140);
  });
})();
