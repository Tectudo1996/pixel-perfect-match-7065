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

### Etapa 5 — Meu Radar

Em desenvolvimento. Personaliza a seleção com categorias, faixa de comissão e objetivo do onboarding, mantendo critérios explicáveis e sem score artificial.

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
