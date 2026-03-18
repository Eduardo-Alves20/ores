function toDateTimeLabel(dateLike) {
  const dt = new Date(dateLike);
  if (Number.isNaN(dt.getTime())) return "-";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(dt);
}

module.exports = {
  toDateTimeLabel,
};
