(function () {
  const root = document.querySelector(".page-acessos");
  if (!root) return;

  async function requestJson(url, options = {}) {
    const response = await fetch(url, {
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
      ...options,
    });

    let payload = null;
    try {
      payload = await response.json();
    } catch (_) {
      payload = null;
    }

    if (!response.ok) {
      const message = payload?.erro || payload?.message || "Erro ao processar a requisicao.";
      throw new Error(message);
    }

    return payload;
  }

  function closeAllMenus(exceptMenu) {
    root.querySelectorAll(".acesso-actions-menu.is-open").forEach((menu) => {
      if (exceptMenu && menu === exceptMenu) return;
      menu.classList.remove("is-open");
      const trigger = menu.querySelector("[data-action='menu-toggle']");
      if (trigger) trigger.setAttribute("aria-expanded", "false");
    });
  }

  function syncBodyModalState() {
    const hasOpenModal = !!root.querySelector(".acessos-modal:not([hidden])");
    document.body.classList.toggle("acessos-modal-open", hasOpenModal);
  }

  let openEditModal = () => {};
  let openApprovalModal = () => {};

  root.addEventListener("click", (event) => {
    const editBtn = event.target.closest("[data-action='edit-user']");
    if (editBtn) {
      event.preventDefault();
      event.stopPropagation();
      closeAllMenus();
      openEditModal(String(editBtn.getAttribute("data-user-id") || "").trim());
      return;
    }

    const approvalBtn = event.target.closest("[data-approval-open]");
    if (approvalBtn) {
      event.preventDefault();
      event.stopPropagation();
      closeAllMenus();
      openApprovalModal(String(approvalBtn.getAttribute("data-user-id") || "").trim());
      return;
    }

    const toggleBtn = event.target.closest("[data-action='menu-toggle']");
    if (!toggleBtn) return;

    event.preventDefault();
    event.stopPropagation();

    const menu = toggleBtn.closest(".acesso-actions-menu");
    if (!menu) return;

    const willOpen = !menu.classList.contains("is-open");
    closeAllMenus(menu);
    menu.classList.toggle("is-open", willOpen);
    toggleBtn.setAttribute("aria-expanded", String(willOpen));
  });

  document.addEventListener("click", (event) => {
    if (event.target.closest(".acesso-actions-menu")) return;
    closeAllMenus();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    closeAllMenus();
  });

  const createBtn = root.querySelector("[data-create-user-open]");
  const modal = root.querySelector("[data-create-user-modal]");
  if (createBtn && modal) {
    const form = modal.querySelector("[data-create-user-form]");
    const errorBox = modal.querySelector("[data-create-user-error]");
    const closeButtons = modal.querySelectorAll("[data-create-user-close]");
    const statusWrap = modal.querySelector("[data-create-user-status-wrap]");
    const accessWrap = modal.querySelector("[data-create-user-access-wrap]");
    const approvalRoleWrap = modal.querySelector("[data-create-user-approval-role-wrap]");
    const hint = modal.querySelector("[data-create-user-hint]");
    const titleEl = modal.querySelector("[data-user-modal-title]");
    const descriptionEl = modal.querySelector("[data-user-modal-description]");
    const passwordHintEl = modal.querySelector("[data-user-password-hint]");
    const submitButton = modal.querySelector("[data-user-modal-submit]");
    const defaultTipoCadastro = String(root.dataset.defaultTipoCadastro || "voluntario")
      .trim()
      .toLowerCase();

    let isSubmitting = false;
    let currentMode = "create";
    let editingUserId = null;

    function showError(message) {
      if (!errorBox) return;
      const text = String(message || "").trim();
      if (!text) {
        errorBox.hidden = true;
        errorBox.textContent = "";
        return;
      }
      errorBox.hidden = false;
      errorBox.textContent = text;
    }

    function setModalTexts(mode) {
      const isEdit = mode === "edit";

      if (titleEl) {
        titleEl.textContent = isEdit ? "Editar usuario" : "Criar novo usuario";
      }

      if (descriptionEl) {
        descriptionEl.textContent = isEdit
          ? "Atualize os dados do acesso selecionado. A senha so muda se voce preencher os campos abaixo."
          : "Preencha os dados abaixo para liberar um novo acesso manualmente.";
      }

      if (passwordHintEl) {
        passwordHintEl.textContent = isEdit
          ? "Senha opcional na edicao. Deixe em branco para manter a senha atual."
          : "Defina uma senha inicial para esse acesso.";
      }

      if (submitButton) {
        submitButton.textContent = isEdit ? "Salvar alteracoes" : "Salvar usuario";
      }

      if (form?.elements?.senha) {
        form.elements.senha.required = !isEdit;
      }

      if (form?.elements?.confirmarSenha) {
        form.elements.confirmarSenha.required = !isEdit;
      }
    }

    function applyProfileRules() {
      if (!form) return;

      const perfil = String(form.elements.perfil?.value || "usuario").trim().toLowerCase();
      const tipoCadastro = String(form.elements.tipoCadastro?.value || defaultTipoCadastro)
        .trim()
        .toLowerCase();
      const isPortalUser = perfil === "usuario";
      const showAccessLevel = isPortalUser && tipoCadastro === "voluntario";
      const showApprovalRole = ["admin", "superadmin"].includes(perfil);

      if (statusWrap) {
        statusWrap.hidden = !isPortalUser;
      }

      if (accessWrap) {
        accessWrap.hidden = !showAccessLevel;
      }

      if (approvalRoleWrap) {
        approvalRoleWrap.hidden = !showApprovalRole;
      }

      if (!isPortalUser && form.elements.statusAprovacao) {
        form.elements.statusAprovacao.value = "aprovado";
      }

      if (!showAccessLevel && form.elements.nivelAcessoVoluntario) {
        form.elements.nivelAcessoVoluntario.value = "";
      }

      if (!showApprovalRole && form.elements.papelAprovacao) {
        form.elements.papelAprovacao.value = "membro";
      }

      if (hint) {
        hint.textContent = isPortalUser
          ? "Para usuario do portal, voce pode escolher se o cadastro nasce aprovado, pendente ou rejeitado."
          : "Perfis internos sao aprovados automaticamente. Se criar ou editar admin_alento, atendente ou tecnico, ele pode nao aparecer nesta listagem filtrada.";
      }
    }

    function resetForm() {
      if (!form) return;
      form.reset();
      if (form.elements.tipoCadastro) {
        form.elements.tipoCadastro.value = defaultTipoCadastro;
      }
      if (form.elements.perfil) {
        form.elements.perfil.value = "usuario";
      }
      if (form.elements.statusAprovacao) {
        form.elements.statusAprovacao.value = "aprovado";
      }
      if (form.elements.papelAprovacao) {
        form.elements.papelAprovacao.value = "membro";
      }
      if (form.elements.ativo) {
        form.elements.ativo.value = "true";
      }
      if (form.elements.nivelAcessoVoluntario) {
        form.elements.nivelAcessoVoluntario.value = "";
      }
      showError("");
      applyProfileRules();
    }

    function openCreateUserModal() {
      modal.hidden = false;
      syncBodyModalState();
      window.setTimeout(() => {
        form?.elements?.nome?.focus();
      }, 30);
    }

    function closeCreateUserModal(force = false) {
      if (isSubmitting && !force) return;
      modal.hidden = true;
      syncBodyModalState();
      showError("");
    }

    function openCreateModal() {
      currentMode = "create";
      editingUserId = null;
      closeAllMenus();
      resetForm();
      setModalTexts("create");
      openCreateUserModal();
    }

    openEditModal = async function handleOpenEditModal(userId) {
      if (!userId) return;
      currentMode = "edit";
      editingUserId = userId;
      resetForm();
      setModalTexts("edit");
      showError("");

      try {
        const usuario = await requestJson(`/usuarios/${userId}`);

        form.elements.nome.value = usuario?.nome || "";
        form.elements.email.value = usuario?.email || "";
        form.elements.login.value = usuario?.login || "";
        form.elements.cpf.value = usuario?.cpf || "";
        form.elements.telefone.value = usuario?.telefone || "";
        form.elements.perfil.value = usuario?.perfil || "usuario";
        form.elements.tipoCadastro.value = usuario?.tipoCadastro || defaultTipoCadastro;
        if (form.elements.papelAprovacao) {
          form.elements.papelAprovacao.value = usuario?.papelAprovacao || "membro";
        }
        if (form.elements.nivelAcessoVoluntario) {
          form.elements.nivelAcessoVoluntario.value = usuario?.nivelAcessoVoluntario || "";
        }
        form.elements.statusAprovacao.value = usuario?.statusAprovacao || "aprovado";
        form.elements.ativo.value = String(
          typeof usuario?.ativo === "boolean" ? usuario.ativo : true
        );
        form.elements.senha.value = "";
        form.elements.confirmarSenha.value = "";

        applyProfileRules();
        openCreateUserModal();
      } catch (error) {
        window.appNotifyError?.(error?.message || "Erro ao carregar usuario para edicao.");
      }
    };

    createBtn.addEventListener("click", openCreateModal);

    closeButtons.forEach((button) => {
      button.addEventListener("click", () => closeCreateUserModal());
    });

    modal.addEventListener("click", (event) => {
      if (event.target === modal.querySelector(".acessos-modal-backdrop")) {
        closeCreateUserModal(true);
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !modal.hidden) {
        closeCreateUserModal();
      }
    });

    form.elements.perfil?.addEventListener("change", applyProfileRules);
    form.elements.tipoCadastro?.addEventListener("change", applyProfileRules);
    setModalTexts("create");
    applyProfileRules();

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (isSubmitting) return;

      const senha = String(form.elements.senha?.value || "");
      const confirmarSenha = String(form.elements.confirmarSenha?.value || "");
      const wantsPasswordChange =
        currentMode === "create" || senha.length > 0 || confirmarSenha.length > 0;

      if (wantsPasswordChange && senha !== confirmarSenha) {
        showError("As senhas informadas nao conferem.");
        return;
      }

      const payload = {
        nome: String(form.elements.nome?.value || "").trim(),
        email: String(form.elements.email?.value || "").trim(),
        login: String(form.elements.login?.value || "").trim(),
        cpf: String(form.elements.cpf?.value || "").trim(),
        telefone: String(form.elements.telefone?.value || "").trim(),
        perfil: String(form.elements.perfil?.value || "usuario").trim(),
        tipoCadastro: String(form.elements.tipoCadastro?.value || defaultTipoCadastro).trim(),
        papelAprovacao: String(form.elements.papelAprovacao?.value || "membro").trim(),
        nivelAcessoVoluntario: String(form.elements.nivelAcessoVoluntario?.value || "").trim(),
        statusAprovacao: String(form.elements.statusAprovacao?.value || "aprovado").trim(),
        ativo: String(form.elements.ativo?.value || "true").trim() === "true",
      };

      if (String(payload.perfil || "").toLowerCase() !== "usuario") {
        payload.statusAprovacao = "aprovado";
      }

      if (String(payload.tipoCadastro || "").toLowerCase() !== "voluntario") {
        payload.nivelAcessoVoluntario = "";
      }

      if (currentMode === "create") {
        payload.senha = senha;
      }

      isSubmitting = true;
      showError("");

      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = currentMode === "edit" ? "Salvando..." : "Criando...";
      }

      try {
        if (currentMode === "edit" && editingUserId) {
          await requestJson(`/usuarios/${editingUserId}`, {
            method: "PUT",
            body: JSON.stringify(payload),
          });

          if (wantsPasswordChange && senha) {
            await requestJson(`/usuarios/${editingUserId}/senha`, {
              method: "PATCH",
              body: JSON.stringify({ senha }),
            });
          }

          closeCreateUserModal(true);
          await window.appNotifySuccess(
            "Usuario atualizado com sucesso. A lista sera recarregada."
          );
          window.location.reload();
          return;
        }

        const result = await requestJson("/usuarios", {
          method: "POST",
          body: JSON.stringify({ ...payload, senha }),
        });

        const createdPerfil = String(result?.usuario?.perfil || payload.perfil)
          .trim()
          .toLowerCase();
        closeCreateUserModal(true);

        if (createdPerfil === "usuario" || payload.tipoCadastro === defaultTipoCadastro) {
          await window.appNotifySuccess(
            "Usuario criado com sucesso. A lista sera atualizada agora."
          );
          window.location.reload();
          return;
        }

        await window.appNotifySuccess("Usuario criado com sucesso.");
      } catch (error) {
        showError(error?.message || "Erro ao salvar usuario.");
        window.appNotifyError?.(error?.message || "Erro ao salvar usuario.");
      } finally {
        isSubmitting = false;
        setModalTexts(currentMode);
        if (submitButton) {
          submitButton.disabled = false;
        }
      }
    });
  }

  const approvalModal = root.querySelector("[data-approval-modal]");
  if (!approvalModal) return;

  const approvalDescription = approvalModal.querySelector("[data-approval-description]");
  const approvalError = approvalModal.querySelector("[data-approval-error]");
  const approvalFields = Array.from(
    approvalModal.querySelectorAll("[data-approval-field]")
  ).reduce((acc, element) => {
    const key = String(element.getAttribute("data-approval-field") || "").trim();
    if (key) acc[key] = element;
    return acc;
  }, {});
  const approvalCloseButtons = approvalModal.querySelectorAll("[data-approval-close]");
  const approveVoteForm = approvalModal.querySelector("[data-approval-vote-approve-form]");
  const approveVoteButton = approvalModal.querySelector("[data-approval-vote-btn='aprovar']");
  const rejectVoteButton = approvalModal.querySelector("[data-approval-reject-open]");
  const actorVotePill = approvalModal.querySelector("[data-approval-actor-vote-pill]");
  const voteCountFields = Array.from(
    approvalModal.querySelectorAll("[data-approval-vote-count]")
  ).reduce((acc, element) => {
    const key = String(element.getAttribute("data-approval-vote-count") || "").trim();
    if (key) acc[key] = element;
    return acc;
  }, {});
  const accessWrap = approvalModal.querySelector("[data-approval-access-wrap]");
  const accessSelect = approvalModal.querySelector("[data-approval-access-select]");
  const reasonsWrap = approvalModal.querySelector("[data-approval-reasons-wrap]");
  const reasonsList = approvalModal.querySelector("[data-approval-reasons-list]");
  const levelVotesWrap = approvalModal.querySelector("[data-approval-level-votes-wrap]");
  const levelVotesList = approvalModal.querySelector("[data-approval-level-votes-list]");
  const levelLeaderPill = approvalModal.querySelector("[data-approval-level-leader-pill]");

  const rejectVoteModal = root.querySelector("[data-reject-vote-modal]");
  const rejectVoteCloseButtons = rejectVoteModal?.querySelectorAll("[data-reject-vote-close]") || [];
  const rejectVoteDescription = rejectVoteModal?.querySelector("[data-reject-vote-description]");
  const rejectVoteForm = rejectVoteModal?.querySelector("[data-approval-reject-vote-form]");
  const rejectVoteReasonField = rejectVoteForm?.querySelector("[name='motivo']");
  const rejectVoteSubmit = rejectVoteForm?.querySelector("button[type='submit']");

  let approvalLoadToken = 0;
  let approvalBusy = false;
  let currentApprovalUserId = "";
  let currentApprovalUserName = "";

  function formatDateTime(value) {
    if (!value) return "-";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "-";
    return parsed.toLocaleString("pt-BR");
  }

  function formatVoteLabel(value) {
    const normalized = String(value || "").trim().toLowerCase();
    if (normalized === "aprovar") return "Aprovar";
    if (normalized === "rejeitar") return "Rejeitar";
    return "Ainda nao votou";
  }

  function formatPendingVotesLabel(count, names = []) {
    const total = Number(count || 0);
    if (total <= 0) return "Nenhum";
    const cleanNames = Array.isArray(names)
      ? names.map((item) => String(item || "").trim()).filter(Boolean)
      : [];
    return cleanNames.length ? `${total} (${cleanNames.join(", ")})` : String(total);
  }

  function formatLevelValueLabel(value) {
    return String(value || "")
      .trim()
      .replace(/_/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function setApprovalError(message) {
    if (!approvalError) return;
    const text = String(message || "").trim();
    if (!text) {
      approvalError.hidden = true;
      approvalError.textContent = "";
      return;
    }
    approvalError.hidden = false;
    approvalError.textContent = text;
  }

  function setApprovalField(name, value) {
    const field = approvalFields[name];
    if (!field) return;
    const text = String(value || "").trim();
    field.value = text || "-";
  }

  function setApprovalBusyState(isBusy) {
    approvalBusy = isBusy;
    if (approveVoteButton) {
      approveVoteButton.disabled = isBusy;
    }
    if (rejectVoteButton) {
      rejectVoteButton.disabled = isBusy;
    }
    if (accessSelect) {
      accessSelect.disabled = isBusy;
    }
  }

  function resetApprovalModal() {
    Object.keys(approvalFields).forEach((key) => setApprovalField(key, ""));
    Object.keys(voteCountFields).forEach((key) => {
      voteCountFields[key].textContent = "0";
    });
    currentApprovalUserId = "";
    currentApprovalUserName = "";

    if (approveVoteForm) {
      approveVoteForm.action = "";
    }

    if (approveVoteButton) {
      approveVoteButton.classList.remove("is-active");
    }

    if (rejectVoteButton) {
      rejectVoteButton.classList.remove("is-active");
    }

    if (accessWrap) {
      accessWrap.hidden = true;
    }
    if (accessSelect) {
      accessSelect.value = "";
      accessSelect.required = false;
    }
    if (approvalDescription) {
      approvalDescription.textContent = "Carregando ficha do cadastro...";
    }
    if (actorVotePill) {
      actorVotePill.textContent = "Ainda nao votou";
    }
    if (reasonsWrap) {
      reasonsWrap.hidden = true;
    }
    if (reasonsList) {
      reasonsList.innerHTML = "";
    }
    if (levelVotesWrap) {
      levelVotesWrap.hidden = true;
    }
    if (levelVotesList) {
      levelVotesList.innerHTML = "";
    }
    if (levelLeaderPill) {
      levelLeaderPill.textContent = "Nenhum nivel lider";
    }
    setApprovalError("");
  }

  function showApprovalModal() {
    approvalModal.hidden = false;
    syncBodyModalState();
  }

  function openRejectVoteModal() {
    if (!rejectVoteModal || !currentApprovalUserId) return;
    rejectVoteModal.hidden = false;
    syncBodyModalState();
    if (rejectVoteDescription) {
      rejectVoteDescription.textContent = currentApprovalUserName
        ? `Se quiser, adicione uma justificativa para aparecer na ficha de ${currentApprovalUserName}.`
        : "Se quiser, adicione uma justificativa para aparecer na ficha.";
    }
    window.setTimeout(() => {
      rejectVoteReasonField?.focus();
    }, 30);
  }

  function closeRejectVoteModal() {
    if (!rejectVoteModal) return;
    rejectVoteModal.hidden = true;
    if (rejectVoteForm) {
      rejectVoteForm.action = "";
    }
    if (rejectVoteReasonField) {
      rejectVoteReasonField.value = "";
      rejectVoteReasonField.disabled = false;
    }
    if (rejectVoteSubmit) {
      rejectVoteSubmit.disabled = false;
    }
    syncBodyModalState();
  }

  function closeApprovalModal() {
    approvalLoadToken += 1;
    approvalModal.hidden = true;
    closeRejectVoteModal();
    syncBodyModalState();
    setApprovalBusyState(false);
    setApprovalError("");
  }

  function renderRejectReasons(reasons = []) {
    if (!reasonsWrap || !reasonsList) return;

    if (!Array.isArray(reasons) || !reasons.length) {
      reasonsWrap.hidden = true;
      reasonsList.innerHTML = "";
      return;
    }

    reasonsWrap.hidden = false;
    reasonsList.innerHTML = reasons
      .map((item) => {
        const adminNome = escapeHtml(item?.adminNome || "Administrador");
        const motivo = escapeHtml(item?.motivo || "");
        const data = formatDateTime(item?.updatedAt);
        return `
          <article class="aprovacao-reason-card">
            <div class="aprovacao-reason-card-head">
              <strong>${adminNome}</strong>
              <span>${escapeHtml(data)}</span>
            </div>
            <p>${motivo || "-"}</p>
          </article>
        `;
      })
      .join("");
  }

  function renderLevelVotes(levelVotes = [], leaderLevel = null) {
    if (!levelVotesWrap || !levelVotesList || !levelLeaderPill) return;

    if (!Array.isArray(levelVotes) || !levelVotes.length) {
      levelVotesWrap.hidden = true;
      levelVotesList.innerHTML = "";
      levelLeaderPill.textContent = "Nenhum nivel lider";
      return;
    }

    levelVotesWrap.hidden = false;
    levelLeaderPill.textContent = leaderLevel?.label
      ? `Nivel lider: ${leaderLevel.label}`
      : "Nenhum nivel lider";

    levelVotesList.innerHTML = levelVotes
      .map((item) => {
        const isLeader = !!item?.isLeader;
        const isTiedLeader = !!item?.isTiedLeader;
        const leaderClass = isTiedLeader ? "is-tied" : isLeader ? "is-leader" : "";
        return `
          <article class="aprovacao-level-card ${leaderClass}">
            <strong>${escapeHtml(item?.label || "-")}</strong>
            <span>${escapeHtml(String(item?.count || 0))} voto(s)</span>
          </article>
        `;
      })
      .join("");
  }

  function populateApprovalModal(data) {
    const isVolunteer = String(data?.tipoCadastro || "").trim().toLowerCase() === "voluntario";
    const approveVotes = Number(data?.votosResumo?.aprovar || 0);
    const rejectVotes = Number(data?.votosResumo?.rejeitar || 0);
    const actorVote = String(data?.votosResumo?.actorVote || "").trim().toLowerCase();
    const actorLevelVote = String(data?.votosResumo?.actorLevelVote || "").trim();
    const workflowResumo = data?.workflowResumo || {};

    currentApprovalUserId = String(data?._id || "").trim();
    currentApprovalUserName = String(data?.nome || "").trim();

    setApprovalField("nome", data?.nome);
    setApprovalField("email", data?.email);
    setApprovalField("login", data?.login);
    setApprovalField("telefone", data?.telefone);
    setApprovalField("cpf", data?.cpf);
    setApprovalField("tipoCadastroLabel", data?.tipoCadastroLabel);
    setApprovalField("perfilLabel", data?.perfilLabel);
    setApprovalField("createdAtLabel", formatDateTime(data?.createdAt));
    setApprovalField("statusAprovacaoLabel", data?.statusAprovacaoLabel);
    setApprovalField("approveVotesLabel", String(approveVotes));
    setApprovalField("rejectVotesLabel", String(rejectVotes));
    setApprovalField("actorVoteLabel", formatVoteLabel(data?.votosResumo?.actorVote));
    setApprovalField("workflowStateLabel", workflowResumo?.stateLabel || "Coletando votos");
    setApprovalField("presidentNameLabel", workflowResumo?.president?.nome || "-");
    setApprovalField(
      "pendingRegularVotesLabel",
      formatPendingVotesLabel(
        workflowResumo?.pendingRegularVotes || 0,
        workflowResumo?.pendingRegularApproverNames || []
      )
    );

    if (voteCountFields.aprovar) {
      voteCountFields.aprovar.textContent = String(approveVotes);
    }

    if (voteCountFields.rejeitar) {
      voteCountFields.rejeitar.textContent = String(rejectVotes);
    }

    if (approveVoteButton) {
      approveVoteButton.classList.toggle("is-active", actorVote === "aprovar");
    }

    if (rejectVoteButton) {
      rejectVoteButton.classList.toggle("is-active", actorVote === "rejeitar");
    }

    if (approvalDescription) {
      approvalDescription.textContent = isVolunteer
        ? "Revise o cadastro completo e defina o nivel desse voluntario antes da aprovacao."
        : "Revise o cadastro completo e decida se o acesso deve ser liberado.";
    }

    if (actorVotePill) {
      actorVotePill.textContent =
        actorVote === "aprovar" && actorLevelVote
          ? `${formatVoteLabel(actorVote)} - ${formatLevelValueLabel(actorLevelVote)}`
          : formatVoteLabel(actorVote);
    }

    if (approveVoteForm) {
      approveVoteForm.action = `/acessos/${data?._id}/votar`;
    }

    if (rejectVoteForm) {
      rejectVoteForm.action = `/acessos/${data?._id}/votar`;
    }

    if (accessWrap) {
      accessWrap.hidden = !isVolunteer;
    }

    if (accessSelect) {
      accessSelect.required = isVolunteer;
      accessSelect.value = isVolunteer ? String(data?.nivelAcessoVoluntario || "") : "";
    }

    renderRejectReasons(data?.rejeicoesComMotivo || []);

    if (isVolunteer) {
      renderLevelVotes(workflowResumo?.levelVotes || [], workflowResumo?.leaderLevel || null);
    } else if (levelVotesWrap) {
      levelVotesWrap.hidden = true;
      if (levelVotesList) {
        levelVotesList.innerHTML = "";
      }
      if (levelLeaderPill) {
        levelLeaderPill.textContent = "Nenhum nivel lider";
      }
    }
  }

  openApprovalModal = async function handleOpenApprovalModal(userId) {
    if (!userId || approvalBusy) return;

    const requestToken = approvalLoadToken + 1;
    approvalLoadToken = requestToken;
    resetApprovalModal();
    showApprovalModal();
    setApprovalBusyState(true);

    try {
      const data = await requestJson(`/acessos/${userId}/detalhe`);
      if (requestToken !== approvalLoadToken) return;
      populateApprovalModal(data);
    } catch (error) {
      if (requestToken !== approvalLoadToken) return;
      setApprovalError(error?.message || "Erro ao carregar a ficha de aprovacao.");
      if (approvalDescription) {
        approvalDescription.textContent =
          "Nao foi possivel carregar os dados completos deste cadastro agora.";
      }
    } finally {
      if (requestToken === approvalLoadToken) {
        setApprovalBusyState(false);
      }
    }
  };

  approvalCloseButtons.forEach((button) => {
    button.addEventListener("click", () => closeApprovalModal());
  });

  rejectVoteCloseButtons.forEach((button) => {
    button.addEventListener("click", () => closeRejectVoteModal());
  });

  approvalModal.addEventListener("click", (event) => {
    if (event.target === approvalModal.querySelector(".acessos-modal-backdrop")) {
      closeApprovalModal();
    }
  });

  rejectVoteModal?.addEventListener("click", (event) => {
    if (event.target === rejectVoteModal.querySelector(".acessos-modal-backdrop")) {
      closeRejectVoteModal();
    }
  });

  rejectVoteButton?.addEventListener("click", () => {
    openRejectVoteModal();
  });

  approveVoteForm?.addEventListener("submit", () => {
    if (approveVoteButton) {
      approveVoteButton.disabled = true;
    }
  });

  rejectVoteForm?.addEventListener("submit", () => {
    if (rejectVoteSubmit) {
      rejectVoteSubmit.disabled = true;
    }
    if (rejectVoteReasonField) {
      rejectVoteReasonField.disabled = true;
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (rejectVoteModal && !rejectVoteModal.hidden) {
      closeRejectVoteModal();
      return;
    }
    if (!approvalModal.hidden) {
      closeApprovalModal();
    }
  });
})();
