# ✅ Checklist Completo de Validação do Sistema

## 📋 Visão Geral

Este documento contém um checklist completo para validação de todas as funcionalidades do sistema Smart Signage Pro v2.1, incluindo autenticação, autorização, CRUDs, integrações e interface do usuário.

## 🔐 1. Autenticação e Autorização

### 1.1 Login e Sessão
- [ ] Login de system_user funciona corretamente
- [ ] Login de subscriber_user funciona corretamente
- [ ] Login de publisher_user funciona corretamente
- [ ] Login de publisher_subscriber funciona corretamente
- [ ] Redirecionamento automático baseado em `userType` funciona
- [ ] Token JWT é gerado corretamente
- [ ] Refresh token funciona
- [ ] Logout limpa tokens corretamente
- [ ] Sessão expira após tempo configurado
- [ ] 2FA funciona (se habilitado)

### 1.2 Permissões e Roles
- [ ] `owner_system` tem acesso total a todos os recursos
- [ ] `admin_sql` tem acesso total a todos os recursos
- [ ] `admin` tem acesso conforme permissões
- [ ] `operador_tecnico` tem acesso apenas a recursos técnicos
- [ ] `operador_faturamento` tem acesso apenas a faturamento
- [ ] `operador_comercial` tem acesso apenas a comerciais
- [ ] `publisher_user` vê apenas seus próprios dados
- [ ] `subscriber_user` vê apenas seus próprios dados
- [ ] `publisher_subscriber` vê dados de publisher e subscriber

### 1.3 Flags de Permissão
- [ ] `flag_smart_0` controla acesso técnico (totens, Smart TVs, players)
- [ ] `flag_smart_1` controla acesso a OTA Updates
- [ ] `flag_smart_2` controla acesso a Admin Tools
- [ ] `flag_smart_3` controla acesso a Faturamento
- [ ] Flags padrão da role são aplicadas corretamente
- [ ] Flags específicas do usuário sobrescrevem flags da role
- [ ] Menu filtra itens baseado em flags

## 👥 2. CRUD de Usuários

### 2.1 Listagem
- [ ] `GET /api/users` lista usuários corretamente
- [ ] Filtro por `role` funciona
- [ ] Filtro por `userType` funciona
- [ ] Filtro por `publisherId` funciona
- [ ] Filtro por `subscriberId` funciona
- [ ] Busca por nome/username/email funciona
- [ ] Paginação funciona corretamente
- [ ] Apenas `admin`, `admin_sql`, `owner_system` podem listar

### 2.2 Criação
- [ ] `POST /api/users` cria usuário com todas as novas roles
- [ ] Criação com `userType` funciona
- [ ] Criação com `publisherId` funciona
- [ ] Criação com `subscriberId` funciona
- [ ] Criação com `flags` funciona
- [ ] Validação de campos obrigatórios funciona
- [ ] Validação de email único funciona
- [ ] Validação de username único funciona
- [ ] Senha é hasheada corretamente

### 2.3 Atualização
- [ ] `PUT /api/users/:id` atualiza usuário corretamente
- [ ] Atualização de `role` funciona
- [ ] Atualização de `userType` funciona
- [ ] Atualização de `flags` funciona
- [ ] Atualização de senha funciona
- [ ] Validações são aplicadas

### 2.4 Exclusão
- [ ] `DELETE /api/users/:id` faz soft delete
- [ ] Usuário excluído não aparece em listagens
- [ ] Usuário excluído não pode fazer login

### 2.5 Flags
- [ ] `GET /api/users/:id/flags` retorna flags corretas
- [ ] `PUT /api/users/:id/flags` atualiza flags
- [ ] `POST /api/users/:id/flags/:flagName` ativa flag
- [ ] `DELETE /api/users/:id/flags/:flagName` desativa flag
- [ ] Flags combinam user_flags > role_flags_default > false

### 2.6 Roles
- [ ] `GET /api/users/:id/roles` lista roles
- [ ] `POST /api/users/:id/roles` define roles
- [ ] `POST /api/users/:id/roles/:roleId` adiciona role
- [ ] `DELETE /api/users/:id/roles/:roleId` remove role

## 📢 3. Publicadores (Publishers)

### 3.1 CRUD Básico
- [ ] Listar publicadores funciona
- [ ] Criar publicador funciona
- [ ] Atualizar publicador funciona
- [ ] Excluir publicador funciona
- [ ] Filtros por tipo funcionam
- [ ] Busca funciona

### 3.2 Relacionamentos
- [ ] Listar locais de um publicador funciona
- [ ] Listar totens de um publicador funciona
- [ ] Listar Smart TVs de um publicador funciona
- [ ] Hierarquia Publisher → Local → Totem → Smart TV está correta

### 3.3 Permissões
- [ ] Publicadores veem apenas seus próprios dados
- [ ] Admins veem todos os publicadores
- [ ] Isolamento de dados funciona corretamente

## 📍 4. Locais (Locals)

### 4.1 CRUD
- [ ] Listar locais funciona
- [ ] Criar local funciona
- [ ] Atualizar local funciona
- [ ] Excluir local funciona
- [ ] Filtro por publicador funciona

### 4.2 Relacionamentos
- [ ] Local está vinculado a um publicador
- [ ] Listar totens de um local funciona

## 📺 5. Totens

### 5.1 CRUD
- [ ] Listar totens funciona
- [ ] Criar totem funciona
- [ ] Atualizar totem funciona
- [ ] Excluir totem funciona
- [ ] Filtro por local funciona
- [ ] Filtro por publicador funciona

### 5.2 Relacionamentos
- [ ] Totem está vinculado a um local
- [ ] Listar Smart TVs de um totem funciona (1:N)
- [ ] Relação Totem → Smart TV (1:N) está correta

## 📱 6. Smart TVs

### 6.1 CRUD
- [ ] Listar Smart TVs funciona
- [ ] Criar Smart TV funciona
- [ ] Atualizar Smart TV funciona
- [ ] Excluir Smart TV funciona
- [ ] Filtro por totem funciona
- [ ] Filtro por publicador funciona
- [ ] Filtro `active_only` funciona

### 6.2 Permissões
- [ ] Publicadores veem apenas suas Smart TVs
- [ ] `flag_smart_0` é necessária para system users (exceto admins)
- [ ] Publicadores/subscribers não precisam de flag
- [ ] Acesso negado (403) funciona corretamente

## 👤 7. Subscribers (Anunciantes)

### 7.1 CRUD
- [ ] Listar subscribers funciona
- [ ] Criar subscriber funciona
- [ ] Atualizar subscriber funciona
- [ ] Excluir subscriber funciona

### 7.2 Acesso a Publicadores
- [ ] Subscriber pode solicitar acesso a publicador
- [ ] Publicador pode aprovar/negar acesso
- [ ] Controle de acesso funciona
- [ ] Expiração de acesso funciona

## 💳 8. Assinaturas (Subscriptions)

### 8.1 CRUD
- [ ] Listar assinaturas funciona
- [ ] Criar assinatura funciona
- [ ] Atualizar assinatura funciona
- [ ] Cancelar assinatura funciona
- [ ] Retomar assinatura funciona

### 8.2 Permissões
- [ ] Publicadores veem apenas suas assinaturas
- [ ] Subscribers veem assinaturas do seu publicador
- [ ] Admins veem todas as assinaturas
- [ ] Erro 500 corrigido (usando publisherId/subscriberId)

### 8.3 Integração Stripe
- [ ] Checkout session funciona
- [ ] Webhook do Stripe funciona
- [ ] Processamento de pagamentos funciona

## 🎬 9. Mídia (Media)

### 9.1 Upload
- [ ] Upload de arquivo funciona
- [ ] Validação de tipo de arquivo funciona
- [ ] Validação de tamanho funciona
- [ ] Processamento de vídeo funciona

### 9.2 Gerenciamento
- [ ] Listar mídias funciona
- [ ] Editar metadados funciona
- [ ] Excluir mídia funciona
- [ ] Filtro por subscriber funciona

## 📋 10. Playlists

### 10.1 CRUD
- [ ] Listar playlists funciona
- [ ] Criar playlist funciona
- [ ] Atualizar playlist funciona
- [ ] Excluir playlist funciona
- [ ] Adicionar mídia à playlist funciona
- [ ] Remover mídia da playlist funciona

### 10.2 Permissões
- [ ] Isolamento por subscriber funciona
- [ ] Publicadores veem apenas suas playlists

## 🎯 11. Campanhas (Campaigns)

### 11.1 CRUD
- [ ] Listar campanhas funciona
- [ ] Criar campanha funciona
- [ ] Atualizar campanha funciona
- [ ] Excluir campanha funciona
- [ ] Ativar/desativar campanha funciona

### 11.2 Relacionamentos
- [ ] Campanha vinculada a subscriber funciona
- [ ] Campanha vinculada a playlists funciona
- [ ] Campanha vinculada a totens funciona

## 🎮 12. Players

### 12.1 Gerenciamento
- [ ] Listar players funciona
- [ ] Registrar player funciona
- [ ] Atualizar player funciona
- [ ] Heartbeat funciona
- [ ] Status online/offline funciona

### 12.2 Permissões
- [ ] `flag_smart_0` necessária para acesso
- [ ] Publicadores veem apenas seus players

## 📊 13. Dashboard

### 13.1 Visualização
- [ ] Dashboard carrega corretamente
- [ ] Estatísticas são exibidas
- [ ] Gráficos funcionam
- [ ] Filtros funcionam

### 13.2 Permissões
- [ ] Cada tipo de usuário vê seu dashboard
- [ ] Dados são filtrados corretamente

## 📈 14. Analytics e Relatórios

### 14.1 Analytics
- [ ] Métricas são calculadas corretamente
- [ ] Filtros funcionam
- [ ] Exportação funciona

### 14.2 Relatórios
- [ ] Geração de relatórios funciona
- [ ] Exportação em PDF funciona
- [ ] Exportação em Excel funciona

## ⚙️ 15. Configurações

### 15.1 Sistema
- [ ] Listar configurações funciona
- [ ] Atualizar configurações funciona
- [ ] Validação de configurações funciona

### 15.2 Permissões
- [ ] Apenas admins podem alterar configurações

## 🔔 16. Notificações

### 16.1 Sistema
- [ ] Notificações são exibidas
- [ ] Notificações são salvas
- [ ] Marcar como lida funciona

## 🎨 17. Interface do Usuário

### 17.1 Menu Hierárquico
- [ ] Menu em árvore funciona
- [ ] Submenus expandem/colapsam
- [ ] Filtragem por role funciona
- [ ] Filtragem por flags funciona
- [ ] Ícones são exibidos corretamente
- [ ] Badges funcionam

### 17.2 Navegação
- [ ] Rotas funcionam corretamente
- [ ] Redirecionamentos funcionam
- [ ] Breadcrumbs funcionam

### 17.3 Responsividade
- [ ] Interface funciona em desktop
- [ ] Interface funciona em tablet
- [ ] Interface funciona em mobile

## 🌐 18. Subdomínios

### 18.1 Detecção
- [ ] Subdomínio de publisher é detectado
- [ ] Subdomínio de subscriber é detectado
- [ ] Redirecionamento funciona

### 18.2 Nginx
- [ ] Configuração de subdomínios funciona
- [ ] Headers `X-Subdomain-Type` são enviados
- [ ] Proxy reverso funciona

## 🔒 19. Segurança

### 19.1 Rate Limiting
- [ ] Rate limiting funciona
- [ ] Mensagens de erro são exibidas
- [ ] Retry after é calculado corretamente

### 19.2 Validação
- [ ] Validação de entrada funciona
- [ ] Sanitização funciona
- [ ] SQL injection prevenido

### 19.3 CORS
- [ ] CORS configurado corretamente
- [ ] Headers de segurança funcionam

## 🗄️ 20. Banco de Dados

### 20.1 Schema
- [ ] Todas as tabelas existem
- [ ] Relacionamentos estão corretos
- [ ] Constraints funcionam
- [ ] Índices estão otimizados

### 20.2 Dados Iniciais
- [ ] Roles são criadas
- [ ] Flags padrão são configuradas
- [ ] Usuário admin inicial existe

## 📝 21. Logs e Auditoria

### 21.1 Logs
- [ ] Logs são gerados
- [ ] Logs são salvos
- [ ] Rotação de logs funciona

### 21.2 Auditoria
- [ ] Ações são registradas
- [ ] Histórico é mantido

## 🧪 22. Testes de Integração

### 22.1 Fluxos Completos
- [ ] Criar publicador → criar local → criar totem → criar Smart TV
- [ ] Criar subscriber → solicitar acesso → aprovar acesso
- [ ] Criar campanha → adicionar mídia → criar playlist → associar a totem
- [ ] Criar usuário → atribuir flags → verificar acesso

## 📊 23. Performance

### 23.1 Tempo de Resposta
- [ ] APIs respondem em < 500ms
- [ ] Queries complexas são otimizadas
- [ ] Cache funciona quando aplicável

### 23.2 Carga
- [ ] Sistema suporta múltiplos usuários simultâneos
- [ ] Uploads grandes funcionam
- [ ] Processamento em background funciona

## ✅ 24. Validação Final

### 24.1 Checklist Geral
- [ ] Todos os endpoints retornam status correto
- [ ] Mensagens de erro são claras
- [ ] Validações funcionam em todos os campos
- [ ] Permissões são aplicadas consistentemente
- [ ] Isolamento de dados funciona
- [ ] Interface está responsiva
- [ ] Navegação funciona sem erros
- [ ] Sem erros no console do navegador
- [ ] Sem erros no backend

## 🎯 Priorização de Testes

### Alta Prioridade 🔴
1. Autenticação e autorização
2. CRUD de usuários com flags
3. Permissões de publicadores/subscribers
4. Menu hierárquico e filtragem

### Média Prioridade 🟡
5. CRUDs principais (Publicadores, Locais, Totens, Smart TVs)
6. Assinaturas e faturamento
7. Mídia e playlists
8. Campanhas

### Baixa Prioridade 🟢
9. Analytics e relatórios
10. Configurações avançadas
11. Integrações externas
12. Performance e otimizações

## 📝 Notas

- Este checklist deve ser atualizado conforme novas funcionalidades são adicionadas
- Testes devem ser executados após cada deploy
- Problemas encontrados devem ser documentados e corrigidos
- Validações devem ser feitas em ambiente de staging antes de produção
