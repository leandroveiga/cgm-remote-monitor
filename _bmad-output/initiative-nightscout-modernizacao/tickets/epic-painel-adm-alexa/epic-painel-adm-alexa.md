---
id: 1
type: epic
title: "O administrador configura a Alexa no painel /admin, sem editar variáveis nem reiniciar"
parent: initiative-nightscout-modernizacao
covers: []
sources: []
companions: ["_bmad-output/initiative-nightscout-modernizacao/tickets/epic-painel-adm-alexa/requisitos-fase2-painel-alexa.md"]
after: []
refined: true
risk: high
---

# O administrador configura a Alexa no painel /admin, sem editar variáveis nem reiniciar

## Description

Fase 2 da skill Alexa clássica: hoje a configuração (modo terceiros, registro por voz, limites, skill ID) vem de variáveis de ambiente do Fly e exige reinício. O epic move esses parâmetros para uma seção do `/admin`, com persistência em MongoDB, aplicação sem reinício, auditoria e prévia das frases, mantendo as variáveis da Fase 1 como padrão e fallback. O detalhamento (contexto, personas, riscos, métricas, Gherkin por história, DoR/DoD) está no documento companheiro.

## Outcome

Para o administrador (pai/mãe/responsável), alterar nome, preposição, registro por voz e limites passa a levar menos de 2 minutos, sem acesso ao Fly e sem reinício; o sinal de sucesso é a mudança ouvida na Echo na requisição seguinte e 0 reinícios.

## Requirements

Fonte de todas as linhas: demanda do usuário de 2026-10-22 (seção indicada no companheiro).

- R1 (companheiro §4): O administrador define nome (até 40 caracteres) e preposição (`do`/`da`/`de`); a próxima requisição Alexa fala em 3ª pessoa com esses valores, sem reinício.
- R2 (§4): O administrador habilita ou desabilita o registro por voz; vale na próxima requisição.
- R3 (§4): O administrador define limites máximos de insulina e carboidratos (números positivos até o teto de segurança); valor acima do limite é recusado.
- R4 (§4): O administrador define o skill ID; a leitura da configuração nunca devolve o valor em claro.
- R5 (§4, a avaliar, prioridade baixa): O administrador define o limite de idade da leitura (padrão 5 min) que separa "está em" de "há N minutos era de".
- R6 (§4): A configuração é persistida em coleção MongoDB própria e sobrevive a reinício e deploy.
- R7 (§4, §6): A precedência (painel > ambiente > padrão) é visível; o painel mostra a origem de cada valor e permite voltar ao ambiente.
- R8 (§4): As mudanças valem sem reiniciar: invalidação do cache na gravação e TTL máximo de 30 s nas demais instâncias.
- R9 (§4): Ler e alterar a configuração exige permissão de administrador; sem ela, recusa e nenhuma alteração.
- R10 (§4): Toda alteração é auditada (quem, quando, campo, valor anterior e novo); o skill ID só como "alterado".
- R11 (§4): Validação e sanitização no servidor: nome ≤ 40 caracteres, sem HTML/controle; preposição em lista fechada; limites finitos, positivos e ≤ teto; inválido retorna 400 sem gravar.
- R12 (§4): O skill ID não aparece em claro em respostas, logs nem auditoria.
- R13 (§4): Todo rótulo, ajuda e erro novo existe em pt-BR e en.
- R14 (§4): Sem valores no painel, o comportamento é idêntico ao das variáveis da Fase 1; os testes existentes passam sem alterar expectativas.
- R15 (§4): O painel mostra a prévia das frases geradas, sem gravar nem registrar tratamentos.
- R16 (§4): Falha do Mongo/cache não derruba a skill nem libera o registro: usa o último valor válido, senão o ambiente.
- R17 (§4): Gravação com revisão desatualizada é rejeitada (409).
- R18 (§4): A documentação do plugin Alexa descreve o painel, a precedência, as permissões e a verificação em produção.

## Constraints

- Segurança do registro por voz da Fase 1 preservada: confirmação obrigatória, limites, verificação de skill ID, janela de 150 s e deduplicação de `requestId` (a assinatura Alexa continua não verificada).
- A permissão de administrador segue o padrão `admin:api:<recurso>:<ação>` dos roles/subjects do Nightscout.
- Os handlers já leem a configuração a cada requisição; o contrato deles (`POST /api/v1/alexa`) não muda.
- Dados de saúde sensíveis; aplicação crítica; compatibilidade retroativa da API v1 obrigatória; CommonJS em JavaScript, Express 4.17.1, mongodb ^5.9.2.
- Nenhuma alteração de código-fonte nesta etapa de requisitos.

## Done when

- Um administrador altera nome e preposição no `/admin` e a Echo fala com o novo nome na requisição seguinte, em produção no Fly, sem reinício.
- Habilitar registro, limites e skill ID funcionam com precedência visível; skill ID nunca aparece em claro (teste automatizado).
- Toda alteração fica auditada; entradas inválidas são rejeitadas no servidor.
- A prévia das frases corresponde às respostas reais; tradução pt-BR e en completa.
- A suíte existente de Alexa/virtAsst passa sem alteração de expectativas; documentação publicada e verificação em produção anexada.

## Boundaries

- Fora: múltiplos pacientes/perfis, Google Home, Alexa+/MCP, edição de frases, verificação de assinatura Alexa, mudanças no fluxo de confirmação do registro.
- Must not change: respostas da Alexa quando nada foi salvo no painel (idênticas à Fase 1).
- Touch point: `/admin` (`lib/admin_plugins`) — nova seção; owner: epic-painel-adm-alexa
- Touch point: roles/subjects (shiro) — nova permissão admin; owner: epic-painel-adm-alexa

## References

- companion — [requisitos-fase2-painel-alexa.md](requisitos-fase2-painel-alexa.md), seções 4 a 14
- parent — [initiative-nightscout-modernizacao.md](../../initiative-nightscout-modernizacao.md)
- code — `lib/api/alexa/index.js` (`patientSubject`), `lib/api/alexa/record.js`, `lib/plugins/virtAsstBase.js` (`FRESH_MINUTES`), `lib/admin_plugins/index.js`, `lib/authorization/endpoints.js`

## Notes

- Assumption: Precedência painel > ambiente > padrão; alternativas: ambiente > painel, ou bloqueio por campo.
- Assumption: Coleção MongoDB própria (`alexa_settings`, documento único com `revision`).
- Assumption: Teto de segurança rígido (25 U insulina, 500 g carboidratos), não editável pelo painel; valores a confirmar com o responsável clínico.
- Assumption: Instância única no Fly hoje; o TTL cobre mais de uma.
- Assumption: Epic alocado na iniciativa `initiative-nightscout-modernizacao` (sem iniciativa ativa registrada; nada alterado em `config.user.toml`).
- Open question: Onde persistir (própria vs. genérica) — espera a história 1.
- Open question: Precedência final — espera as histórias 1, 3 e 4.
- Open question: Múltiplos pacientes no futuro: lista de perfis ou documento único — espera a história 1.
- Open question: Rótulo genérico para outros assistentes (Google Home) — espera as histórias 2 e 4.
- Open question: Incluir o limite de idade (R5) e a faixa (1–60 min) — espera a história 7.
- Open question: Tetos 25 U / 500 g corretos? Quem valida — espera as histórias 3 e 4.
- Open question: Skill ID pode ser limpo (desliga a verificação) ou é obrigatório com registro habilitado — espera a história 3.
- Decision: 2026-10-22 — o traçador é a história 1 (API + Mongo + cache + `patientSubject` com nome e preposição, verificável por requisição Alexa); a tela vem na história 2.
- Decision: 2026-10-22 — varredura de refatoração proposta como história 9, por haver mais de três histórias.
