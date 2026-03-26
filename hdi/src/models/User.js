const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: false },
  cpf: { type: String, required: false },
  matricula: { type: String, required: false },
  groups: {
    type: [
      {
        type: String,
        index: true,
      },
    ],
    default: [],
  },
  favoriteBoards: {
    type: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Board",
      },
    ],
    default: [],
  },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("User", userSchema);
