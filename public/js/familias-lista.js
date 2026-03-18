(function () {
  const shared = window.FamiliasShared;
  if (!shared) return;

  const {
    confirmAction,
    escapeHtml,
    formatDate,
    parseJsonScript,
    requestJson,
    showSuccess,
    showToast,
  } = shared;

  function init(root) {
    const form = document.getElementById("familias-filtro-form");
    const clearBtn = document.getElementById("familias-limpar-filtros");
    const tbody = document.getElementById("familias-table-body");
    const paginacao = document.getElementById("familias-paginacao");
    const count = document.getElementById("familias-count");
    const totalChip = document.getElementById("familias-total-chip");
    const activeChip = document.getElementById("familias-active-chip");
    const pacientesChip = document.getElementById("familias-pacientes-chip");

    const initial = parseJsonScript("familias-initial", {});
    const viewFlags = parseJsonScript("familias-view-flags", {
      canCreateFamily: false,
      canEditFamily: false,
      canToggleFamilyStatus: false,
    });
    const state = {
      busca: String(initial.busca || ""),
      ativo: String(initial.ativo || ""),
      parentesco: String(initial.parentesco || ""),
      cidade: String(initial.cidade || ""),
      page: Number(initial.page || 1),
      limit: Number(initial.limit || 10),
    };

    function syncForm() {
      form.elements.busca.value = state.busca;
      form.elements.ativo.value = state.ativo;
      form.elements.parentesco.value = state.parentesco;
      form.elements.cidade.value = state.cidade;
      form.elements.limit.value = String(state.limit);
    }

    function readForm() {
      state.busca = String(form.elements.busca.value || "").trim();
      state.ativo = String(form.elements.ativo.value || "");
      state.parentesco = String(form.elements.parentesco.value || "").trim();
      state.cidade = String(form.elements.cidade.value || "").trim();
      state.limit = Math.max(Number(form.elements.limit.value || 10), 1);
    }

    function updateUrl() {
      const params = new URLSearchParams();
      if (state.busca) params.set("busca", state.busca);
      if (state.ativo) params.set("ativo", state.ativo);
      if (state.parentesco) params.set("parentesco", state.parentesco);
      if (state.cidade) params.set("cidade", state.cidade);
      params.set("page", String(state.page));
      params.set("limit", String(state.limit));
      const url = `/familias?${params.toString()}`;
      window.history.replaceState({}, "", url);
    }

    function renderRows(items) {
      if (!items.length) {
        tbody.innerHTML = '<tr><td colspan="8">Nenhuma familia encontrada com os filtros atuais.</td></tr>';
        return;
      }

      tbody.innerHTML = items
        .map((doc) => {
          const cidade = [doc?.endereco?.cidade, doc?.endereco?.estado].filter(Boolean).join("/");
          const statusClass = doc?.ativo ? "status-active" : "status-inactive";
          const statusLabel = doc?.ativo ? "Ativa" : "Inativa";
          const toggleLabel = doc?.ativo ? "Inativar" : "Reativar";
          const detalhesHref = `/familias/${doc._id}`;
          const editarHref = `/familias/${doc._id}/editar`;
          const rowLabel = doc?.responsavel?.nome || "familia";
          const actions = [
            `
              <a class="table-action-btn table-action-btn-neutral" href="${detalhesHref}">
                <i class="fa-solid fa-eye" aria-hidden="true"></i>
                <span>Ficha</span>
              </a>
            `,
          ];

          if (viewFlags.canEditFamily) {
            actions.push(`
              <a class="table-action-btn table-action-btn-edit" href="${editarHref}">
                <i class="fa-solid fa-pen-to-square" aria-hidden="true"></i>
                <span>Editar</span>
              </a>
            `);
          }

          if (viewFlags.canToggleFamilyStatus) {
            actions.push(`
              <button class="table-action-btn ${doc?.ativo ? "table-action-btn-danger" : "table-action-btn-success"}" type="button" data-action="toggle" data-id="${doc._id}" data-next="${String(!doc?.ativo)}">
                <i class="fa-solid ${doc?.ativo ? "fa-user-slash" : "fa-power-off"}" aria-hidden="true"></i>
                <span>${toggleLabel}</span>
              </button>
            `);
          }

          return `
            <tr class="family-row-clickable" data-href="${detalhesHref}" role="link" tabindex="0" aria-label="Abrir ficha de ${escapeHtml(rowLabel)}">
              <td data-label="Responsavel">${escapeHtml(doc?.responsavel?.nome || "-")}</td>
              <td data-label="Contato">
                <div>${escapeHtml(doc?.responsavel?.telefone || "-")}</div>
                <small>${escapeHtml(doc?.responsavel?.email || "")}</small>
              </td>
              <td data-label="Parentesco">${escapeHtml(doc?.responsavel?.parentesco || "-")}</td>
              <td data-label="Cidade/UF">${escapeHtml(cidade || "-")}</td>
              <td data-label="Pacientes">${Number(doc?.pacientesAtivos || 0)}</td>
              <td data-label="Status"><span class="status-badge ${statusClass}">${statusLabel}</span></td>
              <td data-label="Atualizacao">${formatDate(doc?.updatedAt)}</td>
              <td data-label="Acoes">
                <div class="table-actions" data-no-row-nav>
                  ${actions.join("")}
                </div>
              </td>
            </tr>
          `;
        })
        .join("");
    }

    function renderPaginacao(meta) {
      const { page, totalPages } = meta;
      if (!totalPages || totalPages <= 1) {
        paginacao.innerHTML = "";
        return;
      }

      const pages = [];
      const start = Math.max(page - 2, 1);
      const end = Math.min(page + 2, totalPages);

      for (let i = start; i <= end; i += 1) {
        pages.push(`
          <button type="button" class="page-btn ${i === page ? "is-active" : ""}" data-page="${i}">${i}</button>
        `);
      }

      paginacao.innerHTML = `
        <button type="button" class="page-btn" data-page="${Math.max(1, page - 1)}" ${page <= 1 ? "disabled" : ""}>Anterior</button>
        ${pages.join("")}
        <button type="button" class="page-btn" data-page="${Math.min(totalPages, page + 1)}" ${page >= totalPages ? "disabled" : ""}>Proxima</button>
      `;
    }

    async function load() {
      tbody.innerHTML = '<tr><td colspan="8">Carregando familias...</td></tr>';
      updateUrl();

      const params = new URLSearchParams();
      if (state.busca) params.set("busca", state.busca);
      if (state.ativo) params.set("ativo", state.ativo);
      if (state.parentesco) params.set("parentesco", state.parentesco);
      if (state.cidade) params.set("cidade", state.cidade);
      params.set("page", String(state.page));
      params.set("limit", String(state.limit));

      try {
        const payload = await requestJson(`/api/familias?${params.toString()}`);
        renderRows(payload.docs || []);
        renderPaginacao(payload);
        count.textContent = `${payload.totalDocs || 0} familias monitoradas`;

        const docs = Array.isArray(payload.docs) ? payload.docs : [];
        const ativosNaPagina = docs.filter((doc) => doc?.ativo).length;
        const dependentesNaPagina = docs.reduce((total, doc) => total + Number(doc?.pacientesAtivos || 0), 0);

        if (totalChip) totalChip.textContent = String(payload.totalDocs || 0);
        if (activeChip) activeChip.textContent = String(ativosNaPagina);
        if (pacientesChip) pacientesChip.textContent = String(dependentesNaPagina);
      } catch (error) {
        tbody.innerHTML = `<tr><td colspan="8">${escapeHtml(error.message)}</td></tr>`;
        count.textContent = "Erro ao carregar";
        if (totalChip) totalChip.textContent = "-";
        if (activeChip) activeChip.textContent = "-";
        if (pacientesChip) pacientesChip.textContent = "-";
      }
    }

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      readForm();
      state.page = 1;
      load();
    });

    clearBtn.addEventListener("click", () => {
      state.busca = "";
      state.ativo = "";
      state.parentesco = "";
      state.cidade = "";
      state.page = 1;
      state.limit = 10;
      syncForm();
      load();
    });

    function closeAllActionMenus() {
      tbody.querySelectorAll(".actions-menu.is-open").forEach((menu) => {
        menu.classList.remove("is-open");
        const trigger = menu.querySelector("[data-action='menu-toggle']");
        if (trigger) trigger.setAttribute("aria-expanded", "false");
      });
    }

    document.addEventListener("click", (event) => {
      if (event.target.closest("#familias-table-body .actions-menu")) return;
      closeAllActionMenus();
    });

    tbody.addEventListener("click", async (event) => {
      const menuToggleBtn = event.target.closest("button[data-action='menu-toggle']");
      if (menuToggleBtn) {
        event.preventDefault();
        event.stopPropagation();
        const menu = menuToggleBtn.closest(".actions-menu");
        if (!menu) return;
        const willOpen = !menu.classList.contains("is-open");
        closeAllActionMenus();
        menu.classList.toggle("is-open", willOpen);
        menuToggleBtn.setAttribute("aria-expanded", String(willOpen));
        return;
      }

      const button = event.target.closest("button[data-action='toggle']");
      if (button) {
        event.preventDefault();
        event.stopPropagation();

        const id = button.getAttribute("data-id");
        const next = button.getAttribute("data-next");
        if (!id || typeof next === "undefined") return;
        const nextAtivo = next === "true";

        const ok = await confirmAction({
          title: nextAtivo ? "Reativar familia?" : "Inativar familia?",
          text: nextAtivo
            ? "Deseja reativar esta familia?"
            : "Deseja inativar esta familia? Essa acao pode impactar atendimentos.",
          icon: "warning",
          confirmButtonText: nextAtivo ? "Reativar" : "Inativar",
        });
        if (!ok) return;

        try {
          button.disabled = true;
          await requestJson(`/api/familias/${id}/status`, {
            method: "PATCH",
            body: { ativo: nextAtivo },
          });
          await load();
          showSuccess("Status da familia atualizado com sucesso.");
        } catch (error) {
          showToast(error.message);
        } finally {
          button.disabled = false;
        }
        return;
      }

      if (event.target.closest("[data-no-row-nav]")) return;
      if (event.target.closest("a, button")) return;

      const row = event.target.closest("tr[data-href]");
      if (!row) return;
      const href = row.getAttribute("data-href");
      if (href) window.location.href = href;
    });

    tbody.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      if (event.target.closest("[data-no-row-nav]")) return;
      const row = event.target.closest("tr[data-href]");
      if (!row) return;
      event.preventDefault();
      const href = row.getAttribute("data-href");
      if (href) window.location.href = href;
    });

    paginacao.addEventListener("click", (event) => {
      const btn = event.target.closest("button[data-page]");
      if (!btn) return;
      state.page = Number(btn.getAttribute("data-page") || 1);
      load();
    });

    syncForm();
    load();
  }

  window.FamiliasListaPage = { init };
})();
