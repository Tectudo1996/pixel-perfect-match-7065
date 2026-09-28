# Diagnóstico do ambiente — RADARSHOP AI

Somente leitura. Nenhum código, banco ou secret foi alterado. Nenhum valor é exibido — apenas presença/ausência.

## Configurações solicitadas (secrets do backend)

Nenhuma das configurações abaixo está definida no ambiente do projeto. O cofre de secrets contém apenas dois itens gerenciados pela plataforma: `LOVABLE_API_KEY` e `LOVABLE_CRON_SECRET` (presentes, gerenciados — fora da lista solicitada).

| Configuração | Status |
|---|---|
| OPENAI_API_KEY | Ausente |
| OPENAI_MODEL | Ausente |
| OPENAI_BASE_URL | Ausente |
| PRODUCT_INGEST_SECRET | Ausente |
| AI_USAGE_LIMITS_ENABLED | Ausente |
| AI_FREE_MONTHLY_LIMIT | Ausente |
| AI_PRO_MONTHLY_LIMIT | Ausente |
| APP_PUBLIC_URL | Ausente |
| MERCADO_PAGO_BILLING_ENABLED | Ausente |
| MERCADO_PAGO_ACCESS_TOKEN | Ausente |
| MERCADO_PAGO_WEBHOOK_SECRET | Ausente |
| MERCADO_PAGO_PRO_MONTHLY_BRL | Ausente |
| PAYPAL_BILLING_ENABLED | Ausente |
| PAYPAL_ENVIRONMENT | Ausente |
| PAYPAL_CLIENT_ID | Ausente |
| PAYPAL_CLIENT_SECRET | Ausente |
| PAYPAL_PLAN_ID | Ausente |
| PAYPAL_WEBHOOK_ID | Ausente |
| PAYPAL_PRO_MONTHLY_BRL | Ausente |
| PEPPER_BILLING_ENABLED | Ausente |
| PEPPER_CHECKOUT_URL | Ausente |
| PEPPER_PRO_MONTHLY_BRL | Ausente |

## Observações de leitura (sem valores)

- O código referencia vários desses nomes (ex.: `OPENAI_API_KEY`, `MERCADO_PAGO_ACCESS_TOKEN`, `PAYPAL_*`, `PEPPER_*`, `PRODUCT_INGEST_SECRET`, `APP_PUBLIC_URL`), então os recursos que dependem deles estão inativos até serem preenchidos em Configurações do Projeto → Secrets.
- `AI_FREE_MONTHLY_LIMIT` e `AI_PRO_MONTHLY_LIMIT` não são lidos por nenhum código atual (apenas `AI_USAGE_LIMITS_ENABLED` é, em `src/lib/usage.server.ts`).
- O arquivo `.env` local contém apenas variáveis públicas de conexão (URL e chave pública do backend) — nenhum segredo da lista acima.

## App publicado × banco Lovable Cloud

Confirmado: o app publicado aponta para a instância Lovable Cloud atual (ref `rpocaokydibuypwpzptg`), a mesma referência definida tanto no arquivo de conexão do navegador (`src/lib/cloud-client.ts`) quanto na configuração de build (`vite.config.ts`), com a chave pública correspondente. Ou seja, o site publicado está lendo/gravando no banco atual do projeto.

## Próximo passo (opcional)

Para ativar IA e cobranças, cada item ausente precisa ser cadastrado em Configurações do Projeto → Secrets. Posso orientar a lista exata de valores quando você quiser habilitar cada provedor.
