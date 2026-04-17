(function () {
  function readMeta(name) {
    const node = document.querySelector(`meta[name="${name}"]`);
    return node ? String(node.getAttribute("content") || "").trim() : "";
  }

  function getToken() {
    return readMeta("csrf-token");
  }

  function getHeaderName() {
    return readMeta("csrf-header-name") || "X-CSRF-Token";
  }

  function getFieldName() {
    return readMeta("csrf-field-name") || "_csrf";
  }

  function isUnsafeMethod(method) {
    const normalized = String(method || "GET").trim().toUpperCase();
    return !["GET", "HEAD", "OPTIONS", "TRACE"].includes(normalized);
  }

  function resolveActionUrl(action) {
    try {
      return new URL(String(action || ""), window.location.href);
    } catch (_) {
      return null;
    }
  }

  function isSameOriginUrl(url) {
    const resolved = resolveActionUrl(url);
    if (!resolved) return false;
    return resolved.origin === window.location.origin;
  }

  function ensureFormToken(form) {
    if (!(form instanceof HTMLFormElement)) return;

    const method = String(form.getAttribute("method") || "GET").trim().toUpperCase();
    if (!isUnsafeMethod(method)) return;

    const action = form.getAttribute("action") || window.location.href;
    if (!isSameOriginUrl(action)) return;

    const token = getToken();
    const fieldName = getFieldName();
    if (!token || !fieldName) return;

    let hidden = form.querySelector(`input[name="${fieldName}"]`);
    if (!hidden) {
      hidden = document.createElement("input");
      hidden.type = "hidden";
      hidden.name = fieldName;
      form.appendChild(hidden);
    }

    hidden.value = token;
  }

  function patchForms(root) {
    const scope = root && typeof root.querySelectorAll === "function" ? root : document;
    scope.querySelectorAll("form").forEach((form) => ensureFormToken(form));
  }

  function patchFetch() {
    if (typeof window.fetch !== "function") return;

    const originalFetch = window.fetch.bind(window);
    window.fetch = function patchedFetch(input, init) {
      const requestUrl =
        typeof input === "string"
          ? input
          : input && typeof input.url === "string"
            ? input.url
            : "";

      const currentInit = init ? { ...init } : {};
      const method =
        currentInit.method ||
        (typeof input !== "string" && input && input.method ? input.method : "GET");

      if (requestUrl && isUnsafeMethod(method) && isSameOriginUrl(requestUrl)) {
        const headers = new Headers(
          currentInit.headers ||
          (typeof input !== "string" && input && input.headers ? input.headers : undefined) ||
          undefined
        );

        if (!headers.has(getHeaderName())) {
          const token = getToken();
          if (token) {
            headers.set(getHeaderName(), token);
          }
        }

        currentInit.headers = headers;
      }

      return originalFetch(input, currentInit);
    };
  }

  function observeForms() {
    if (typeof MutationObserver !== "function" || !document.body) return;

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (!(node instanceof Element)) return;
          if (node.matches("form")) {
            ensureFormToken(node);
          }
          patchForms(node);
        });
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  patchFetch();

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      patchForms(document);
      observeForms();
    });
  } else {
    patchForms(document);
    observeForms();
  }

  window.ORESCsrf = {
    getFieldName,
    getHeaderName,
    getToken,
    patchForms,
  };
})();
