(function () {
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
    const isJson = contentType.includes("application/json");
    const payload = isJson ? await response.json() : await response.text();

    if (!response.ok) {
      const message = isJson
        ? payload?.erro || payload?.message?.[0] || "Erro na requisicao."
        : "Erro na requisicao.";
      throw new Error(message);
    }

    return payload;
  }

  function formatDate(dateLike) {
    if (!dateLike) return "-";
    const dt = new Date(dateLike);
    if (Number.isNaN(dt.getTime())) return "-";
    return new Intl.DateTimeFormat("pt-BR").format(dt);
  }

  function formatDateTime(dateLike) {
    if (!dateLike) return "-";
    const dt = new Date(dateLike);
    if (Number.isNaN(dt.getTime())) return "-";
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(dt);
  }

  function formatAtendimentoTipoLabel(tipo) {
    const labels = {
      ligacao: "Ligacao",
      presencial: "Presencial",
      mensagem: "Mensagem",
      whatsapp: "Whatsapp",
      videochamada: "Videochamada",
      outro: "Outro",
    };
    const normalized = String(tipo || "").toLowerCase().trim();
    return labels[normalized] || "Outro";
  }

  function formatAgendaTipoLabel(tipo) {
    const labels = {
      visita_domiciliar: "Visita domiciliar",
      atendimento_sede: "Atendimento na sede",
      entrega_beneficio: "Entrega de beneficio",
      reuniao_equipe: "Reuniao de equipe",
      outro: "Outro",
    };
    const normalized = String(tipo || "").toLowerCase().trim();
    return labels[normalized] || "Outro";
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

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
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

  function toIsoFromLocal(localDateTime) {
    if (!localDateTime) return null;
    const dt = new Date(localDateTime);
    if (Number.isNaN(dt.getTime())) return null;
    return dt.toISOString();
  }

  window.FamiliasShared = {
    confirmAction,
    escapeHtml,
    formatAgendaTipoLabel,
    formatAtendimentoTipoLabel,
    formatDate,
    formatDateTime,
    parseJsonScript,
    requestJson,
    sanitizeClassToken,
    showSuccess,
    showToast,
    toIsoFromLocal,
  };
})();
