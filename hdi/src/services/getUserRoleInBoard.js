function getUserRoleInBoard(board, userId) {
    const member = board.members.find(
        (_member) => _member.user._id.toString() === userId,
    );

    const myRole =
        board.owner.toString() === userId
        ? "admin"
        : member
            ? member.role
            : "observer";

    return myRole
}

module.exports = {
  getUserRoleInBoard
};
