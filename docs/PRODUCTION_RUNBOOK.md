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

Aplique no Lovable Cloud / Supabase de produção, nesta ordem:

1. `drizzle/migrations/0001_foundation_security.sql`
2. `drizzle/migrations/0002_plan_usage.sql`
3. `drizzle/migrations/0003_billing_mercado_pago.sql`
4. `drizzle/migrations/0004_multi_gateway_billing.sql`
5. `drizzle/migrations/0005_multi_gateway_readiness.sql`
6. `drizzle/migrations/0006_ingestion_observability.sql`

Depois, acesse **Admin → Prontidão**. A migration 0005 não altera dados comerciais: ela cria uma
RPC somente de leitura, executável apenas pelo service role, usada para confirmar que os constraints
da migration 0004 aceitam `mercado_pago`, `paypal` e `pepper`.

Não habilite PayPal ou Pepper enquanto a migration 0004 não aparecer como pronta.

## 3. Variáveis obrigatórias

### Base

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

A service role nunca deve ser exposta como variável `VITE_*`.

### IA

No Lovable Cloud, o projeto prioriza o Lovable AI Gateway:

- `LOVABLE_API_KEY` é gerenciada pela plataforma
- `LOVABLE_AI_MODEL` é opcional; o código possui modelo padrão

Fora do Lovable Cloud, o fallback externo usa:

- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `OPENAI_BASE_URL` somente se for usado um gateway compatível

### Ingestão

- `PRODUCT_INGEST_SECRET` com valor longo e aleatório

### TikTok Shop Affiliate

Mantenha desativado até o app receber acesso/allowlist no Partner Center:

- `TIKTOK_SHOP_AFFILIATE_ENABLED=false`
- `TIKTOK_SHOP_APP_KEY`
- `TIKTOK_SHOP_APP_SECRET`

`TIKTOK_SHOP_APP_SECRET` é estritamente server-side e nunca deve existir como variável `VITE_*`.
A feature flag impede chamadas externas acidentais antes da aprovação do aplicativo.

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

1. faça deploy com `AI_USAGE_LIMITS_ENABLED=false` e todos os `*_BILLING_ENABLED=false`
2. aplique as migrations 0001, 0002, 0003, 0004, 0005 e 0006
3. configure Supabase/Lovable Cloud, IA e segredo de ingestão
4. abra **Admin → Prontidão** e confirme banco base, migrations 0002/0003/0004/0005 e IA
5. abra **Admin → Fontes** e confirme que o histórico da migration 0006 está acessível
6. ative `AI_USAGE_LIMITS_ENABLED=true`
7. teste geração de IA e consumo de cota com uma conta interna
8. configure primeiro apenas o gateway que será testado
9. confirme em **Admin → Prontidão** que checkout e reconciliação desse gateway estão prontos
10. habilite a flag `*_BILLING_ENABLED=true` somente para esse gateway
11. execute uma assinatura controlada/teste autorizado
12. confirme criação do registro de billing e recebimento dos eventos
13. teste sincronização e cancelamento quando o gateway oferecer gerenciamento automático
14. mantenha os outros gateways desativados até serem testados individualmente
15. só então libere checkout para usuários externos

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

### Migrations multi-gateway

Aplique `drizzle/migrations/0004_multi_gateway_billing.sql` antes de habilitar PayPal ou Pepper.

Em seguida, aplique `drizzle/migrations/0005_multi_gateway_readiness.sql`. Ela cria apenas uma
função de diagnóstico server-side, sem alterar assinaturas ou eventos existentes. **Admin → Prontidão**
usa essa função para confirmar que os dois constraints aceitam Mercado Pago, PayPal e Pepper.


## 11. Observabilidade de ingestão

A migration `0006_ingestion_observability.sql` cria `ingestion_runs`.

O histórico registra:

- fonte
- canal (`api` ou `csv`)
- status da execução
- quantidade recebida
- inseridos
- atualizados
- snapshots gravados
- horário de coleta e execução
- erro operacional sanitizado quando houver

A tabela usa RLS. Usuários comuns não recebem acesso; somente administradores autenticados podem
consultar/gravar pelo painel, enquanto integrações server-to-server usam o service role.

A observabilidade é propositalmente best-effort: uma falha ao registrar o histórico não deve
interromper uma ingestão válida de produtos.


## 12. TikTok Shop Affiliate

A base server-side do conector segue a documentação e o sample oficial do TikTok Shop.

Fluxo preparado:

1. registrar/aprovar o aplicativo Affiliate no TikTok Shop Partner Center
2. configurar `TIKTOK_SHOP_APP_KEY` e `TIKTOK_SHOP_APP_SECRET`
3. manter `TIKTOK_SHOP_AFFILIATE_ENABLED=false` enquanto o acesso não estiver liberado
4. após aprovação, gerar um `state` imprevisível e construir a URL de autorização do Creator
5. validar o `state` no callback antes de aceitar o `code`
6. trocar o auth code pelo access/refresh token no servidor
7. validar `code == 0`, `user_type == 1` e os scopes concedidos
8. somente depois conectar APIs Affiliate e alimentar a ingestão normalizada do RadarShop

O cliente implementa a assinatura HMAC-SHA256 usada pela Open API e mantém app secret e tokens
fora do navegador.

Esta etapa não persiste tokens de Creator. Persistência multiusuário só deve ser adicionada junto
com armazenamento seguro/criptografado e fluxo de revogação/refresh. Até isso existir, não coloque
access token ou refresh token em tabelas comuns nem em variáveis `VITE_*`.
