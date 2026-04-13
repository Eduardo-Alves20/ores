module.exports = {
  ...require("./family/portalFamilyPolicyService"),
  ...require("./family/portalFamilyFormattingService"),
  ...require("./family/portalFamilyContextService"),
  ...require("./family/portalFamilyAgendaService"),
  ...require("./family/portalFamilyAgendaActionService"),
  ...require("./family/portalFamilyAppointmentService"),
  ...require("../agenda/domain/agendaProfessionalAvailabilityService"),
  ...require("./family/portalFamilyNotificationService"),
  ...require("./family/portalFamilyViewService"),
};
