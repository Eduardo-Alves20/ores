const Board = require("../models/Board");
const List = require("../models/List");
const Card = require("../models/Card");
const User = require("../models/User");
const { getUserRoleInBoard } = require("../services/getUserRoleInBoard");
const { escapeRegexLiteral, normalizeObjectId } = require("../services/resourceAccessService");

const BOARD_ROLE_ALLOWLIST = new Set(["admin", "editor", "observer"]);

function normalizeBoardTitle(value) {
  const normalized = String(value || "").trim();
  if (!normalized) {
    throw new Error("Titulo do board obrigatorio.");
  }
  return normalized.slice(0, 120);
}

function normalizeBoardColor(value) {
  const normalized = String(value || "#0079bf").trim();
  return /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(normalized)
    ? normalized
    : "#0079bf";
}

function normalizeBoardRole(value) {
  const normalized = String(value || "editor").trim().toLowerCase();
  if (!BOARD_ROLE_ALLOWLIST.has(normalized)) {
    throw new Error("Perfil de membro invalido.");
  }
  return normalized;
}

async function getHome(req, res) {
  try {
    const userId = req.session.userId;
    const user = await User.findById(req.session.userId);
    const favBoardIds = user.favoriteBoards.map(id => id.toString());

    // Busca quadros onde sou DONO -OU- sou MEMBRO
    const boards = await Board.find({
      $or: [{ owner: userId }, { "members.user": userId }],
    }).sort({ updatedAt: -1 });

    const favoriteBoards = [];
    const recentBoards = [];

    boards.forEach(board => {
        if (favBoardIds.includes(board._id.toString())) {
            favoriteBoards.push(board);
        } else {
            recentBoards.push(board);
        }
    });

    res.render("pages/home/index", {
      layout: "layouts/main",
      favorites: favoriteBoards,
      recents: recentBoards,
      user,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Erro ao carregar quadros");
  }
}

async function createBoard(req, res) {
  try {
    const title = normalizeBoardTitle(req.body?.title);
    const color = normalizeBoardColor(req.body?.color);

    const newBoard = await Board.create({
      title,
      color,
      owner: req.session.userId,
      members: [
        {
          user: req.session.userId,
          role: "admin",
        },
      ],
    });

    // Redireciona direto para o quadro criado
    res.redirect(`/board/${newBoard._id}`);
  } catch (error) {
    console.error(error);
    res.redirect("/");
  }
}

async function updateBoard(req, res) {
  try {
    const { boardId } = req.params;
    const title = normalizeBoardTitle(req.body?.title);
    const color = normalizeBoardColor(req.body?.color);

    if (!title) {
        return res.status(400).json({ error: "O título é obrigatório." });
    }

    const updatedBoard = await Board.findByIdAndUpdate(
        boardId,
        { 
            title: title, 
            color: color 
        },
        { new: true }
    );

    if (req.io) {
      req.io.to(boardId).emit('boardUpdated', {
          boardId: boardId,
          board: updatedBoard,
          senderId: req.session.userId
      });
    }

    res.json({ success: true, board: updatedBoard });
  } catch (error) {
    console.error("Erro ao atualizar board:", error);
    res.status(500).json({ error: "Erro interno ao atualizar quadro." });
  }
}

async function deleteBoard(req, res) {
  try {
    const { boardId } = req.params;

    const board = await Board.findByIdAndDelete(boardId);

    if (board) {
      await List.deleteMany({ boardId });

       res.redirect(`/`);
    } else {
      res.redirect("/");
    }

  } catch (error) {
    console.error("Erro ao deletar Board:", error);
    res.redirect("/");
  }
}

async function getBoard(req, res) {
  try {
    const view = req.query.view || "boards";
    const { boardId } = req.params;
    const userId = req.session.userId;

    // Busca o board populando os dados dos membros (para mostrar os nomes no header)
    const board = await Board.findOne({
      _id: boardId,
      $or: [{ owner: userId }, { "members.user": userId }], // <--- A Permissão acontece aqui
    })
      .populate({
        path: "members.user",
        select: "name email username",
      })
      .populate("owner", "name email");

    if (!board) return res.redirect("/");
    
    const myRole = getUserRoleInBoard(board, userId);

    // Buscamos as listas desse board ordenadas pela posição
    const lists = await List.find({ boardId, isArchived: { $ne: true } }).sort({ position: 1 });

    // Buscamos TODOS os cards desse board ordenados pela posição
    const cards = await Card.find({ boardId, isArchived: { $ne: true } })
      .sort({ position: 1 })
      .populate("assignees", "name");

    // Arquivados
    let totalArchivedItems = 0;

    const archivedLists = (await List.find({ boardId, isArchived: true }).lean()).length || 0;
    const archivedCards = (await Card.find({ boardId, isArchived: true }).lean()).length || 0;

    totalArchivedItems = archivedLists + archivedCards;

    console.log("Cards: ", archivedCards);
    console.log("Lists: ", archivedLists);
    console.log("Total: ", totalArchivedItems);
    

    // Renderizamos a view 'board.ejs' enviando os dados
    res.render("pages/board/index", {
      layout: "layouts/board.ejs",
      board,
      lists,
      cards,
      myRole,
      userId,
      totalArchivedItems,
      view,
    });
  } catch (error) {
    console.error(error);
    res.redirect("/");
  }
}

async function inviteMember(req, res) {
  try {
    const { boardId } = req.params;
    const email = String(req.body?.email || "").trim().toLowerCase();
    const role = normalizeBoardRole(req.body?.role);
    if (!email) {
      return res.redirect(`/board/${boardId}`);
    }

    // Verifica se o usuário convidado existe
    const userToInvite = await User.findOne({ email });

    if (!userToInvite) {
      console.log("Usuário não encontrado");
      return res.redirect(`/board/${boardId}`);
    }

    const board = await Board.findById(boardId);
    // Verifica se já é membro
    const isMember = board.members.some(
      (m) => m.user.toString() === userToInvite._id.toString(),
    );

    if (isMember) {
      // Se já for membro, ATUALIZA o papel
      await Board.updateOne(
        { _id: boardId, "members.user": userToInvite._id },
        { $set: { "members.$.role": role } },
      );
    } else {
      // Se não for, ADICIONA novo objeto
      board.members.push({
        user: userToInvite._id,
        role: role || "editor",
      });
      await board.save();
    }

    res.redirect(`/board/${boardId}`);
  } catch (error) {
    console.error(error);
  }
}

async function searchUsers(req, res) {
  try {
    const query = String(req.query.q || "").trim().slice(0, 64);
    const myGroups = req.session.user.groups || [];
    const safeQuery = escapeRegexLiteral(query);

    const users = await User.find({
      $and: [
        {
          $or: [
            { name: { $regex: safeQuery, $options: "i" } },
            { email: { $regex: safeQuery, $options: "i" } },
          ],
        },
        { groups: { $in: myGroups } },
        { _id: { $ne: req.session.userId } },
      ],
    }).select("name email username");

    res.json(users);
  } catch (error) {
    res.status(500).json({ error: "Erro ao buscar usuários" });
  }
}

async function updateMemberRole(req, res) {
  try {
    const { boardId, userId } = req.params;
    const role = normalizeBoardRole(req.body?.role);
    normalizeObjectId(userId, "Usuario");

    const board = await Board.findById(boardId);

    // Não permite alterar o papel do DONO do quadro
    if (board.owner.toString() === userId) {
      return res
        .status(403)
        .json({ error: "Não é possível alterar o papel do dono do quadro." });
    }

    // Atualiza o papel do membro específico dentro do array
    await Board.updateOne(
      { _id: boardId, "members.user": userId },
      { $set: { "members.$.role": role } },
    );

    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao atualizar permissão." });
  }
}

async function removeMember(req, res) {
  try {
    const { boardId, userId } = req.params;
    const board = await Board.findById(boardId);

    // Não permite remover o DONO
    if (board.owner.toString() === userId) {
      return res
        .status(403)
        .json({ error: "O dono do quadro não pode ser removido." });
    }

    // Remove do array (PULL)
    await Board.updateOne(
      { _id: boardId },
      { $pull: { members: { user: userId } } },
    );

    // Remover o usuário dos cartões que ele estava vinculado
    await Card.updateMany({ boardId }, { $pull: { assignees: userId } });

    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao remover membro." });
  }
}

async function exportBoard(req, res) {
  try {
    const { boardId } = req.params;
    const board = await Board.findById(boardId);

    const lists = await List.find({ boardId }).sort({ position: 1 });
    const cards = await Card.find({ boardId })
      .populate("assignees", "name email")
      .sort({ position: 1 });

    // \ufeff é para o Excel entender acentos UTF-8
    let csvContent = "\ufeff";
    csvContent +=
      "Lista;Título do Cartão;Descrição;Membros;Data de Entrega;Checklist (Feitos/Total)\n";

    // Iterar e Preencher
    for (const list of lists) {
      // Filtra os cards desta lista específica
      const listCards = cards.filter(
        (card) => card.listId.toString() === list._id.toString(),
      );

      for (const card of listCards) {
        // Tratamento de dados para não quebrar o CSV (aspas e quebras de linha)
        const title = `"${(card.title || "").replace(/"/g, '""')}"`;
        const description = `"${(card.description || "").replace(/"/g, '""').replace(/\n/g, " ")}"`;

        // Formata membros: "João, Maria"
        const members = `"${card.assignees.map((u) => u.name).join(", ")}"`;

        // Formata Data
        const dueDate = card.dueDate
          ? new Date(card.dueDate).toLocaleDateString("pt-BR")
          : "-";

        // Formata Checklist: "3/5"
        const checkTotal = card.checklist ? card.checklist.length : 0;
        const checkDone = card.checklist
          ? card.checklist.filter((i) => i.done).length
          : 0;
        const checkStatus = `${checkDone}/${checkTotal}`;

        // Linha final
        // Lista;Título;Desc;Membros;Data;Checklist
        csvContent += `"${list.title}";${title};${description};${members};${dueDate};${checkStatus}\n`;
      }
    }

    //  Download
    const filename = `Relatorio_${board.title.replace(/\s+/g, "_")}_${Date.now()}.csv`;

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename=${filename}`);
    res.status(200).send(csvContent);
  } catch (error) {
    console.error(error);
    res.status(500).send("Erro ao gerar relatório");
  }
}

async function renderCalendar(req, res) {
  try {
    const { boardId } = req.params;
    const board = await Board.findById(boardId)
      .populate({
        path: "members.user",
        select: "name email username",
      })
      .populate("owner", "name email");
    const userId = req.session.userId;

    if (!board) return res.status(404).send("Quadro não encontrado");

    const member = board.members.find(
      (_member) => _member.user._id.toString() === userId,
    );
    const myRole =
      board.owner.toString() === userId
        ? "admin"
        : member
          ? member.role
          : "observer";

    res.render("calendar", {
      layout: "layouts/calendar",
      board,
      user: req.session.user,
      myRole,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Erro ao carregar calendário");
  }
}

async function getEvents(req, res) {
  try {
    const { boardId } = req.params;
    // Busca cards que tenham Data de Entrega (dueDate)
    // $exists: true garante que não pegaremos cards sem data
    const cards = await Card.find({
      boardId,
      dueDate: { $exists: true, $ne: null },
    });

    // Formata para o padrão do FullCalendar
    const events = cards.map((card) => {
      // Se tiver data e checklist 100%, fica verde. Senão, usa a cor do board ou azul padrão.
      let color = "#3788d8";
      const isDone =
        card.checklist &&
        card.checklist.length > 0 &&
        card.checklist.every((item) => item.done);

      if (isDone) color = "#5aac44";

      return {
        id: card._id,
        title: card.title,
        start: card.dueDate,
        color: color,
      };
    });

    res.json(events);
  } catch (error) {
    console.error(error);
    res.status(500).json([]);
  }
}

async function toggleFavorite(req, res) {
  try {
    const { boardId } = req.params;
    const userId = req.session.userId;

    const user = await User.findById(userId);

    // Verificar se o board já está favoritado
    const isFavorite = user.favoriteBoards.includes(boardId);


    if (isFavorite) {
      // Tira dos favoritos
      await User.findByIdAndUpdate(userId, {
        $pull: { favoriteBoards: boardId }
      });
    } else {
      // Adiciona aos favoritos
      await User.findByIdAndUpdate(userId, {
        $addToSet: { favoriteBoards: boardId }
      });
    }

    res.json({ success: true, isFavorite: !isFavorite });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
}

async function searchMembersForMention(req, res) {
  try {
    const { boardId } = req.params;
    const query = String(req.query.query || "").trim().slice(0, 64);

    console.log("Query: ", query);
    
    const board = await Board.findById(boardId).populate('members.user', 'name username');
    if (!board) return res.json([]);

    const regex = new RegExp(escapeRegexLiteral(query), 'i');
    const matchedMembers = board.members
      .filter(member => regex.test(member.user.name) || regex.test(member.user.username))
      .map(member => ({
          id: member.user._id,
          value: member.user.name // O Quill precisa dessa propriedade 'value' para exibir o texto
      }));

    console.log("matchedMembers: ", matchedMembers);
    

    res.status(200).json(matchedMembers);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
}

async function searchCardsForMention(req, res) {
  try {
    const userId = req.session.userId;
    const query = String(req.query.query || "").trim().slice(0, 64);

    const boards = await Board.find({
      $or: [
          { owner: userId },
          { 'members.user': userId }
      ]
    }).select('_id title');

    const boardIds = boards.map(board => board._id);

    const cards = await Card.find({
      boardId: { $in: boardIds },
      title: { $regex: new RegExp(escapeRegexLiteral(query), 'i') }
    })
    .populate('boardId', 'title')
    .limit(10); // Limita a 10 para não travar a tela

    const matchedCards = cards.map(card => ({
      id: card._id,
      value: card.title,
      boardName: card.boardId ? card.boardId.title : 'Desconhecido',
      type: 'card' // Flag para sabermos o que renderizar no front
    }));

    res.json(matchedCards);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
}

async function getArchivedItems(req, res) {
  try {
    const { boardId } = req.params;
    
    const archivedLists = await List.find({ 
        boardId: boardId, 
        isArchived: true 
    }).sort({ updatedAt: -1 });
    
    const archivedCards = await Card.find({ 
        boardId: boardId, 
        isArchived: true 
    })
    .populate('listId', 'title')
    .sort({ updatedAt: -1 });
                                    
    res.json({ lists: archivedLists, cards: archivedCards });
  } catch (error) {
      console.error("Erro ao buscar arquivados:", error);
      res.status(500).json({ error: "Erro ao buscar arquivados." });
  }
}

module.exports = {
  getHome,
  createBoard,
  updateBoard,
  deleteBoard,
  getBoard,
  inviteMember,
  searchUsers,
  updateMemberRole,
  removeMember,
  exportBoard,
  renderCalendar,
  getEvents,
  toggleFavorite,
  searchMembersForMention,
  searchCardsForMention,
  getArchivedItems
};
