const express = require("express");
const router = express.Router();
const boardController = require("../controllers/boardController");
const listController = require("../controllers/listController");
const cardController = require("../controllers/cardController");
const upload = require("../config/upload");
const checkPermission = require("../middlewares/checkRole");

// --- ROTAS GERAIS ---
router.get("/", boardController.getHome);

// --- ROTAS DO QUADRO ESPECÍFICO ---
router.get(
  "/board/:boardId/export",
  checkPermission("observer"),
  boardController.exportBoard,
);

router.post("/boards", boardController.createBoard);

router.put("/board/:boardId/", checkPermission("admin"), boardController.updateBoard);
router.post("/board/:boardId/delete", checkPermission("admin"), boardController.deleteBoard);

router.post(
  "/board/:boardId/invite",
  checkPermission("editor"),
  boardController.inviteMember,
);

router.get("/api/users/search", boardController.searchUsers);

router.get(
  "/board/:boardId",
  checkPermission("observer"),
  boardController.getBoard,
);

router.post(
  "/board/:boardId/member/:userId/role",
  checkPermission("admin"),
  boardController.updateMemberRole,
);
router.post(
  "/board/:boardId/member/:userId",
  checkPermission("admin"),
  boardController.removeMember,
);

router.get(
  "/board/:boardId/calendar",
  checkPermission("observer"),
  boardController.renderCalendar,
);

router.get(
  "/board/:boardId/events",
  checkPermission("observer"),
  boardController.getEvents,
);

router.post('/board/:boardId/favorite', checkPermission("observer"), boardController.toggleFavorite);
router.get('/board/:boardId/archived', checkPermission("observer"), boardController.getArchivedItems);


// --- ROTAS INTERNA DO QUADRO ---
// --- LIST ---
router.post(
  "/board/:boardId/list",
  checkPermission("editor"),
  listController.createList,
);
router.post(
  "/board/:boardId/list/:listId/move",
  checkPermission("editor"),
  listController.moveList,
);
router.post(
  "/board/:boardId/list/:listId/update",
  checkPermission("editor"),
  listController.updateList,
);
router.post(
  "/board/:boardId/list/:listId/delete",
  checkPermission("editor"),
  listController.deleteList,
);

router.post('/board/:boardId/list/:listId/archive', checkPermission("editor"), listController.toggleArchiveList);

// --- CARD ---
router.post(
  "/board/:boardId/card/:cardId/move",
  checkPermission("editor"),
  cardController.moveCard,
);
router.post(
  "/board/:boardId/card",
  checkPermission("editor"),
  cardController.createCard,
);
router.post(
  "/board/:boardId/card/:cardId/update",
  checkPermission("editor"),
  cardController.updateCard,
);

router.post(
  "/board/:boardId/card/:cardId/date",
  checkPermission("editor"),
  cardController.updateCardDate,
);

router.post(
  "/board/:boardId/card/:cardId/delete",
  checkPermission("editor"),
  cardController.deleteCard,
);
router.post(
  "/board/:boardId/card/:cardId/cover",
  checkPermission("editor"),
  upload.single("cover"),
  cardController.uploadCover,
);

router.post(
  "/board/:boardId/card/:cardId/cover/delete",
  checkPermission("editor"),
  upload.single("cover"),
  cardController.removeCover,
);

router.post("/card/:cardId/checklist", checkPermission("editor"), cardController.addChecklistItem);
router.post(
  "/card/:cardId/checklist/:itemId/update",
  checkPermission("editor"),
  cardController.toggleChecklistItem,
);
router.post(
  "/card/:cardId/checklist/:itemId/delete",
  checkPermission("editor"),
  cardController.deleteChecklistItem,
);

router.post("/card/:cardId/assign", checkPermission("editor"), cardController.toggleAssignee);

router.get('/:boardId/mentions/members', checkPermission("observer"), boardController.searchMembersForMention);
router.get('/:boardId/mentions/cards', checkPermission("observer"), boardController.searchCardsForMention);

router.get('/card/:cardId/summary', checkPermission("observer"), cardController.getCardSummary);

router.post('/board/:boardId/card/:cardId/archive', checkPermission("editor"), cardController.toggleArchiveCard);

module.exports = router;
