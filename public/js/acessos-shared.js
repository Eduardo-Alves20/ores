(function () {
  function requestJson(url, options = {}) {
    return fetch(url, {
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
      ...options,
    }).then(async (response) => {
      let payload = null;
      try {
        payload = await response.json();
      } catch (_) {
        payload = null;
      }

      if (!response.ok) {
        const message = payload?.erro || payload?.message || "Erro ao processar a requisicao.";
        throw new Error(message);
      }

      return payload;
    });
  }

  function createPageHelpers(root) {
    function closeAllMenus(exceptMenu) {
      root.querySelectorAll(".acesso-actions-menu.is-open").forEach((menu) => {
        if (exceptMenu && menu === exceptMenu) return;
        menu.classList.remove("is-open");
        const trigger = menu.querySelector("[data-action='menu-toggle']");
        if (trigger) trigger.setAttribute("aria-expanded", "false");
      });
    }

    function syncBodyModalState() {
      const hasOpenModal = !!root.querySelector(".acessos-modal:not([hidden])");
      document.body.classList.toggle("acessos-modal-open", hasOpenModal);
    }

    return {
      closeAllMenus,
      syncBodyModalState,
    };
  }

  window.ORESAcessosShared = {
    requestJson,
    createPageHelpers,
  };
})();
