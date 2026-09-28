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
