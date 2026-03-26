const Card = require("../models/Card");
const List = require("../models/List");
const User = require("../models/User");
const mongoose = require("mongoose");
const Board = require("../models/Board");
const { getUserRoleInBoard } = require("../services/getUserRoleInBoard");
const {
  createAccessError,
  normalizeObjectId,
  resolveScopedAccess,
} = require("../services/resourceAccessService");
const {
  safeUnlinkAbsolutePath,
  safeUnlinkUploadUrl,
  sanitizeOriginalFilename,
} = require("../services/uploadSecurityService");

function normalizeRequiredText(value, label, maxLength = 160) {
  const normalized = String(value || "").trim();
  if (!normalized) {
    throw createAccessError(`${label} obrigatorio.`, 400);
  }
  if (normalized.length > maxLength) {
    throw createAccessError(`${label} excede o limite permitido.`, 400);
  }
  return normalized;
}

function normalizeBooleanFlag(value, label) {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  throw createAccessError(`${label} invalido.`, 400);
}

function normalizeDueDate(value) {
  if (!value || !String(value).trim()) return null;
  const normalized = String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    throw createAccessError("Data invalida.", 400);
  }
  const parsed = new Date(`${normalized}T12:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw createAccessError("Data invalida.", 400);
  }
  return parsed;
}

async function ensureCardMutationAccess(cardId, userId, requiredRole = "editor") {
  const access = await resolveScopedAccess({
    cardId,
    userId,
    requiredRole,
  });
  return access.card;
}

async function moveCard(req, res) {
  try {
    const { boardId, cardId } = req.params;
    const targetListId = normalizeObjectId(req.body?.newListId, "Lista de destino");
    const parsedIndex = Number.parseInt(String(req.body?.newIndex ?? ""), 10);

    if (!Number.isInteger(parsedIndex) || parsedIndex < 0) {
      return res.status(400).json({ error: "Posicao de destino invalida." });
    }

    const targetList = await List.findOne({ _id: targetListId, boardId })
      .select("_id")
      .lean();
    if (!targetList) {
      return res.status(404).json({ error: "Lista de destino nao encontrada." });
    }

    // Buscando todos os cards da lista de DESTINO, ordenados
    const cardsInList = await Card.find({ listId: targetList._id, boardId }).sort({
      position: 1,
    });

    // Remove o card que ESTA movendo dessa lista
    const cleanCards = cardsInList.filter(
      (card) => card._id.toString() !== cardId,
    );

    let newPosition;

    // CÁLCULO DA POSIÇÃO
    if (cleanCards.length === 0) {
      // A lista estava vazia
      newPosition = 10000;
    } else if (parsedIndex === 0) {
      // O card foi para o topo da lista
      // Pega a posição do primeiro e dividimos por 2
      newPosition = cleanCards[0].position / 2;
    } else if (parsedIndex >= cleanCards.length) {
      //  O card foi para o final da lista
      // Pega o último e somamos um valor arbitrário (ex: 10000)
      newPosition = cleanCards[cleanCards.length - 1].position + 10000;
    } else {
      // O card foi para o meio de dois outros
      const prevCardPosition = cleanCards[parsedIndex - 1].position;
      const nextCardPosition = cleanCards[parsedIndex].position;
      newPosition = (prevCardPosition + nextCardPosition) / 2;
    }

    // Atualiza no Banco
    await Card.findOneAndUpdate({ _id: cardId, boardId }, {
      listId: targetList._id,
      position: newPosition,
    });

    await Board.findByIdAndUpdate(boardId, { updatedAt: new Date() });
    
    req.io.to(boardId).emit('cardMoved', {
        cardId: cardId,
        newListId: String(targetList._id),
        newIndex: parsedIndex,
        senderId: req.session.userId // Pra saber quem moveu
    });

    res.status(200).json({ success: true, newPosition });
  } catch (error) {
    console.error("Erro ao mover:", error);
    res.status(500).json({ error: "Erro ao mover cartão" });
  }
}

async function createCard(req, res) {
  try {
    const { boardId } = req.params;
    const title = normalizeRequiredText(req.body?.title, "Titulo do card");
    const listId = normalizeObjectId(req.body?.listId, "Lista");

    const userId = req.session.userId;
    const targetList = await List.findOne({ _id: listId, boardId }).select("_id").lean();
    if (!targetList) {
      return res.status(404).json({ error: "Lista nao encontrada." });
    }

    // Descobrir a última posição nesta lista
    const lastCard = await Card.findOne({ listId: targetList._id, boardId }).sort({ position: -1 });
    const newPosition = lastCard ? lastCard.position + 1000 : 1000;

    // Criando
    const newCard = await Card.create({
      title,
      listId: targetList._id,
      boardId,
      position: newPosition,
    });

    const board = await Board.findByIdAndUpdate(boardId, { updatedAt: new Date() });
    const myRole = getUserRoleInBoard(board, userId);

    req.app.render('pages/board/partials/card', {
      card: newCard,
      myRole,
    }, (err, html) => {
      if (err) {
          console.error("Erro ao renderizar o Card:", err);
          return;
      }

      // Emite o HTML PRONTO via Socket
      if (req.io) {
          req.io.to(boardId).emit('cardCreated', { 
              listId: String(targetList._id),
              html,
              card: newCard,
              senderId: req.session.userId 
          });
      }
    });

    res.redirect(`/board/${boardId}`);
  } catch (error) {
    console.error("Erro ao criar card:", error);
    res.status(500).json({ error: "Erro ao criar um card" });
  }
}

async function updateCard(req, res) {
  try {
    const { boardId, cardId } = req.params;
    let { title, labels, description, dueDate } = req.body;

    // Normalização dos checkboxes
    if (!labels) {
      labels = []; // Nenhuma selecionada
    } else if (!Array.isArray(labels)) {
      labels = [labels]; // Uma selecionada (vira array de 1 item)
    }

    labels = labels
      .map((item) => String(item || "").trim())
      .filter((item) => /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(item));

    title = normalizeRequiredText(title, "Titulo do card");
    description = String(description || "").trim().slice(0, 20000);
    dueDate = normalizeDueDate(dueDate);

    const card = await Card.findOneAndUpdate({ _id: cardId, boardId }, {
      title,
      labels,
      description,
      dueDate,
    }, {new: true}).populate("assignees", "name email username");

    if (!card) {
      return res.status(404).json({ error: "Card nao encontrado" });
    }

    await Board.findByIdAndUpdate(card.boardId, { updatedAt: new Date() });

    if (req.io) {
      req.io.to(card.boardId.toString()).emit('cardUpdated', {
          cardId,
          updatedCard: card,
          updates: req.body,
          senderId: req.session.userId
      });
    }

    res.json({ success: true, card });
  } catch (error) {
    console.error("Erro ao atualizar:", error);
    res.status(error?.status || 500).json({ error: error?.message || "Erro ao atualizar cartao" });
  }
}

async function updateCardDate(req, res) {
  try {
    const { boardId, cardId } = req.params;
    const dueDate = normalizeDueDate(req.body?.date);

    // Atualiza a dueDate no banco
    const card = await Card.findOneAndUpdate(
      { _id: cardId, boardId },
      { dueDate },
      { new: true },
    );

    if (!card) return res.status(404).json({ error: "Card nao encontrado" });

    await Board.findByIdAndUpdate(card.boardId, { updatedAt: new Date() });

    if (req.io) {
      req.io.to(card.boardId).emit('cardUpdated', {
          cardId,
          updatedCard: card,
          updates: req.body,
          senderId: req.session.userId
      });
    }

    res.json({ success: true, date: card.dueDate });
  } catch (error) {
    console.error("Erro ao mover card no calendário:", error);
    res.status(error?.status || 500).json({ error: error?.message || "Erro ao atualizar data" });
  }
}

async function deleteCard(req, res) {
  try {
    const { boardId, cardId } = req.params;

    const deletedCard = await Card.findOneAndDelete({ _id: cardId, boardId });
    if (!deletedCard) {
      return res.status(404).json({ error: "Card nao encontrado" });
    }

    await Board.findByIdAndUpdate(deletedCard.boardId, { updatedAt: new Date() });

    if (req.io) {
      req.io.to(deletedCard.boardId.toString()).emit('cardDeleted', {
          cardId: cardId,
          listId: deletedCard.listId,
          senderId: req.session.userId
      });
    }

    res.json({ success: true, message: "Cartão deletado" });
  } catch (error) {
    console.error("Erro ao deletar:", error);
    res.status(error?.status || 500).json({ error: error?.message || "Erro ao deletar cartao" });
  }
}

async function uploadCover(req, res) {
  try {
    const { cardId } = req.params; // ID do Card


    if (!req.file) {
      return res.redirect("/");
    }

    const previousCard = await Card.findById(cardId).select("_id boardId coverImage").lean();
    if (!previousCard) {
      await safeUnlinkAbsolutePath(req.file.path).catch(() => {});
      return res.status(404).json({ error: "Card nÃ£o encontrado" });
    }

    // Montamos o caminho relativo para o HTML ler depois
    const imagePath = `/uploads/${req.file.filename}`;

    const updatedCard = await Card.findByIdAndUpdate(cardId, {
      coverImage: imagePath,
    }, { new: true });

    if (previousCard.coverImage && previousCard.coverImage !== imagePath) {
      await safeUnlinkUploadUrl(previousCard.coverImage).catch((error) => {
        console.log("Erro ao apagar arquivo antigo de capa:", error?.message || error);
      });
    }

    await Board.findByIdAndUpdate(updatedCard.boardId, { updatedAt: new Date() });

    if (req.io) {
      req.io.to(updatedCard.boardId.toString()).emit('cardUpdated', {
          cardId,
          updatedCard,
          senderId: req.session.userId
      });
    }

    res.json({ success: true, updatedCard });
  } catch (error) {
    console.error("Erro no upload:", error);
    res.redirect("/");
  }
}

async function removeCover(req, res) {
  try {
    const { cardId } = req.params;

    // Busca o cardpara guardar o caminho da imagem antes de apagar
    const oldCard = await Card.findById(cardId);
    if (!oldCard) return res.status(404).json({ error: "Card não encontrado" });
    const oldCoverPath = oldCard.coverImage;

    // Remove do banco e popula os dados
    const updatedCard = await Card.findByIdAndUpdate(
        cardId,
        { $unset: { coverImage: "" } },
        { new: true }
    ).populate("assignees", "name email username");

    if (oldCoverPath) {
      await safeUnlinkUploadUrl(oldCoverPath).catch((error) => {
        console.log("Erro ao apagar arquivo de capa:", error?.message || error);
      });
    }

    await Board.findByIdAndUpdate(updatedCard.boardId, { updatedAt: new Date() });

    // Emite para o WebSocket
    if (req.io) {
      req.io.to(updatedCard.boardId.toString()).emit('cardUpdated', {
          cardId,
          updatedCard: updatedCard,
          senderId: req.session.userId
      });
    }

    res.json({ success: true, card: updatedCard, updatedCard: updatedCard });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro interno ao remover capa" }); 
  }
}

async function addChecklistItem(req, res) {
  try {
    const { cardId } = req.params;
    const text = normalizeRequiredText(req.body?.text, "Item do checklist", 240);

    const card = await Card.findByIdAndUpdate(
      cardId,
      {
        $push: { checklist: { text, done: false } },
      },
      { new: true },
    ).select("checklist boardId");

    if (!card) {
      return res.status(404).json({ error: "Card nao encontrado" });
    }

    await Board.findByIdAndUpdate(card.boardId, { updatedAt: new Date() });

    res.json({ success: true, checklist: card.checklist });
  } catch (error) {
    res.status(500).json({ error: "Erro ao adicionar item" });
  }
}

async function toggleChecklistItem(req, res) {
  try {
    const { cardId, itemId } = req.params;
    const done = normalizeBooleanFlag(req.body?.done, "Status do checklist");
    if (!mongoose.Types.ObjectId.isValid(itemId)) {
      return res.status(400).json({ error: "Item do checklist invalido." });
    }

    // Atualizar um sub-documento específico no Mongo é chatinho, mas poderoso:
    const card = await Card.findOneAndUpdate(
      { _id: cardId, "checklist._id": itemId },
      { $set: { "checklist.$.done": done } },
      { new: true },
    );

    if (!card) {
      return res.status(404).json({ error: "Item do checklist nao encontrado." });
    }

    await Board.findByIdAndUpdate(card.boardId, { updatedAt: new Date() });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Erro ao atualizar item" });
  }
}

async function deleteChecklistItem(req, res) {
  try {
    const { cardId, itemId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(itemId)) {
      return res.status(400).json({ error: "Item do checklist invalido." });
    }

    const card = await Card.findByIdAndUpdate(cardId, {
      $pull: { checklist: { _id: itemId } },
    }, { new: true }).select("boardId");

    if (!card) {
      return res.status(404).json({ error: "Card nao encontrado" });
    }

    await Board.findByIdAndUpdate(card.boardId, { updatedAt: new Date() });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Erro ao remover item" });
  }
}

async function toggleAssignee(req, res) {
  try {
    const { cardId } = req.params;
    const userId = normalizeObjectId(req.body?.userId, "Usuario");
    const access = await resolveScopedAccess({
      cardId,
      userId: req.session?.userId,
      requiredRole: "editor",
    });

    const allowedUserIds = new Set(
      [
        access.board?.owner,
        ...(Array.isArray(access.board?.members)
          ? access.board.members.map((member) => member?.user)
          : []),
      ].map((value) => String(value || "")).filter(Boolean)
    );

    if (!allowedUserIds.has(userId)) {
      return res.status(400).json({ error: "Usuario fora do escopo do board." });
    }

    const userExists = await User.findById(userId).select("_id").lean();
    if (!userExists) {
      return res.status(404).json({ error: "Usuario nao encontrado." });
    }

    const card = await Card.findById(cardId);
    if (!card) {
      return res.status(404).json({ error: "Card nao encontrado" });
    }

    // Verifica se o usuário já está no array
    const index = card.assignees.findIndex(
      (assignedUserId) => String(assignedUserId || "") === userId
    );

    if (index > -1) {
      card.assignees.splice(index, 1);
    } else {
      card.assignees.push(userId);
    }

    await card.save();

    await Board.findByIdAndUpdate(card.boardId, { updatedAt: new Date() });

    await card.populate("assignees", "name email username");

    if (req.io) {
      req.io.to(card.boardId.toString()).emit('cardUpdated', {
          cardId: cardId,
          updatedCard: card,
          senderId: req.session.userId
      });
    }

    res.json({ success: true, card });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao vincular membro" });
  }
}

async function uploadAttachment(req, res) {
  try {
    const { cardId } = req.params;
    if (!req.file) {
      return res.status(400).json({ error: "Arquivo nÃ£o enviado" });
    }

    const cardSnapshot = await ensureCardMutationAccess(cardId, req.session.userId, "editor");
    const fixedName = Buffer.from(
      String(req.file.originalname || ""),
      "latin1"
    ).toString("utf8");

    const newAttachment = {
      originalName: sanitizeOriginalFilename(fixedName),
      filename: req.file.filename,
      path: `/uploads/attachments/${req.file.filename}`,
      mimetype: req.file.mimetype,
      size: req.file.size,
    };

    const card = await Card.findByIdAndUpdate(
      cardId,
      { $push: { attachments: newAttachment } },
      { new: true },
    ).populate("assignees", "name email username");

    await Board.findByIdAndUpdate(cardSnapshot.boardId, { updatedAt: new Date() });

    if (req.io) {
      req.io.to(card.boardId.toString()).emit('cardUpdated', {
          cardId: cardId,
          updatedCard: card,
          senderId: req.session.userId
      });
    }

    res.json({ success: true, card: card, attachment: newAttachment });
  } catch (error) {
    if (req.file?.path) {
      await safeUnlinkAbsolutePath(req.file.path).catch(() => {});
    }
    console.error(error);
    res.status(error?.status || 500).json({
      error: error?.message || "Erro ao enviar anexo",
    });
  }
}

async function deleteAttachmentLegacy(req, res) {
  try {
    const { cardId, filename } = req.params;
    const cardSnapshot = await ensureCardMutationAccess(cardId, req.session.userId, "editor");
    const attachment = (cardSnapshot.attachments || []).find(
      (item) => String(item?.filename || "") === String(filename || "")
    );

    if (!attachment) {
      return res.status(404).json({ error: "Anexo nÃ£o encontrado" });
    }

    const card = await Card.findOneAndUpdate(
      { _id: cardId },
      { $pull: { attachments: { filename: attachment.filename } } },
      { new: true },
    ).populate("assignees", "name email username");

    await safeUnlinkUploadUrl(attachment.path).catch((error) => {
      if (err) {
        console.error(
          "Erro ao apagar arquivo físico (pode já ter sido apagado):",
          err.message,
        );
      } else {
        console.log(`Arquivo deletado fisicamente: ${filename}`);
      }
    });

    await Board.findByIdAndUpdate(card.boardId, { updatedAt: new Date() });

    if (req.io) {
      req.io.to(card.boardId.toString()).emit('cardUpdated', {
          cardId: cardId,
          updatedCard: card,
          senderId: req.session.userId
      });
    }

    res.json({ success: true, card: card });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao deletar anexo" });
  }
}

async function deleteAttachment(req, res) {
  try {
    const { cardId, filename } = req.params;
    const cardSnapshot = await ensureCardMutationAccess(cardId, req.session.userId, "editor");
    const attachment = (cardSnapshot.attachments || []).find(
      (item) => String(item?.filename || "") === String(filename || "")
    );

    if (!attachment) {
      return res.status(404).json({ error: "Anexo nÃ£o encontrado" });
    }

    const card = await Card.findOneAndUpdate(
      { _id: cardId },
      { $pull: { attachments: { filename: attachment.filename } } },
      { new: true },
    ).populate("assignees", "name email username");

    await safeUnlinkUploadUrl(attachment.path).catch((error) => {
      console.error(
        "Erro ao apagar arquivo fÃ­sico (pode jÃ¡ ter sido apagado):",
        error?.message || error,
      );
    });

    await Board.findByIdAndUpdate(card.boardId, { updatedAt: new Date() });

    if (req.io) {
      req.io.to(card.boardId.toString()).emit("cardUpdated", {
        cardId,
        updatedCard: card,
        senderId: req.session.userId,
      });
    }

    return res.json({ success: true, card });
  } catch (error) {
    console.error(error);
    return res.status(error?.status || 500).json({
      error: error?.message || "Erro ao deletar anexo",
    });
  }
}
async function getCardSummary(req, res) {
  try {
        const { cardId } = req.params;
        await resolveScopedAccess({
            cardId,
            userId: req.session?.userId,
            requiredRole: "observer",
        });

        const card = await Card.findById(cardId).populate('boardId', 'title _id description');

        if (!card) {
            return res.status(404).json({ error: "Card nao encontrado" });
        }

        res.status(200).json({
            id: card._id,
            title: card.title,
            description: card.description || "Sem descricao",
            boardId: card.boardId._id,
            boardTitle: card.boardId.title
        });

    } catch (error) {
        console.error("Erro ao buscar resumo do card:", error);
        res.status(error?.status || 500).json({ error: error?.message || "Erro no servidor" });
    }
}

async function toggleArchiveCard(req, res) {
  try {
    const { boardId, cardId } = req.params;
    const isArchived = normalizeBooleanFlag(req.body?.isArchived, "Status de arquivamento");

    const updatedCard = await Card.findOneAndUpdate(
      { _id: cardId, boardId },
      { isArchived },
      { new: true }
    )
    .populate('listId', 'title')
    .populate('assignees', 'name username email');

    if (!updatedCard) {
      return res.status(404).json({ error: "Card nao encontrado" });
    }

    if (req.io) {
      req.io.to(updatedCard.boardId.toString()).emit('cardArchiveToggled', {
        card: updatedCard,
        senderId: req.session.userId
      });
    }

    res.json({ success: true, card: updatedCard });
  } catch (error) {
    console.error("Erro ao arquivar cartão:", error);
    res.status(error?.status || 500).json({ error: error?.message || "Erro ao alterar status do cartao." });
  }
}

module.exports = {
  moveCard,
  createCard,
  updateCard,
  updateCardDate,
  deleteCard,
  uploadCover,
  removeCover,
  addChecklistItem,
  toggleChecklistItem,
  deleteChecklistItem,
  toggleAssignee,
  uploadAttachment,
  deleteAttachment,
  getCardSummary,
  toggleArchiveCard
};
