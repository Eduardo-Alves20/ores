function openListModal(listId, currentTitle) {
  const modal = document.getElementById("edit-list-modal");
  const titleInput = document.getElementById("edit-list-title-input");
  const editForm = document.getElementById("edit-list-form");
  const deleteForm = document.getElementById("delete-list-form");
  const boardId = document
    .querySelector(".board-canvas")
    .getAttribute("data-board-id");

  // Preenche o input
  titleInput.value = currentTitle;

  // Configura as rotas dinamicamente
  editForm.action = `/board/${boardId}/list/${listId}/update`;
  deleteForm.action = `/board/${boardId}/list/${listId}/delete`;

  // Abre o modal
  modal.style.display = "flex";
  titleInput.focus(); // Foco automático para digitar rápido
}

function closeListModal() {
  document.getElementById("edit-list-modal").style.display = "none";
}
