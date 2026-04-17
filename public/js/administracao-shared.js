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
      throw new Error(payload?.erro || payload?.message || "Erro ao processar a requisicao.");
    }

    return payload;
  }

  async function confirmAction(options = {}) {
    const defaults = {
      title: "Confirmar acao",
      text: "Deseja continuar?",
      icon: "question",
      confirmButtonText: "Confirmar",
      cancelButtonText: "Cancelar",
    };

    if (typeof window.appConfirm === "function") {
      return window.appConfirm({ ...defaults, ...options });
    }

    return window.confirm(options?.text || defaults.text);
  }

  function notifySuccess(message) {
    if (typeof window.appNotifySuccess === "function") {
      window.appNotifySuccess(message);
      return;
    }
    window.alert(message);
  }

  function notifyError(message) {
    if (typeof window.appNotifyError === "function") {
      window.appNotifyError(message);
      return;
    }
    window.alert(message);
  }

  function reloadSoon(message) {
    notifySuccess(message);
    window.setTimeout(() => {
      window.location.reload();
    }, 250);
  }

  function parsePayloadAttribute(value) {
    try {
      return JSON.parse(decodeURIComponent(String(value || "")));
    } catch (_) {
      return {};
    }
  }

  window.ORESAdministracaoShared = {
    confirmAction,
    notifyError,
    notifySuccess,
    parseJsonScript,
    parsePayloadAttribute,
    reloadSoon,
    requestJson,
  };
})();
