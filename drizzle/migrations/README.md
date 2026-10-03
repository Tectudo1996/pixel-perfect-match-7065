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
