(function () {
  const toggle = document.querySelector("[data-mobile-nav-toggle]");
  const sidebar = document.querySelector("[data-sidebar]");
  if (!toggle || !sidebar) return;

  toggle.addEventListener("click", function () {
    const opened = sidebar.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", opened ? "true" : "false");
  });

  document.addEventListener("click", function (event) {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest("[data-sidebar]") || target.closest("[data-mobile-nav-toggle]")) return;
    sidebar.classList.remove("is-open");
    toggle.setAttribute("aria-expanded", "false");
  });
})();

