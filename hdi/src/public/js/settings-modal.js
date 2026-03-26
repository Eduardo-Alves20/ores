function openSettingsModal() {
    document.getElementById('settings-modal').style.display = 'flex';
}

function closeSettingsModal() {
    document.getElementById('settings-modal').style.display='none'
}

async function handleBoardUpdate(event) {
    event.preventDefault();

    const title = document.getElementById('settings-title-input').value;
    const color = document.getElementById('settings-color-input').value;
    
    const boardId = document
    .querySelector(".board-canvas")
    .getAttribute("data-board-id");
    
    await API.board.update(title, color, boardId)
}

async function deleteBoard(boardId) {
    const result = await confirmAction('Excluir Quadro?', 'Todos os cards e listas serão perdidos para sempre.');
    if (result) {
        await API.board.delete(boardId);
    }
}