const List = require("../models/List");
const Card = require("../models/Card");
const Board = require("../models/Board");
const { getUserRoleInBoard } = require("../services/getUserRoleInBoard");

function normalizeListTitle(value) {
  const normalized = String(value || "").trim();
  if (!normalized) {
    throw new Error("Titulo da lista obrigatorio.");
  }
  return normalized.slice(0, 120);
}

function normalizeBooleanFlag(value) {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error("Status de arquivamento invalido.");
}

async function moveList(req, res) {
  try {
    const { boardId, listId } = req.params;
    const newIndex = Number.parseInt(String(req.body?.newIndex ?? ""), 10);
    if (!Number.isInteger(newIndex) || newIndex < 0) {
      return res.status(400).json({ error: "Posicao da lista invalida." });
    }

    // Buscamos todas as listas DO BOARD, ordenadas
    const lists = await List.find({ boardId }).sort({ position: 1 });

    // Removemos a lista que estamos movendo do array de cálculo
    const cleanLists = lists.filter((list) => list._id.toString() !== listId);

    let newPosition;

    if (cleanLists.length === 0) {
      newPosition = 10000;
    } else if (newIndex === 0) {
      // Foi para o começo
      newPosition = cleanLists[0].position / 2;
    } else if (newIndex >= cleanLists.length) {
      // Foi para o final (antes do botão de criar)
      newPosition = cleanLists[cleanLists.length - 1].position + 10000;
    } else {
      // Foi para o meio
      const prevPos = cleanLists[newIndex - 1].position;
      const nextPos = cleanLists[newIndex].position;
      newPosition = (prevPos + nextPos) / 2;
    }

    await List.findByIdAndUpdate(listId, { position: newPosition });
    await Board.findByIdAndUpdate(boardId, { updatedAt: new Date() });

    if (req.io) {
      req.io.to(boardId.toString()).emit('listMoved', {
          listId: listId,
          newIndex: newIndex,
          senderId: req.session.userId
      });
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Erro ao mover lista:", error);
    res.status(500).json({ error: "Erro interno" });
  }
}

async function createList(req, res) {
  try {
    console.log(req.body);
    const { boardId } = req.params;
    const title = normalizeListTitle(req.body?.title);
    

    const userId = req.session.userId;

    // Descobrir a última posição usada
    const lastList = await List.findOne({ boardId }).sort({ position: -1 });
    const newPosition = lastList ? lastList.position + 1000 : 1000;

    const newList = await List.create({
      title,
      boardId,
      position: newPosition,
    });

    const board = await Board.findByIdAndUpdate(boardId, { updatedAt: new Date() });

    const myRole = getUserRoleInBoard(board, userId);

    // Passando TODAS as variáveis
    req.app.render('pages/board/partials/list', {
      list: newList,
      cards: [],
      board: { _id: boardId },
      myRole
    }, (err, html) => {
      if (err) {
          console.error("Erro ao renderizar a Lista:", err);
          return;
      }

      // Emite o HTML PRONTO via Socket
      if (req.io) {
          req.io.to(boardId).emit('listCreated', { 
              listId: newList._id,
              html,
              senderId: req.session.userId 
          });
      }
    });

    res.status(200).json({ success: true, newList });
  } catch (error) {
    console.error("Erro ao criar lista:", error);
    res.status(500).send("Erro ao criar lista");
  }
}

async function updateList(req, res) {
  try {
    const { boardId, listId } = req.params;
    const title = normalizeListTitle(req.body?.title);

    const list = await List.findByIdAndUpdate(listId, { title });

    await Board.findByIdAndUpdate(boardId, { updatedAt: new Date() });

    req.io.to(boardId).emit('listUpdated', { 
        listId: listId, 
        title: title,
        senderId: req.session.userId 
    });

    res.redirect(list ? `/board/${list.boardId}` : "/");
  } catch (error) {
    console.error("Erro ao atualizar lista:", error);
    res.redirect("/");
  }
}

async function deleteList(req, res) {
  try {
    const { boardId, listId } = req.params;

    const list = await List.findByIdAndDelete(listId);
    await Board.findByIdAndUpdate(boardId, { updatedAt: new Date() });

    if (list) {
      await Card.deleteMany({ listId: listId });

      req.io.to(boardId).emit('listDeleted', { 
        listId: listId, 
        senderId: req.session.userId 
      });

      res.redirect(`/board/${list.boardId}`);
    } else {
      res.redirect("/");
    }
  } catch (error) {
    console.error("Erro ao deletar lista:", error);
    res.redirect("/");
  }
}

async function toggleArchiveList(req, res) {
  try {
    const { boardId, listId } = req.params;
    const isArchived = normalizeBooleanFlag(req.body?.isArchived);

    const updatedList = await List.findByIdAndUpdate(
      listId,
      { isArchived: isArchived },
      { new: true }
    );

    if (!updatedList) {
      return res.status(404).json({ error: "Lista não encontrada" });
    }

    // buscar todos os cartões ativos
    let cards = [];
    if (isArchived === false) {
      cards = await Card.find({ 
        listId: updatedList._id, 
        isArchived: false 
      }).populate('assignees', 'name username email');
    }

    console.log("[Cards]: ", cards);
    

    if (req.io) {
      req.io.to(boardId.toString()).emit('listArchiveToggled', {
        listId: updatedList._id,
        isArchived: isArchived,
        list: updatedList,
        cards,
        senderId: req.session.userId
      });
    }

    res.json({ success: true, list: updatedList, cards });
  } catch (error) {
    console.error("Erro ao arquivar lista:", error);
    res.status(500).json({ error: "Erro ao alterar status da lista." });
  }
}

module.exports = {
  moveList,
  createList,
  updateList,
  deleteList,
  toggleArchiveList
};
