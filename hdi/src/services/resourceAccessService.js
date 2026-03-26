const mongoose = require("mongoose");

const Board = require("../models/Board");
const List = require("../models/List");
const Card = require("../models/Card");

const ROLE_WEIGHTS = Object.freeze({
  observer: 1,
  editor: 2,
  admin: 3,
});

function createAccessError(message, status = 403) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function normalizeObjectId(value, label = "Recurso") {
  const normalized = String(value || "").trim();
  if (!normalized || !mongoose.Types.ObjectId.isValid(normalized)) {
    throw createAccessError(`${label} invalido.`, 400);
  }
  return normalized;
}

function escapeRegexLiteral(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function resolveBoardRole(board, userId) {
  const normalizedUserId = String(userId || "").trim();
  if (!board || !normalizedUserId) return "";

  if (String(board.owner || "") === normalizedUserId) {
    return "admin";
  }

  const member = Array.isArray(board.members)
    ? board.members.find((item) => String(item?.user || "") === normalizedUserId)
    : null;

  return String(member?.role || "").toLowerCase();
}

function hasRequiredRole(currentRole, requiredRole = "observer") {
  return (ROLE_WEIGHTS[currentRole] || 0) >= (ROLE_WEIGHTS[requiredRole] || 0);
}

async function resolveScopedAccess({ boardId, listId, cardId, userId, requiredRole = "observer" } = {}) {
  const normalizedUserId = String(userId || "").trim();
  if (!normalizedUserId) {
    throw createAccessError("Sessao invalida.", 401);
  }

  const normalizedBoardId = boardId ? normalizeObjectId(boardId, "Board") : "";
  const normalizedListId = listId ? normalizeObjectId(listId, "Lista") : "";
  const normalizedCardId = cardId ? normalizeObjectId(cardId, "Card") : "";

  let list = null;
  let card = null;

  if (normalizedListId) {
    list = await List.findById(normalizedListId).select("_id boardId").lean();
    if (!list) {
      throw createAccessError("Lista nao encontrada.", 404);
    }
  }

  if (normalizedCardId) {
    card = await Card.findById(normalizedCardId)
      .select("_id boardId listId attachments assignees checklist coverImage")
      .lean();
    if (!card) {
      throw createAccessError("Card nao encontrado.", 404);
    }
  }

  const derivedBoardId =
    normalizedBoardId ||
    String(list?.boardId || "") ||
    String(card?.boardId || "");

  if (!derivedBoardId) {
    throw createAccessError("Board invalido.", 400);
  }

  if (normalizedBoardId && list && String(list.boardId || "") !== normalizedBoardId) {
    throw createAccessError("Lista fora do escopo do board.", 404);
  }

  if (normalizedBoardId && card && String(card.boardId || "") !== normalizedBoardId) {
    throw createAccessError("Card fora do escopo do board.", 404);
  }

  if (list && card && String(card.listId || "") !== String(list._id || "")) {
    throw createAccessError("Card fora do escopo da lista.", 404);
  }

  const board = await Board.findById(derivedBoardId).select("_id owner members").lean();
  if (!board) {
    throw createAccessError("Board nao encontrado.", 404);
  }

  const currentRole = resolveBoardRole(board, normalizedUserId);
  if (!currentRole) {
    throw createAccessError("Acesso negado.", 403);
  }

  if (!hasRequiredRole(currentRole, requiredRole)) {
    throw createAccessError("Permissao insuficiente para esta acao.", 403);
  }

  return {
    board,
    boardId: String(board._id),
    list,
    card,
    currentRole,
  };
}

module.exports = {
  ROLE_WEIGHTS,
  createAccessError,
  escapeRegexLiteral,
  hasRequiredRole,
  normalizeObjectId,
  resolveBoardRole,
  resolveScopedAccess,
};
