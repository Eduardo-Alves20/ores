document.addEventListener("DOMContentLoaded", () => {
  const boardId = document
    .querySelector(".board-canvas")
    .getAttribute("data-board-id");
  // Seleciona todas as colunas de cartões
  // ---- CARD ----
  const columns = document.querySelectorAll(".js-list-cards");
  columns.forEach((column) => {
    new Sortable(column, {
      group: "shared", // Permite arrastar de uma lista para outra
      animation: 150, // Animação suave em ms
      ghostClass: "blue-background-class", // Classe visual do espaço vazio (placeholder)

      // Evento disparado quando soltamos o card
      onEnd: function (event) {
        const itemEl = event.item; // O elemento HTML arrastado
        const newIndex = event.newIndex; // A nova posição visual (0, 1, 2...)
        const toList = event.to; // O elemento HTML da lista de destino

        // Pegamos os IDs do banco de dados que colocamos no HTML
        const cardId = itemEl.getAttribute("data-card-id");
        const newListId = toList.closest(".list").getAttribute("data-list-id");

        // AQUI ENVIAREMOS PARA O BACKEND (Faremos no próximo passo)
        API.card.move(boardId, cardId, newListId, newIndex);
      },
    });
  });

  // ---- lISTAS ----
  const listsContainer = document.querySelector(".js-lists-container");
  if (listsContainer) {
    new Sortable(listsContainer, {
      animation: 150,
      handle: ".list-header", // Só pode arrastar segurando pelo topo da lista
      draggable: ".list-wrapper", // O elemento que se mexe
      ghostClass: "blue-background-class",

      onEnd: async function (event) {
        const itemEl = event.item;

        const newIndex = event.newIndex;

        // O botão de "Adicionar Lista" conta como um elemento no DOM.
        // Se arrastarmos para DEPOIS do botão, precisamos corrigir o índice ou impedir.
        const listId = itemEl.getAttribute("data-list-id");

        API.list.move(listId, boardId, newIndex);
      },
    });
  }
});