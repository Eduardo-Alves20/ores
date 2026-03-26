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
- validacao de `userId` e `ativo` nos fluxos de aprovacoes/acessos
- reforco de autorizacao e validacao de tipo/status no modulo de atendimentos
- validacao de `eventId` nas acoes da agenda do portal da familia
- validacao de nome/data/tipo no modulo de pacientes
- protecao contra `notificationId` invalido no portal da familia
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

Implementado nesta etapa:

- escape consistente de campos dinamicos na agenda administrativa
- sanitizacao de tokens usados em classes CSS da agenda
- endurecimento da agenda do portal da familia contra classe/markup injetado
- testes automatizados para renderizacao segura de cards e selects da agenda
- serializacao segura de JSON em `<script>` inline e `application/json` nas views principais
- endurecimento das telas de familias para `data-id`, `href`, `data-href` e badges de status
- escape das opcoes dinamicas em filtros administrativos

Testes:

- payload com HTML/script nao executa nem quebra layout
- conteudo dinamico aparece escapado no DOM
- snapshots/flash inline nao permitem breakout de `</script>`
- listas, fichas e filtros administrativos rejeitam markup/classe injetada em atributos

## Bloco 5 - Segredos, logs e configuracao

Foco:

- revisar segredos em `.env`, logs e bootstrap
- reduzir exposicao de dados sensiveis em auditoria e console
- revisar limites de payload, CORS, proxy e uploads

Implementado nesta etapa:

- invalidacao de sessao por `authVersion`, perfil, tipo de cadastro, nivel de acesso e estado da conta
- renovacao do payload de sessao com versao de autenticacao para derrubar sessao antiga apos mudanca de senha, status, aprovacao ou funcoes
- `no-store` em respostas dinamicas para reduzir cache indevido de dados autenticados
- reducao de limite global de payload e `parameterLimit` em formularios
- endurecimento de `/uploads` com `dotfiles: deny`, sem index e sem cache
- `rate limit` dedicado para troca de senha, mutacoes do portal da familia e bridge de modulos
- bridge de modulos em fail-secure: sem credenciais hardcoded e sem `javascript:`/protocolo invalido em URL externa
- sanitizacao de logs de erro para nao imprimir senha, token, cookie, `authorization` e CPF em claro
- incremento de `authVersion` quando funcoes de acesso do usuario mudam no modulo de seguranca

Testes:

- logs nao exibem senha, token ou segredo
- configuracao insegura falha cedo em ambiente produtivo

## Bloco 6 - Casos avancados

Foco:

- SSRF, uploads, file handling, webhooks e integracoes externas
- limites de taxa por rota sensivel
- monitoramento de eventos de seguranca

Implementado nesta etapa:

- bridge server-to-server por token assinado de curta duracao para HDI e GLPI, sem credencial de modulo exposta no HTML do cliente
- validacao de replay e `aud/iss/exp/jti` no consumo de token dos modulos integrados
- endurecimento do HDI com headers de seguranca, `no-store`, limites de payload e cookie de sessao com `httpOnly`, `sameSite` e `secure` por ambiente
- CSRF no HDI com token por sessao para formularios e `fetch` same-origin
- logout do HDI migrado para `POST`
- autorizacao por escopo no HDI para `board/list/card`, bloqueando mismatch entre `boardId`, `listId` e `cardId`
- reforco de allowlist e validacao de papel, titulo, cor, booleanos e buscas com escape de regex no HDI
- protecao de upload/file handling no HDI contra traversal, nome de arquivo malicioso e exclusao fora da raiz de uploads
- cobertura automatizada dos novos guard rails de escopo, CSRF, request hardening e upload

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
