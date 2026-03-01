const mongoose = require("mongoose");
const Usuario = require("../../schemas/core/Usuario");
const FuncaoAcesso = require("../../schemas/core/FuncaoAcesso");
const { PERFIS } = require("../../config/roles");
const {
  PERMISSION_GROUPS,
  normalizePermissionList,
} = require("../../config/permissions");
const { registrarAuditoria } = require("../../services/auditService");
const { refreshSessionPermissions } = require("../../services/accessControlService");

function parseBoolean(value) {
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  return undefined;
}

function escapeRegex(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function toArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === "undefined" || value === null) return [];
  return [value];
}

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

function resolveReturnTo(rawValue) {
  const raw = String(rawValue || "").trim();
  if (!raw) return "/seguranca/funcoes";
  if (!raw.startsWith("/")) return "/seguranca/funcoes";
  if (raw.startsWith("//")) return "/seguranca/funcoes";
  if (!raw.startsWith("/seguranca/funcoes")) return "/seguranca/funcoes";
  return raw;
}

class SegurancaController {
  static async index(req, res) {
    try {
      const roleIdEmEdicao = String(req.query?.editar || "").trim();
      const userBusca = String(req.query?.userBusca || "").trim().slice(0, 80);

      const [roles, usuarios] = await Promise.all([
        FuncaoAcesso.find({})
          .sort({ nome: 1 })
          .lean(),
        Usuario.find(
          userBusca
            ? {
                $or: [
                  { nome: { $regex: new RegExp(escapeRegex(userBusca), "i") } },
                  { email: { $regex: new RegExp(escapeRegex(userBusca), "i") } },
                  { login: { $regex: new RegExp(escapeRegex(userBusca), "i") } },
                ],
              }
            : {}
        )
          .select("_id nome email login perfil ativo funcoesAcesso")
          .populate({
            path: "funcoesAcesso",
            select: "_id nome slug ativo",
            options: { lean: true },
          })
          .sort({ nome: 1 })
          .limit(80)
          .lean(),
      ]);

      const roleEmEdicao =
        roles.find((item) => String(item?._id || "") === roleIdEmEdicao) || null;

      return res.status(200).render("pages/seguranca/funcoes", {
        title: "Seguranca de Acesso",
        sectionTitle: "Seguranca de Acesso",
        navKey: "seguranca-funcoes",
        layout: "partials/app.ejs",
        pageClass: "page-seguranca-funcoes",
        extraCss: ["/css/seguranca.css"],
        permissionGroups: PERMISSION_GROUPS,
        roles,
        roleEmEdicao,
        usuarios,
        filtros: { userBusca },
        successMessage: req.flash("success"),
        errorMessage: req.flash("error"),
      });
    } catch (error) {
      console.error("Erro ao carregar seguranca de funcoes:", error);
      return res.status(500).render("pages/errors/500", {
        status: 500,
        message: "Erro ao carregar a seguranca de acesso.",
        req,
        err: error,
        layout: "partials/login.ejs",
      });
    }
  }

  static async criarFuncao(req, res) {
    try {
      const actorId = req?.session?.user?.id || null;
      const nome = String(req.body?.nome || "").trim().slice(0, 80);
      const slugInformado = String(req.body?.slug || "").trim();
      const descricao = String(req.body?.descricao || "").trim().slice(0, 400);
      const ativo = parseBoolean(req.body?.ativo);
      const permissoes = normalizePermissionList(toArray(req.body?.permissoes));

      if (!nome) {
        req.flash("error", "Nome da funcao e obrigatorio.");
        return res.redirect("/seguranca/funcoes");
      }

      const slug = slugify(slugInformado || nome);
      if (!slug) {
        req.flash("error", "Slug invalido para a funcao.");
        return res.redirect("/seguranca/funcoes");
      }

      const funcao = await FuncaoAcesso.create({
        nome,
        slug,
        descricao,
        permissoes,
        ativo: typeof ativo === "undefined" ? true : ativo,
        criadoPor: actorId,
        atualizadoPor: actorId,
      });

      await registrarAuditoria(req, {
        acao: "FUNCAO_ACESSO_CRIADA",
        entidade: "seguranca",
        entidadeId: String(funcao._id),
        detalhes: { slug, permissoes: funcao.permissoes || [] },
      });

      req.flash("success", "Funcao criada com sucesso.");
      return res.redirect("/seguranca/funcoes");
    } catch (error) {
      console.error("Erro ao criar funcao:", error);
      if (error?.code === 11000) {
        req.flash("error", "Ja existe uma funcao com esse slug.");
      } else {
        req.flash("error", error?.message || "Erro ao criar funcao.");
      }
      return res.redirect("/seguranca/funcoes");
    }
  }

  static async atualizarFuncao(req, res) {
    try {
      const actorId = req?.session?.user?.id || null;
      const id = String(req.params?.id || "").trim();
      const nome = String(req.body?.nome || "").trim().slice(0, 80);
      const slugInformado = String(req.body?.slug || "").trim();
      const descricao = String(req.body?.descricao || "").trim().slice(0, 400);
      const ativo = parseBoolean(req.body?.ativo);
      const permissoes = normalizePermissionList(toArray(req.body?.permissoes));

      if (!id || !mongoose.Types.ObjectId.isValid(id)) {
        req.flash("error", "Funcao invalida.");
        return res.redirect("/seguranca/funcoes");
      }

      if (!nome) {
        req.flash("error", "Nome da funcao e obrigatorio.");
        return res.redirect(`/seguranca/funcoes?editar=${id}`);
      }

      const slug = slugify(slugInformado || nome);
      if (!slug) {
        req.flash("error", "Slug invalido para a funcao.");
        return res.redirect(`/seguranca/funcoes?editar=${id}`);
      }

      const funcao = await FuncaoAcesso.findByIdAndUpdate(
        id,
        {
          nome,
          slug,
          descricao,
          permissoes,
          ...(typeof ativo === "undefined" ? {} : { ativo }),
          atualizadoPor: actorId,
        },
        { new: true, runValidators: true }
      );

      if (!funcao) {
        req.flash("error", "Funcao nao encontrada.");
        return res.redirect("/seguranca/funcoes");
      }

      await registrarAuditoria(req, {
        acao: "FUNCAO_ACESSO_ATUALIZADA",
        entidade: "seguranca",
        entidadeId: String(funcao._id),
      });

      req.flash("success", "Funcao atualizada com sucesso.");
      return res.redirect("/seguranca/funcoes");
    } catch (error) {
      console.error("Erro ao atualizar funcao:", error);
      if (error?.code === 11000) {
        req.flash("error", "Ja existe uma funcao com esse slug.");
      } else {
        req.flash("error", error?.message || "Erro ao atualizar funcao.");
      }
      return res.redirect("/seguranca/funcoes");
    }
  }

  static async alterarStatusFuncao(req, res) {
    try {
      const actorId = req?.session?.user?.id || null;
      const id = String(req.params?.id || "").trim();
      const ativo = parseBoolean(req.body?.ativo);
      const returnTo = resolveReturnTo(req.body?.returnTo);

      if (!id || !mongoose.Types.ObjectId.isValid(id)) {
        req.flash("error", "Funcao invalida.");
        return res.redirect(returnTo);
      }

      if (typeof ativo === "undefined") {
        req.flash("error", "Campo ativo e obrigatorio.");
        return res.redirect(returnTo);
      }

      const funcao = await FuncaoAcesso.findByIdAndUpdate(
        id,
        { ativo, atualizadoPor: actorId },
        { new: true, runValidators: true }
      );

      if (!funcao) {
        req.flash("error", "Funcao nao encontrada.");
        return res.redirect(returnTo);
      }

      await registrarAuditoria(req, {
        acao: ativo ? "FUNCAO_ACESSO_ATIVADA" : "FUNCAO_ACESSO_INATIVADA",
        entidade: "seguranca",
        entidadeId: String(funcao._id),
      });

      req.flash("success", ativo ? "Funcao ativada com sucesso." : "Funcao inativada com sucesso.");
      return res.redirect(returnTo);
    } catch (error) {
      console.error("Erro ao alterar status da funcao:", error);
      req.flash("error", error?.message || "Erro ao alterar status da funcao.");
      return res.redirect(resolveReturnTo(req.body?.returnTo));
    }
  }

  static async atribuirFuncoes(req, res) {
    try {
      const actorId = req?.session?.user?.id || null;
      const usuarioId = String(req.params?.id || "").trim();
      const returnTo = resolveReturnTo(req.body?.returnTo);
      const funcoesRecebidas = toArray(req.body?.funcoes)
        .map((item) => String(item || "").trim())
        .filter((item) => mongoose.Types.ObjectId.isValid(item));

      if (!usuarioId || !mongoose.Types.ObjectId.isValid(usuarioId)) {
        req.flash("error", "Usuario invalido.");
        return res.redirect(returnTo);
      }

      const [usuario, funcoesValidas] = await Promise.all([
        Usuario.findById(usuarioId).select("_id perfil nome funcoesAcesso").lean(),
        FuncaoAcesso.find({
          _id: { $in: funcoesRecebidas },
        })
          .select("_id")
          .lean(),
      ]);

      if (!usuario) {
        req.flash("error", "Usuario nao encontrado.");
        return res.redirect(returnTo);
      }

      if (String(usuario.perfil || "").toLowerCase() === PERFIS.SUPERADMIN) {
        req.flash("error", "Nao e permitido alterar funcoes do SuperAdmin.");
        return res.redirect(returnTo);
      }

      const funcoesIds = funcoesValidas.map((item) => item._id);

      await Usuario.findByIdAndUpdate(
        usuarioId,
        {
          funcoesAcesso: funcoesIds,
          atualizadoPor: actorId,
        },
        { runValidators: true }
      );

      await refreshSessionPermissions(req, usuarioId);

      await registrarAuditoria(req, {
        acao: "USUARIO_FUNCOES_ATRIBUIDAS",
        entidade: "usuario",
        entidadeId: String(usuarioId),
        detalhes: {
          totalFuncoes: funcoesIds.length,
        },
      });

      req.flash("success", "Funcoes do usuario atualizadas com sucesso.");
      return res.redirect(returnTo);
    } catch (error) {
      console.error("Erro ao atribuir funcoes:", error);
      req.flash("error", error?.message || "Erro ao atribuir funcoes.");
      return res.redirect(resolveReturnTo(req.body?.returnTo));
    }
  }
}

module.exports = SegurancaController;


