(function () {
  const root = document.querySelector("[data-page]");
  if (!root) return;

  const page = root.getAttribute("data-page");

  function parseJsonScript(id, fallback) {
    const el = document.getElementById(id);
    if (!el) return fallback;
    try {
      return JSON.parse(el.textContent || "");
    } catch (_) {
      return fallback;
    }
  }

  async function requestJson(url, options = {}) {
    const headers = Object.assign(
      { Accept: "application/json" },
      options.body ? { "Content-Type": "application/json" } : {},
      options.headers || {}
    );

    const response = await fetch(url, {
      method: options.method || "GET",
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    const contentType = response.headers.get("content-type") || "";
    const isJson = contentType.includes("application/json");
    const payload = isJson ? await response.json() : await response.text();

    if (!response.ok) {
      const message = isJson
        ? payload?.erro || payload?.message?.[0] || "Erro na requisicao."
        : "Erro na requisicao.";
      throw new Error(message);
    }

    return payload;
  }

  function formatDate(dateLike) {
    if (!dateLike) return "-";
    const dt = new Date(dateLike);
    if (Number.isNaN(dt.getTime())) return "-";
    return new Intl.DateTimeFormat("pt-BR").format(dt);
  }

  function formatDateTime(dateLike) {
    if (!dateLike) return "-";
    const dt = new Date(dateLike);
    if (Number.isNaN(dt.getTime())) return "-";
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(dt);
  }

  function showToast(message) {
    window.alert(message);
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function toIsoFromLocal(localDateTime) {
    if (!localDateTime) return null;
    const dt = new Date(localDateTime);
    if (Number.isNaN(dt.getTime())) return null;
    return dt.toISOString();
  }

  function initFamiliasLista() {
    const form = document.getElementById("familias-filtro-form");
    const clearBtn = document.getElementById("familias-limpar-filtros");
    const tbody = document.getElementById("familias-table-body");
    const paginacao = document.getElementById("familias-paginacao");
    const count = document.getElementById("familias-count");

    const initial = parseJsonScript("familias-initial", {});
    const state = {
      busca: String(initial.busca || ""),
      ativo: String(initial.ativo || ""),
      parentesco: String(initial.parentesco || ""),
      cidade: String(initial.cidade || ""),
      page: Number(initial.page || 1),
      limit: Number(initial.limit || 20),
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
      state.limit = Math.max(Number(form.elements.limit.value || 20), 1);
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
          const toggleLabel = doc?.ativo ? "Excluir" : "Reativar";
          const detalhesHref = `/familias/${doc._id}`;
          const editarHref = `/familias/${doc._id}/editar`;
          const rowLabel = doc?.responsavel?.nome || "familia";

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
                <div class="actions-menu" data-no-row-nav>
                  <button class="actions-menu-trigger" type="button" aria-haspopup="true" aria-expanded="false" data-action="menu-toggle" title="Abrir acoes">
                    <span aria-hidden="true">...</span>
                    <span class="sr-only">Abrir acoes</span>
                  </button>
                  <div class="actions-menu-dropdown" role="menu">
                    <a class="actions-menu-item" role="menuitem" href="${detalhesHref}">Visualizar ficha</a>
                    <a class="actions-menu-item" role="menuitem" href="${editarHref}">Editar</a>
                    <button class="actions-menu-item actions-menu-item-warn" role="menuitem" type="button" data-action="toggle" data-id="${doc._id}" data-next="${String(!doc?.ativo)}">${toggleLabel}</button>
                  </div>
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
        count.textContent = `${payload.totalDocs || 0} encontrados`;
      } catch (error) {
        tbody.innerHTML = `<tr><td colspan="8">${escapeHtml(error.message)}</td></tr>`;
        count.textContent = "Erro ao carregar";
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
      state.limit = 20;
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

        try {
          button.disabled = true;
          await requestJson(`/api/familias/${id}/status`, {
            method: "PATCH",
            body: { ativo: next === "true" },
          });
          await load();
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

  function initFamiliasForm() {
    const form = document.getElementById("familia-form");
    const feedback = document.getElementById("familia-form-feedback");
    const mode = root.getAttribute("data-mode");
    const familyId = root.getAttribute("data-familia-id");
    const initial = parseJsonScript("familia-form-initial", null);
    const initialAtivo = initial?.ativo ?? true;

    function setFeedback(message, type) {
      feedback.hidden = !message;
      feedback.textContent = message || "";
      feedback.className = `form-feedback ${type ? `is-${type}` : ""}`;
    }

    function collectPayload() {
      return {
        responsavel: {
          nome: form.elements.responsavel_nome.value.trim(),
          telefone: form.elements.responsavel_telefone.value.trim(),
          email: form.elements.responsavel_email.value.trim(),
          parentesco: form.elements.responsavel_parentesco.value,
        },
        endereco: {
          cep: form.elements.endereco_cep.value.trim(),
          rua: form.elements.endereco_rua.value.trim(),
          numero: form.elements.endereco_numero.value.trim(),
          bairro: form.elements.endereco_bairro.value.trim(),
          cidade: form.elements.endereco_cidade.value.trim(),
          estado: form.elements.endereco_estado.value.trim().toUpperCase(),
          complemento: form.elements.endereco_complemento.value.trim(),
        },
        observacoes: form.elements.observacoes.value.trim(),
      };
    }

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      setFeedback("", "");

      const payload = collectPayload();
      if (!payload.responsavel.nome || !payload.responsavel.telefone) {
        setFeedback("Preencha nome e telefone do responsavel.", "error");
        return;
      }

      const submitBtn = form.querySelector("button[type='submit']");
      submitBtn.disabled = true;

      try {
        let targetId = familyId;
        if (mode === "editar" && familyId) {
          await requestJson(`/api/familias/${familyId}`, {
            method: "PUT",
            body: payload,
          });

          const nextAtivo = form.elements.ativo ? form.elements.ativo.value === "true" : initialAtivo;
          if (nextAtivo !== initialAtivo) {
            await requestJson(`/api/familias/${familyId}/status`, {
              method: "PATCH",
              body: { ativo: nextAtivo },
            });
          }
        } else {
          const created = await requestJson("/api/familias", {
            method: "POST",
            body: payload,
          });
          targetId = created?.familia?._id;
        }

        setFeedback("Familia salva com sucesso. Redirecionando...", "success");
        window.setTimeout(() => {
          window.location.href = targetId ? `/familias/${targetId}` : "/familias";
        }, 500);
      } catch (error) {
        setFeedback(error.message, "error");
      } finally {
        submitBtn.disabled = false;
      }
    });
  }

  function initFamiliaDetalhe() {
    const familiaId = root.getAttribute("data-familia-id");
    const workflowTitle = document.getElementById("workflow-title");
    const workflowSubtitle = document.getElementById("workflow-subtitle");
    const workflowMainBtn = document.getElementById("workflow-main-btn");
    const workflowBackBtn = document.getElementById("workflow-back-btn");
    const panelPacientes = document.getElementById("panel-pacientes");
    const panelDependente = document.getElementById("panel-dependente");
    const panelHistorico = document.getElementById("panel-historico");
    const panelAtendimento = document.getElementById("panel-atendimento");
    const panelRegistro = document.getElementById("panel-registro");
    const historicoRegistrarBtn = document.getElementById("historico-registrar-btn");
    const registroVoltarBtn = document.getElementById("registro-voltar-btn");
    const registroPanelTitle = document.getElementById("registro-panel-title");
    const pacientesLista = document.getElementById("pacientes-lista");
    const atendimentosLista = document.getElementById("atendimentos-lista");
    const atendimentoDetalhe = document.getElementById("atendimento-detalhe");
    const atendimentoEditarBtn = document.getElementById("atendimento-editar-btn");
    const pacientesCount = document.getElementById("pacientes-count");
    const atendimentosCount = document.getElementById("atendimentos-count");
    const statusBadge = document.getElementById("resumo-status");
    const statusBtn = document.getElementById("familia-toggle-status");
    const pacienteNovoBtn = document.getElementById("paciente-novo-btn");
    const pacienteCancelarBtn = document.getElementById("paciente-cancelar-btn");
    const pacienteForm = document.getElementById("paciente-form");
    const dependenteDetalhe = document.getElementById("dependente-detalhe");
    const dependenteEditarBtn = document.getElementById("dependente-editar-btn");
    const dependenteForm = document.getElementById("dependente-form");
    const dependenteCancelarBtn = document.getElementById("dependente-cancelar-btn");
    const atendimentoForm = document.getElementById("atendimento-form");
    const atendimentoSubmitBtn = document.getElementById("atendimento-submit-btn");
    const pacienteSelect = document.getElementById("atendimento-paciente");

    if (!familiaId) return;

    let currentFamilia = null;
    let currentPacientes = [];
    let currentAtendimentos = [];
    let selectedDependenteId = null;
    let selectedAtendimentoId = null;
    let activeView = "pacientes";
    let historicoOrigin = "pacientes";
    let registroOrigin = "historico";
    let registroMode = "create";

    function toDateInputValue(dateLike) {
      if (!dateLike) return "";
      const dt = new Date(dateLike);
      if (Number.isNaN(dt.getTime())) return "";
      const year = dt.getFullYear();
      const month = String(dt.getMonth() + 1).padStart(2, "0");
      const day = String(dt.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }

    function toDateTimeLocalValue(dateLike) {
      if (!dateLike) return "";
      const dt = new Date(dateLike);
      if (Number.isNaN(dt.getTime())) return "";
      const year = dt.getFullYear();
      const month = String(dt.getMonth() + 1).padStart(2, "0");
      const day = String(dt.getDate()).padStart(2, "0");
      const hour = String(dt.getHours()).padStart(2, "0");
      const minute = String(dt.getMinutes()).padStart(2, "0");
      return `${year}-${month}-${day}T${hour}:${minute}`;
    }

    function getSelectedDependente() {
      if (!selectedDependenteId) return null;
      return currentPacientes.find((p) => String(p._id) === String(selectedDependenteId)) || null;
    }

    function getAtendimentoPaciente(item) {
      const itemPacienteId = item?.pacienteId?._id || item?.pacienteId || null;
      return currentPacientes.find((p) => String(p._id) === String(itemPacienteId)) || null;
    }

    function getSelectedAtendimento() {
      if (!selectedAtendimentoId) return null;
      return currentAtendimentos.find((a) => String(a._id) === String(selectedAtendimentoId)) || null;
    }

    function closePacienteForm() {
      pacienteForm.reset();
      pacienteForm.hidden = true;
      pacienteNovoBtn.hidden = false;
    }

    function openPacienteForm() {
      pacienteForm.hidden = false;
      pacienteNovoBtn.hidden = true;
      const nomeInput = pacienteForm.elements.nome;
      if (nomeInput) nomeInput.focus();
    }

    function closeDependenteForm() {
      dependenteForm.reset();
      dependenteForm.hidden = true;
      dependenteEditarBtn.hidden = false;
    }

    function openDependenteForm(paciente) {
      if (!paciente) return;
      dependenteForm.elements.nome.value = paciente.nome || "";
      dependenteForm.elements.dataNascimento.value = toDateInputValue(paciente.dataNascimento);
      dependenteForm.elements.tipoDeficiencia.value = paciente.tipoDeficiencia || "outra";
      dependenteForm.elements.necessidadesApoio.value = paciente.necessidadesApoio || "";
      dependenteForm.elements.observacoes.value = paciente.observacoes || "";
      dependenteForm.elements.diagnosticoResumo.value = paciente.diagnosticoResumo || "";
      dependenteForm.hidden = false;
      dependenteEditarBtn.hidden = true;
      const nomeInput = dependenteForm.elements.nome;
      if (nomeInput) nomeInput.focus();
    }

    function renderDependenteFicha() {
      const dependente = getSelectedDependente();
      if (!dependente) {
        dependenteDetalhe.innerHTML = '<p class="empty-hint">Selecione um dependente para visualizar a ficha.</p>';
        dependenteEditarBtn.disabled = true;
        return;
      }

      dependenteEditarBtn.disabled = false;
      const statusClass = dependente.ativo ? "status-active" : "status-inactive";
      const statusLabel = dependente.ativo ? "Ativo" : "Inativo";
      const toggleLabel = dependente.ativo ? "Inativar" : "Reativar";

      dependenteDetalhe.innerHTML = `
        <div class="stack-card-content">
          <h4>${escapeHtml(dependente.nome || "-")}</h4>
          <p><strong>Nascimento:</strong> ${escapeHtml(formatDate(dependente.dataNascimento))}</p>
          <p><strong>Tipo:</strong> ${escapeHtml(dependente.tipoDeficiencia || "-")}</p>
          <p><strong>Necessidades de apoio:</strong> ${escapeHtml(dependente.necessidadesApoio || "-")}</p>
          <p><strong>Observacoes:</strong> ${escapeHtml(dependente.observacoes || "-")}</p>
          <p><strong>Diagnostico / laudo:</strong> ${escapeHtml(dependente.diagnosticoResumo || "-")}</p>
        </div>
        <div class="stack-actions">
          <span class="status-badge ${statusClass}">${statusLabel}</span>
          <button class="mini-btn mini-btn-warn" type="button" data-type="dependente-status" data-id="${dependente._id}" data-next="${String(!dependente.ativo)}">${toggleLabel}</button>
        </div>
      `;
    }

    function renderAtendimentoFicha() {
      const atendimento = getSelectedAtendimento();
      if (!atendimento) {
        atendimentoDetalhe.innerHTML = '<p class="empty-hint">Selecione um atendimento no historico para visualizar a ficha.</p>';
        atendimentoEditarBtn.disabled = true;
        return;
      }

      atendimentoEditarBtn.disabled = false;
      const paciente = getAtendimentoPaciente(atendimento);
      const statusClass = atendimento.ativo ? "status-active" : "status-inactive";
      const statusLabel = atendimento.ativo ? "Ativo" : "Inativo";
      const toggleLabel = atendimento.ativo ? "Inativar" : "Reativar";

      atendimentoDetalhe.innerHTML = `
        <div class="stack-card-content">
          <h4>${escapeHtml(atendimento.tipo || "outro")} - ${escapeHtml(formatDateTime(atendimento.dataHora))}</h4>
          <p><strong>Dependente:</strong> ${escapeHtml(paciente?.nome || "Nao informado")}</p>
          <p><strong>Resumo:</strong> ${escapeHtml(atendimento.resumo || "-")}</p>
          <p><strong>Proximos passos:</strong> ${escapeHtml(atendimento.proximosPassos || "-")}</p>
        </div>
        <div class="stack-actions">
          <span class="status-badge ${statusClass}">${statusLabel}</span>
          <button class="mini-btn mini-btn-warn" type="button" data-type="atendimento-status" data-id="${atendimento._id}" data-next="${String(!atendimento.ativo)}">${toggleLabel}</button>
        </div>
      `;
    }

    function setRegistroMode(mode, atendimento = null) {
      registroMode = mode === "edit" ? "edit" : "create";

      if (registroMode === "edit" && atendimento) {
        registroPanelTitle.textContent = "Editar Atendimento";
        atendimentoSubmitBtn.textContent = "Salvar Alteracoes";
        registroVoltarBtn.textContent = "Voltar ao Atendimento";
        atendimentoForm.elements.pacienteId.value = String(atendimento?.pacienteId?._id || atendimento?.pacienteId || "");
        atendimentoForm.elements.tipo.value = atendimento.tipo || "outro";
        atendimentoForm.elements.dataHora.value = toDateTimeLocalValue(atendimento.dataHora);
        atendimentoForm.elements.resumo.value = atendimento.resumo || "";
        atendimentoForm.elements.proximosPassos.value = atendimento.proximosPassos || "";
      } else {
        registroPanelTitle.textContent = "Registrar Atendimento";
        atendimentoSubmitBtn.textContent = "Salvar Atendimento";
        registroVoltarBtn.textContent = "Voltar ao Historico";
        atendimentoForm.reset();
      }
    }

    function openRegistroCreate(origin = "historico") {
      registroOrigin = origin;
      setRegistroMode("create");
      setView("registro");
    }

    function openRegistroEdit(atendimento) {
      if (!atendimento) return;
      registroOrigin = "atendimento";
      setRegistroMode("edit", atendimento);
      setView("registro");
    }

    function setView(view) {
      activeView = view;

      panelPacientes.hidden = view !== "pacientes";
      panelDependente.hidden = view !== "dependente";
      panelHistorico.hidden = view !== "historico";
      panelAtendimento.hidden = view !== "atendimento";
      panelRegistro.hidden = view !== "registro";

      panelPacientes.classList.toggle("is-active", view === "pacientes");
      panelDependente.classList.toggle("is-active", view === "dependente");
      panelHistorico.classList.toggle("is-active", view === "historico");
      panelAtendimento.classList.toggle("is-active", view === "atendimento");
      panelRegistro.classList.toggle("is-active", view === "registro");

      if (view === "pacientes") {
        workflowTitle.textContent = "Ficha de Dependentes";
        workflowSubtitle.textContent = "Gestao dos dependentes vinculados a esta familia.";
        workflowMainBtn.hidden = false;
        workflowMainBtn.textContent = "Historico de atendimento";
        workflowBackBtn.hidden = true;
      } else if (view === "dependente") {
        workflowTitle.textContent = "Ficha do Dependente";
        workflowSubtitle.textContent = "Dados completos do dependente e edicao segura.";
        workflowMainBtn.hidden = false;
        workflowMainBtn.textContent = "Historico de atendimento";
        workflowBackBtn.hidden = false;
        workflowBackBtn.textContent = "Voltar aos dependentes";
      } else if (view === "historico") {
        workflowTitle.textContent = "Historico de Atendimentos";
        workflowSubtitle.textContent = "Linha do tempo completa das interacoes com a familia.";
        workflowMainBtn.hidden = false;
        workflowMainBtn.textContent = "Registrar atendimento";
        workflowBackBtn.hidden = false;
        workflowBackBtn.textContent = "Ficha de dependentes";
      } else if (view === "atendimento") {
        workflowTitle.textContent = "Ficha do Atendimento";
        workflowSubtitle.textContent = "Detalhes completos do atendimento selecionado.";
        workflowMainBtn.hidden = true;
        workflowBackBtn.hidden = false;
        workflowBackBtn.textContent = "Voltar ao historico";
      } else {
        workflowTitle.textContent = registroMode === "edit" ? "Editar Atendimento" : "Registrar Atendimento";
        workflowSubtitle.textContent = registroMode === "edit"
          ? "Atualize as informacoes e salve as alteracoes."
          : "Preencha os dados e salve o novo registro.";
        workflowMainBtn.hidden = true;
        workflowBackBtn.hidden = false;
        workflowBackBtn.textContent = registroOrigin === "atendimento" ? "Voltar ao atendimento" : "Voltar ao historico";
      }

      if (view !== "pacientes") {
        closePacienteForm();
      }
      if (view !== "dependente") {
        closeDependenteForm();
      }
    }

    function renderResumo(familia) {
      currentFamilia = familia;
      document.getElementById("resumo-nome").textContent = familia?.responsavel?.nome || "-";
      document.getElementById("resumo-telefone").textContent = familia?.responsavel?.telefone || "-";
      document.getElementById("resumo-email").textContent = familia?.responsavel?.email || "-";
      document.getElementById("resumo-observacoes").textContent = familia?.observacoes || "-";

      const endereco = [
        familia?.endereco?.rua,
        familia?.endereco?.numero,
        familia?.endereco?.bairro,
        familia?.endereco?.cidade,
        familia?.endereco?.estado,
      ].filter(Boolean).join(", ");
      document.getElementById("resumo-endereco").textContent = endereco || "-";

      statusBadge.textContent = familia?.ativo ? "Ativa" : "Inativa";
      statusBadge.className = `status-badge ${familia?.ativo ? "status-active" : "status-inactive"}`;
      statusBtn.textContent = familia?.ativo ? "Inativar Familia" : "Reativar Familia";
    }

    function renderPacientes(pacientes) {
      currentPacientes = pacientes;
      pacientesCount.textContent = String(pacientes.length);
      if (selectedDependenteId && !pacientes.some((p) => String(p._id) === String(selectedDependenteId))) {
        selectedDependenteId = null;
      }

      if (!pacientes.length) {
        pacientesLista.innerHTML = '<p class="empty-hint">Nenhum dependente vinculado.</p>';
      } else {
        pacientesLista.innerHTML = pacientes
          .map((paciente) => {
            const toggleLabel = paciente.ativo ? "Inativar" : "Reativar";
            return `
              <article class="stack-card stack-card-clickable" data-type="dependente-open" data-id="${paciente._id}" role="button" tabindex="0" aria-label="Abrir ficha de ${escapeHtml(paciente.nome || "dependente")}">
                <div>
                  <h4>${escapeHtml(paciente.nome || "-")}</h4>
                  <p><strong>Tipo:</strong> ${escapeHtml(paciente.tipoDeficiencia || "-")}</p>
                  <p><strong>Nascimento:</strong> ${escapeHtml(formatDate(paciente.dataNascimento))}</p>
                  <p><strong>Apoio:</strong> ${escapeHtml(paciente.necessidadesApoio || "-")}</p>
                </div>
                <div class="stack-actions">
                  <span class="status-badge ${paciente.ativo ? "status-active" : "status-inactive"}">${paciente.ativo ? "Ativo" : "Inativo"}</span>
                  <button class="mini-btn mini-btn-warn" type="button" data-type="paciente-status" data-id="${paciente._id}" data-next="${String(!paciente.ativo)}">${toggleLabel}</button>
                </div>
              </article>
            `;
          })
          .join("");
      }

      const options = ['<option value="">Sem dependente especifico</option>']
        .concat(
          pacientes
            .filter((p) => p.ativo)
            .map((p) => `<option value="${p._id}">${escapeHtml(p.nome)}</option>`)
        );
      pacienteSelect.innerHTML = options.join("");
    }

    function renderAtendimentos(atendimentos) {
      currentAtendimentos = atendimentos;
      atendimentosCount.textContent = String(atendimentos.length);
      if (selectedAtendimentoId && !atendimentos.some((a) => String(a._id) === String(selectedAtendimentoId))) {
        selectedAtendimentoId = null;
      }

      if (!atendimentos.length) {
        atendimentosLista.innerHTML = '<p class="empty-hint">Nenhum atendimento registrado.</p>';
        renderAtendimentoFicha();
        return;
      }

      atendimentosLista.innerHTML = atendimentos
        .map((item) => {
          const paciente = getAtendimentoPaciente(item);
          const toggleLabel = item.ativo ? "Inativar" : "Reativar";

          return `
            <article class="timeline-card timeline-card-clickable" data-type="atendimento-open" data-id="${item._id}" role="button" tabindex="0" aria-label="Abrir ficha do atendimento">
              <div class="timeline-top">
                <div>
                  <h4>${escapeHtml(item.tipo || "outro")} - ${escapeHtml(formatDateTime(item.dataHora))}</h4>
                  <p><strong>Dependente:</strong> ${escapeHtml(paciente?.nome || "Nao informado")}</p>
                </div>
                <span class="status-badge ${item.ativo ? "status-active" : "status-inactive"}">${item.ativo ? "Ativo" : "Inativo"}</span>
              </div>
              <p><strong>Resumo:</strong> ${escapeHtml(item.resumo || "-")}</p>
              <p><strong>Proximos passos:</strong> ${escapeHtml(item.proximosPassos || "-")}</p>
              <div class="stack-actions">
                <button class="mini-btn mini-btn-warn" type="button" data-type="atendimento-status" data-id="${item._id}" data-next="${String(!item.ativo)}">${toggleLabel}</button>
              </div>
            </article>
          `;
        })
        .join("");

      renderAtendimentoFicha();
    }

    function openDependenteViewById(id) {
      if (!id) return;
      selectedDependenteId = String(id);
      renderDependenteFicha();
      setView("dependente");
    }

    function openAtendimentoViewById(id) {
      if (!id) return;
      selectedAtendimentoId = String(id);
      renderAtendimentoFicha();
      setView("atendimento");
    }

    workflowMainBtn.addEventListener("click", () => {
      if (activeView === "pacientes" || activeView === "dependente") {
        historicoOrigin = activeView;
        setView("historico");
      } else if (activeView === "historico") {
        openRegistroCreate("historico");
      }
    });

    workflowBackBtn.addEventListener("click", () => {
      if (activeView === "dependente") {
        setView("pacientes");
      } else if (activeView === "historico") {
        setView(historicoOrigin === "dependente" ? "dependente" : "pacientes");
      } else if (activeView === "atendimento") {
        setView("historico");
      } else if (activeView === "registro") {
        setView(registroOrigin === "atendimento" ? "atendimento" : "historico");
      }
    });

    historicoRegistrarBtn.addEventListener("click", () => {
      openRegistroCreate("historico");
    });

    registroVoltarBtn.addEventListener("click", () => {
      setView(registroOrigin === "atendimento" ? "atendimento" : "historico");
    });

    pacienteNovoBtn.addEventListener("click", () => {
      openPacienteForm();
    });

    pacienteCancelarBtn.addEventListener("click", () => {
      closePacienteForm();
    });

    dependenteEditarBtn.addEventListener("click", () => {
      const dependente = getSelectedDependente();
      if (!dependente) return;
      openDependenteForm(dependente);
    });

    dependenteCancelarBtn.addEventListener("click", () => {
      closeDependenteForm();
    });

    atendimentoEditarBtn.addEventListener("click", () => {
      const atendimento = getSelectedAtendimento();
      if (!atendimento) return;
      openRegistroEdit(atendimento);
    });

    async function loadDetail() {
      try {
        const payload = await requestJson(`/api/familias/${familiaId}?incluirInativos=true`);
        renderResumo(payload.familia);
        renderPacientes(payload.pacientes || []);
        renderDependenteFicha();
        renderAtendimentos(payload.atendimentos || []);
      } catch (error) {
        showToast(error.message);
      }
    }

    statusBtn.addEventListener("click", async () => {
      if (!currentFamilia) return;
      const next = !currentFamilia.ativo;
      try {
        await requestJson(`/api/familias/${familiaId}/status`, {
          method: "PATCH",
          body: { ativo: next },
        });
        await loadDetail();
      } catch (error) {
        showToast(error.message);
      }
    });

    pacientesLista.addEventListener("click", async (event) => {
      const button = event.target.closest("button[data-type='paciente-status']");
      if (button) {
        try {
          await requestJson(`/api/pacientes/${button.getAttribute("data-id")}/status`, {
            method: "PATCH",
            body: { ativo: button.getAttribute("data-next") === "true" },
          });
          await loadDetail();
        } catch (error) {
          showToast(error.message);
        }
        return;
      }

      const card = event.target.closest("[data-type='dependente-open']");
      if (card) {
        openDependenteViewById(card.getAttribute("data-id"));
      }
    });

    pacientesLista.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      if (event.target.closest("button[data-type='paciente-status']")) return;
      const card = event.target.closest("[data-type='dependente-open']");
      if (!card) return;
      event.preventDefault();
      openDependenteViewById(card.getAttribute("data-id"));
    });

    dependenteDetalhe.addEventListener("click", async (event) => {
      const button = event.target.closest("button[data-type='dependente-status']");
      if (!button) return;
      try {
        await requestJson(`/api/pacientes/${button.getAttribute("data-id")}/status`, {
          method: "PATCH",
          body: { ativo: button.getAttribute("data-next") === "true" },
        });
        await loadDetail();
      } catch (error) {
        showToast(error.message);
      }
    });

    atendimentosLista.addEventListener("click", async (event) => {
      const button = event.target.closest("button[data-type='atendimento-status']");
      if (button) {
        try {
          await requestJson(`/api/atendimentos/${button.getAttribute("data-id")}/status`, {
            method: "PATCH",
            body: { ativo: button.getAttribute("data-next") === "true" },
          });
          await loadDetail();
        } catch (error) {
          showToast(error.message);
        }
        return;
      }

      const card = event.target.closest("[data-type='atendimento-open']");
      if (card) {
        openAtendimentoViewById(card.getAttribute("data-id"));
      }
    });

    atendimentosLista.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      if (event.target.closest("button[data-type='atendimento-status']")) return;
      const card = event.target.closest("[data-type='atendimento-open']");
      if (!card) return;
      event.preventDefault();
      openAtendimentoViewById(card.getAttribute("data-id"));
    });

    atendimentoDetalhe.addEventListener("click", async (event) => {
      const button = event.target.closest("button[data-type='atendimento-status']");
      if (!button) return;
      try {
        await requestJson(`/api/atendimentos/${button.getAttribute("data-id")}/status`, {
          method: "PATCH",
          body: { ativo: button.getAttribute("data-next") === "true" },
        });
        await loadDetail();
      } catch (error) {
        showToast(error.message);
      }
    });

    pacienteForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const payload = {
        nome: pacienteForm.elements.nome.value.trim(),
        dataNascimento: pacienteForm.elements.dataNascimento.value || null,
        tipoDeficiencia: pacienteForm.elements.tipoDeficiencia.value,
        necessidadesApoio: pacienteForm.elements.necessidadesApoio.value.trim(),
      };

      if (!payload.nome) {
        showToast("Informe o nome do dependente.");
        return;
      }

      try {
        const created = await requestJson(`/api/familias/${familiaId}/pacientes`, {
          method: "POST",
          body: payload,
        });
        closePacienteForm();
        await loadDetail();
        const createdId = created?.paciente?._id;
        if (createdId) {
          openDependenteViewById(createdId);
        }
      } catch (error) {
        showToast(error.message);
      }
    });

    dependenteForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const dependente = getSelectedDependente();
      if (!dependente) return;

      const payload = {
        nome: dependenteForm.elements.nome.value.trim(),
        dataNascimento: dependenteForm.elements.dataNascimento.value || null,
        tipoDeficiencia: dependenteForm.elements.tipoDeficiencia.value,
        necessidadesApoio: dependenteForm.elements.necessidadesApoio.value.trim(),
        observacoes: dependenteForm.elements.observacoes.value.trim(),
        diagnosticoResumo: dependenteForm.elements.diagnosticoResumo.value.trim(),
      };

      if (!payload.nome) {
        showToast("Informe o nome do dependente.");
        return;
      }

      try {
        await requestJson(`/api/pacientes/${dependente._id}`, {
          method: "PUT",
          body: payload,
        });
        closeDependenteForm();
        await loadDetail();
        setView("dependente");
      } catch (error) {
        showToast(error.message);
      }
    });

    atendimentoForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const payload = {
        pacienteId: atendimentoForm.elements.pacienteId.value || null,
        tipo: atendimentoForm.elements.tipo.value,
        dataHora: toIsoFromLocal(atendimentoForm.elements.dataHora.value) || new Date().toISOString(),
        resumo: atendimentoForm.elements.resumo.value.trim(),
        proximosPassos: atendimentoForm.elements.proximosPassos.value.trim(),
      };

      if (!payload.resumo) {
        showToast("Informe o resumo do atendimento.");
        return;
      }

      try {
        if (registroMode === "edit" && selectedAtendimentoId) {
          await requestJson(`/api/atendimentos/${selectedAtendimentoId}`, {
            method: "PUT",
            body: payload,
          });
        } else {
          await requestJson(`/api/familias/${familiaId}/atendimentos`, {
            method: "POST",
            body: payload,
          });
        }
        await loadDetail();
        if (registroMode === "edit" && selectedAtendimentoId) {
          setView("atendimento");
        } else {
          setView("historico");
        }
        setRegistroMode("create");
      } catch (error) {
        showToast(error.message);
      }
    });

    setView("pacientes");
    closePacienteForm();
    closeDependenteForm();
    loadDetail();
  }

  if (page === "familias-lista") initFamiliasLista();
  if (page === "familias-form") initFamiliasForm();
  if (page === "familia-detalhe") initFamiliaDetalhe();
})();
