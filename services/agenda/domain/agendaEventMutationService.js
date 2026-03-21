module.exports = {
  ...require("./agendaEventMutationSupportService"),
  ...require("./agendaEventCreationService"),
  ...require("./agendaEventUpdateService"),
  ...require("./agendaEventMoveService"),
  ...require("./agendaEventStatusService"),
  ...require("./agendaEventAttendanceService"),
};
