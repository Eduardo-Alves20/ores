const API = {
  card: {
    move: async (boardId, cardId, newListId, newIndex) => {
      try {
        await fetch(`/board/${boardId}/card/${cardId}/move`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            newListId: newListId,
            newIndex: newIndex,
          }),
        });
      } catch (error) {
        console.error("Erro ao salvar:", error);
        showToast("Erro ao mover cartão. Recarregue a página.", "error");
      }
    },
    update: async (boardId, currentCardId, payload) => {
      try {
        const response = await fetch(`/board/${boardId}/card/${currentCardId}/update`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (response.ok) {
            closeEditModal();
            const cardElement = document.querySelector(`[data-card-id="${currentCardId}"]`);
            if (cardElement) {
                updateCardVisuals(cardElement, data.card); 
            }
            console.log("Salvo com sucesso!");
        } else {
            alert("Erro ao salvar: " + data.error);
        }
      } catch (error) {
        console.error("Erro na requisição:", error);
      }
    },
    delete: async(currentCardId, boardId, cardId) => {
      if (!currentCardId) return;
      try {
        const response = await fetch(`/board/${boardId}/card/${cardId}/delete`, { method: 'POST' });

        if (response.ok) {
            closeEditModal();

            // Remove o card da tela imediatamente
            const cardElement = document.querySelector(`[data-card-id="${currentCardId}"]`);
            if (cardElement) {
                cardElement.remove();
            }
            
            console.log("Card deletado com sucesso!");
        } else {
            showSweet("Erro", "Erro ao excluir cartão.", "error");
        }
      } catch (error) {
        console.error("Erro:", error);
        alert("Erro de conexão.");
      }
    },
    assign: async (currentCardIdForChecklist, userId, isSelected) => {
      try {
        const response = await fetch(`/card/${currentCardIdForChecklist}/assign`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId }),
        });

        const data = await response.json();
        if (data.success) {
          const cardElement = document.querySelector(`[data-card-id="${currentCardId}"]`);
          
          if (cardElement && data.card) {
              updateCardVisuals(cardElement, data.card);
          }
        }
      } catch (error) {
        console.error(error);
        check.style.display = isSelected ? "flex" : "none";
        avatar.style.opacity = isSelected ? "1" : "0.5";
        showToast("Erro ao vincular membro.", "error");
      }
    },
    uploadCover: async (boardId, currentCardId, formData) => {
      try {
        const response = await fetch(`/board/${boardId}/card/${currentCardId}/cover`, {
            method: 'POST',
            body: formData,
        });

        if (response.ok) {
            // Atualiza preview localmente ou espera o socket
            const data = await response.json();
            
            document.getElementById("cover-preview-img").src = data.updatedCard.coverImage;
            document.getElementById("cover-preview-area").style.display = "block";
            document.getElementById("upload-cover-form").style.display = "none";

            // Atualiza o card na lista.
            const cardElement = document.querySelector(`[data-card-id="${currentCardId}"]`);
            if (cardElement) {
                updateCardVisuals(cardElement, data.updatedCard);
            }
        }

      } catch (error) {
        console.error(error);
        showToast(error.message, "error");
      }
    },

    deleteCover: async (boardId, currentCardId) => {
      try {
        const response = await fetch(`/board/${boardId}/card/${currentCardId}/cover/delete`, { method: 'POST' });

        const data = await response.json();
        console.log("Dados vindos da deleção do cover: ", data);
        
        if (response.ok) {
            // Atualiza o Modal
            document.getElementById("cover-preview-area").style.display = "none";
            document.getElementById("upload-cover-form").style.display = "block";
            document.getElementById("cover-preview-img").src = "";

            // Atualiza a lista em tempo real
            const cardElement = document.querySelector(`[data-card-id="${currentCardId}"]`);
            
            const realCard = data.card || data.updatedCard;
            
            if (cardElement && realCard) {
                updateCardVisuals(cardElement, realCard);
            }
        }
      } catch (error) {
        console.error(error);
        showToast(error.message, "error");
      }
    },

    uploadAttachment: async (currentCardIdForChecklist, formData) => {
      try {
        const response = await fetch(
          `/card/${currentCardIdForChecklist}/attachment`,
          {
            method: "POST",
            body: formData,
          },
        );
        const data = await response.json();

        return data
      } catch (error) {
        console.error(error);
        showToast(error.message, "error");
      }
    },
    deleteAttachment: async (currentCardIdForChecklist, filename) => {
      try {
        const response = await fetch(
          `/card/${currentCardIdForChecklist}/attachment/${filename}`,
          {
            method: "POST",
          },
        );

        const data = await response.json();
        return data;
      } catch (error) {
        showToast("Erro ao excluir.", "error");
      }
    },
    addChecklistItem: async (currentCardIdForChecklist, text) => {
      try {
        const res = await fetch(
          `/card/${currentCardIdForChecklist}/checklist`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text }),
          },
        );
        const data = await res.json();

        if (data.success) {
          return data;
        }
      } catch (error) {
        console.error(error);
        showToast(error, "error");
      }
    },
    toggleItem: async (currentCardIdForChecklist, itemId, isChecked) => {
      try {
        await fetch(
          `/card/${currentCardIdForChecklist}/checklist/${itemId}/update`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ done: isChecked }),
          },
        );
      } catch (error) {
        console.error(error);
        showToast(error, "error");
      }
    },
    deleteItem: async (currentCardIdForChecklist, itemId) => {
      try {
        await fetch(
          `/card/${currentCardIdForChecklist}/checklist/${itemId}/delete`,
          {
            method: "POST",
          },
        );
      } catch (error) {
        console.error(error);
        showToast(error, "error");
      }
    },
  },

  list: {
    move: async (listId, boardId, newIndex) => {
      try {
        await fetch(`/board/${boardId}/list/${listId}/move`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            newIndex: newIndex,
          }),
        });
      } catch (error) {
        console.error(error);
        showToast(error, "error");
      }
    },
    create: async (boardId, title) => {
      try {
          const response = await fetch(`/board/${boardId}/list`, { 
              method: 'POST', 
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({title}) 
          });

          const data = await response.json();

          if (response.ok) {
              hideListForm();
              // Limpa o input
              document.querySelector("#title").value = ""; 
              // RETORNA OS DADOS PARA QUEM CHAMOU
              return data; 
          }
          
      } catch (error) {
          console.error("Erro na requisição:", error);
      }
    },
    update: async (boardId, listId, titleDisplay, titleInput, newTitle) => {
      try {
         // Atualiza a interface IMEDIATAMENTE
        titleDisplay.innerText = newTitle;
        titleInput.style.display = 'none';
        titleDisplay.style.display = 'block';

        await fetch(`/board/${boardId}/list/${listId}/update`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: newTitle }) 
        });
      } catch (error) {
        console.error("Erro ao renomear lista:", error);
        titleDisplay.innerText = titleInput.defaultValue; 
        alert("Erro ao salvar o nome da lista.");
      }
    },
    delete: async (boardId, listId) => {
      try {
        await fetch(`/board/${boardId}/list/${listId}/delete`, { method: 'POST',});
        window.location.reload()
      } catch (error) {
        console.error(error);
        alert("Erro ao excluir lista");
      }
    },
  },

  invite: {
    search: async (query) => {
      try {
        // Chama sua API
        const res = await fetch(
          `/api/users/search?q=${encodeURIComponent(query)}`,
        );
        const users = await res.json();

        return users;
      } catch (error) {
        console.error(error);
        showToast(error, "error");
      }
    },
    updateMember: async (boardId, userId, newRole) => {
      try {
        const res = await fetch(`/board/${boardId}/member/${userId}/role`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: newRole }),
        });

        if (res.ok) {
          showToast("Permissão atualizada!", "success", function () {
            window.location.reload();
          });
        } else {
          const data = await res.json();
          console.error(data.error);
          showToast(data.error || "Erro ao atualizar", "error");
        }
      } catch (error) {
        console.error(error);
        showToast(error, "error");
      }
    },

    removeMember: async (boardId, userId) => {
      try {
        const res = await fetch(`/board/${boardId}/member/${userId}`, {
          method: "POST",
        });

        if (res.ok) {
          showToast("Membro removido", "success", function () {
            window.location.reload();
          });
        } else {
          const data = await res.json();
          showToast(data.error || "Erro ao atualizar", "error");
        }
      } catch (error) {
        console.error(error);
        showToast(error, "error");
      }
    },
  },

  board: {
    update: async (title, color, boardId) => {
      try {
        const res = await fetch(`/board/${boardId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, color }),
        });

        const data = await res.json();

        if (data.success) {
          closeSettingsModal();

          updateBoardVisuals(data.board);

          console.log("Configurações salvas com sucesso!");
        } else {
          showToast(data.error || "Erro ao atualizar", "error");
        }
      } catch (error) {
        console.error(error);
        showToast("Erro de conexão", "error");
      }
    },

    delete: async (boardId) => {
      try {
        const res = await fetch(`/board/${boardId}/delete`, { method: "POST" });
        if (res.ok) {
          window.location.href = "/"; // Volta para a home
        } else {
          showToast("Erro ao excluir", "error");
        }
      } catch (e) {
        showToast("Erro de conexão", "error");
      }
    },

    findMembersForMention: async (boardId, searchTerm) => {
      const response = await fetch(`/${boardId}/mentions/members?query=${searchTerm}`);
      const data = await response.json();
      return data
    },

    findCardsForMention: async (boardId, searchTerm) => {
      const response = await fetch(`/${boardId}/mentions/cards?query=${searchTerm}`);
      const data = await response.json();
      return data
    }
  },
};
