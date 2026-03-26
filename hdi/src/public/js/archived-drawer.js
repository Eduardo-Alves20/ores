let estadoArquivados = {
    viewAtual: 'cards', // cards || lists
    dados: { cards: [], lists: [] }
};

async function abrirGavetaArquivados() {
    document.getElementById('archived-drawer').classList.add('aberto');
    await carregarItensArquivados();
}

function fecharGavetaArquivados() {
    document.getElementById('archived-drawer').classList.remove('aberto');
}

async function carregarItensArquivados() {
    const boardId = document.querySelector(".board-canvas").getAttribute("data-board-id");
    const container = document.getElementById('archived-items-container');

    container.innerHTML = '<div style="text-align:center; padding: 20px;"><i class="ri-loader-4-line ri-spin"></i> Carregando...</div>';

    try {
        const response = await fetch(`/board/${boardId}/archived`);
        const data = await response.json();

        estadoArquivados.dados = data; // Salva no estado global
        renderizarArquivados(); // Pinta na tela
    } catch (error) {
        container.innerHTML = '<div style="color: #f87168;">Erro ao buscar itens arquivados.</div>';
    }
}

function alternarVisaoArquivados() {
    estadoArquivados.viewAtual = estadoArquivados.viewAtual === 'cards' ? 'lists' : 'cards';

    // Atualiza o texto do botão
    const label = document.getElementById('archived-view-label');
    label.innerText = estadoArquivados.viewAtual === 'cards' ? 'Alternar para Listas' : 'Alternar para Cartões';

    // Limpa a busca e re-renderiza
    document.getElementById('search-archived-input').value = "";
    renderizarArquivados();
}

function filtrarArquivados() {
    renderizarArquivados(); // O renderizador lê o input e filtra sozinho
}

function renderizarArquivados() {
    const container = document.getElementById('archived-items-container');
    const termoBusca = document.getElementById('search-archived-input').value.toLowerCase();

    let html = '';
    const itens = estadoArquivados.viewAtual === 'cards' ? estadoArquivados.dados.cards : estadoArquivados.dados.lists;

    const itensFiltrados = itens.filter(item => item.title.toLowerCase().includes(termoBusca));

    if (itensFiltrados.length === 0) {
        container.innerHTML = '<div style="text-align:center; color:#8c9bab; margin-top:20px;">Nenhum item encontrado.</div>';
        return;
    }

    itensFiltrados.forEach(item => {
        const icone = estadoArquivados.viewAtual === 'cards' ? 'ri-article-line' : 'ri-layout-column-line';
        let origem = 'Quadro Atual';
        if (estadoArquivados.viewAtual === 'cards') {
            const tituloLista = item.listId && item.listId.title ? item.listId.title : 'Desconhecida';
            origem = `Lista: ${tituloLista}`;
        }

        html += `
            <div class="archived-item" id="archived-item-${item._id}">
                <h4>${item.title}</h4>
                <div class="archived-item-meta">
                    <i class="${icone}"></i> Arquivado • ${origem}
                </div>
                <div class="archived-actions">
                    <span onclick="restaurarItem('${item._id}', '${estadoArquivados.viewAtual}')">Restaurar</span>
                    <span class="action-danger" onclick="excluirItemArquivado('${item._id}', '${estadoArquivados.viewAtual}')">Excluir</span>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

async function restaurarItem(itemId, tipo) {
    const boardId = document.querySelector(".board-canvas").getAttribute("data-board-id");
    const endpoint = tipo === 'cards' 
        ? `/board/${boardId}/card/${itemId}/archive` 
        : `/board/${boardId}/list/${itemId}/archive`;

    // Remove da gaveta instantaneamente
    const itemNaGaveta = document.getElementById(`archived-item-${itemId}`);
    if (itemNaGaveta) itemNaGaveta.style.display = 'none';

    try {
        await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isArchived: false })
        });
    } catch (error) {
        alert("Erro ao restaurar item.");
        if (itemNaGaveta) itemNaGaveta.style.display = 'block'; // Devolve em caso de erro
    }
}

async function arquivarLista(listId) {
    const boardId = document.querySelector(".board-canvas").getAttribute("data-board-id");
    
    // Remove do HTML do quadro instantaneamente
    const listEl = document.querySelector(`[data-list-id="${listId}"]`);
    if (listEl) {
        const wrapper = listEl.closest('.list-wrapper');
        if (wrapper) wrapper.remove();
    }

    try {
        await fetch(`/board/${boardId}/list/${listId}/archive`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isArchived: true })
        });
    } catch (e) {
        console.error("Erro ao arquivar lista");
    }
}

async function arquivarCartao(cardId) {
    const boardId = document.querySelector(".board-canvas").getAttribute("data-board-id");
    
    // Remove do HTML do quadro instantaneamente
    const cardElement = document.querySelector(`[data-card-id="${cardId}"]`);
    if (cardElement) cardElement.remove();

    closeEditModal()

    try {
        await fetch(`/board/${boardId}/card/${cardId}/archive`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isArchived: true })
        });
    } catch (e) {
        console.error("Erro ao arquivar cartão");
    }
}

async function excluirItemArquivado(itemId, tipo) {
    // Busca o boardId (adaptado para pegar do main ou da canvas que você usa)
    const boardEl = document.querySelector("main[data-board-id]") || document.querySelector(".board-canvas");
    const boardId = boardEl.getAttribute("data-board-id");

    if (tipo === 'lists') {
        const result = await confirmAction("Tem certeza que deseja excluir DE VEZ esta lista e todos os cartões nela? Essa ação não pode ser desfeita.");
        if (result) {
            try {
                // Chama a SUA api de deletar lista
                await API.list.delete(boardId, itemId);
                
                // Remove o item da gaveta visualmente e da memória
                removerVisualmenteDaGaveta(itemId, tipo);

                // Atualiza o contador de arquivados
                updateCounterArchived(false);
            } catch (error) {
                console.error("Erro ao excluir lista", error);
            }
        }
    } 
    else if (tipo === 'cards') {
        const result = await confirmAction("Tem certeza que deseja excluir DE VEZ este cartão? Essa ação não pode ser desfeita.");
        if (result) {
            try {
                // Chama a SUA api de deletar cartão
                // O seu método espera (currentCardId, boardId, cardId), passei o itemId nos dois.
                await API.card.delete(itemId, boardId, itemId);
                
                // Remove o item da gaveta visualmente e da memória
                removerVisualmenteDaGaveta(itemId, tipo);
            } catch (error) {
                console.error("Erro ao excluir cartão", error);
            }
        }
    }
}

function removerVisualmenteDaGaveta(itemId, tipo) {
    // 1. Tira do array de estado para não voltar se mudar de aba
    if (tipo === 'cards') {
        estadoArquivados.dados.cards = estadoArquivados.dados.cards.filter(c => String(c._id) !== String(itemId));
    } else {
        estadoArquivados.dados.lists = estadoArquivados.dados.lists.filter(l => String(l._id) !== String(itemId));
    }

    // 2. Faz o elemento HTML sumir da gaveta
    const elemento = document.getElementById(`archived-item-${itemId}`);
    if (elemento) {
        elemento.remove();
    }
}