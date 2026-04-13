(function () {
  function toArray(value) {
    if (Array.isArray(value)) {
      return value
        .map((item) => String(item || "").trim())
        .filter(Boolean);
    }
    const single = String(value || "").trim();
    return single ? [single] : [];
  }

  function hasSwal() {
    return typeof window.Swal !== "undefined" && typeof window.Swal.fire === "function";
  }

  function readAppFlash() {
    if (window.__APP_FLASH && typeof window.__APP_FLASH === "object") {
      return window.__APP_FLASH;
    }

    const payloadNode = document.getElementById("app-flash-data");
    if (!payloadNode) {
      return {};
    }

    try {
      const raw = String(payloadNode.textContent || "").trim();
      return raw ? JSON.parse(raw) : {};
    } catch (_) {
      return {};
    }
  }

  function notify(type, message, options = {}) {
    const text = String(message || "").trim();
    if (!text) return Promise.resolve();

    const icon = type || "info";
    const title = String(options.title || "").trim() || (
      icon === "success" ? "Sucesso" :
      icon === "error" ? "Erro" :
      icon === "warning" ? "Aviso" :
      "Informacao"
    );

    if (!hasSwal()) {
      window.alert(text);
      return Promise.resolve();
    }

    const toast = options.toast !== false;
    return window.Swal.fire({
      toast,
      position: "top-end",
      timer: toast ? 3800 : undefined,
      timerProgressBar: toast,
      showConfirmButton: !toast,
      icon,
      title,
      text,
      customClass: {
        popup: "swal2-app-popup",
      },
    });
  }

  window.appNotify = function appNotify(type, message, options) {
    return notify(type, message, options);
  };

  window.appNotifySuccess = function appNotifySuccess(message, options = {}) {
    return notify("success", message, options);
  };

  window.appNotifyError = function appNotifyError(message, options = {}) {
    return notify("error", message, options);
  };

  window.appNotifyWarning = function appNotifyWarning(message, options = {}) {
    return notify("warning", message, options);
  };

  window.appNotifyInfo = function appNotifyInfo(message, options = {}) {
    return notify("info", message, options);
  };

  window.appConfirm = async function appConfirm(options = {}) {
    const title = String(options.title || "Confirmar").trim();
    const text = String(options.text || "Deseja continuar?").trim();

    if (!hasSwal()) {
      return window.confirm(text);
    }

    const result = await window.Swal.fire({
      icon: options.icon || "question",
      title,
      text,
      showCancelButton: true,
      confirmButtonText: options.confirmButtonText || "Sim",
      cancelButtonText: options.cancelButtonText || "Cancelar",
      reverseButtons: true,
    });

    return !!result.isConfirmed;
  };

  function readConfirmOptionsFromDataset(el) {
    if (!el) return null;
    const ds = el.dataset || {};
    const title = String(ds.confirmTitle || "Confirmar").trim();
    const text = String(ds.confirmText || "Deseja continuar?").trim();
    const icon = String(ds.confirmIcon || "question").trim() || "question";
    const confirmButtonText = String(ds.confirmConfirm || "Sim").trim() || "Sim";
    const cancelButtonText = String(ds.confirmCancel || "Cancelar").trim() || "Cancelar";
    return { title, text, icon, confirmButtonText, cancelButtonText };
  }

  document.addEventListener(
    "submit",
    async (event) => {
      const form = event.target.closest("form[data-confirm='true']");
      if (!form) return;

      if (form.dataset.confirmed === "1") {
        form.dataset.confirmed = "0";
        return;
      }

      event.preventDefault();
      const options = readConfirmOptionsFromDataset(form);
      const ok = await window.appConfirm(options || {});
      if (!ok) return;

      form.dataset.confirmed = "1";
      HTMLFormElement.prototype.submit.call(form);
    },
    true
  );

  const flash = readAppFlash();
  window.__APP_FLASH = flash;
  const success = toArray(flash.success);
  const error = toArray(flash.error);
  const warning = toArray(flash.warning);
  const info = toArray(flash.info);

  const queue = []
    .concat(error.slice(0, 2).map((msg) => ({ type: "error", msg })))
    .concat(success.slice(0, 2).map((msg) => ({ type: "success", msg })))
    .concat(warning.slice(0, 1).map((msg) => ({ type: "warning", msg })))
    .concat(info.slice(0, 1).map((msg) => ({ type: "info", msg })));

  if (queue.length) {
    document
      .querySelectorAll(".auth-error,.auth-success,.conta-error,.conta-success")
      .forEach((el) => {
        el.style.display = "none";
      });

    queue.forEach((item) => {
      notify(item.type, item.msg);
    });
  }
})();
