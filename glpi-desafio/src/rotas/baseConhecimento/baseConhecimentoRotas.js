import { Router } from "express";
import {
  exigirLogin,
  exigirUsuarioAtivo,
  exigirPerfis,
} from "../../compartilhado/middlewares/seguranca.js";
import { acharPorId } from "../../repos/usuariosRepo.js";
import {
  baseConhecimentoExcluirPost,
  baseConhecimentoEditarGet,
  baseConhecimentoEditarPost,
  baseConhecimentoGerenciarGet,
  baseConhecimentoIndexGet,
  baseConhecimentoNovoGet,
  baseConhecimentoNovoPost,
  baseConhecimentoStatusPost,
  baseConhecimentoShowGet,
} from "../../controllers/baseConhecimento/baseConhecimentoController.js";

export function criarBaseConhecimentoRotas({ auditoria } = {}) {
  const router = Router();
  const validarAtivo = exigirUsuarioAtivo(acharPorId);

  router.use(
    ["/base-conhecimento", "/artigos", "/admin/artigos"],
    exigirLogin,
    validarAtivo,
    exigirPerfis(["usuario", "tecnico", "admin"], {
      onNegado: auditoria?.registrarTentativaAcessoNegado,
    }),
  );

  router.get("/artigos", (req, res) => res.redirect("/base-conhecimento"));
  router.get("/admin/artigos", (req, res) => res.redirect("/base-conhecimento"));
  router.get("/base-conhecimento", baseConhecimentoIndexGet);
  router.get(
    "/base-conhecimento/novo",
    exigirPerfis(["tecnico", "admin"], {
      onNegado: auditoria?.registrarTentativaAcessoNegado,
    }),
    baseConhecimentoNovoGet,
  );
  router.post(
    "/base-conhecimento/novo",
    exigirPerfis(["tecnico", "admin"], {
      onNegado: auditoria?.registrarTentativaAcessoNegado,
    }),
    baseConhecimentoNovoPost,
  );
  router.get(
    "/base-conhecimento/gerenciar",
    exigirPerfis(["tecnico", "admin"], {
      onNegado: auditoria?.registrarTentativaAcessoNegado,
    }),
    baseConhecimentoGerenciarGet,
  );
  router.get(
    "/base-conhecimento/:slug/editar",
    exigirPerfis(["tecnico", "admin"], {
      onNegado: auditoria?.registrarTentativaAcessoNegado,
    }),
    baseConhecimentoEditarGet,
  );
  router.post(
    "/base-conhecimento/:slug/editar",
    exigirPerfis(["tecnico", "admin"], {
      onNegado: auditoria?.registrarTentativaAcessoNegado,
    }),
    baseConhecimentoEditarPost,
  );
  router.post(
    "/base-conhecimento/:slug/status",
    exigirPerfis(["tecnico", "admin"], {
      onNegado: auditoria?.registrarTentativaAcessoNegado,
    }),
    baseConhecimentoStatusPost,
  );
  router.post(
    "/base-conhecimento/:slug/excluir",
    exigirPerfis(["tecnico", "admin"], {
      onNegado: auditoria?.registrarTentativaAcessoNegado,
    }),
    baseConhecimentoExcluirPost,
  );
  router.get("/base-conhecimento/:slug", baseConhecimentoShowGet);

  return router;
}
