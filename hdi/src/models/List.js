const mongoose = require("mongoose");

const listSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  position: {
    type: Number,
    required: true,
    default: 0,
  },
  isArchived: { 
    type: Boolean, 
    default: false 
  },
  boardId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Board",
    required: true,
  },
});

module.exports = mongoose.model("List", listSchema);
