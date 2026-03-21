const {
  changeAgendaRoomStatus,
  changeAgendaEventStatus,
  createAgendaRoom,
  createAgendaEvent,
  getAgendaEventDetail,
  getSessionUser,
  listAgendaEvents,
  listAgendaProfessionals,
  listAgendaRooms,
  listAvailableAgendaRooms,
  moveAgendaEvent,
  registerAgendaAttendance,
  updateAgendaEvent,
  updateAgendaRoom,
} = require("../../services/agenda/agendaDomainService");
const {
  handleEntityAction,
  handleEventAction,
  respondAgendaError,
} = require("../../services/agenda/agendaControllerService");

class AgendaController {
  static async listar(req, res) {
    try {
      return res.status(200).json(
        await listAgendaEvents(getSessionUser(req), req.query || {})
      );
    } catch (error) {
      return respondAgendaError(
        res,
        "Erro ao listar agenda:",
        "Erro interno ao listar agenda.",
        error
      );
    }
  }

  static async detalhe(req, res) {
    try {
      return res.status(200).json(
        await getAgendaEventDetail(getSessionUser(req), req.params?.id)
      );
    } catch (error) {
      return respondAgendaError(
        res,
        "Erro ao buscar detalhe do evento:",
        "Erro interno ao buscar o evento.",
        error
      );
    }
  }

  static async listarProfissionais(req, res) {
    try {
      return res.status(200).json(
        await listAgendaProfessionals(getSessionUser(req))
      );
    } catch (error) {
      return respondAgendaError(
        res,
        "Erro ao listar profissionais da agenda:",
        "Erro interno ao listar profissionais.",
        error
      );
    }
  }

  static async listarSalas(req, res) {
    try {
      return res.status(200).json(
        await listAgendaRooms(getSessionUser(req), req.query || {})
      );
    } catch (error) {
      return respondAgendaError(
        res,
        "Erro ao listar salas da agenda:",
        "Erro interno ao listar salas.",
        error
      );
    }
  }

  static async listarSalasDisponiveis(req, res) {
    try {
      return res.status(200).json(
        await listAvailableAgendaRooms(getSessionUser(req), req.query || {})
      );
    } catch (error) {
      return respondAgendaError(
        res,
        "Erro ao listar salas disponiveis:",
        "Erro interno ao consultar salas disponiveis.",
        error
      );
    }
  }

  static async criarSala(req, res) {
    return handleEntityAction({
      action: () => createAgendaRoom(getSessionUser(req), req.body || {}),
      req,
      res,
      entityKey: "sala",
      logMessage: "Erro ao criar sala da agenda:",
      fallbackMessage: "Erro interno ao criar sala.",
      statusCode: 201,
    });
  }

  static async atualizarSala(req, res) {
    return handleEntityAction({
      action: () => updateAgendaRoom(getSessionUser(req), req.params?.id, req.body || {}),
      req,
      res,
      entityKey: "sala",
      logMessage: "Erro ao atualizar sala da agenda:",
      fallbackMessage: "Erro interno ao atualizar sala.",
      statusCode: 200,
    });
  }

  static async alterarStatusSala(req, res) {
    return handleEntityAction({
      action: () =>
        changeAgendaRoomStatus(
          getSessionUser(req),
          req.params?.id,
          req.body?.ativo
        ),
      req,
      res,
      entityKey: "sala",
      logMessage: "Erro ao alterar status da sala:",
      fallbackMessage: "Erro interno ao alterar status da sala.",
      statusCode: 200,
    });
  }

  static async criar(req, res) {
    return handleEventAction({
      action: () => createAgendaEvent(getSessionUser(req), req.body || {}),
      req,
      res,
      entityKey: "evento",
      logMessage: "Erro ao criar evento de agenda:",
      fallbackMessage: "Erro interno ao criar agendamento.",
      statusCode: 201,
    });
  }

  static async atualizar(req, res) {
    return handleEventAction({
      action: () =>
        updateAgendaEvent(
          getSessionUser(req),
          req.params?.id,
          req.body || {}
        ),
      req,
      res,
      entityKey: "evento",
      logMessage: "Erro ao atualizar evento de agenda:",
      fallbackMessage: "Erro interno ao atualizar agendamento.",
      statusCode: 200,
    });
  }

  static async mover(req, res) {
    return handleEventAction({
      action: () =>
        moveAgendaEvent(
          getSessionUser(req),
          req.params?.id,
          req.body || {}
        ),
      req,
      res,
      entityKey: "evento",
      logMessage: "Erro ao mover evento de agenda:",
      fallbackMessage: "Erro interno ao mover agendamento.",
      statusCode: 200,
    });
  }

  static async alterarStatus(req, res) {
    return handleEventAction({
      action: () =>
        changeAgendaEventStatus(
          getSessionUser(req),
          req.params?.id,
          req.body?.ativo
        ),
      req,
      res,
      entityKey: "evento",
      logMessage: "Erro ao alterar status do evento de agenda:",
      fallbackMessage: "Erro interno ao alterar status do agendamento.",
      statusCode: 200,
    });
  }

  static async registrarPresenca(req, res) {
    return handleEventAction({
      action: () =>
        registerAgendaAttendance(
          getSessionUser(req),
          req.params?.id,
          req.body || {}
        ),
      req,
      res,
      entityKey: "evento",
      logMessage: "Erro ao registrar presenca:",
      fallbackMessage: "Erro interno ao registrar presenca.",
      statusCode: 200,
    });
  }
}

module.exports = AgendaController;
