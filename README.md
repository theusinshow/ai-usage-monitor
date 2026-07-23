# AI Usage Monitor

Aplicativo desktop local-first para Windows que reúne uso, limites e saldos de Codex, Claude Code, OpenAI API e DeepSeek API em uma janela compacta acessível pela System Tray.

O projeto usa Tauri 2, React 19, TypeScript estrito, Vite 8, Rust e SQLite. Não há backend em nuvem, telemetria, analytics ou armazenamento de credenciais no frontend.

## Estado do MVP

- Janela de 380 × 600 px, iniciada oculta e acessível pela bandeja do Windows.
- Menu da bandeja com abrir, atualizar, configurações e sair.
- Fechar a janela apenas a oculta. Perder o foco também a recolhe.
- Providers independentes com estados `connected`, `error`, `notConfigured` e `notInstalled`.
- Limites reais do Codex via API estável do `codex app-server`.
- Tokens do Claude Code calculados a partir do histórico JSONL local.
- Saldo DeepSeek via endpoint oficial `/user/balance`.
- Custos OpenAI via endpoint oficial `/v1/organization/costs` quando uma Admin API Key é fornecida.
- Credenciais no Windows Credential Manager através da crate `keyring`.
- Preferências e snapshots em SQLite local, com retenção padrão de 90 dias.
- Adapter opcional para relatórios JSON do OpenUsage.
- Atualização automática configurável em 30 s, 1 min, 5 min ou 15 min.

## Requisitos

- Windows 10 ou Windows 11.
- [Node.js](https://nodejs.org/) 20 ou mais recente.
- [Rust com target MSVC](https://www.rust-lang.org/tools/install).
- [Microsoft C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) com o workload **Desenvolvimento para desktop com C++** e um Windows SDK.
- WebView2, já incluído nas versões atuais do Windows 10 e 11.
- Opcional: Codex CLI, Claude Code e OpenUsage no `PATH`.

## Instalação para desenvolvimento

```powershell
npm install
npm run tauri dev
```

O frontend isolado pode ser aberto com:

```powershell
npm run dev
```

Nessa visualização, os providers exibem que o backend Tauri não está disponível. Isso é esperado.

Para revisar barras, resets e métricas sem o backend, use o modo de demonstração disponível somente durante o desenvolvimento:

```text
http://127.0.0.1:1420/?demo=1
```

Os dados de demonstração são identificados na interface e nunca são incluídos no build de produção.

### Design Lab

No modo de demonstração, selecione o ícone de laboratório no topo para abrir uma área experimental com barras de progresso, gráficos de uso e estudos de motion. Também é possível acessá-la diretamente:

```text
http://127.0.0.1:1420/?lab=1
```

O laboratório usa apenas dados sintéticos, oferece os temas Mineral, Ember e Violet e respeita a preferência de movimento reduzido do Windows. Ele só fica acessível em desenvolvimento e seu código é carregado em um bundle separado da interface principal.

## Validação

```powershell
npm run typecheck
npm run lint
npm run build
cargo check --manifest-path src-tauri/Cargo.toml
```

## Gerar o instalador Windows

```powershell
npm run tauri build
```

Os instaladores NSIS e MSI são produzidos em `src-tauri/target/release/bundle`.

## Configurar APIs

Abra **Configurações** pela engrenagem ou pelo menu da bandeja. Informe a chave, defina um orçamento mensal opcional e selecione **Salvar e testar**.

### OpenAI

Uma chave comum é suficiente para validar conectividade, mas a API oficial de custos da organização exige uma **Admin API Key**. Quando a chave não possui essa permissão, o app mostra a limitação claramente e não calcula um gasto fictício.

Endpoint usado: `GET https://api.openai.com/v1/organization/costs`.

### DeepSeek

O saldo é consultado diretamente na API oficial. A API pública não oferece consumo diário ou mensal agregado, portanto esses dados ficam indisponíveis até existir uma fonte oficial ou histórico local suficiente.

Endpoint usado: `GET https://api.deepseek.com/user/balance`.

## Detecção do Codex

1. Procura `codex` no `PATH`.
2. Inicia `codex app-server` sem janela de console.
3. Usa JSON-RPC `account/read` e `account/rateLimits/read`.
4. Converte `primary` e `secondary` em limites com percentual real e reset oficial.

O app não lê nem copia o arquivo de autenticação do Codex. O próprio CLI mantém e atualiza sua sessão.

## Detecção do Claude Code

1. Procura `claude` no `PATH` ou a pasta `~/.claude`.
2. Lê somente arquivos JSONL de `~/.claude/projects`.
3. Soma os campos de tokens gravados pelo próprio Claude para hoje e para o mês.

O Claude Code não expõe oficialmente os percentuais de assinatura em uma API headless estável. Por isso o app não inventa as barras de 5 horas ou semanal. Quando o OpenUsage estiver instalado, a arquitetura já permite consumir seus relatórios JSON como fallback futuro.

## OpenUsage

O [OpenUsage](https://github.com/janekbaraniewski/openusage) foi avaliado como uma integração opcional adequada:

- licença MIT compatível;
- suporte a Windows e configuração em `%APPDATA%\openusage`;
- providers para Codex, Claude, OpenAI e DeepSeek;
- relatórios `daily`, `weekly`, `monthly` e `blocks` com `--json`;
- SQLite local e coleta opcional em daemon.

O projeto não copia código do OpenUsage. `OpenUsageAdapter` chama o executável externo e mantém o aplicativo desacoplado. O fluxo nativo continua funcionando sem ele.

## Segurança e privacidade

- API keys nunca são salvas em SQLite, JSON, `localStorage` ou logs.
- O frontend envia a chave ao backend somente no momento de salvar no cofre do Windows.
- Depois de salva, a chave completa não volta para a interface.
- Erros são sanitizados antes de chegar ao frontend.
- Não há Sentry, analytics, tracking ou telemetria.
- As únicas chamadas externas são para as APIs oficiais configuradas pelo usuário.

O banco fica no diretório de dados do aplicativo e guarda apenas configurações não sensíveis e snapshots agregados:

```text
usage_snapshots(provider, timestamp, tokens, cost, percentage)
```

## Marcas de terceiros

Os símbolos de OpenAI, Claude Code e DeepSeek são exibidos somente para identificar os serviços monitorados e não indicam endosso ou parceria. O Blossom segue o asset e as diretrizes oficiais da OpenAI; Claude Code e DeepSeek usam paths vetoriais locais fornecidos pelo pacote [Simple Icons](https://github.com/simple-icons/simple-icons). Todas as marcas pertencem aos respectivos titulares.

## Arquitetura

```text
React UI
  -> hooks / provider service
    -> provider específico
      -> comandos Tauri
        -> Codex app-server / histórico Claude / APIs oficiais
        -> OpenUsage CLI opcional
        -> Credential Manager + SQLite
```

Componentes React não acessam arquivos, processos, APIs externas, credenciais ou banco diretamente.

## Limitações conhecidas

- Limites de assinatura do Claude não possuem fonte oficial headless; apenas tokens locais são mostrados no MVP.
- Custos OpenAI exigem Admin API Key. Chaves de projeto comuns não podem consultar gastos da organização.
- A DeepSeek expõe saldo, mas não uma API agregada de gasto diário e mensal.
- O adapter OpenUsage está pronto, porém ainda não mescla todos os formatos de relatório no modelo visual.
- O posicionamento da janela é central no MVP; ancoragem precisa junto ao ícone da bandeja pode variar entre Windows 10 e 11.
- O build Rust exige o linker MSVC. Se `link.exe` não for encontrado, instale o workload C++ Build Tools indicado nos requisitos.

## Fontes técnicas

- [Codex app-server, account e rate limits](https://github.com/openai/codex/blob/main/codex-rs/app-server/README.md)
- [OpenAI Usage and Costs API](https://platform.openai.com/docs/api-reference/usage)
- [DeepSeek Get User Balance](https://api-docs.deepseek.com/api/get-user-balance/)
- [OpenUsage](https://github.com/janekbaraniewski/openusage)
