/* --- Controle de Formulários de Criação da Lista --- */
function showListForm() {
  document.getElementById("btn-add-list").style.display = "none";
  document.getElementById("form-add-list").style.display = "block";
  document.querySelector("#form-add-list input").focus();
}

function hideListForm() {
  document.getElementById("btn-add-list").style.display = "flex";
  document.getElementById("form-add-list").style.display = "none";
}

// Controle da UI de Criar Cartão
function showCardForm(listId) {
  const form = document.getElementById(`form-card-${listId}`);
  const btn = form.previousElementSibling;
  btn.style.display = "none";
  form.style.display = "block";
  form.querySelector("textarea").focus();
}

function hideCardForm(listId) {
  const form = document.getElementById(`form-card-${listId}`);
  const btn = form.previousElementSibling;
  btn.style.display = "flex";
  form.style.display = "none";
}

// Atualizar o fechar modal ao clicar fora
window.onclick = function (event) {
  // const modalCard = document.getElementById("edit-modal");
  // if (event.target == modalCard) {
  //   closeEditModal();
  // }
};

async function handleUpdateMemberRole(boardId, userId, newRole) {
  await API.invite.updateMember(boardId, userId, newRole);
}

// Notificação flutuante (Substitui alert de sucesso/erro)
function showToast(message, type = "success", onClose) {
  const color = type === 'success' ? '#5aac44' : '#eb5a46';
    
    Toastify({
        text: message,
        duration: type === "success" ? 1000 : 5000,
        close: true,
        gravity: "top", // `top` or `bottom`
        position: "right", // `left`, `center` or `right`
        style: {
            background: color,
            borderRadius: "4px",
            boxShadow: "0 3px 6px rgba(0,0,0,0.16)"
        },
        callback: typeof onClose === "function" ? onClose : null,
    }).showToast();
}

// Confirmação (Substitui confirm e prompt)
async function confirmAction(title, text = "Essa ação não pode ser desfeita.") {
  const result = await Swal.fire({
      title: title,
      text: text,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#eb5a46', // Vermelho perigo
      cancelButtonColor: '#6e7781',
      confirmButtonText: 'Sim, confirmar!',
      cancelButtonText: 'Cancelar'
  });
  return result.isConfirmed;
}

// Alert com Sweet Alert
async function showSweet(title, text, icon) {
  Swal.fire({
    title,
    text,
    icon
  });
}

// --- FUNÇÕES DO WebSocket --- 
function handleRemoteCardMove(data) {
  console.log("Movendo card remotamente...", data);
  
  // Não gera a mudança para mim mesmo
  if (isMe(data.senderId)) {
    console.log("🚫 Parei aqui: Fui eu quem moveu.");
    console.groupEnd();
    return;
  }

  // Card movido
  const cardElement = document.querySelector(`[data-card-id="${data.cardId}"]`);

  // Acha a lista nova onde o card ficara
  const newListContainer = document.querySelector(`[data-list-id="${data.newListId}"] .js-list-cards`);

  if (cardElement && newListContainer) {
    
    const cardsInContainer = newListContainer.children; // Pega os cards
    const desiredIndex = data.newIndex;

    // Move o elemento
    newListContainer.appendChild(cardElement);

    // Verifica se o index é valido ou nao para usar o insertBefore
    if (desiredIndex >= cardsInContainer.length) {
      // Se o index for maior que a quantidade atual (ou lista vazia), vai pro final
      newListContainer.appendChild(cardElement)
    } else {

      const referenceCard = cardsInContainer[desiredIndex];
      newListContainer.insertBefore(cardElement, referenceCard);
    }

    // Feedback Visual
    const originalBg = cardElement.style.background;
    cardElement.style.background = "#fff9c4"; // Amarelo claro
    cardElement.style.transition = "background 0.5s";
    
    setTimeout(() => {
        cardElement.style.background = originalBg || ""; 
    }, 1000);
  }
}

function isMe(senderId) {
  const myId = document.querySelector(".board-canvas").getAttribute('data-user-id');
  return (myId && senderId === myId);
}

// Ativa edição do titulo da lista
function enableListTitleEditing(listId) {
  const titleDisplay = document.getElementById(`list-title-display-${listId}`);
  const titleInput = document.getElementById(`list-title-input-${listId}`);

  // Troca a visibilidade
  titleDisplay.style.display = 'none';
  titleInput.style.display = 'block';

  // Foca no input e seleciona todo o texto
  titleInput.focus();
  titleInput.select();
}

// Salva a edição do titulo da lista
async function saveListTitle(listId) {
  const boardId = document.querySelector("main[data-board-id]").getAttribute("data-board-id");
  
  const titleDisplay = document.getElementById(`list-title-display-${listId}`);
  const titleInput = document.getElementById(`list-title-input-${listId}`);
  const newTitle = titleInput.value.trim();

  // Se o título estiver vazio ou igual ao anterior, só cancela e volta
  if (!newTitle || newTitle === titleDisplay.innerText) {
      titleInput.style.display = 'none';
      titleDisplay.style.display = 'block';
      titleInput.value = titleDisplay.innerText; // Reseta o valor
      return;
  }

  await API.list.update(boardId, listId, titleDisplay, titleInput, newTitle);
}

function handleListTitleKey(event, listId) {
    if (event.key === 'Enter') {
        // O blur já chama o saveListTitle, então só tiramos o foco
        event.target.blur(); 
    }
}

// Menu da lista
function toggleListMenu(event, listId) {
    event.stopPropagation(); // Impede que o clique feche o menu imediatamente
    
    const menu = document.getElementById(`menu-list-${listId}`);
    const button = event.currentTarget;
    
    // Fecha todos os outros menus abertos antes de abrir este
    document.querySelectorAll('.list-dropdown-menu').forEach(m => {
        if (m.id !== `menu-list-${listId}`) m.style.display = 'none';
    });

    // Pega a posição do botão em tela
    const rect = button.getBoundingClientRect();
    
    menu.style.top = `${rect.bottom + 5}px`;
    menu.style.left = `${rect.left}px`;

    // Se o menu for vazar para a direita da tela, alinha ele pela direita do botão
    if (rect.left + 260 > window.innerWidth) {
      menu.style.left = 'auto';
      menu.style.right = `${window.innerWidth - rect.right}px`;
    }

    // Toggle
    if (menu.style.display === 'block') {
        menu.style.display = 'none';
    } else {
        menu.style.display = 'block';
    }
}

document.addEventListener('click', (e) => {
    // Se o clique NÃO foi dentro de um menu dropdown, fecha tudo
    if (!e.target.closest('.list-dropdown-menu')) {
        document.querySelectorAll('.list-dropdown-menu').forEach(menu => {
            menu.style.display = 'none';
        });
    }
});

// Fecha o menu caso o usuario use o Scroll na tela. Como o position é fixed, se rolar a tela o menu ficaria voando solto.
window.addEventListener('scroll', () => {
    document.querySelectorAll('.list-dropdown-menu').forEach(m => m.style.display = 'none');
}, true);

async function deleteList(listId) {
  const boardId = document.querySelector("main[data-board-id]").getAttribute("data-board-id");

  const result = await confirmAction("Tem certeza que deseja excluir esta lista e todos os cartões nela?");
  if (result) {
    await API.list.delete(boardId, listId);
  };
}

function removeListFromDOM(listId) {
  const listElement = document.querySelector(`[data-list-id="${listId}"]`);
  
  // Se o atributo estiver no pai (wrapper), delete o pai. 
  // Se estiver na própria lista, delete ela ou o pai dela.
  if (listElement) {
      // Se o listElement for a .list interna, removemos o pai (.list-wrapper)
      if (listElement.closest('.list-wrapper')) {
          listElement.closest('.list-wrapper').remove();
      } else {
          listElement.remove();
      }
  }
}

async function handleCreateList(event) {
  event.preventDefault(); // Impede o reload
  
  const boardId = document.querySelector(".board-canvas").getAttribute("data-board-id"); // Ajuste o seletor se precisar
  const titleInput = document.querySelector("#title");
  const title = titleInput.value;

  if (!title.trim()) return;

  // Chama a API e espera a resposta
  const data = await API.list.create(boardId, title);

  if (data && data.success) {
      // CRIA A LISTA NA TELA IMEDIATAMENTE
      appendListToDom(data.newList); 
      console.log("Lista criada e renderizada!");
  }
}

function appendListToDom(listData) {
    const listsContainer = document.querySelector(".js-lists-container");

    // Botão de adicionar nova lista (para inserir antes dele)
    const addListBtn = document.querySelector(".mod-add") || document.querySelector(".add-list-wrapper"); 

    // Pega o ID do board para o action do formulário de card
    const boardId = document.querySelector(".board-canvas").getAttribute("data-board-id") || document.body.getAttribute("data-board-id");

    if (!listsContainer) return;

    // Salva a posição da lista
    const listWrapper = document.createElement("div");
    listWrapper.className = "list-wrapper";
    listWrapper.setAttribute("data-list-id", listData._id);
    listWrapper.setAttribute("data-position", listData.position); // ORDENAÇÃO

    listWrapper.innerHTML = `
      <div class="list" data-list-id="${listData._id}">
        
        <div class="list-header">
          <div class="title">
            <h2 id="list-title-display-${listData._id}" 
                onclick="enableListTitleEditing('${listData._id}')"
                style="cursor: pointer;">
                ${listData.title}
            </h2>

            <input 
              type="text" 
              id="list-title-input-${listData._id}" 
              value="${listData.title}" 
              style="display: none;"
              onblur="saveListTitle('${listData._id}')"
              onkeydown="handleListTitleKey(event, '${listData._id}')"
            >
          </div>

          <button class="btn-icon list-menu-btn" onclick="toggleListMenu(event, '${listData._id}')">
              <i class="ri-more-fill"></i>
          </button>

          <div id="menu-list-${listData._id}" class="list-dropdown-menu" style="display: none;">
              <div class="dropdown-header">
                  <span>Ações da Lista</span>
                  <i class="ri-close-line" onclick="toggleListMenu(event, '${listData._id}')" style="cursor: pointer;"></i>
              </div>
              <ul class="dropdown-actions">
                  <li class="action-archive" onclick="arquivarLista('${listData._id}')">
                      Arquivar esta lista
                  </li>
              </ul>
          </div>
        </div>

        <div class="list-cards js-list-cards">
            </div>

        <div class="list-footer">
            <button
              class="btn-show-card-form"
              onclick="showCardForm('${listData._id}')"
            >
              <img src="../assets/icons/plus.svg" alt="">
              Adicionar cartão
            </button>

            <form
              id="form-card-${listData._id}"
              action="/board/${boardId}/card" 
              method="POST"
              class="add-card-form"
              style="display: none"
              onsubmit="handleCreateCard(event, '${listData._id}')" 
            >
              <input type="hidden" name="listId" value="${listData._id}" />
              <textarea
                name="title"
                placeholder="Insira um título..."
                rows="2"
                required
              ></textarea>
              <div class="form-actions">
                <button type="submit">Adicionar</button>
                <i
                  class="ri-close-line"
                  onclick="hideCardForm('${listData._id}')"
                ></i>
              </div>
            </form>
        </div>
      </div>
    `;

    // Coloca a lista na lista(DOM)
    const listView = listsContainer.querySelectorAll('.list-wrapper');
    let insert = false;

    // Procura alguma lista que tenha uma posição MAIOR que a lista que estamos inserindo
    for (let i = 0; i < listView.length; i++) {
        const elementoAtual = listView[i];
        const posicaoAtual = parseFloat(elementoAtual.getAttribute('data-position')) || 0;

        if (posicaoAtual > listData.position) {
            listsContainer.insertBefore(listWrapper, elementoAtual); // Insere ANTES dela
            insert = true;
            break;
        }
    }

    // Se não insert (porque é a maior posição ou não tem outras listas), insere no final
    if (!insert) {
        if (addListBtn) {
            listsContainer.insertBefore(listWrapper, addListBtn);
        } else {
            listsContainer.appendChild(listWrapper);
        }
    }

    // ATIVAR O DRAG & DROP (SortableJS)
    const newCardsContainer = listWrapper.querySelector(".js-list-cards");
    
    if (typeof Sortable !== 'undefined' && newCardsContainer) {
        new Sortable(newCardsContainer, {
            group: 'shared',
            animation: 150,
            ghostClass: 'blue-background-class',
            onEnd: function (event) {
                const itemEl = event.item;
                const newIndex = event.newIndex;
                const toList = event.to;
                
                const cardId = itemEl.getAttribute("data-card-id");
                const newListId = toList.closest(".list").getAttribute("data-list-id");
                
                API.card.move(boardId, cardId, newListId, newIndex);
            }
        });
    }

    // Animação de Entrada
    listWrapper.animate([
        { opacity: 0, transform: 'translateY(20px)' },
        { opacity: 1, transform: 'translateY(0)' }
    ], {
        duration: 300,
        easing: 'ease-out'
    });
}

function appendCardToDom(card) {
    const idDaLista = typeof card.listId === 'object' ? card.listId._id : card.listId;
    const listContainer = document.querySelector(`[data-list-id="${idDaLista}"] .list-cards`);
    if (!listContainer) return;

    const myRole = document.body.getAttribute('data-my-role') || 'member';
    
    // Tratamento de string pro JSON.stringify não quebrar o HTML
    const cardJson = JSON.stringify(card).replace(/'/g, "&apos;").replace(/"/g, "&quot;");

    let html = `<div class="card" data-card-id="${card._id}" data-position="${card.position || 0}" data-card-json="${cardJson}" onclick="openEditModal(this, '${myRole}')">`;

    if (card.coverImage) {
        html += `<div class="card-cover" style="background-image: url('${card.coverImage}');"></div>`;
    }

    html += `<div class="card-content"><div class="card-labels">`;
    if (card.labels && card.labels.length > 0) {
        card.labels.forEach(color => { html += `<span class="label" style="background-color: ${color};"></span>`; });
    }
    
    html += `</div><h3>${card.title}</h3><div class="details-wrapper"><div class="badges">`;

    if (card.description && card.description.trim().length > 0) {
        html += `<span title="Este cartão tem uma descrição"><i class="ri-align-left"></i></span>`;
    }

    if (card.checklist && card.checklist.length > 0) {
        const doneCount = card.checklist.filter(item => item.done).length;
        const totalCount = card.checklist.length;
        const style = doneCount === totalCount ? 'style="background: #61bd4f; color: white; padding: 2px 4px; border-radius: 3px;"' : '';
        html += `<div class="deadline" ${style}><i class="ri-checkbox-line"></i> ${doneCount}/${totalCount}</div>`;
    }

    if (card.dueDate) {
        const now = new Date();
        const due = new Date(card.dueDate);
        const isLate = due < now && (due.toDateString() !== now.toDateString());
        const dateStr = due.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' }).replace('.', '');
        html += `<span class="badge-date ${isLate ? 'badge-late' : ''}" title="Data de entrega"><i class="ri-time-line"></i> ${dateStr}</span>`;
    }

    if (card.attachments && card.attachments.length > 0) {
        html += `<span><i class="ri-attachment-2"></i> ${card.attachments.length}</span>`;
    }

    html += `</div><div class="card-members">`;
    
    if (card.assignees && card.assignees.length > 0) {
        card.assignees.forEach(user => {
            const names = user.name.trim().split(" ");
            let initials = names[0].charAt(0).toUpperCase();
            if (names.length > 1) initials += names[names.length - 1].charAt(0).toUpperCase();
            html += `<div class="card-member-ball" title="${user.name || 'Usuário'}">${initials}</div>`;
        });
    }

    html += `</div></div></div></div>`;

    // Converte a string em elementos HTML e joga na tela
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    const newElementCard = tempDiv.firstChild;

    // Ordenação
    const cardView = listContainer.querySelectorAll('.card');
    let insert = false;

    // Compara a posição do novo cartão com os que já estão na tela
    for (let i = 0; i < cardView.length; i++) {
        const currentCard = cardView[i];
        const posicaoAtual = parseFloat(currentCard.getAttribute('data-position')) || 0;

        if (posicaoAtual > (card.position || 0)) {
            listContainer.insertBefore(newElementCard, currentCard);
            insert = true;
            break;
        }
    }

    // Se não tinha ninguém maior (ou a lista estava vazia), joga pro final
    if (!insert) {
        listContainer.appendChild(newElementCard);
    }
}

function updateCounterArchived(increase) {
  const countElement = document.getElementById('archive-count');
  if (countElement) {
    let current = parseInt(countElement.innerText) || 0;
    
    if (increase) {
        current += 1;
    } else {
        current -= 1;
    }
    
    // Proteção para nunca ficar negativo
    if (current < 0) current = 0;
    
    countElement.innerText = current;
  }
}