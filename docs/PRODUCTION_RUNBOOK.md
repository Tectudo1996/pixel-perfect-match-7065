# RadarShop AI — Runbook de Produção

Este documento é o roteiro operacional para colocar o RadarShop AI em produção sem depender da memória de conversas.

## 1. Decisões que precisam existir antes de ativar cobrança

- domínio público definitivo usado em `APP_PUBLIC_URL`
- preço mensal do Pro em `MERCADO_PAGO_PRO_MONTHLY_BRL`
- política comercial de cancelamento
- canal de suporte ao cliente
- revisão final dos textos legais e de privacidade antes do lançamento público

A implementação atual cancela o Pro imediatamente depois que o Mercado Pago confirma o cancelamento.
Se a política comercial mudar para manter acesso até o fim do período já pago, o entitlement deverá
ser alterado antes do lançamento.

## 2. Ordem das migrations

Aplique no Supabase de produção, nesta ordem:

1. `drizzle/migrations/0001_foundation_security.sql`
2. `drizzle/migrations/0002_plan_usage.sql`
3. `drizzle/migrations/0003_billing_mercado_pago.sql`

Depois, acesse **Admin → Prontidão**. Não ative cobrança enquanto as migrations 0002 e 0003 não
aparecerem como disponíveis.

## 3. Variáveis obrigatórias

### Base

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

A service role nunca deve ser exposta como variável `VITE_*`.

### IA

- `OPENAI_API_KEY`
- `OPENAI_MODEL` quando necessário
- `OPENAI_BASE_URL` somente se for usado um gateway compatível

### Ingestão

- `PRODUCT_INGEST_SECRET` com valor longo e aleatório

### Planos

- `AI_USAGE_LIMITS_ENABLED=false` durante preparação
- `AI_FREE_MONTHLY_LIMIT`
- `AI_PRO_MONTHLY_LIMIT`

### Mercado Pago

- `MERCADO_PAGO_ACCESS_TOKEN`
- `MERCADO_PAGO_WEBHOOK_SECRET`
- `MERCADO_PAGO_PRO_MONTHLY_BRL`
- `MERCADO_PAGO_PRO_REASON`
- `APP_PUBLIC_URL`
- `MERCADO_PAGO_BILLING_ENABLED=false` durante preparação

`MERCADO_PAGO_BILLING_ENABLED` controla **novos checkouts**. Desligar essa flag não deve impedir a
reconciliação de Webhooks nem o gerenciamento de assinaturas já existentes.

## 4. Configuração do Mercado Pago

Endpoint de Webhook:

`https://SEU-DOMINIO/api/webhooks/mercado-pago`

Tópicos usados pela aplicação:

- `subscription_preapproval`
- `subscription_authorized_payment`

O servidor valida `x-signature`, `x-request-id` e `data.id` antes de processar a notificação.
A aplicação também consulta o recurso diretamente na API do Mercado Pago antes de alterar o plano.

Referências oficiais:

- https://www.mercadopago.com.br/developers/pt/docs/subscriptions/integration-configuration/subscription-no-associated-plan/pending-payments
- https://www.mercadopago.com.br/developers/pt/docs/subscriptions/subscription-management
- https://www.mercadopago.com.br/developers/pt/docs/links-and-debts/additional-content/your-integrations/notifications/webhooks

## 5. Ordem segura de ativação

1. faça deploy com `AI_USAGE_LIMITS_ENABLED=false` e `MERCADO_PAGO_BILLING_ENABLED=false`
2. aplique as migrations 0001, 0002 e 0003
3. configure Supabase, IA e segredo de ingestão
4. abra **Admin → Prontidão** e confirme o banco base
5. ative `AI_USAGE_LIMITS_ENABLED=true`
6. teste geração de IA e consumo de cota com uma conta interna
7. configure Access Token, Webhook Secret, preço e domínio do Mercado Pago
8. cadastre o Webhook no Mercado Pago
9. confirme em **Admin → Prontidão** que a reconciliação está pronta
10. ative `MERCADO_PAGO_BILLING_ENABLED=true`
11. execute uma assinatura real controlada/teste autorizado
12. confirme criação do registro de billing e recebimento dos eventos
13. teste sincronização manual
14. teste cancelamento
15. só então libere o checkout para usuários externos

## 6. Checklist após deploy

- `GET /api/health` responde 200
- login e logout funcionam
- onboarding conclui e redireciona para Dashboard
- Radar carrega catálogo
- Favoritos persistem
- Meu Radar respeita preferências
- Inteligência de Mercado abre sem erro
- Estúdio salva projeto
- geração por IA consome uma unidade quando limites estão ativos
- falha do provedor devolve a unidade reservada
- Admin → Prontidão não expõe segredos
- checkout abre no Mercado Pago somente quando habilitado
- retorno do navegador não ativa Pro sozinho
- Webhook autorizado ativa Pro
- cancelamento confirmado retorna o usuário ao Free
- novas vendas podem ser pausadas sem desligar a reconciliação de assinaturas existentes

## 7. Pausar novas vendas sem perder reconciliação

Para interromper novas assinaturas:

`MERCADO_PAGO_BILLING_ENABLED=false`

Mantenha configurados:

- `MERCADO_PAGO_ACCESS_TOKEN`
- `MERCADO_PAGO_WEBHOOK_SECRET`
- Supabase e migrations de billing

Assim, novas vendas ficam bloqueadas, mas eventos e assinaturas já existentes continuam podendo ser
sincronizados e gerenciados.

## 8. Incidente de billing

Se houver comportamento inesperado:

1. desligue `MERCADO_PAGO_BILLING_ENABLED` para bloquear novos checkouts
2. não remova imediatamente Access Token ou Webhook Secret
3. verifique Admin → Prontidão
4. confira os registros em `billing_webhook_events`
5. use “Atualizar status” na conta afetada
6. compare o estado local com o estado da assinatura no Mercado Pago
7. só remova credenciais se a decisão for interromper também reconciliação e autoatendimento

## 9. CI obrigatório

Antes de merge na `main`, o projeto deve passar por:

- ESLint
- build de produção
- `tsc --noEmit`

Não ignore um erro de typecheck apenas porque o bundler conseguiu gerar o build.

## 10. Gateways adicionais

### PayPal

Variáveis:

- `PAYPAL_BILLING_ENABLED`
- `PAYPAL_ENVIRONMENT=sandbox|live`
- `PAYPAL_CLIENT_ID`
- `PAYPAL_CLIENT_SECRET`
- `PAYPAL_PLAN_ID`
- `PAYPAL_WEBHOOK_ID`
- `PAYPAL_PRO_MONTHLY_BRL`
- `PAYPAL_BRAND_NAME`

Webhook:

`POST /api/webhooks/paypal`

Comece em sandbox. O valor em `PAYPAL_PRO_MONTHLY_BRL` deve corresponder ao plano cadastrado no PayPal.

### Pepper

Variáveis:

- `PEPPER_BILLING_ENABLED`
- `PEPPER_CHECKOUT_URL`
- `PEPPER_PRO_MONTHLY_BRL`

A Pepper fica disponível como checkout alternativo, mas a ativação automática do Pro permanece
desabilitada até o contrato de API/Webhook da conta ser validado. Não trate retorno visual do
checkout como confirmação de pagamento.

### Migration multi-gateway

Aplique `drizzle/migrations/0004_multi_gateway_billing.sql` antes de habilitar PayPal ou Pepper.
