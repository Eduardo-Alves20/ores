(function () {
  const DAY_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

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
      options.headers || {},
    );

    const response = await fetch(url, {
      method: options.method || "GET",
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    const contentType = response.headers.get("content-type") || "";
    const payload = contentType.includes("application/json")
      ? await response.json()
      : await response.text();

    if (!response.ok) {
      const message =
        payload?.erro || payload?.message?.[0] || "Erro na requisicao.";
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
    return dt.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function toLocalIsoString(dateLike) {
    const dt = new Date(dateLike);
    if (Number.isNaN(dt.getTime())) return "";

    const year = dt.getFullYear();
    const month = String(dt.getMonth() + 1).padStart(2, "0");
    const day = String(dt.getDate()).padStart(2, "0");
    const hour = String(dt.getHours()).padStart(2, "0");
    const minute = String(dt.getMinutes()).padStart(2, "0");
    const second = String(dt.getSeconds()).padStart(2, "0");
    const offsetMinutes = -dt.getTimezoneOffset();
    const sign = offsetMinutes >= 0 ? "+" : "-";
    const absoluteOffset = Math.abs(offsetMinutes);
    const offsetHour = String(Math.floor(absoluteOffset / 60)).padStart(2, "0");
    const offsetMinute = String(absoluteOffset % 60).padStart(2, "0");

    return `${year}-${month}-${day}T${hour}:${minute}:${second}${sign}${offsetHour}:${offsetMinute}`;
  }

  function mergeDateAndTime(dateStr, timeStr) {
    if (!dateStr || !timeStr) return null;
    const raw = `${dateStr}T${timeStr}:00`;
    const localIso = toLocalIsoString(raw);
    return localIso || null;
  }

  function addMinutes(dateLike, minutes) {
    const dt = new Date(dateLike);
    if (Number.isNaN(dt.getTime())) return null;
    return new Date(dt.getTime() + minutes * 60 * 1000);
  }

  function buildEndIso(startIso, slotMinutes) {
    const duration = Number(slotMinutes) > 0 ? Number(slotMinutes) : 30;
    const end = addMinutes(startIso, duration);
    const localIso = toLocalIsoString(end);
    return localIso || null;
  }

  function startOfCalendarGrid(monthDate) {
    const first = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
    const diff = first.getDay();
    return new Date(
      first.getFullYear(),
      first.getMonth(),
      first.getDate() - diff,
    );
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
      entrega_beneficio: "Entrega de Beneficio",
      reuniao_equipe: "Reuniao de Equipe",
      outro: "Outro",
    };
    return labels[value] || value || "Outro";
  }

  function requiresRoomSelection(roomRequiredTypes, tipoAtendimento) {
    return Array.isArray(roomRequiredTypes)
      ? roomRequiredTypes.includes(String(tipoAtendimento || "").trim())
      : false;
  }

  function toTimeRangeLabel(inicioLike, fimLike) {
    const inicio = new Date(inicioLike);
    const fim = new Date(fimLike);
    if (Number.isNaN(inicio.getTime())) return "--:--";
    if (Number.isNaN(fim.getTime())) return toHourLabel(inicio);
    return `${toHourLabel(inicio)} - ${toHourLabel(fim)}`;
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function sanitizeClassToken(value, fallback = "") {
    const normalized = String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/-{2,}/g, "-")
      .replace(/^-|-$/g, "");

    return normalized || String(fallback || "").trim().toLowerCase();
  }

  window.AgendaShared = {
    MONTH_NAMES,
    buildEndIso,
    confirmAction,
    escapeHtml,
    formatDateTime,
    getVisibleRange,
    mergeDateAndTime,
    normalizeTypeLabel,
    parseDayKeyLocal,
    parseJsonScript,
    requestJson,
    requiresRoomSelection,
    showSuccess,
    showToast,
    sanitizeClassToken,
    startOfCalendarGrid,
    toDateInputValue,
    toDayLabel,
    toDayString,
    toHourLabel,
    toLocalIsoString,
    toMonthLabel,
    toTimeInputValue,
    toTimeRangeLabel,
  };
})();
