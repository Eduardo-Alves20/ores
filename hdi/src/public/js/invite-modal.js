// --- Controle do Modal de Convite
function openInviteModal() {
  const modal = document.getElementById("invite-modal");

  // Limpar campos
  document.getElementById("invite-search-input").value = "";
  document.getElementById("invite-email-hidden").value = "";
  document.getElementById("invite-results-list").style.display = "none";

  // Dar foco no input para digitar logo
  setTimeout(() => {
    document.getElementById("invite-search-input").focus();
  }, 100);

  modal.style.display = "flex";
}

function closeInviteModal() {
  document.getElementById("invite-modal").style.display = "none";
}

// lista de convite
let searchTimeout = null;
function handleUserSearch(query) {
  const list = document.getElementById("invite-results-list");

  // Limpa o timer anterior
  clearTimeout(searchTimeout);

  // Se estiver vazio, esconde a lista
  if (!query || query.trim().length < 2) {
    list.style.display = "none";
    list.innerHTML = "";
    return;
  }

  // Define um novo timer de 300ms
  searchTimeout = setTimeout(async () => {
    const users = await API.invite.search(query);
    renderSearchResults(users);
  }, 300);
}

// Função para desenhar a lista
function renderSearchResults(users) {
  const list = document.getElementById("invite-results-list");
  list.innerHTML = ""; // Limpa resultados antigos

  if (users.length === 0) {
    list.innerHTML =
      '<div class="autocomplete-item"><span>Nenhum usuário encontrado no seu grupo.</span></div>';
    list.style.display = "block";
    return;
  }

  users.forEach((user) => {
    const div = document.createElement("div");
    div.className = "autocomplete-item";

    // O que aparece na lista
    div.innerHTML = `
            <strong>${user.name}</strong>
            <span>${user.email} (${user.username})</span>
        `;

    // Ao clicar em um item
    div.onclick = () => {
      selectUser(user);
    };

    list.appendChild(div);
  });

  list.style.display = "block";
}

// Função ao selecionar alguém
function selectUser(user) {
  const inputDisplay = document.getElementById("invite-search-input");
  const inputHidden = document.getElementById("invite-email-hidden");
  const list = document.getElementById("invite-results-list");

  // Preenche os inputs
  inputDisplay.value = user.name; // Mostra o nome bonito pro usuário
  inputHidden.value = user.email; // Salva o email pro backend usar

  // Esconde a lista
  list.style.display = "none";
}

// Fechar a lista se clicar fora
document.addEventListener("click", function (e) {
  const container = document.querySelector(".autocomplete-container");
  const list = document.getElementById("invite-results-list");

  if (container && !container.contains(e.target)) {
    list.style.display = "none";
  }
});
