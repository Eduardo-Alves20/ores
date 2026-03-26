// Variável global para saber qual card está aberto no modal
let currentCardIdForChecklist = null;
let currentCardId = null;
let currentListId = null;

const boardId = document.querySelector(".board-canvas").getAttribute("data-board-id");

/* --- Controle do Modal Card --- */
function openEditModal(cardElement, myRole) {
  initQuill();

  const cardData = JSON.parse(cardElement.getAttribute('data-card-json'));
  
  const cardId = cardData._id;
  const currentTitle = cardData.title;
  const currentDesc = cardData.description || '';
  const assignees = cardData.assignees || [];
  const coverImage = cardData.coverImage || '';
  const dueDate = cardData.dueDate ? new Date(cardData.dueDate).toISOString() : '';
  const labels = cardData.labels;
  currentCardIdForChecklist = cardId; // Salva o ID globalmente

  currentCardId = cardData._id;
  currentListId = cardData.listId;

  const modal = document.getElementById("edit-modal");
  const titleInput = document.getElementById("edit-title-input");
  const dateInput = document.getElementById("edit-date-input");

  const uploadForm = document.getElementById("upload-cover-form");
  const removeForm = document.getElementById("remove-cover-form");
  const previewArea = document.getElementById("cover-preview-area");
  const previewImg = document.getElementById("cover-preview-img");

  const archiveBtn = document.getElementById('btn-archive-card-modal');
  if (archiveBtn) {
    archiveBtn.addEventListener("click", () => {
      arquivarCartao(cardId)
    });
  }

  // DESCRIÇÃO
  quillEditor.clipboard.dangerouslyPasteHTML(currentDesc || '');

  if (myRole === "observer") {
    quillEditor.disable();
  } else {
    quillEditor.enable();
  }

  // --- LÓGICA DO CHECKLIST ---
  const container = document.getElementById("checklist-items-container");
  container.innerHTML = ""; // Limpa itens antigos
  let checklist = [];
  try {
    checklist = cardData.checklist || [];
  } catch (e) {}

  checklist.forEach((item) => {
    renderChecklistItem(item, myRole);
  });

  let currentLabels = [];
  try {
    currentLabels = labels;
  } catch (e) {
    currentLabels = [];
  }

  // Calcula a barra
  updateProgress();

  // Preenche os dados para envio do form
  titleInput.value = currentTitle;
  // Preencher Data (Converter ISO para YYYY-MM-DD)
  if (dueDate) {
    // Pega só a primeira parte da string ISO (antes do T)
    dateInput.value = dueDate.split("T")[0];
  } else {
    dateInput.value = ""; // Limpa se não tiver data
  }

  // Marca os checkboxes corretos
  const checkboxes = document.querySelectorAll('input[name="labels"]');
  checkboxes.forEach((checkBox) => {
    // Se a cor do checkbox estiver no array do cartão, marca true
    if (currentLabels.includes(checkBox.value)) {
      checkBox.checked = true;
    } else {
      checkBox.checked = false;
    }
  });

  // editForm.action = `/board/${boardId}/card/${cardId}/update`;

  // LÓGICA DA CAPA
  uploadForm.action = `/board/${boardId}/card/${cardId}/cover`; // Configura rota de upload
  removeForm.action = `/board/${boardId}/card/${cardId}/cover/delete`; // Configura rota de delete

  if (coverImage && coverImage !== "null" && coverImage !== "") {
    previewArea.style.display = "block";
    previewImg.src = coverImage;
    uploadForm.style.display = "none"; // Se já tem capa, esconde o upload (opcional)
  } else {
    previewArea.style.display = "none";
    uploadForm.style.display = "block";
    previewImg.src = "";
  }

  // --- Membros do CARD ---
  // Reset Visual
  document
    .querySelectorAll(".assignee-check")
    .forEach((el) => (el.style.display = "none"));
  document
    .querySelectorAll(".assignee-option")
    .forEach((el) => (el.style.opacity = "0.5"));

  // Lê quem tá no card
  let currentAssignees = [];
  try {
    currentAssignees = assignees || [];
  } catch (e) {}

  // Marca quem tá no card
  currentAssignees.forEach((userId) => {
    // userId pode ser string ou objeto populado, garantimos string
    const id = typeof userId === "object" ? userId._id : userId;

    const check = document.querySelector(
      `#assignee-option-${id} .assignee-check`,
    );
    const avatar = document.getElementById(`assignee-option-${id}`);

    if (check && avatar) {
      check.style.display = "flex"; // Mostra o check
      avatar.style.opacity = "1"; // Deixa 100% visível
    }
  });

  // --- RENDERIZAR ANEXOS ---
  const attachmentsList = document.getElementById("attachments-list");
  attachmentsList.innerHTML = ""; // Limpa

  let attachments = [];
  try {
    attachments = cardData.attachments || [];
  } catch (e) {}

  attachments.forEach((file) => renderAttachmentItem(file, myRole));

  modal.style.display = "flex";
  // titleInput.focus();
}


function closeEditModal() {
  document.getElementById("edit-modal").style.display = "none";
  fecharPainelLateral();
}

// Função que adiciona membro no CARD
async function toggleAssignee(userId, myRole) {
  if (!currentCardIdForChecklist || myRole === "observer") return;

  const avatar = document.getElementById(`assignee-option-${userId}`);
  const check = avatar.querySelector(".assignee-check");
  const isSelected = check.style.display === "flex";

  // Inverte visualmente
  check.style.display = isSelected ? "none" : "flex";
  avatar.style.opacity = isSelected ? "0.5" : "1";

  await API.card.assign(currentCardIdForChecklist, userId, isSelected);
}

// Função auxiliar para desenhar UM anexo
function renderAttachmentItem(file, myRole) {
  const list = document.getElementById("attachments-list");

  const div = document.createElement("div");
  div.className = "attachment-item";
  div.id = `att-${file.filename}`;
  div.style.cssText =
    "display: flex; align-items: center; gap: 10px; background: #f4f5f7; padding: 10px; border-radius: 4px;";

  // Ícone baseado na extensão (Simples)
  let icon = "ri-file-text-line";
  if (file.mimetype.includes("image")) icon = "ri-image-line";
  if (file.mimetype.includes("pdf")) icon = "ri-file-pdf-line";

  div.innerHTML = `
        <div style="font-size: 24px; color: #5e6c84;"><i class="${icon}"></i></div>
        
        <div style="flex-grow: 1; overflow: hidden;">
            <a href="${
              file.path
            }" target="_blank" style="font-weight: bold; color: #172b4d; text-decoration: none; display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                ${file.originalName}
            </a>
            ${
              file.uploadedAt
                ? `<span style="font-size: 11px; color: #5e6c84;">Adicionado em ${new Date(
                    file.uploadedAt,
                  ).toLocaleDateString()}</span>`
                : "<span style='font-size: 11px; color: #5e6c84;'>Agora</span>"
            }
        </div>
        ${
          myRole !== "observer"
            ? `<i class="ri-delete-bin-line" 
            style="cursor: pointer; color: #5e6c84;"
            onclick="deleteAttachment('${file.filename}')">
          </i>`
            : ""
        }
        
  `;

  list.appendChild(div);
}

// Lógica de Upload
async function handleAttachmentUpload(input, myRole) {
  if (!input.files || input.files.length === 0) return;

  const file = input.files[0];
  const formData = new FormData();
  formData.append("file", file);

  const data = await API.card.uploadAttachment(
    currentCardIdForChecklist,
    formData,
    myRole,
  );

  if (data.success) {
    renderAttachmentItem(data.attachment, myRole); // Adiciona na lista na hora

    // ATUALIZA O ÍCONE DE CLIPE NO CARD
    const cardElement = document.querySelector(`[data-card-id="${currentCardId}"]`);
    if (cardElement && data.card) {
        updateCardVisuals(cardElement, data.card);
    }
  } else {
    showToast(error, "error");
  }

  input.value = ""; // Limpa o input para poder subir o mesmo arquivo de novo se quiser
}

// Lógica de Delete
async function deleteAttachment(filename) {
  const result = await confirmAction("Excluir anexo", "Deseja mesmo excluir o anexo?");

  if (result) {
    const data = await API.card.deleteAttachment(currentCardIdForChecklist, filename);
    if (data && data.success) {
      // Remove o item da lista DENTRO do Modal
      const div = document.getElementById(`att-${filename}`);
      if (div) {
          // Efeito visual de sumir suavemente
          div.style.opacity = '0';
          setTimeout(() => div.remove(), 300);
      }

      // ATUALIZA O CARD NA LISTA PRINCIPAL (O Ícone de Clipe)
      const cardElement = document.querySelector(`[data-card-id="${currentCardId}"]`);
      
      // O Backend retornou o card atualizado (sem o anexo no array)
      if (cardElement && data.card) {
        updateCardVisuals(cardElement, data.card);
      }
        console.log("Anexo removido e visual atualizado!");
      } else {
        alert("Erro ao excluir anexo.");
      }
    }
}

// --- FUNÇÕES DA CHECKLIST
function renderChecklistItem(item, myRole) {
  const container = document.getElementById("checklist-items-container");

  const div = document.createElement("div");
  div.className = "checklist-item";
  div.style.display = "flex";
  div.style.alignItems = "center";
  div.style.gap = "10px";
  div.id = `check-item-${item._id}`;

  div.innerHTML = `
        <input type="checkbox" 
               ${item.done ? "checked" : ""} 
               ${myRole !== "observer" ? "" : "disabled"}
               onchange="toggleItem('${item._id}', this.checked)"
               style="width: 16px; height: 16px; cursor: pointer;">
        
        <span style="${
          item.done ? "text-decoration: line-through; color: #5e6c84;" : ""
        }; flex-grow: 1;">
            ${item.text}
        </span>

        ${
          myRole !== "observer"
            ? `
            <i class="ri-delete-bin-line" 
              style="cursor: pointer; color: #5e6c84; opacity: 0.5;"
              onmouseover="this.style.opacity=1" 
              onmouseout="this.style.opacity=0.5"
              onclick="deleteItem('${item._id}')">
            </i>
        `
            : ""
        }
        
    `;

  container.appendChild(div);
}

async function addCheckitem() {
  const input = document.getElementById("new-checklist-item");
  const text = input.value;
  if (!text) return;

  const data = await API.card.addChecklistItem(currentCardIdForChecklist, text);

  // Pega o último item adicionado (que tem o _id novo)
  const newItem = data.checklist[data.checklist.length - 1];
  renderChecklistItem(newItem);
  input.value = "";
  input.focus();
  updateProgress();
}

async function toggleItem(itemId, isChecked) {
  // Atualiza visual riscado
  const div = document.getElementById(`check-item-${itemId}`);
  const span = div.querySelector("span");
  span.style.textDecoration = isChecked ? "line-through" : "none";
  span.style.color = isChecked ? "#5e6c84" : "inherit";

  updateProgress();

  // Envia pro backend
  await API.card.toggleItem(currentCardIdForChecklist, itemId, isChecked);
}

async function deleteItem(itemId) {
  const div = document.getElementById(`check-item-${itemId}`);
  div.remove();
  updateProgress();

  await API.card.deleteItem(currentCardIdForChecklist, itemId);
}

function updateProgress() {
  const container = document.getElementById("checklist-items-container");
  const checkboxes = container.querySelectorAll('input[type="checkbox"]');
  const total = checkboxes.length;

  if (total === 0) {
    document.getElementById("checklist-progress-bar").style.width = "0%";
    document.getElementById("checklist-progress-text").innerText = "0%";
    return;
  }

  const checked = container.querySelectorAll(
    'input[type="checkbox"]:checked',
  ).length;
  const percent = Math.round((checked / total) * 100);

  document.getElementById("checklist-progress-bar").style.width = `${percent}%`;
  document.getElementById("checklist-progress-text").innerText = `${percent}%`;

  // Muda cor da barra para verde se 100%
  const bar = document.getElementById("checklist-progress-bar");
  if (percent === 100) bar.style.backgroundColor = "#61bd4f";
  else bar.style.backgroundColor = "#5aac44";
}

async function handleEditFormSubmit(event) {
  event.preventDefault(); 

  const descriptionHTML = quillEditor.root.innerHTML;

  const finalDescription = descriptionHTML === '<p><br></p>' ? '' : descriptionHTML;

  // Coleta Labels marcadas
  const selectedLabels = [];
  document.querySelectorAll('input[name="labels"]:checked').forEach(cb => {
      selectedLabels.push(cb.value);
  });

  // Monta o objeto de dados
  const payload = {
      title: document.getElementById("edit-title-input").value,
      description: finalDescription,
      dueDate: document.getElementById("edit-date-input").value,
      labels: selectedLabels,
  };

  await API.card.update(boardId, currentCardId, payload);
  
} 

async function handleCoverUpload(event) {
  event.preventDefault(); 
  console.log("Sobe capa do card");
  const form = event.target;
  const formData = new FormData(form);

  await API.card.uploadCover(boardId, currentCardId, formData);
}

async function handleCoverRemove(event) {
  event.preventDefault(); 
  const result = await confirmAction("Remover capa", "Tem certeza que deseja remover esta capa do cartão?");
  if (result) {
    console.log("Deleção de capa");
    await API.card.deleteCover(boardId, currentCardId);
  }
} 

let quillEditor;

function initQuill() {
  if (quillEditor) return;

  quillEditor = new Quill('#editor-container', {
    theme: 'snow',
    modules: {
      // Barra de ferramentas
      toolbar: [
        ['bold', 'italic', 'underline', 'strike'],
        ['blockquote', 'code-block'],
        [{ 'list': 'ordered'}, { 'list': 'bullet' }],
        ['link'],
        ['clean'] // botão de remover formatação
      ],
      // Configuração do @ e #
      mention: {
        allowedChars: /^[A-Za-z\sÅÄÖåäö]*$/,
        mentionDenotationChars: ["@", "#"],

        renderItem: function(item, searchTerm) {
          // Se for um Card (usamos a flag que mandamos do backend)
          if (item.type === 'card') {
              return `
                  <div style="line-height: 1.4;">
                      <span style="font-weight: bold; color: #172b4d;">${item.value}</span><br>
                      <span style="font-size: 11px; color: #5e6c84;">
                          <i class="ri-layout-masonry-line"></i> Quadro: ${item.boardName}
                      </span>
                  </div>
              `;
          }
          // Se for um Usuário (@)
          return `
              <div style="display: flex; align-items: center; gap: 8px;">
                  <div style="background: #dfe1e6; border-radius: 50%; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; font-size: 10px;">
                      ${item.value.charAt(0).toUpperCase()}
                  </div>
                  <span style="font-weight: bold; color: #172b4d;">${item.value}</span>
              </div>
          `;
        },
        
        // Essa função é chamada toda vez que o usuário digita @ ou #
        source: async function (searchTerm, renderList, mentionChar) {
          try {
            let matches = [];

            if (mentionChar === "@") {
                const data = await API.board.findMembersForMention(boardId, searchTerm);
                matches = data;
            } else if (mentionChar === "#") {
                const data = await API.board.findCardsForMention(boardId, searchTerm);
                matches = data;
            }

            renderList(matches, searchTerm);
          } catch (error) {
            console.error("Erro ao buscar menções", error);
            renderList([], searchTerm);
          }
        }
      }
    }
  });
}

// Detalhes da menção
document.addEventListener('DOMContentLoaded', () => {
 
  const editorContainer = document.querySelector('.ql-editor') || document.getElementById('editor-container');
  const sidePanel = document.getElementById('mention-side-panel');

  if (!editorContainer || !sidePanel) return;

  // Busca o tooltip no DOM. Se não existir, cria e anexa corretamente.
  let tooltip = document.getElementById('mention-tooltip');
  if (!tooltip) {
    tooltip = document.createElement('div');
    tooltip.id = 'mention-tooltip';
    tooltip.style.position = 'absolute';
    tooltip.style.zIndex = '100000';
    tooltip.style.pointerEvents = 'none'; // Evita que o tooltip "roube" o hover do mouse
    document.body.appendChild(tooltip);
  }

  // Click do cartão
  editorContainer.addEventListener("click", async (e) => {
    const mentionNode = e.target.closest('.mention');

    if (mentionNode && mentionNode.getAttribute('data-denotation-char') === '#') {
      e.preventDefault();
      
      const cardId = mentionNode.getAttribute('data-id');
      
      // Pega o ID do card que está atualmente aberto (se houver)
      const cardAtualNaGaveta = sidePanel.getAttribute('data-card-aberto');

      // Se a gaveta já está aberta E o usuário clicou no MESMO card de novo FECHA
      if (sidePanel.classList.contains('aberto') && cardAtualNaGaveta === cardId) {
          sidePanel.classList.remove('aberto');
          sidePanel.removeAttribute('data-card-aberto'); // Limpa a memória
          return;
      }

      // Se estava fechada, ou se clicou em um card DIFERENTE ABRE / ATUALIZA
      sidePanel.classList.add('aberto');
      sidePanel.setAttribute('data-card-aberto', cardId);

      document.getElementById('side-panel-title').innerText = "Carregando...";
      document.getElementById('side-panel-board').innerText = "Aguarde...";
      document.getElementById('side-panel-desc').innerHTML = '<i class="ri-loader-4-line ri-spin"></i> Buscando...';
      
      const btnLink = document.getElementById('side-panel-link-btn');
      btnLink.disabled = true;

      try {
        const response = await fetch(`/card/${cardId}/summary`);
        const data = await response.json();
        
        document.getElementById('side-panel-title').innerText = data.title;
        document.getElementById('side-panel-board').innerText = `Quadro: ${data.boardTitle || 'Desconhecido'}`;
        
        document.getElementById('side-panel-desc').innerText = typeof stripHTML === 'function' ? stripHTML(data.description) : data.description;

        btnLink.disabled = false;
        btnLink.onclick = () => {
            window.open(`/board/${data.boardId}?openCard=${cardId}`, '_blank');
        };
      } catch (err) {
        console.error(err);
        document.getElementById('side-panel-desc').innerText = "Erro ao carregar detalhes do cartão.";
      }
    }
  });

  // Hover do usuario
  editorContainer.addEventListener('mouseover', (e) => {
    const mentionNode = e.target.closest('.mention');
    
    if (mentionNode && mentionNode.getAttribute('data-denotation-char') === '@') {
      // Posiciona o tooltip
      tooltip.style.left = (e.pageX + 15) + 'px';
      tooltip.style.top = (e.pageY + 15) + 'px';
      tooltip.style.display = 'block';
      tooltip.style.opacity = '1';

      const userName = mentionNode.innerText.replace('@', '').trim();
      const initial = userName.charAt(0).toUpperCase();

      tooltip.innerHTML = `
        <div style="padding: 4px 8px; display: flex; align-items: center; gap: 12px; background: white; border: 1px solid #dfe1e6; border-radius: 6px; box-shadow: 0 4px 8px rgba(0,0,0,0.1);">
          <div style="background: linear-gradient(135deg, #0079bf, #5aac44); color: white; border-radius: 50%; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: bold;">
              ${initial}
          </div>
          <div>
            <h4 style="margin: 0 0 2px 0; color: #172b4d; font-size: 14px;">${userName}</h4>
            <span style="font-size: 11px; color: #5e6c84;">Membro do Espaço de Trabalho</span>
          </div>
        </div>
      `;
    }
  });

  // MOUSEOUT -> ESCONDER TOOLTIP
  editorContainer.addEventListener('mouseout', (e) => {
    const mentionNode = e.target.closest('.mention');
    if (mentionNode && mentionNode.getAttribute('data-denotation-char') === '@') {
      tooltip.style.display = 'none';
      tooltip.style.opacity = '0';
    }
  });

});

// Abre o modal do card quando há redirecionamento
document.addEventListener("DOMContentLoaded", () => {
    
    const urlParams = new URLSearchParams(window.location.search);
    const cardToOpen = urlParams.get('openCard');

    if (cardToOpen) {
        // Limpa a URL para que, se o usuário der F5, o modal não reabra sozinho
        window.history.replaceState({}, document.title, window.location.pathname);

        setTimeout(() => {
            const cardElement = document.querySelector(`[data-card-id="${cardToOpen}"]`);
            
            if (cardElement) {
                // Substitua pelo método que você usa para pegar a role do usuário no JS
                const myRole = document.body.getAttribute('data-my-role') || 'member'; 
                
                // Simula o clique chamando sua função de abrir modal
                openEditModal(cardElement, myRole);
            } else {
                console.log("Card referenciado não está nesta tela.");
            }
        }, 500);
    }
});

// Função para Fechar
window.fecharPainelLateral = function() {
    const sidePanel = document.getElementById('mention-side-panel');
    if (sidePanel) {
        sidePanel.classList.remove('aberto');
    }
}

function stripHTML(htmlString) {
    if (!htmlString) return "Este cartão não possui descrição.";
    
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = htmlString;
    
    // Retorna apenas o texto, ignorando todas as tags HTML
    return tempDiv.textContent || tempDiv.innerText || "";
}