# Migrations do RadarShop AI

Este diretório contém migrations publicadas em momentos diferentes do desenvolvimento. Para evitar
quebrar ambientes já existentes, arquivos históricos não devem ser apagados apenas para "arrumar a
numeração".

## Ordem canônica para uma instalação limpa

A ordem oficial para preparar um banco novo é:

1. `0000_radarshop_core_schema.sql`
2. `0001_foundation_security.sql`
3. `0002_plan_usage.sql`
4. `0003_billing_mercado_pago.sql`
5. `0004_multi_gateway_billing.sql`
6. `0005_multi_gateway_readiness.sql`
7. `0006_ingestion_observability.sql`
8. `0007_tiktok_shop_oauth_storage.sql`
9. `0008_tiktok_showcase_private_cache.sql`
10. `0009_tiktok_opportunity_tracking.sql`
11. `0010_security_definer_hardening.sql`
12. `0011_market_intelligence.sql` (Etapa 15A — campos aditivos de inteligência de mercado FastMoss BR e índices)

A mesma sequência operacional está documentada em `docs/PRODUCTION_RUNBOOK.md`.

## Aliases legados preservados

Dois nomes antigos permanecem versionados porque já fizeram parte do histórico publicado:

- `0001_billing_mercado_pago.sql` → conteúdo equivalente a `0003_billing_mercado_pago.sql`
- `0002_0004_multi_gateway_billing.sql` → conteúdo equivalente a `0004_multi_gateway_billing.sql`

Em uma instalação limpa, **não aplique os aliases legados** depois das migrations canônicas.
Eles ficam no repositório somente para preservar compatibilidade e rastreabilidade histórica.

O arquivo `meta/_journal.json` representa o histórico gerado pelo Drizzle em uma fase anterior e
não é a fonte operacional de verdade para as migrations manuais posteriores. Não o reescreva sem
antes confirmar o histórico efetivamente aplicado no banco do Lovable Cloud.

## Estado confirmado no Lovable Cloud — 2026-10-03

No banco atual do projeto RadarShop AI, a tabela `drizzle.__drizzle_migrations` contém três
registros. Os valores de `created_at` coincidem exatamente com as três entradas de
`meta/_journal.json`:

1. `1790399539395` → `0000_radarshop_core_schema`
2. `1790620958978` → `0001_billing_mercado_pago` (alias legado)
3. `1790622627658` → `0002_0004_multi_gateway_billing` (alias legado)

As migrations canônicas posteriores estão refletidas no schema atual — incluindo planos e limites,
billing, diagnóstico multi-gateway, observabilidade de ingestão e as tabelas privadas do TikTok Shop
até a `0009` — mas não aparecem como novas linhas na tabela histórica do Drizzle. A migration `0010` foi aplicada e verificada explicitamente no banco atual em 2026-10-03; ela permanece fora do journal antigo do Drizzle, conforme a estratégia aditiva documentada.

Consequências operacionais:

- **não apague, renomeie nem reescreva os dois aliases legados**: eles fazem parte do histórico real;
- **não edite manualmente `drizzle.__drizzle_migrations`** para tentar alinhar nomes antigos e novos;
- em uma instalação limpa, aplique somente a ordem canônica acima e não execute os aliases;
- no banco atual, trate o histórico existente como imutável e faça mudanças futuras de forma aditiva,
  com verificação de schema antes de executar qualquer nova migration.

## Verificação automática

Execute:

```sh
npm run check:migrations
```

O comando falha se:

- uma migration canônica desaparecer;
- surgir uma migration nova sem ser registrada na ordem oficial;
- um alias legado divergir do seu equivalente canônico;
- o journal apontar para um arquivo inexistente;
- o runbook deixar de listar a ordem oficial.
