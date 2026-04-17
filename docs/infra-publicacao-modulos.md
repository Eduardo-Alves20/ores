# Publicacao Integrada dos Modulos

## Objetivo

Manter `ORES`, `GLPI` e `HDI`:

- integrados por SSO/bridge a partir do ORES;
- acessiveis diretamente por dominio proprio;
- independentes no ciclo de login e operacao;
- publicados por uma borda unica, sem acoplar os modulos ao app central.

## Arquitetura adotada

- `sistema.institutoORES.ong.br` -> ORES
- `glpi.institutoORES.ong.br` -> GLPI
- `hdi.institutoORES.ong.br` -> HDI

Todos os tres dominios entram pelo mesmo `ORES-nginx`, que roteia por `Host`:

- `sistema.institutoORES.ong.br` -> `ORES-app:4000`
- `glpi.institutoORES.ong.br` -> `glpi-origin:80`
- `hdi.institutoORES.ong.br` -> `hdi-origin:80`

Os modulos continuam separados:

- GLPI continua com login proprio e sessao propria.
- HDI continua com login proprio e sessao propria.
- O ORES apenas oferece uma porta de entrada integrada via bridge quando necessario.

## Cloudflare

O tunel publico precisa publicar os tres hostnames no mesmo edge:

1. `sistema.institutoORES.ong.br` -> `http://ORES-nginx:80`
2. `glpi.institutoORES.ong.br` -> `http://ORES-nginx:80`
3. `hdi.institutoORES.ong.br` -> `http://ORES-nginx:80`

Se o tunel continuar expondo apenas `sistema.institutoORES.ong.br`, os dominios do GLPI/HDI seguirao com erro `1033`.

## Modo dedicado adotado agora

Como GLPI e HDI vao continuar com subdominios proprios e tuneis proprios, o desenho operacional fica assim:

- `ORES` tunnel publica `sistema.institutoORES.ong.br`;
- `glpi` tunnel publica `glpi.institutoORES.ong.br`;
- `hdi` tunnel publica `hdi.institutoORES.ong.br`;
- o bridge do ORES continua existindo apenas para entrar logado no modulo.

No painel da Cloudflare Tunnel, os registros devem ficar exatamente assim:

1. no tunel `ORES`: `sistema.institutoORES.ong.br` -> `http://ORES-nginx:80`
2. no tunel `glpi`: `glpi.institutoORES.ong.br` -> `http://nginx:80`
3. no tunel `hdi`: `hdi.institutoORES.ong.br` -> `http://nginx:80`

Nao usar `http://localhost:8081`, `http://localhost:8082` nem `http://ORES-nginx:80` dentro dos tuneis `glpi` e `hdi`.
Nesses dois tuneis, o `cloudflared` enxerga apenas a rede privada do proprio stack, entao o destino correto e `nginx:80`.

## Modos de publicacao

### Modo recomendado

Usar um unico tunel publico no compose raiz.

Vantagens:

- um ponto de entrada publico;
- menos conectores `cloudflared`;
- menos risco de divergencia entre dominios;
- GLPI e HDI continuam acessiveis diretamente.

### Modo dedicado

GLPI e HDI podem ser publicados com seus proprios tuneis e agora sobem por padrao no compose de cada modulo.

Exemplo:

```powershell
docker compose up -d
```

Esse e o modo certo quando cada modulo tiver seu proprio hostname publico e seu proprio conector Cloudflare.

## Observacoes operacionais

- O dominio publico do ORES pode continuar sendo usado nas variaveis `HELPDESK_URL` e `HDI_URL`.
- O erro `1033` indica problema de resolucao do tunel/host publico, nao do app em si.
- Se o `cloudflared` continuar instavel, revisar o modo de transporte suportado pela versao instalada antes de alterar o comando do servico.
