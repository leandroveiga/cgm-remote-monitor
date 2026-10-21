# PRD de Contexto Inicial — Nightscout (cgm-remote-monitor)

| Campo | Valor |
|---|---|
| Data de criação | 2026-10-21 |
| Última atualização | 2026-10-21 (pós-pull do upstream, v15.0.8, e entrega da Alexa clássica) |
| Autor | Mary (Business Analyst, BMad) para Leandro |
| Status | Rascunho — retroativo (baseline do produto existente) |
| Origem | Análise técnica do repositório (`package.json`, `README.md`, `lib/`, `docs/`) |
| Versão analisada | `nightscout` 15.0.8, licença AGPL-3.0 |

> Este PRD é **retroativo**: descreve o produto como ele existe hoje, não uma nova iniciativa. Itens marcados como **[A VALIDAR]** são inferências sem evidência direta e precisam de confirmação com os mantenedores/PO.

---

## 1. Visão geral do produto

Nightscout é um monitor web open source de CGM (Continuous Glucose Monitor). Permite que pacientes e cuidadores acompanhem glicose em tempo real, remotamente, recebam alarmes e consultem histórico e relatórios. O servidor lê/escreve em um MongoDB alimentado por uploaders (apps de CGM, bombas, sistemas de loop) e exibe os valores em um dashboard com previsão de 30 minutos (modelo autorregressivo AR2).

Evidência: [README.md](../../README.md), [package.json](../../package.json).

### 1.1 Contexto da iniciativa atual

A instalação é usada pela família para acompanhar a glicemia do Gabriel. A iniciativa **Alexa+ (MCP) foi abortada** em 2026-10-21 (exigiria servidor OAuth2, programa restrito a parceiros e disponível só nos EUA). O objetivo vigente é a **skill Alexa clássica (pt-BR) no Echo Dot**: ler glicemia, insulina ativa e carboidratos ativos, e registrar insulina e carboidratos por voz. A hospedagem é um PaaS (não AWS) e o endpoint HTTPS é chamado diretamente pelo Alexa Developer Console (skill em modo desenvolvimento, sem publicação).

## 2. Problema e proposta de valor

| Problema | Resposta do produto |
|---|---|
| Cuidadores não veem a glicose do paciente à distância | Dashboard web em tempo real (Socket.IO) |
| Hipo/hiperglicemias passam despercebidas | Alarmes (`simplealarms`, `ar2`), push (Pushover), IFTTT Maker, voz (Alexa) |
| Dados de CGM, insulina e carboidratos ficam em silos | API REST (v1/v2/v3) unificada sobre MongoDB |
| Usuários querem integrar apps (Loop, AAPS, OpenAPS, xDrip) | API compatível + plugins por sistema |
| Análise de tendência é manual | Relatórios (`report_plugins`: percentis, estatísticas diárias, distribuição) |

## 3. Personas

| Persona | Objetivo principal | Superfície usada |
|---|---|---|
| Paciente (pessoa com diabetes) | Ver glicose atual, tendência, IOB/COB, receber alarme | Dashboard `/`, relógio `/clock`, Pebble |
| Cuidador/familiar | Monitorar remotamente e reconhecer alarmes | Dashboard, push, view `/split` (8 usuários) |
| Profissional de saúde | Consultar relatórios e perfis | `/report`, `/profile` |
| Administrador da instância | Configurar, proteger e manter dados | `/admin`, variáveis de ambiente, roles/subjects |
| Integrador/desenvolvedor | Enviar e ler dados programaticamente | `/api/v1`, `/api/v2`, `/api/v3`, MCP |
| Assistente de voz/IA (agente) | Consultar e registrar dados por voz ou ferramenta | Alexa clássica (leitura e registro), Google Home (quebrado); servidor MCP local, fora de escopo |

## 4. Escopo funcional atual (capabilities)

| ID | Capacidade | Evidência no código |
|---|---|---|
| CAP-01 | Visualização em tempo real de glicose (SGV), direção, delta | [lib/client/](../../lib/client), [lib/plugins/bgnow.js](../../lib/plugins/bgnow.js), [lib/plugins/direction.js](../../lib/plugins/direction.js) |
| CAP-02 | Previsão AR2 de 30 min | [lib/plugins/ar2.js](../../lib/plugins/ar2.js) |
| CAP-03 | Alarmes e notificações (urgente/alerta, snooze, ack por qualquer observador) | [lib/notifications.js](../../lib/notifications.js), [lib/levels.js](../../lib/levels.js) |
| CAP-04 | Push externo: Pushover, IFTTT Maker | [lib/plugins/pushover.js](../../lib/plugins/pushover.js), [lib/plugins/maker.js](../../lib/plugins/maker.js) |
| CAP-05 | Careportal e Bolus Wizard (registro de tratamentos, cálculo de bolus) | [lib/plugins/careportal.js](../../lib/plugins/careportal.js), [lib/plugins/boluscalc.js](../../lib/plugins/boluscalc.js) |
| CAP-06 | IOB, COB, idade de sensor/cânula/insulina/bateria | `iob.js`, `cob.js`, `sensorage.js`, `cannulaage.js`, `insulinage.js`, `batteryage.js` |
| CAP-07 | Integração com sistemas de loop/bomba (Loop, OpenAPS, AAPS, xDrip-js, pump) | `loop.js`, `openaps.js`, `pump.js`, `xdripjs.js`, `override.js` |
| CAP-08 | Ingestão de dados de nuvem (nightscout-connect; bridges Dexcom Share e MiniMed deprecados) | `lib/plugins/bridge.js`, `mmconnect.js`, dependência `nightscout-connect` |
| CAP-09 | API REST v1 / v2 / v3 (OpenAPI/Swagger) | [lib/api/](../../lib/api), [lib/api2/](../../lib/api2), [lib/api3/](../../lib/api3) |
| CAP-10 | Autenticação e autorização (API_SECRET, tokens/subjects/roles, permissões Shiro) | [lib/authorization/](../../lib/authorization) |
| CAP-11 | Relatórios históricos | [lib/report_plugins/](../../lib/report_plugins), [lib/report/](../../lib/report) |
| CAP-12 | Editores: perfil, alimentos; ferramentas de admin (limpeza de bases) | [lib/profile/](../../lib/profile), [lib/food/](../../lib/food), [lib/admin_plugins/](../../lib/admin_plugins) |
| CAP-13 | Assistentes de voz: Alexa clássica com leitura (glicemia, IOB, COB e demais métricas) e **registro por voz de insulina e carboidratos** (`RecordInsulin`/`RecordCarbs`, desativado por padrão, com confirmação, limites e permissão `api:treatments:create`); Google Home marcado como quebrado | `alexa.js`, `googlehome.js`, `virtAsstBase.js`, [lib/api/alexa/record.js](../../lib/api/alexa/record.js), [template pt-br](../../docs/plugins/alexa-templates/pt-br.json) |
| CAP-14 | Servidor MCP com 6 ferramentas somente leitura (`get_current_glucose`, `get_glucose_history`, `get_iob_cob`, `get_treatments`, `get_device_status`, `get_profile`). **Trabalho local não versionado; fora de escopo após o aborto do Alexa+** | [lib/mcp/index.js](../../lib/mcp/index.js) |
| CAP-15 | Pebble API e telas de relógio (`/clock`) | [lib/server/pebble.js](../../lib/server/pebble.js), [lib/server/clocks.js](../../lib/server/clocks.js) |
| CAP-16 | i18n (33 arquivos de tradução) e unidades mg/dL / mmol/L | [translations/](../../translations), [lib/language.js](../../lib/language.js), [lib/units.js](../../lib/units.js) |

## 5. Requisitos não funcionais observados

| ID | Requisito | Evidência | Situação |
|---|---|---|---|
| NFR-01 | Segurança de acesso: redirect HTTPS, HSTS, CSP opcional, CORS opcional | [lib/server/app.js](../../lib/server/app.js) | Implementado; CSP exige `unsafe-inline` (TODO no código) |
| NFR-02 | Autenticação obrigatória da API: sem `API_SECRET` a API não sobe | `checkSettings` em [lib/server/bootevent.js](../../lib/server/bootevent.js) | Implementado |
| NFR-03 | Alerta quando a instância é legível publicamente (`AUTH_DEFAULT_ROLES=readable`) | idem | Implementado |
| NFR-04 | Runtime Node >= 20 / npm >= 10 (boot aceita >= 16) | `package.json` `engines`, `checkNodeVersion` | **Inconsistência**: engines e boot divergem |
| NFR-05 | Performance de ingestão em lote (debounce com `maxWait` de 5 s para uploads AAPS) | `setupListeners` em bootevent | Implementado |
| NFR-06 | Portabilidade de implantação | `Dockerfile` (node:22-alpine), `docker-compose.yml`, `fly.toml`, `Procfile`, `app.json` (Heroku), `azuredeploy.json`, `Vagrantfile` | Implementado |
| NFR-07 | Qualidade: ~219 arquivos de teste (~33,7 mil linhas) vs ~33,7 mil linhas em `lib/`; testes Node-only de `client-core` e fixtures capturadas | [tests/](../../tests), scripts de flaky em [scripts/](../../scripts) | Cobertura numérica real **[A VALIDAR]** |
| NFR-08 | Segurança de supply chain: CodeQL no CI | [.github/workflows/codeql-analysis.yml](../../.github/workflows/codeql-analysis.yml) | Implementado |
| NFR-09 | Sanitização de dados gravados (treatments, food, profile, activity, API v3) com `sanitize-html` e purificação no armazenamento | [lib/server/purifier.js](../../lib/server/purifier.js), `lib/server/storage-purifier.js` | Novo no upstream 15.0.8 |
| NFR-10 | Escrita por voz protegida: desligada por padrão, confirmação falada, limites, skill ID, janela de 150 s e anti-replay; **sem verificação de assinatura da Alexa** | `lib/api/alexa/record.js` | Implementado, com lacuna conhecida |

## 6. Integrações externas

Pushover, IFTTT Maker, Dexcom Share (deprecado), Medtronic CareLink (deprecado), nightscout-connect, Loop, OpenAPS, AAPS, xDrip-js, Alexa, Google Home (quebrado), MCP (clientes de IA), Apple push (`@parse/node-apn`), MongoDB.

## 7. Restrições e premissas

- Aplicação **crítica para saúde**: regressão em alarme/valor exibido é risco ao paciente (princípio já adotado em [docs/meta/modernization-roadmap.md](../../docs/meta/modernization-roadmap.md)).
- Compatibilidade retroativa de API v1 é obrigatória (base instalada de uploaders de terceiros).
- Banco único suportado hoje: MongoDB (há `TODO` no código para outros).
- Licença AGPL-3.0 impõe obrigações a derivados/serviços hospedados.
- Projeto comunitário: mudanças dependem de consenso entre mantenedores.

## 8. Dívida técnica e riscos (consolidados)

Fonte: [docs/meta/modernization-roadmap.md](../../docs/meta/modernization-roadmap.md) e verificação no código.

| ID | Item | Impacto | Observação da análise |
|---|---|---|---|
| R-01 | Biblioteca `request` deprecada | Segurança | **Mitigado**: não é mais dependência direta; resta apenas em `overrides` |
| R-02 | `express` 4.22.1 (atualizado) e `helmet` ^4 defasado | Segurança | Express resolvido; helmet segue pendente |
| R-03 | `event-stream` fixado em 3.3.4 | Segurança/supply chain | `jsdom` foi atualizado para ^24.1.3 e o purifier migrou para `sanitize-html`; `event-stream@3.3.4` continua fixado e deve ser **auditado [A VALIDAR]** |
| R-04 | Estado global no objeto `ctx` e código baseado em callbacks | Testabilidade | Observado em `bootevent.js`; `lib/client-core` é o início da extração de lógica pura |
| R-05 | Sem TypeScript; módulos mistos | Velocidade de desenvolvimento | Observado |
| R-06 | Cliente com jQuery, d3 v5, flot, moment | Manutenção/bundle | Observado |
| R-07 | Sem rate limiting | Disponibilidade | Citado no roadmap; há apenas delay de tentativas de autenticação |
| R-08 | Documentação desatualizada (ex.: `architecture-overview.md` cita v15.0.4, mongodb ^3.6, Node 14-20; código está em v15.0.8, mongodb ^5.9) | Confiança na doc | Verificado |
| R-09 | Dependências de build (`webpack`, `babel`, loaders) em `dependencies` | Imagem de produção maior | Verificado em `package.json` |
| R-10 | Endpoint Alexa sem verificação de assinatura; token na query string da URL | Segurança | Mitigado em parte por skill ID, janela de tempo e anti-replay; Lambda intermediária é a evolução possível |
| R-11 | Registro por voz pode gravar valor mal reconhecido de insulina/carboidratos (Nightscout não aplica insulina, mas IOB/COB e calculadora usam o dado) | Segurança do paciente | Mitigado por confirmação falada, limites (10 U / 150 g) e token de escrita dedicado |
| R-12 | Merges do upstream podem quebrar código do fork (ex.: parâmetro `env` removido de `configure` em `lib/api/alexa/index.js`, já corrigido) | Regressão | Rodar `tests/api.alexa.test.js` (requer MongoDB) a cada sincronização |

## 9. Métricas de sucesso propostas (baseline) **[A VALIDAR]**

| Métrica | Alvo proposto | Como medir |
|---|---|---|
| Latência dado recebido → dashboard atualizado | p95 < 5 s | Instrumentar `data-received` → `data-processed` |
| Vulnerabilidades críticas/altas em dependências | 0 | `npm audit` + CodeQL no CI |
| Taxa de testes flaky | < 1% em 20 iterações | `npm run test:flaky:thorough` |
| Cobertura de linhas em `lib/` | Definir baseline e meta incremental | `npm run test-ci` (nyc) |

## 10. Perguntas em aberto para o PO

1. ~~Objetivo da análise~~ **Respondida:** manutenção com foco em Alexa clássica no Echo Dot (Alexa+ abortada).
2. Qual versão de Node é o alvo oficial? `engines` exige >= 20 e o Dockerfile usa `node:22-alpine`; o boot ainda aceita >= 16 **[A VALIDAR]**.
3. ~~MCP somente leitura ou escrita?~~ **Respondida:** MCP fora de escopo; o código local não versionado pode ser removido ou mantido a critério do dono.
4. Google Home segue como "quebrado" ou deve ser removido?
5. Existe meta de cobertura de testes acordada?
6. Evoluir o endpoint Alexa para uma Lambda intermediária (assinatura, skill ID e token em Secrets Manager)?
7. O registro por voz deve limitar a quantidade por hora ou exigir PIN falado?

## 11. Próximos passos recomendados

1. Validar este baseline com os stakeholders (itens **[A VALIDAR]**).
2. Executar `tests/api.alexa.test.js` com MongoDB e validar a skill no simulador do Alexa Developer Console (inclui `AMAZON.FirstName` para "Gabriel" em pt-BR).
3. Configurar o host: `ENABLE=alexa`, `LANGUAGE=br`, `ALEXA_RECORD_ENABLED`, limites e `ALEXA_SKILL_ID`; criar token de leitura e token de escrita dedicado.
4. Com Winston (arquiteto): decidir sobre a Lambda intermediária (R-10) e priorizar R-03 e R-09.

---

*Disclaimer BIA Tech: este documento foi gerado com apoio de IA a partir de análise estática do repositório. O conteúdo deve ser validado pelo profissional responsável antes de ser usado em decisões de produto.*
