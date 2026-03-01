(function () {
  const root = document.querySelector(".page-acessos");
  if (!root) return;

  function closeAllMenus(exceptMenu) {
    root.querySelectorAll(".acesso-actions-menu.is-open").forEach((menu) => {
      if (exceptMenu && menu === exceptMenu) return;
      menu.classList.remove("is-open");
      const trigger = menu.querySelector("[data-action='menu-toggle']");
      if (trigger) trigger.setAttribute("aria-expanded", "false");
    });
  }

  root.addEventListener("click", (event) => {
    const toggleBtn = event.target.closest("[data-action='menu-toggle']");
    if (!toggleBtn) return;

    event.preventDefault();
    event.stopPropagation();

    const menu = toggleBtn.closest(".acesso-actions-menu");
    if (!menu) return;

    const willOpen = !menu.classList.contains("is-open");
    closeAllMenus(menu);
    menu.classList.toggle("is-open", willOpen);
    toggleBtn.setAttribute("aria-expanded", String(willOpen));
  });

  document.addEventListener("click", (event) => {
    if (event.target.closest(".acesso-actions-menu")) return;
    closeAllMenus();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    closeAllMenus();
  });
})();
