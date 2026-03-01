(function () {
  const toggles = document.querySelectorAll("[data-password-toggle]");
  if (!toggles.length) return;

  toggles.forEach((toggle) => {
    const targetId = String(toggle.getAttribute("data-password-toggle") || "").trim();
    if (!targetId) return;

    const input = document.getElementById(targetId);
    if (!input) return;

    const icon = toggle.querySelector("[data-password-icon]");

    function setState(show) {
      input.setAttribute("type", show ? "text" : "password");
      toggle.setAttribute("aria-pressed", show ? "true" : "false");
      toggle.setAttribute("aria-label", show ? "Ocultar senha" : "Mostrar senha");
      if (icon) {
        icon.classList.remove("fa-eye", "fa-eye-slash");
        icon.classList.add(show ? "fa-eye" : "fa-eye-slash");
      }
    }

    setState(false);

    toggle.addEventListener("click", () => {
      const isShowing = input.getAttribute("type") === "text";
      setState(!isShowing);
    });
  });
})();
