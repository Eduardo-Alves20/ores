const bcrypt = require("bcryptjs");
const User = require("../models/User");
const Board = require("../models/Board");
const { AMBIENTE } = require("../config/env");

async function ensureLocalAdmin() {
  if (AMBIENTE !== "LOCAL") {
    return;
  }

  const username =
    process.env.HDI_ADMIN_LOGIN ||
    process.env.HDI_BRIDGE_ADMIN_LOGIN ||
    process.env.LOCAL_ADMIN_USERNAME ||
    "admin";
  const password = process.env.LOCAL_ADMIN_PASSWORD || "123";
  const email = process.env.LOCAL_ADMIN_EMAIL || "admin@local.hdi";
  const passwordHash = await bcrypt.hash(password, 10);

  await User.findOneAndUpdate(
    { username },
    {
      $set: {
        name: "Administrador Local",
        username,
        email,
        password: passwordHash,
        groups: ["LOCAL_ADMIN"],
      },
      $setOnInsert: {
        favoriteBoards: [],
      },
    },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    }
  );

  console.log(`Admin local pronto: ${username}`);
}

async function ensureLocalUser() {
  if (AMBIENTE !== "LOCAL") {
    return;
  }

  const username =
    process.env.HDI_USER_LOGIN ||
    process.env.HDI_BRIDGE_USER_LOGIN ||
    process.env.LOCAL_USER_USERNAME ||
    "usuario";
  const password = process.env.LOCAL_USER_PASSWORD || "123";
  const email = process.env.LOCAL_USER_EMAIL || "usuario@local.hdi";
  const passwordHash = await bcrypt.hash(password, 10);

  const user = await User.findOneAndUpdate(
    { username },
    {
      $set: {
        name: "Usuario Local",
        username,
        email,
        password: passwordHash,
        groups: ["LOCAL_USER"],
      },
      $setOnInsert: {
        favoriteBoards: [],
      },
    },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    }
  );

  const board = await Board.findOne({
    $or: [{ owner: user._id }, { "members.user": user._id }],
  }).select("_id");

  if (!board) {
    const firstBoard = await Board.findOne({}).sort({ createdAt: 1 });

    if (firstBoard) {
      firstBoard.members.push({
        user: user._id,
        role: "observer",
      });
      await firstBoard.save();
    }
  }

  console.log(`Usuario local pronto: ${username}`);
}

module.exports = {
  ensureLocalAdmin,
  ensureLocalUser,
};
