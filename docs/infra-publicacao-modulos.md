# Publicacao Integrada dos Modulos

## Objetivo

Manter `Alento`, `GLPI` e `HDI`:

- integrados por SSO/bridge a partir do Alento;
- acessiveis diretamente por dominio proprio;
- independentes no ciclo de login e operacao;
- publicados por uma borda unica, sem acoplar os modulos ao app central.

## Arquitetura adotada

- `sistema.institutoalento.ong.br` -> Alento
- `glpi.institutoalento.ong.br` -> GLPI
- `hdi.institutoalento.ong.br` -> HDI

Todos os tres dominios entram pelo mesmo `alento-nginx`, que roteia por `Host`:

- `sistema.institutoalento.ong.br` -> `alento-app:4000`
- `glpi.institutoalento.ong.br` -> `glpi-origin:80`
- `hdi.institutoalento.ong.br` -> `hdi-origin:80`

Os modulos continuam separados:

- GLPI continua com login proprio e sessao propria.
- HDI continua com login proprio e sessao propria.
- O Alento apenas oferece uma porta de entrada integrada via bridge quando necessario.

## Cloudflare

O tunel publico precisa publicar os tres hostnames no mesmo edge:

1. `sistema.institutoalento.ong.br` -> `http://alento-nginx:80`
2. `glpi.institutoalento.ong.br` -> `http://alento-nginx:80`
3. `hdi.institutoalento.ong.br` -> `http://alento-nginx:80`

Se o tunel continuar expondo apenas `sistema.institutoalento.ong.br`, os dominios do GLPI/HDI seguirao com erro `1033`.

## Modo dedicado adotado agora

Como GLPI e HDI vao continuar com subdominios proprios e tuneis proprios, o desenho operacional fica assim:

- `alento` tunnel publica `sistema.institutoalento.ong.br`;
- `glpi` tunnel publica `glpi.institutoalento.ong.br`;
- `hdi` tunnel publica `hdi.institutoalento.ong.br`;
- o bridge do Alento continua existindo apenas para entrar logado no modulo.

No painel da Cloudflare Tunnel, os registros devem ficar exatamente assim:

1. no tunel `alento`: `sistema.institutoalento.ong.br` -> `http://alento-nginx:80`
2. no tunel `glpi`: `glpi.institutoalento.ong.br` -> `http://nginx:80`
3. no tunel `hdi`: `hdi.institutoalento.ong.br` -> `http://nginx:80`

Nao usar `http://localhost:8081`, `http://localhost:8082` nem `http://alento-nginx:80` dentro dos tuneis `glpi` e `hdi`.
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

- O dominio publico do Alento pode continuar sendo usado nas variaveis `HELPDESK_URL` e `HDI_URL`.
- O erro `1033` indica problema de resolucao do tunel/host publico, nao do app em si.
- Se o `cloudflared` continuar instavel, revisar o modo de transporte suportado pela versao instalada antes de alterar o comando do servico.
