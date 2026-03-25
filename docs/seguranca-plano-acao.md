# Plano de acao de seguranca do Alento

## Objetivo

Endurecer o sistema por blocos pequenos, com validacao automatizada a cada etapa, para reduzir risco sem quebrar fluxo de producao.

## Bloco 1 - Baseline e guard rails

Foco:

- headers de seguranca no servidor
- nao vazar erro interno em respostas de API
- sanitizar buscas para evitar regex injection e consultas perigosas
- criar suite inicial de testes de seguranca

Criterios de aceite:

- respostas incluem headers basicos de hardening
- erros 500 em API retornam mensagem generica
- busca de usuarios escapa metacaracteres regex
- `npm test` valida esse comportamento

## Bloco 2 - CSRF e sessao

Foco:

- mapear todas as rotas state-changing com sessao e cookie
- introduzir token CSRF nas telas HTML
- revisar expiracao de sessao, logout e reautenticacao para acoes sensiveis

Implementado nesta etapa:

- middleware global de CSRF com token por sessao
- token exposto no layout base para formularios HTML e `fetch` same-origin
- cobertura nos principais formularios sensiveis do sistema
- testes automatizados da validacao de token

Testes:

- POST sem token deve falhar
- POST com token valido deve passar
- logout e troca de senha devem invalidar sessao anterior

## Bloco 3 - Validacao de entrada e autorizacao profunda

Foco:

- padronizar validacao de `body`, `query` e `params`
- revisar IDOR/BOLA em familia, agenda, atendimentos e painel admin
- negar por padrao e validar dono do recurso

Implementado nesta etapa:

- validacao central de `ObjectId` para rotas do dominio de familias
- reforco de autorizacao por recurso em atualizar/inativar familia
- reforco de escopo nas telas de detalhe e edicao de familia
- allowlist de campos aceitos em `responsavel` e `endereco`
- validacao explicita de `eventId`, `salaId` e filtros sensiveis da agenda
- bloqueio de mutacao de agendamento fora do responsavel sem permissao global
- validacao de `userId` e booleano de status no painel admin de usuarios
- teste de promocao para `superadmin` negada fora do perfil permitido
- testes automatizados cobrindo ID invalido, escopo negado e payload normalizado

Testes:

- payloads invalidos retornam 400 sem stack trace
- usuario sem permissao recebe 403
- recurso fora do escopo do usuario nao pode ser acessado

## Bloco 4 - XSS e renderizacao segura

Foco:

- revisar usos de `innerHTML` no front
- padronizar escape/sanitizacao onde houver HTML dinamico
- avaliar CSP em modo progressivo

Testes:

- payload com HTML/script nao executa nem quebra layout
- conteudo dinamico aparece escapado no DOM

## Bloco 5 - Segredos, logs e configuracao

Foco:

- revisar segredos em `.env`, logs e bootstrap
- reduzir exposicao de dados sensiveis em auditoria e console
- revisar limites de payload, CORS, proxy e uploads

Testes:

- logs nao exibem senha, token ou segredo
- configuracao insegura falha cedo em ambiente produtivo

## Bloco 6 - Casos avancados

Foco:

- SSRF, uploads, file handling, webhooks e integracoes externas
- limites de taxa por rota sensivel
- monitoramento de eventos de seguranca

Testes:

- URL interna proibida e rejeitada
- upload invalido e rejeitado
- brute force e abuso de rota sensivel sofrem rate limit

## Ordem sugerida

1. Baseline e testes
2. CSRF e sessao
3. Autorizacao e validacao
4. XSS
5. Segredos e configuracao
6. Integracoes e upload
