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
- dashboard inicial
- endurecimento de segurança em migration
- remoção do `.env` versionado
- CI com lint dirigido e build de produção

A migration `drizzle/migrations/0001_foundation_security.sql` deve ser aplicada ao banco Supabase do ambiente antes de considerar a infraestrutura de produção sincronizada.

### Etapa 2 — Dashboard real

Em desenvolvimento. O objetivo é transformar `/dashboard` em uma visão geral alimentada exclusivamente por dados existentes no banco, com contagem de produtos, favoritos, projetos de conteúdo, preferências do usuário e produtos atualizados recentemente.

## Fluxo base

```text
Landing
  ↓
Cadastro / Login
  ↓
Onboarding
  ↓
Dashboard
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
