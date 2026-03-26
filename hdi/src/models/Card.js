const mongoose = require("mongoose");

const cardSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
  },
  position: {
    type: Number,
    required: true,
    default: 0,
  },
  labels: [
    {
      type: String, // Guardaremos hexadecimais: '#ff0000', '#00ff00'
    },
  ],
  listId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "List",
    required: true,
  },
  boardId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Board",
    required: true,
  },
  // Guardaremos algo como: "/uploads/1239123-imagem.png"
  coverImage: { type: String, default: null },
  checklist: [
    {
      text: { type: String, required: true },
      done: { type: Boolean, default: false },
    },
  ],
  assignees: [{ 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'User' 
  }],
  attachments: [
    {
      originalName: String, // "relatorio_final.pdf"
      filename: String,     // "17823123-relatorio_final.pdf" (nome salvo no disco)
      path: String,         // "/uploads/attachments/..."
      mimetype: String,     // "application/pdf"
      size: Number,         // Tamanho em bytes
      uploadedAt: { type: Date, default: Date.now }
    }
  ],
  isArchived: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  dueDate: { type: Date, default: null },
});

module.exports = mongoose.model("Card", cardSchema);
