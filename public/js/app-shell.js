(function () {
  const toggle = document.querySelector("[data-mobile-nav-toggle]");
  const sidebar = document.querySelector("[data-sidebar]");
  const backdrop = document.querySelector("[data-sidebar-backdrop]");
  const mobileQuery = window.matchMedia("(max-width: 920px)");
  if (!toggle || !sidebar || !backdrop) return;

  function setSidebarState(opened) {
    sidebar.classList.toggle("is-open", opened);
    backdrop.hidden = !opened;
    document.body.classList.toggle("app-nav-open", opened);
    toggle.setAttribute("aria-expanded", opened ? "true" : "false");
  }

  toggle.addEventListener("click", function () {
    const opened = !sidebar.classList.contains("is-open");
    setSidebarState(opened);
  });

  document.addEventListener("click", function (event) {
    if (!mobileQuery.matches) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest("[data-sidebar]") || target.closest("[data-mobile-nav-toggle]")) return;
    setSidebarState(false);
  });

  backdrop.addEventListener("click", function () {
    setSidebarState(false);
  });

  const groupToggles = Array.from(document.querySelectorAll("[data-sidebar-group-toggle]"));
  groupToggles.forEach(function (groupToggle) {
    groupToggle.addEventListener("click", function () {
      const group = groupToggle.closest("[data-sidebar-group]");
      const panel = group?.querySelector("[data-sidebar-group-panel]");
      if (!group || !panel) return;

      const willOpen = panel.hidden;
      panel.hidden = !willOpen;
      group.classList.toggle("is-open", willOpen);
      groupToggle.setAttribute("aria-expanded", willOpen ? "true" : "false");
    });
  });

  sidebar.addEventListener("click", function (event) {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest(".sidebar-group-toggle")) return;
    if (!target.closest(".sidebar-link")) return;
    if (!mobileQuery.matches) return;
    setSidebarState(false);
  });

  document.addEventListener("keydown", function (event) {
    if (event.key !== "Escape") return;
    if (!sidebar.classList.contains("is-open")) return;
    setSidebarState(false);
  });

  function syncSidebarForViewport(event) {
    if (event.matches) return;
    setSidebarState(false);
  }

  if (typeof mobileQuery.addEventListener === "function") {
    mobileQuery.addEventListener("change", syncSidebarForViewport);
  } else if (typeof mobileQuery.addListener === "function") {
    mobileQuery.addListener(syncSidebarForViewport);
  }
})();
