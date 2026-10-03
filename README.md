# RadarShop AI

SaaS em desenvolvimento para afiliados brasileiros do TikTok Shop.

O produto está sendo construído em etapas para manter segurança, previsibilidade e um fluxo utilizável a cada entrega.

## Stack

- React 19 + TypeScript
- TanStack Start / Router
- Supabase + PostgreSQL
- Tailwind CSS 4
- React Query
- Radix UI / shadcn
- Drizzle para migrations

## Status

### Etapa 1 — concluída no código

- autenticação
- onboarding
- redirecionamento pós-login
- endurecimento de segurança em migration
- remoção do `.env` versionado
- CI com lint dirigido e build de produção

A migration `drizzle/migrations/0001_foundation_security.sql` deve ser aplicada ao banco Supabase do ambiente antes de considerar a infraestrutura de produção sincronizada.

### Etapa 2 — concluída

- dashboard alimentado por dados reais
- contagem de produtos, favoritos e projetos
- resumo das preferências do usuário
- produtos atualizados recentemente
- estados de carregamento, erro e banco vazio
- navegação completa das rotas existentes

### Etapa 3 — concluída

- consulta paginada no servidor
- busca por nome
- filtro por categoria
- faixa de preço e comissão mínima
- ordenação por atualização, comissão, vendas e preço
- favoritos por usuário
- estados reais de erro, carregamento e catálogo vazio

### Etapa 4 — concluída

- página individual do produto
- fonte e datas dos dados
- histórico de métricas
- link original quando disponível
- favoritos persistidos por usuário
- página real de favoritos

### Etapa 5 — concluída

- seleção personalizada pelas preferências do onboarding
- categorias e faixa de comissão aplicadas como filtros reais
- ordenação explicável pelo objetivo do usuário
- preferências editáveis em Configurações
- nenhum score artificial de chance de venda

### Etapa 6 — concluída no código

- Estúdio vinculado a um produto do Radar
- criação, edição e exclusão de projetos
- público-alvo, tipo de vídeo, duração e tom
- roteiro, legenda, hashtags e prompt audiovisual
- status de rascunho ou pronto
- IA automática ainda não ativada: primeiro o CRUD real, depois os provedores de IA

## Fluxo base

```text
Landing
  ↓
Cadastro / Login
  ↓
Onboarding
  ↓
Dashboard
  ↓
Radar de Produtos
  ↓
Produto / Favoritos
  ↓
Meu Radar personalizado
  ↓
Estúdio de Conteúdo
```

Usuários autenticados que ainda não concluíram o onboarding são direcionados para `/onboarding`. Após salvar as preferências, o acesso segue para `/dashboard`.

## Desenvolvimento local

Copie o arquivo de exemplo e preencha apenas no seu ambiente local:

```sh
cp .env.example .env
npm install
npm run dev
```

Nunca versione chaves secretas. Chaves com privilégios administrativos, como `SUPABASE_SERVICE_ROLE_KEY`, devem existir somente no ambiente de servidor.

## Sincronização com Lovable

Este repositório continua conectado ao Lovable. Evite force push, rebase ou alteração do histórico já publicado, pois isso pode quebrar a sincronização do projeto.


### Etapa 7 — concluída no código

- painel administrativo protegido por role
- visão de usuários e roles para auditoria
- cadastro, edição e exclusão de produtos
- gestão de categorias
- fontes registradas e fonte padrão de importação
- importação CSV com validação linha a linha
- snapshot inicial de métricas para produtos importados
- nenhuma credencial privada armazenada no navegador


### Etapa 8 — concluída no código

- Inteligência de Mercado baseada em dados observados
- Índice de Oportunidade de 0–100 com cobertura explícita
- ritmo de vendas calculado pelo histórico de coletas
- concorrência relativa baseada em criadores informados
- comissão comparada sem misturar R$ e percentual
- Produtos Novos, Baixa Concorrência e Antes de Viralizar
- Segunda Onda baseada em re-aceleração entre pelo menos três coletas
- Caçador de Oportunidades com critérios transparentes
- leitura de crescimento adicionada à página individual do produto
- nenhum índice é apresentado como probabilidade de venda


### Etapa 9 — concluída no código

- geração real de conteúdo pelo servidor usando um provedor de IA
- saída estruturada para roteiro, legenda, hashtags e prompt audiovisual
- contexto inclui produto, preferências, histórico do produto e projetos anteriores
- comparação com produtos da mesma categoria para sugerir diferenciação
- nenhuma chave de IA é enviada ao navegador
- o usuário revisa a geração antes de salvar no Estúdio
- endpoint server-to-server para ingestão de produtos por integrações externas
- autenticação da ingestão por segredo mantido apenas no servidor
- atualização do produto identificada por fonte + URL original
- cada sincronização grava um novo snapshot no histórico de métricas
- integração não fica presa a um fornecedor específico; crawlers e parceiros podem usar o mesmo contrato


## API de ingestão externa

A rota `POST /api/integrations/products` recebe lotes normalizados de até 100 produtos.
Ela exige `Authorization: Bearer <PRODUCT_INGEST_SECRET>`. A URL original junto com a fonte
funciona como identidade do produto para decidir entre inserir e atualizar. O endpoint aceita
campos ausentes sem fabricar valores e registra um snapshot de métricas em cada sincronização.


### Etapa 10A — concluída no código

- headers de segurança globais sem bloquear o preview incorporado
- respostas de API com no-store e Vary: Authorization
- rotas privadas e APIs marcadas como noindex
- limite de payload para geração por IA e ingestão externa
- endpoint GET /api/health
- página pública de Transparência
- robots.txt preparado para impedir indexação das áreas privadas
- preços, planos e gateway de pagamento continuam sem valores inventados

### Etapa 10B — concluída no código

- estrutura de planos Grátis e Pro sem preços inventados
- página autenticada de Plano e uso
- limites mensais de geração por IA definidos no servidor
- reserva atômica de uso para impedir estouro por requisições simultâneas
- devolução automática da cota quando o provedor de IA falha
- bloqueio efetivo acontece no servidor, não apenas na interface
- migration `drizzle/migrations/0002_plan_usage.sql` com RLS e privilégios mínimos
- feature flag mantém os limites desligados até o banco do ambiente estar sincronizado
- checkout, preço e gateway de pagamento continuam para uma etapa separada

Para ativar os limites em um ambiente real, aplique primeiro a migration
`drizzle/migrations/0002_plan_usage.sql` no Supabase e só depois configure
`AI_USAGE_LIMITS_ENABLED=true`. Os valores `AI_FREE_MONTHLY_LIMIT` e
`AI_PRO_MONTHLY_LIMIT` podem ser ajustados no servidor sem alterar o frontend.

### Etapa 10C — concluída no código

- gestão manual de planos Free/Pro para beta e suporte
- consulta de uso por usuário dentro do painel administrativo
- alteração de plano, ativação/inativação e reset de uso
- autorização administrativa revalidada no servidor em cada alteração
- service role permanece exclusivamente no servidor
- painel de planos permanece inativo enquanto a migration 0002 e a feature flag não estiverem ativas
- nenhuma decisão de preço ou gateway foi embutida nesta etapa

Essa administração manual permite validar o fluxo Free/Pro antes de conectar um checkout real.

### Etapa 10D — concluída no código

- integração de checkout recorrente com Mercado Pago
- preço mensal do Pro obrigatório via variável de ambiente, sem valor hardcoded
- checkout criado no servidor com referência interna do usuário
- retorno do navegador não concede acesso ao Pro
- ativação do Pro somente após reconciliação server-to-server
- webhook validado por HMAC SHA-256 usando `x-signature`, `x-request-id` e `data.id`
- consulta da assinatura diretamente na API do Mercado Pago antes de alterar o plano
- eventos de webhook persistidos para auditoria e reprocessamento idempotente
- assinaturas autorizadas ativam Pro; pausadas/canceladas retornam ao Free
- página Plano e uso mostra preço configurado, status e botão de checkout quando habilitado
- migration `drizzle/migrations/0003_billing_mercado_pago.sql`

Para habilitar cobrança real, aplique primeiro as migrations 0002 e 0003, mantenha
`AI_USAGE_LIMITS_ENABLED=true`, configure as credenciais do Mercado Pago, defina
`MERCADO_PAGO_PRO_MONTHLY_BRL`, configure `APP_PUBLIC_URL` e então altere
`MERCADO_PAGO_BILLING_ENABLED=true`. O endpoint de webhook é
`POST /api/webhooks/mercado-pago`.

### Etapa 10E — concluída no código

- sincronização manual segura do status da assinatura com o Mercado Pago
- endpoint autenticado `POST /api/billing/sync`
- cancelamento da assinatura pelo próprio usuário
- endpoint autenticado `POST /api/billing/cancel`
- propriedade da assinatura validada pela `external_reference` antes de sincronizar ou cancelar
- cancelamento enviado ao Mercado Pago e reconciliado antes de atualizar o plano local
- página Plano e uso permite atualizar status, continuar checkout pendente e cancelar o Pro
- toda sincronização invalida os caches de cobrança e de limites de IA

O cancelamento nesta implementação é imediato: depois da confirmação do provedor, o usuário
retorna ao plano Grátis. Uma política futura de acesso até o fim do período pago exigirá guardar
e aplicar explicitamente o término do entitlement.

### Etapa 10F — concluída no código

- diagnóstico de prontidão disponível apenas para administradores
- verificação server-side de Supabase, banco base e migrations 0002/0003
- verificação de configuração da IA, ingestão, limites e Mercado Pago sem expor segredos
- indicadores separados para núcleo da aplicação e lançamento pago
- nova aba `Prontidão` dentro do painel administrativo
- endpoint protegido `GET /api/admin/readiness`
- CI reforçado com `tsc --noEmit` após o build de produção

A tela de Prontidão é a referência operacional para ativação do ambiente. Ela não mostra
valores de chaves; apenas informa se cada dependência está configurada e acessível.

### Etapa 10G — concluída no código

- separação entre novas vendas e reconciliação de assinaturas existentes
- `MERCADO_PAGO_BILLING_ENABLED=false` passa a bloquear novos checkouts sem desativar Webhooks
- sincronização e cancelamento continuam disponíveis para assinaturas já vinculadas
- Admin → Prontidão separa estado do Webhook do estado de novas assinaturas
- documentação operacional completa em `docs/PRODUCTION_RUNBOOK.md`
- runbook inclui migrations, variáveis, ordem segura de ativação, checklist e resposta a incidentes

Isso permite pausar vendas em uma emergência sem deixar o estado local das assinaturas
desatualizado enquanto o Mercado Pago continua processando eventos.

## Runbook de produção

Consulte `docs/PRODUCTION_RUNBOOK.md` antes de ativar limites, billing ou liberar o checkout
para usuários externos.

### Etapa 11A — multi-gateway e home mobile

- home pública centralizada e refinada no mobile sem alterar o layout desktop
- billing preparado para múltiplos gateways
- Mercado Pago preservado como integração automática existente
- PayPal adicionado com assinatura recorrente via API oficial, Webhook verificado e autoatendimento
- Pepper adicionada como checkout alternativo em modo assistido
- bloqueio contra duas assinaturas simultâneas em gateways diferentes
- migration `0004_multi_gateway_billing.sql` amplia os provedores permitidos para Mercado Pago, PayPal e Pepper
- Admin → Prontidão passa a diagnosticar cada gateway separadamente
- Pepper não concede Pro automaticamente até a API/Webhook específica da conta ser validada

A migration 0004 deve ser aplicada antes de habilitar PayPal ou Pepper em produção.

### Etapa 11B — IA nativa do Lovable

- Estúdio passa a priorizar o Lovable AI Gateway no Lovable Cloud
- usa `LOVABLE_API_KEY` gerenciada automaticamente pela plataforma
- nenhuma chave de IA é enviada ao navegador
- modelo padrão do gateway: `openai/gpt-5.5`, configurável por `LOVABLE_AI_MODEL`
- OpenAI externo permanece disponível como fallback para outros ambientes
- saída estruturada, validação factual e devolução de cota em falhas continuam preservadas
- Admin → Prontidão reconhece Lovable AI ou OpenAI externo como provedores válidos

No Lovable Cloud não é necessário cadastrar manualmente `LOVABLE_API_KEY`.


### Etapa 11C — segurança do checkout assistido Pepper

- início do checkout Pepper passa a ser registrado como pendente no servidor
- um checkout Pepper pendente bloqueia a abertura simultânea de Mercado Pago ou PayPal
- o usuário pode cancelar o checkout Pepper pendente e liberar a escolha de outro gateway
- o cancelamento local não finge cancelar uma assinatura paga na Pepper
- contas Pro ativadas manualmente pela Pepper continuam exigindo suporte/API real para cancelamento
- nenhuma ativação automática do Pro foi adicionada sem Webhook/API validado


### Etapa 11D — prontidão multi-gateway

- Admin → Prontidão verifica explicitamente a migration 0004
- nova migration 0005 adiciona uma RPC somente de leitura para diagnosticar os constraints de billing
- a RPC é acessível apenas pelo service role e não expõe dados de usuário nem secrets
- PayPal e Pepper só aparecem como prontos quando o schema aceita os três gateways
- o indicador de lançamento pago exige o conjunto atual de migrations
- runbook de produção atualizado para Lovable AI, Mercado Pago, PayPal e Pepper


### Etapa 12A — observabilidade das fontes

- registra execuções da ingestão externa e da importação CSV
- guarda fonte, canal, status, quantidades recebidas/inseridas/atualizadas e snapshots
- falhas de observabilidade não bloqueiam a ingestão de produtos
- nova aba Admin → Fontes mostra saúde do catálogo e histórico recente
- cada fonte exibe quantidade de produtos, dado mais recente e última execução registrada
- migration `0006_ingestion_observability.sql` protege o histórico com RLS de administrador
- prepara a operação para conectar TikTok Shop oficial ou outros provedores sem perder rastreabilidade


### Etapa 12B — base oficial do TikTok Shop

- adiciona cliente server-side para TikTok Shop Open API
- implementa assinatura HMAC-SHA256 conforme o sample oficial do TikTok Shop
- usa os hosts oficiais de API e autorização
- prepara geração de URL de autorização do Creator com state obrigatório
- prepara troca de auth code por access/refresh token
- prepara refresh de token
- valida que a autorização retornada pertence a Creator (user_type = 1)
- adiciona request genérico assinado para futuras APIs Affiliate
- credenciais permanecem exclusivamente no servidor
- integração fica desativada por padrão até aprovação no Partner Center
- Admin → Prontidão passa a mostrar o estado básico do conector


### Etapa 12C — OAuth seguro do TikTok Shop

- cria estado OAuth aleatório de uso único e armazena somente o hash no banco
- estado expira em 10 minutos e não pode ser reutilizado
- adiciona callback server-side do TikTok Shop
- tokens de Creator são criptografados com AES-256-GCM antes de persistir
- access token e refresh token nunca são enviados ao navegador
- adiciona status e desconexão autenticados
- tabelas de OAuth/tokens ficam sem grants para anon e authenticated
- somente service_role acessa as credenciais armazenadas
- migration `0007_tiktok_shop_oauth_storage.sql`


### Etapa 12D — conexão TikTok Shop em Configurações

- adiciona card TikTok Shop em Configurações
- mostra estados: em preparação, configuração pendente, não conectado e conectado
- só exibe o botão de conexão quando a feature flag e a configuração segura do servidor estão prontas
- inicia OAuth pelo endpoint autenticado e redireciona para a autorização oficial
- trata retorno de sucesso/erro do callback sem expor tokens
- mostra somente metadados não sensíveis da conexão
- permite desconectar a conta Creator pelo próprio painel
- integração permanece visualmente em preparação enquanto TIKTOK_SHOP_AFFILIATE_ENABLED=false


### Etapa 12E — ciclo de token e vitrine Creator

- corrige os nomes oficiais de expiração `access_token_expires_in` e `refresh_token_expires_in`
- mantém compatibilidade defensiva com a variação antiga já tipada
- faz refresh automático do access token antes de expirar
- valida que o `open_id` permanece o mesmo depois do refresh
- atualiza tokens novamente com AES-256-GCM, sem expor credenciais
- valida `granted_scopes` antes de chamar a API
- adiciona leitura autenticada de Get Showcase Products
- usa o endpoint oficial `GET /affiliate_creator/202405/showcases/products`
- limita `page_size` ao intervalo oficial de 1 a 20
- endpoint interno: `GET /api/integrations/tiktok-shop/showcase`


### Etapa 12F — cache privado da Showcase TikTok

- lê até 5 páginas da vitrine Creator por execução
- extrai IDs retornados pela Showcase oficial
- enriquece cada lote com `POST /affiliate_creator/202509/open_collaborations/products`
- exige `creator.affiliate_collaboration.read` para dados de colaboração
- preserva título, link, imagem, loja, vendas, preço, comissão e moeda nativa
- converte commission rate da API para percentual
- salva os itens em `user_tiktok_showcase_products`, isolados por usuário
- migration `0008_tiktok_showcase_private_cache.sql`
- tabela server-only com RLS e sem grants para `anon` ou `authenticated`
- adiciona botão **Sincronizar vitrine** em Configurações
- endpoint interno: `POST /api/integrations/tiktok-shop/showcase/sync`
- a Showcase de um Creator não alimenta o catálogo global do RadarShop
- descoberta global fica reservada para uma API oficial de busca/colaboração aprovada para o app



### Etapa 12G — oportunidades TikTok no Meu Radar

- integra Creator Search Open Collaboration Product
- usa `POST /affiliate_creator/202405/open_collaborations/products/search`
- exige `creator.affiliate_collaboration.read`
- busca por palavras-chave com até 255 caracteres
- permite ordenar por maior comissão ou unidades vendidas
- retorna até 20 oportunidades por chamada
- resultados ficam ligados à sessão Creator e não são gravados no catálogo global
- Meu Radar ganhou seção separada de oportunidades oficiais do TikTok Shop
- exibe preço, comissão, vendas, loja, região e link oficial quando disponíveis
- não inventa score, preço, comissão ou métrica ausente


### Etapa 12H — paginação da descoberta TikTok

- usa o `next_page_token` oficial retornado pela busca de colaborações
- adiciona **Carregar mais oportunidades** no Meu Radar
- mantém a busca e a ordenação originais ao avançar de página
- acumula resultados sem duplicar produtos pelo ID
- não mistura páginas de filtros diferentes quando o usuário altera o formulário
- continua mantendo os resultados vinculados à sessão Creator, sem gravá-los no catálogo global


### Etapa 12I — acompanhamento privado de oportunidades TikTok

- adiciona **Acompanhar** às oportunidades oficiais encontradas no Meu Radar
- valida o produto novamente na API oficial antes de salvá-lo
- mantém uma lista privada por usuário com limite de 100 oportunidades
- registra leituras históricas de vendas, comissão, preço e disponibilidade
- botão **Atualizar acompanhamento** consulta novamente a API oficial em lotes de até 20 produtos
- mostra variações observadas entre a leitura atual e a anterior, sem transformar variação em probabilidade de venda
- histórico e lista ficam em tabelas server-only, com RLS ativo e sem grants para `anon` ou `authenticated`
- remover um produto apaga também o histórico privado correspondente
- migration `0009_tiktok_opportunity_tracking.sql`
- endpoints internos: `GET/POST/DELETE /api/integrations/tiktok-shop/tracked` e `POST /api/integrations/tiktok-shop/tracked/refresh`


### Etapa 12J — trajetória histórica das oportunidades TikTok

- adiciona **Ver trajetória** em cada oportunidade acompanhada
- consulta o histórico exclusivamente pelo usuário autenticado e pelo produto acompanhado
- retorna até 30 leituras recentes, com contagem total disponível
- mostra evolução observada de vendas, comissão e preço mínimo dentro da janela exibida
- exibe cada leitura com data, estoque, vendas, comissão e preço retornados pela API
- nenhuma variação histórica é tratada como previsão ou probabilidade de venda
- o histórico é invalidado automaticamente depois de **Atualizar acompanhamento**
- endpoint interno: `GET /api/integrations/tiktok-shop/tracked/history?productId=...`
- não exige nova migration: reutiliza a tabela privada criada na Etapa 12I

### Etapa 14F — endurecimento do fluxo público de conta

- páginas de autenticação e redefinição de senha recebem `noindex,nofollow,noarchive`
- cadastro mostra de forma explícita os links para Termos de Uso e Política de Privacidade
- campos de nome, e-mail e senha informam `autocomplete` adequado ao navegador e gerenciadores de senha
- redefinição de senha valida a existência de uma sessão antes de aceitar uma nova credencial
- links de recuperação inválidos ou expirados exibem estado próprio e permitem solicitar um novo link
- testes automatizados protegem esses contratos públicos contra regressões

