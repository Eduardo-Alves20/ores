const mongoose = require("mongoose");

const AuditTrailSchema = new mongoose.Schema(
  {
    atorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Usuario",
      required: false,
      index: true,
    },
    atorNome: { type: String, trim: true },
    acao: { type: String, required: true, trim: true, index: true },
    entidade: { type: String, required: true, trim: true, index: true },
    entidadeId: { type: String, required: false, trim: true, index: true },
    detalhes: { type: mongoose.Schema.Types.Mixed, default: {} },
    ip: { type: String, trim: true },
    userAgent: { type: String, trim: true },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
    collection: "AuditTrails",
  }
);

module.exports = mongoose.model("AuditTrail", AuditTrailSchema);

