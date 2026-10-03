# RadarShop AI — Roadmap operacional

Este arquivo reflete o estado real da `main`. Ele não substitui o runbook de produção.

## Núcleo da v1

- [x] Banco de dados, perfis, papéis, preferências, produtos, histórico, favoritos e projetos
- [x] RLS e endurecimento da fundação
- [x] Landing page pública
- [x] Autenticação por e-mail/senha e Google
- [x] Recuperação de senha
- [x] Onboarding
- [x] Dashboard
- [x] Radar de Produtos com busca, filtros e ordenação
- [x] Página individual do produto
- [x] Favoritos
- [x] Meu Radar personalizado
- [x] Inteligência de Mercado com critérios explicáveis
- [x] Estúdio de Conteúdo com CRUD
- [x] Geração de conteúdo por IA server-side
- [x] Meu Perfil funcional
- [x] Configurações do usuário
- [x] Painel administrativo
- [x] Importação CSV e API de ingestão externa
- [x] Transparência pública
- [x] Política de Privacidade
- [x] Termos de Uso

## Monetização

- [x] Planos Free/Pro no banco e limites de geração
- [x] Administração manual de planos
- [x] Mercado Pago recorrente no código
- [x] PayPal recorrente no código
- [x] Pepper em checkout assistido
- [x] Webhooks e reconciliação para gateways automáticos
- [x] Diagnóstico Admin → Prontidão
- [ ] Definir preço comercial final
- [ ] Definir política comercial final de cancelamento
- [ ] Configurar e testar um gateway com credenciais reais antes de liberar vendas
- [ ] Configurar canal oficial de suporte

## TikTok Shop oficial

- [x] Cliente server-side assinado
- [x] OAuth Creator com state de uso único
- [x] Tokens criptografados no banco
- [x] Refresh automático
- [x] Leitura e cache privado da Showcase
- [x] Busca oficial de oportunidades no Meu Radar
- [x] Paginação
- [x] Acompanhamento privado e histórico de oportunidades
- [ ] Aprovação/allowlist do aplicativo no Partner Center
- [ ] Configurar App Key, App Secret e callback do domínio definitivo
- [ ] Testar o fluxo real com uma conta Creator aprovada

## Catálogo e operação

- [x] Importação administrativa
- [x] Endpoint server-to-server de ingestão
- [x] Observabilidade das fontes
- [ ] Conectar uma fonte operacional autorizada para alimentar o catálogo global
- [ ] Gerar histórico real de métricas com coletas recorrentes
- [ ] Validar o Radar com volume real de produtos

## Qualidade e lançamento

- [x] CI com ESLint, migrations, smoke tests, build e TypeScript
- [x] Ordem canônica das migrations documentada e validada
- [x] Confirmar o histórico efetivamente aplicado no banco e decidir o destino dos aliases legados
- [x] Ampliar testes automatizados para fluxos críticos de billing e TikTok
- [x] Endurecer cadastro e recuperação de senha para pré-lançamento
- [x] Proteger crawling das rotas privadas e sensíveis
- [x] Validar automaticamente o contrato de configuração de produção
- [x] Proteger contratos de autorização administrativa contra regressões
- [ ] Aplicar e verificar no banco a migration 0010 de hardening SECURITY DEFINER
- [ ] Revisão jurídica final dos textos públicos
- [ ] Teste completo em desktop e mobile
- [ ] Teste E2E do primeiro cadastro até geração de conteúdo e plano Pro
- [ ] Domínio público definitivo
- [ ] Checklist final de produção concluído
