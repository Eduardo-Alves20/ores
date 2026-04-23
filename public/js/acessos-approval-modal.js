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
    const rejectVoteForm = approvalModal.querySelector("[data-approval-vote-reject-form]");
    const rejectVoteButton = approvalModal.querySelector("[data-approval-vote-btn='rejeitar']");
    const accessHiddenFields = approvalModal.querySelectorAll("[data-approval-access-hidden]");
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

    let approvalLoadToken = 0;
    let approvalBusy = false;
    let currentApprovalUserId = "";
    let currentApprovalUserName = "";
    let lastFocusedElement = null;

    function formatDateTime(value) {
      if (!value) return "-";
      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime())) return "-";
      return parsed.toLocaleString("pt-BR");
    }

    function formatDateLabel(value) {
      const text = String(value || "").trim();
      if (!text) return "-";
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(text)) return text;
      if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
        const [year, month, day] = text.split("-");
        return `${day}/${month}/${year}`;
      }
      const parsed = new Date(text);
      if (Number.isNaN(parsed.getTime())) return text;
      return parsed.toLocaleDateString("pt-BR");
    }

    function formatVoteLabel(value) {
      const normalized = String(value || "").trim().toLowerCase();
      if (normalized === "aprovado" || normalized === "aprovar") return "Aprovado";
      if (normalized === "rejeitado" || normalized === "rejeitar") return "Rejeitado";
      return "Pendente";
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

    function getFocusableElements(container) {
      if (!container) return [];
      return Array.from(
        container.querySelectorAll(
          'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter(
        (element) =>
          element instanceof HTMLElement &&
          !element.hasAttribute("hidden") &&
          element.getAttribute("aria-hidden") !== "true"
      );
    }

    function focusFirstElement(container) {
      const focusable = getFocusableElements(container);
      if (!focusable.length) return;
      focusable[0].focus();
    }

    function trapTabNavigation(event, container) {
      if (event.key !== "Tab") return;
      const focusable = getFocusableElements(container);
      if (!focusable.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    async function confirmVoteAction(decision) {
      const normalizedDecision = String(decision || "").trim().toLowerCase();
      const actionLabel = normalizedDecision === "rejeitar" ? "rejeitar" : "aprovar";
      const title =
        actionLabel === "rejeitar"
          ? "Confirmar rejeição?"
          : "Confirmar aprovação?";
      const text = currentApprovalUserName
        ? `Você está prestes a ${actionLabel} o cadastro de ${currentApprovalUserName}.`
        : `Você está prestes a ${actionLabel} este cadastro.`;

      if (window.Swal && typeof window.Swal.fire === "function") {
        const result = await window.Swal.fire({
          title,
          text,
          icon: "question",
          showCancelButton: true,
          confirmButtonText:
            actionLabel === "rejeitar" ? "Sim, rejeitar" : "Sim, aprovar",
          cancelButtonText: "Cancelar",
        });
        return !!result?.isConfirmed;
      }

      return window.confirm(`${title}\n\n${text}`);
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

    function extractSignupData(data) {
      const source =
        data?.dadosCadastroResumo && typeof data.dadosCadastroResumo === "object"
          ? data.dadosCadastroResumo
          : data?.dadosCadastro && typeof data.dadosCadastro === "object"
            ? data.dadosCadastro
            : {};

      return {
        dataNascimento:
          source?.data_nascimento ||
          source?.dataNascimento ||
          source?.nascimento ||
          "",
        funcaoNaOng:
          source?.funcao_na_ong ||
          source?.funcaoNaOng ||
          source?.funcao ||
          "",
      };
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

    function syncSelectedAccessToForms() {
      const levelValue = accessSelect ? String(accessSelect.value || "").trim() : "";
      accessHiddenFields.forEach((input) => {
        input.value = levelValue;
      });
      return levelValue;
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

      if (accessWrap) {
        accessWrap.hidden = true;
      }
      if (accessSelect) {
        accessSelect.value = "";
        accessSelect.required = false;
      }
      syncSelectedAccessToForms();
      if (approvalDescription) {
        approvalDescription.textContent = "Carregando ficha do cadastro...";
      }
      if (actorVotePill) {
        actorVotePill.textContent = "Aguardando decisao";
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
      if (!lastFocusedElement && document.activeElement instanceof HTMLElement) {
        lastFocusedElement = document.activeElement;
      }
      approvalModal.hidden = false;
      syncBodyModalState();
      const dialog = approvalModal.querySelector(".acessos-modal-dialog");
      window.setTimeout(() => {
        focusFirstElement(dialog);
      }, 20);
    }

    function closeApprovalModal() {
      approvalLoadToken += 1;
      const shouldRestoreFocus = !approvalModal.hidden;
      approvalModal.hidden = true;
      syncBodyModalState();
      setApprovalBusyState(false);
      setApprovalError("");
      if (shouldRestoreFocus && lastFocusedElement instanceof HTMLElement) {
        lastFocusedElement.focus();
      }
      lastFocusedElement = null;
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
            <span>${escapeHtml(String(item?.count || 0))} registro(s)</span>
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
      const signupData = extractSignupData(data);

      currentApprovalUserId = String(data?._id || "").trim();
      currentApprovalUserName = String(data?.nome || "").trim();

      setApprovalField("nome", data?.nome);
      setApprovalField("email", data?.email);
      setApprovalField("login", data?.login);
      setApprovalField("tipoCadastroLabel", data?.tipoCadastroLabel);
      setApprovalField("dataNascimentoLabel", formatDateLabel(signupData.dataNascimento));
      setApprovalField("funcaoNaOngLabel", signupData.funcaoNaOng);

      if (approvalDescription) {
        approvalDescription.textContent = isVolunteer
          ? "Revise os dados enviados no cadastro, escolha o nivel e aprove ou nao."
          : "Revise os dados enviados no cadastro e decida se o acesso deve ser liberado.";
      }

      if (approveVoteForm) {
        approveVoteForm.action = `/acessos/${data?._id}/aprovar`;
      }

      if (rejectVoteForm) {
        rejectVoteForm.action = `/acessos/${data?._id}/rejeitar`;
      }

      if (accessWrap) {
        accessWrap.hidden = !isVolunteer;
      }

      if (accessSelect) {
        accessSelect.required = isVolunteer;
        accessSelect.value = isVolunteer ? String(data?.nivelAcessoVoluntario || "") : "";
      }
      syncSelectedAccessToForms();
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

    approvalModal.addEventListener("click", (event) => {
      if (event.target === approvalModal.querySelector(".acessos-modal-backdrop")) {
        closeApprovalModal();
      }
    });

    approveVoteForm?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const isVolunteer = !accessWrap?.hidden;
      const selectedAccessLevel = syncSelectedAccessToForms();
      if (isVolunteer && !selectedAccessLevel) {
        setApprovalError("Selecione o nivel do voluntario antes de aprovar.");
        if (accessSelect) {
          accessSelect.focus();
        }
        return;
      }
      const confirmed = await confirmVoteAction("aprovar");
      if (!confirmed) return;
      setApprovalError("");
      if (approveVoteButton) {
        approveVoteButton.disabled = true;
      }
      approveVoteForm.submit();
    });

    rejectVoteForm?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const confirmed = await confirmVoteAction("rejeitar");
      if (!confirmed) return;
      setApprovalError("");
      if (rejectVoteButton) {
        rejectVoteButton.disabled = true;
      }
      rejectVoteForm.submit();
    });

    accessSelect?.addEventListener("change", () => {
      syncSelectedAccessToForms();
      setApprovalError("");
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Tab") {
        if (!approvalModal.hidden) {
          trapTabNavigation(event, approvalModal.querySelector(".acessos-modal-dialog"));
        }
      }

      if (event.key !== "Escape") return;
      if (!approvalModal.hidden) {
        closeApprovalModal();
      }
    });

    return {
      openApprovalModal,
    };
  };
})();
