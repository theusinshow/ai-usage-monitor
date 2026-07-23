# Design system

## Scene

Um desenvolvedor consulta limites entre comandos, em uma tela escura durante uma jornada longa; a janela deve ser lida em dois segundos sem competir com o terminal.

## Direction

Superfície escura mineral, tipografia Segoe UI, uma cor de acento azul-petróleo usada apenas para ação e progresso. Separadores finos substituem cards flutuantes.

## Tokens

- Canvas: `oklch(0.155 0.008 235)`
- Raised: `oklch(0.19 0.009 235)`
- Border: `oklch(0.29 0.01 235)`
- Text: `oklch(0.93 0.006 235)`
- Muted: `oklch(0.68 0.012 235)`
- Accent: `oklch(0.72 0.105 205)`
- Warning: `oklch(0.77 0.08 80)`
- Critical: `oklch(0.68 0.11 30)`

### Provider palette

- Codex: `oklch(0.78 0.105 202)` (ciano)
- Claude: `oklch(0.72 0.13 48)` (terracota)
- OpenAI API: `oklch(0.76 0.085 165)` (jade)
- DeepSeek: `oklch(0.72 0.115 258)` (azul)

As cores identificam providers em monogramas, progresso e visualizações. Estados de atenção e crítico continuam usando os tokens semânticos de warning e critical, e toda informação permanece legível sem cor.

## Components

Controles têm raio de 6 a 8px, foco visível, transições de 160ms e alvos mínimos de 32px. O conteúdo usa divisores horizontais e ritmo assimétrico, sem cards aninhados.

Providers usam monogramas discretos para reconhecimento rápido, sem depender apenas de cor. A barra de status resume conexões e atualização; ações de salvamento permanecem visíveis no rodapé das configurações.

Os monogramas foram substituídos por símbolos vetoriais das marcas. Claude Code e DeepSeek usam paths locais do Simple Icons; Codex e OpenAI API usam a geometria oficial do Blossom da OpenAI. O Blossom permanece monocromático e sem efeitos, enquanto a identificação específica continua no texto do provider.

O primeiro limite de cada provider usa um anel compacto; limites adicionais usam blocos segmentados de dez etapas. Ambos herdam a cor do provider e preservam rótulo, valor e reset como sinais textuais.

## Dashboard hierarchy

- O topo responde primeiro quantos providers estão ativos e quando ocorreu a última atualização.
- Uma faixa contextual aparece somente para erro, configuração pendente ou limite acima de 75%; ela abre diretamente o provider relacionado.
- Todos os providers permanecem compactos por padrão. Apenas um pode ser expandido por vez.
- A expansão revela histórico real quando disponível, horário da atualização, origem dos dados e ação de configuração.
- Métricas incompatíveis não são somadas: porcentagem de assinatura, gasto, saldo e tokens permanecem no contexto de cada provider.
- Histórico sintético existe apenas no modo demo. A interface de produção não cria gráficos quando a integração ainda não forneceu pontos reais.

## Anti-slop rules

- Texto operacional usa caixa normal; caixa alta fica restrita a pequenos identificadores como `Demo`.
- O resumo global comunica providers ativos, portanto cards conectados usam apenas um ponto de saúde acessível em vez de repetir badges.
- Alertas descrevem diretamente provider, percentual e janela. Rótulos genéricos como “Atenção ao limite” não ocupam a primeira linha.
- Contadores de reset usam tempo natural, sem segundos em atualização contínua.
- Métricas ficam em fluxo aberto, sem caixas ou divisórias verticais desnecessárias.
- Motion permanece ligado a atualização, expansão e mudança de valor; não há movimento decorativo contínuo no dashboard.
