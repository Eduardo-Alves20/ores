(function () {
  const cardsDataNode = document.getElementById("usuario-familia-consultas-data");
  if (!cardsDataNode) return;

  const cards = JSON.parse(cardsDataNode.textContent || "[]");
  const byId = new Map(cards.map((item) => [String(item.id || ""), item]));

  const backdrop = document.getElementById("usuario-consulta-modal-backdrop");
  const closeBtn = document.getElementById("usuario-consulta-modal-close");
  if (!backdrop || !closeBtn) return;

  const refs = {
    tipo: document.getElementById("usuario-consulta-tipo"),
    data: document.getElementById("usuario-consulta-data"),
    dependente: document.getElementById("usuario-consulta-dependente"),
    status: document.getElementById("usuario-consulta-status"),
    resumo: document.getElementById("usuario-consulta-resumo"),
    passos: document.getElementById("usuario-consulta-passos"),
  };

  function openCard(card) {
    refs.tipo.textContent = card?.tipoLabel || "-";
    refs.data.textContent = card?.dataHoraLabel || "-";
    refs.dependente.textContent = card?.dependenteNome || "-";
    refs.status.textContent = card?.statusLabel || "-";
    refs.resumo.textContent = card?.resumo || "-";
    refs.passos.textContent = card?.proximosPassos || "-";
    backdrop.hidden = false;
  }

  function closeModal() {
    backdrop.hidden = true;
  }

  document.querySelectorAll("[data-consulta-id]").forEach((element) => {
    const open = () => {
      const card = byId.get(String(element.getAttribute("data-consulta-id") || ""));
      if (card) openCard(card);
    };

    element.addEventListener("click", open);
    element.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        open();
      }
    });
  });

  closeBtn.addEventListener("click", closeModal);
  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop) closeModal();
  });
})();
