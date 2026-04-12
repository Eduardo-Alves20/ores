(function () {
  window.initAcessosApprovalModal = function initAcessosApprovalModal({
    root,
    requestJson,
    syncBodyModalState,
  }) {
    const approvalModal = root.querySelector("[data-approval-modal]");
    if (!approvalModal) {
      return {
        openApprovalModal: async () => {},
      };
    }

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
    const sensitiveWrap = approvalModal.querySelector("[data-approval-sensitive-wrap]");
    const attachmentMetaFields = Array.from(
      approvalModal.querySelectorAll("[data-approval-attachment-meta]")
    ).reduce((acc, element) => {
      const key = String(element.getAttribute("data-approval-attachment-meta") || "").trim();
      if (key) acc[key] = element;
      return acc;
    }, {});
    const attachmentNoteFields = Array.from(
      approvalModal.querySelectorAll("[data-approval-attachment-note]")
    ).reduce((acc, element) => {
      const key = String(element.getAttribute("data-approval-attachment-note") || "").trim();
      if (key) acc[key] = element;
      return acc;
    }, {});
    const attachmentLinkFields = Array.from(
      approvalModal.querySelectorAll("[data-approval-attachment-link]")
    ).reduce((acc, element) => {
      const key = String(element.getAttribute("data-approval-attachment-link") || "").trim();
      if (key) acc[key] = element;
      return acc;
    }, {});
    const attachmentPreviewFields = Array.from(
      approvalModal.querySelectorAll("[data-approval-attachment-preview]")
    ).reduce((acc, element) => {
      const key = String(element.getAttribute("data-approval-attachment-preview") || "").trim();
      if (key) acc[key] = element;
      return acc;
    }, {});

    const rejectVoteModal = root.querySelector("[data-reject-vote-modal]");
    const rejectVoteCloseButtons =
      rejectVoteModal?.querySelectorAll("[data-reject-vote-close]") || [];
    const rejectVoteDescription =
      rejectVoteModal?.querySelector("[data-reject-vote-description]") || null;
    const rejectVoteForm =
      rejectVoteModal?.querySelector("[data-approval-reject-vote-form]") || null;
    const rejectVoteReasonField = rejectVoteForm?.querySelector("[name='motivo']") || null;
    const rejectVoteSubmit = rejectVoteForm?.querySelector("button[type='submit']") || null;

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
      if (sensitiveWrap) {
        sensitiveWrap.hidden = true;
      }
      Object.keys(attachmentMetaFields).forEach((key) => {
        attachmentMetaFields[key].textContent = "Nao enviado";
      });
      Object.keys(attachmentNoteFields).forEach((key) => {
        attachmentNoteFields[key].textContent =
          key === "fotoPerfil"
            ? "Foto usada para validacao visual e futura identificacao interna."
            : "Aceita RG ou CNH em PDF ou imagem.";
      });
      Object.keys(attachmentLinkFields).forEach((key) => {
        attachmentLinkFields[key].hidden = true;
        attachmentLinkFields[key].setAttribute("href", "#");
      });
      Object.keys(attachmentPreviewFields).forEach((key) => {
        attachmentPreviewFields[key].hidden = true;
        attachmentPreviewFields[key].setAttribute("src", "");
      });
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

    function renderProtectedAttachments(attachments = {}) {
      const documentAsset = attachments?.documentoIdentidade || null;
      const profilePhotoAsset = attachments?.fotoPerfil || null;
      const hasAnyAttachment = !!(documentAsset || profilePhotoAsset);

      if (sensitiveWrap) {
        sensitiveWrap.hidden = !hasAnyAttachment;
      }

      [
        { key: "documentoIdentidade", asset: documentAsset },
        { key: "fotoPerfil", asset: profilePhotoAsset },
      ].forEach(({ key, asset }) => {
        const metaField = attachmentMetaFields[key];
        const noteField = attachmentNoteFields[key];
        const linkField = attachmentLinkFields[key];
        const previewField = attachmentPreviewFields[key];

        if (!asset) {
          if (metaField) metaField.textContent = "Nao enviado";
          if (noteField) {
            noteField.textContent =
              key === "fotoPerfil"
                ? "Foto usada para validacao visual e futura identificacao interna."
                : "Aceita RG ou CNH em PDF ou imagem.";
          }
          if (linkField) {
            linkField.hidden = true;
            linkField.setAttribute("href", "#");
          }
          if (previewField) {
            previewField.hidden = true;
            previewField.setAttribute("src", "");
          }
          return;
        }

        if (metaField) {
          metaField.textContent = [asset.originalName || "", asset.sizeLabel || ""]
            .filter(Boolean)
            .join(" - ");
        }

        if (noteField) {
          noteField.textContent =
            key === "fotoPerfil"
              ? "Uso futuro para perfil interno e cracha, com acesso restrito neste fluxo."
              : "Documento protegido para conferencia de identidade antes da aprovacao.";
        }

        if (linkField) {
          linkField.hidden = !asset.viewUrl;
          linkField.setAttribute("href", asset.viewUrl || "#");
        }

        if (previewField) {
          const canPreviewImage = !!asset.viewUrl && !!asset.isImage;
          previewField.hidden = !canPreviewImage;
          previewField.setAttribute("src", canPreviewImage ? asset.viewUrl : "");
        }
      });
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

      renderProtectedAttachments(data?.anexosProtegidos || {});
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

    async function openApprovalModal(userId) {
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
    }

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

    return {
      openApprovalModal,
    };
  };
})();
