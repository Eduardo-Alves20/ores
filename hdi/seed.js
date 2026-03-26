const mongoose = require("mongoose");
const Board = require("./src/models/Board");
const List = require("./src/models/List");
const Card = require("./src/models/Card");

// Conexão com MongoDB
const MONGO_URI = "mongodb://localhost:27017/trello";
mongoose
  .connect(MONGO_URI)
  .then(() => console.log("📦 MongoDB Conectado!"))
  .catch((err) => console.error(err));

async function seedDB() {
  try {
    // Limpar o banco (CUIDADO: Apaga tudo)
    await Board.deleteMany({});
    await List.deleteMany({});
    await Card.deleteMany({});

    // Criar um Board
    const board = new Board({
      title: "Projeto Clone Trello",
      color: "#89609e",
    });

    await board.save();

    // Criar Listas
    // O 'position' define a ordem da esquerda para a direita
    const listToDo = new List({
      title: "A fazer",
      position: 100,
      boardId: board._id,
    });
    const listDoing = new List({
      title: "Em Progresso",
      position: 200,
      boardId: board._id,
    });
    const listDone = new List({
      title: "Concluído",
      position: 300,
      boardId: board._id,
    });

    await Promise.all([listToDo.save(), listDoing.save(), listDone.save()]);

    // Criar cartões
    const cards = [
      {
        title: "Estudar NodeJS",
        listId: listToDo._id,
        boardId: board._id,
        position: 100,
      },
      {
        title: "Criar Models do Mongoose",
        listId: listDone._id,
        boardId: board._id,
        position: 100,
      },
      {
        title: "Configurar CSS",
        listId: listToDo._id,
        boardId: board._id,
        position: 200,
      },
      {
        title: "Fazer o script de Seed",
        listId: listDoing._id,
        boardId: board._id,
        position: 100,
      },
    ];

    await Card.insertMany(cards);

    console.log("✅ Banco de dados populado com sucesso!");
  } catch (error) {
    console.log("❌ Erro na semeadura:", e);
  } finally {
    mongoose.connection.close();
  }
}

seedDB();
