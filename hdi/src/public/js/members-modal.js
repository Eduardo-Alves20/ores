function openModal() {
    document.getElementById('members-modal').style.display='flex';
}

function closeModal() {
    document.getElementById('members-modal').style.display = 'none';
}

async function handleRemoveMember(boardId, userId) {
  const result = await confirmAction("Remover membro", "Tem certeza que deseja remover este usuário do quadro?")
  if (result) {
    await API.invite.removeMember(boardId, userId);
  }
}