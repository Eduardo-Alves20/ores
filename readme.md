# Alento (GESA)

Sistema web para gestao social da Fundacao Alento, com foco em familias, dependentes, atendimentos e agenda.

## Requisitos

- Node.js 20+ (veja `.nvmrc`)
- MongoDB local rodando na maquina

## Stack

- Node.js + Express + EJS
- MongoDB + Mongoose
- Sessao via `express-session` + `connect-mongodb-session`

## Configuracao local (rapido)

1. Instale dependencias:

```bash
npm install
```

2. Copie o arquivo de ambiente:

```bash
cp .env.example .env
```

No Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

3. Garanta que o MongoDB local esta ativo em `127.0.0.1:27017`.

O projeto ja vem configurado para:

```env
MONGO_URI=mongodb://127.0.0.1:27017/ALENTO?directConnection=true
```

4. Inicie em desenvolvimento:

```bash
npm run dev
```

5. Acesse:

`http://localhost:4000/login`

## Usuario admin inicial

No primeiro start, se nao existir admin ativo, o sistema tenta criar admin usando:

- `ADMIN_NAME`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`

Defina uma senha forte no `.env` (minimo 10 chars, com maiuscula, minuscula e numero).

## Scripts

- `npm run dev` -> sobe com watch
- `npm start` -> sobe em modo normal

## Estrutura resumida

- `Controllers/` -> controladores HTTP
- `Routes/` -> rotas web e API
- `schemas/` -> modelos Mongoose
- `views/` -> telas EJS
- `public/` -> CSS e JS frontend

## Git e seguranca

O `.gitignore` ja ignora:

- `node_modules/`
- `.env`
- logs e caches
- arquivos de upload em `uploads/` (mantendo `.gitkeep`)

Antes de subir para o Git:

1. Verifique se `.env` nao entrou no stage.
2. Garanta que nao ha credenciais reais no commit.
3. Revise `git status`.

## Troubleshooting

### "Nao vejo o banco no Compass"

Use exatamente a mesma conexao do projeto:

`mongodb://127.0.0.1:27017/ALENTO?directConnection=true`

### "Erro de login"

- Confira se o usuario existe na collection `usuarios`.
- Confira senha forte para criacao do admin inicial.
- Limpe cache do navegador (`Ctrl+F5`) se alterou tela de login.
