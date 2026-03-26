const Board = require("../models/Board");

async function sidebarDataMiddleware(req, res, next) {
    if (!req.session.userId) {
        res.locals.sidebarMyBoards = [];
        res.locals.sidebarSharedBoards = [];
        return next();
    }

    try {
        console.log("Passo aq");
        
        const userId = req.session.userId;

        const allBoards = await Board.find({
            $or: [
                { owner: userId },
                { 'members.user': userId }
            ]
        }).select('title color owner members updatedAt').sort({ updatedAt: -1 });

        const myBoards = [];
        const sharedBoards = [];

        allBoards.forEach(board => {
            // Verifica se sou o dono
            if (board.owner.toString() === userId) {
                myBoards.push(board);
            } else {
                sharedBoards.push(board);
            }
        });

        res.locals.sidebarMyBoards = myBoards;
        res.locals.sidebarSharedBoards = sharedBoards;

        next();

    } catch (error) {
        console.error("Erro ao carregar sidebar:", error);
        res.locals.sidebarMyBoards = [];
        res.locals.sidebarSharedBoards = [];
        next();
    }
}

module.exports = sidebarDataMiddleware;
