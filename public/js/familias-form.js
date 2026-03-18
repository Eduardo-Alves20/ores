(function () {
  const shared = window.FamiliasShared;
  if (!shared) return;

  const { parseJsonScript, requestJson } = shared;

  function init(root) {
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
      const camposExtras = {};
      form.querySelectorAll("[data-custom-field-key]").forEach((field) => {
        const key = String(field.getAttribute("data-custom-field-key") || "").trim();
        const type = String(field.getAttribute("data-custom-field-type") || "texto").trim();
        if (!key) return;
        if (type === "booleano") {
          camposExtras[key] = String(field.value || "").trim() === "true";
          return;
        }
        camposExtras[key] = String(field.value || "").trim();
      });

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
        camposExtras,
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

  window.FamiliasFormPage = { init };
})();
