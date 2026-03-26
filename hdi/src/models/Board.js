const mongoose = require("mongoose");

const boardSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  color: {
    type: String,
    default: "#0079BF",
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  // Um array de IDs de usuários convidados
  members: [
    {
      _id: false,
      user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      role: {
        type: String,
        enum: ["admin", "editor", "observer"],
        default: "editor",
      },
    },
  ],
}, { timestamps: true });

module.exports = mongoose.model("Board", boardSchema);
