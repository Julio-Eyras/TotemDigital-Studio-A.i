# FAQ - Perguntas Frequentes

## Geral

### O que é o SmartSignage Pro?
SmartSignage Pro é uma plataforma completa de gerenciamento de sinalização digital que permite criar, gerenciar e distribuir conteúdo multimídia para totens digitais em tempo real.

### Quais navegadores são suportados?
- Chrome/Edge (recomendado)
- Firefox
- Safari
- Opera

### O sistema funciona offline?
O player pode funcionar offline usando cache local, mas a criação e gerenciamento de conteúdo requer conexão com o servidor.

## Campanhas

### Como criar uma campanha?
Acesse **Campanhas** → **Nova Campanha**, preencha os dados, vincule playlists e totens, e salve. Veja o [Manual do Usuário](./02-manual-usuario.md) para detalhes.

### Por que minha campanha não está sendo exibida?
Verifique:
1. Status da campanha está "Ativa"?
2. Período de exibição está correto (data/hora)?
3. Totem está online e ativo?
4. Campanha foi aprovada pelo publisher?
5. Há outras campanhas com maior prioridade?

### Como definir prioridade de campanhas?
Use valores de 0-100. Maior número = maior prioridade. Em caso de conflito, a campanha com maior prioridade é selecionada.

### Posso pausar uma campanha temporariamente?
Sim. Acesse a campanha e altere o status para "Pausada". Ela não será exibida até ser reativada.

## Playlists

### Quantos itens uma playlist pode ter?
Não há limite técnico, mas recomenda-se 5-10 itens para melhor performance.

### Como reordenar itens da playlist?
Arraste os itens ou use os botões ↑↓ na lista.

### Posso usar a mesma mídia em múltiplas playlists?
Sim, uma mídia pode ser usada em quantas playlists desejar.

## Mídias

### Quais formatos de vídeo são suportados?
MP4 (H.264), WebM, MOV. Recomenda-se MP4 para melhor compatibilidade.

### Qual o tamanho máximo de arquivo?
Padrão: 500MB. Pode ser configurado pelo administrador.

### Quanto tempo leva para processar um vídeo?
Depende do tamanho e duração. Vídeos pequenos (< 50MB) geralmente processam em segundos. Vídeos grandes podem levar alguns minutos.

### Por que minha mídia foi rejeitada?
Publishers podem rejeitar mídias por:
- Conteúdo inadequado
- Qualidade baixa
- Formato não suportado
- Violação de políticas

Verifique o motivo da rejeição na notificação ou na página da mídia.

## Totens

### Como cadastrar um novo totem?
Acesse **Totens** → **Novo Totem**, preencha os dados (nome, UIN, local) e salve.

### O que é UIN?
UIN (Unique Identifier Number) é o identificador único do totem. Formato: `UIN-{CATEGORIA}-{NUMERO}-{ANO}`. Exemplo: `UIN-SHOPPING-001-2025`.

### Por que meu totem aparece como offline?
Possíveis causas:
1. Totem desconectado da rede
2. Player não está rodando
3. Problema de conectividade
4. Totem em manutenção

Verifique a conexão de rede e o status do player no totem.

### Como reiniciar um totem remotamente?
Acesse **Totens** → Selecione o totem → **Comandos** → **Reboot**. O comando será enviado no próximo heartbeat (até 30 segundos).

## Dispatcher e Exibição

### Como o sistema decide qual campanha exibir?
O Dispatcher considera:
1. Validação temporal (data/hora válida?)
2. Validação técnica (mídia compatível?)
3. Validação comercial (regras de negócio)
4. Prioridade da campanha
5. Score calculado (em caso de empate)

### Por que aparece a vinheta padrão SmartSignage?
A vinheta padrão é exibida quando:
- Não há campanhas ativas para o totem
- Todas as campanhas foram rejeitadas nas validações
- Período de exibição não está válido

### Com que frequência o totem atualiza o conteúdo?
O player sincroniza com o servidor a cada 15 minutos. Mudanças podem levar até 15 minutos para refletir.

### O que acontece se houver erro na reprodução?
O player registra o erro e tenta reproduzir o próximo item. Erros são registrados no sistema para análise.

## Permissões e Acesso

### Qual a diferença entre Subscriber e Publisher?
- **Subscriber**: Cria campanhas e conteúdo. Precisa de aprovação do publisher.
- **Publisher**: Gerencia totens e aprova/rejeita campanhas de subscribers.

### Como solicitar acesso a um publisher?
Contate o administrador do sistema ou o publisher diretamente. O acesso é concedido via contratos.

### Posso ter múltiplos roles?
Sim, um usuário pode ter múltiplos roles (ex: subscriber + publisher).

## Relatórios

### Como gerar um relatório?
Acesse **Relatórios**, selecione o tipo (Campanhas, Totens, etc.), defina período e filtros, e clique em **Gerar**.

### Posso exportar relatórios?
Sim, relatórios podem ser exportados em CSV ou PDF após serem gerados.

### Com que frequência os dados são atualizados?
Dados são atualizados em tempo real. Relatórios refletem dados até o momento da geração.

## Problemas Técnicos

### O player não carrega conteúdo
Verifique:
1. UIN está correto na URL?
2. Totem está online?
3. Há campanhas ativas?
4. Console do navegador mostra erros?

### Erro "Não foi possível gerar plano de exibição"
Isso indica que não há campanhas válidas para o totem. Verifique:
1. Há campanhas ativas vinculadas ao totem?
2. Período de exibição está válido?
3. Campanhas foram aprovadas?

### Erro ao fazer upload de mídia
Verifique:
1. Formato do arquivo é suportado?
2. Tamanho está dentro do limite?
3. Conexão estável?
4. Permissões de upload estão corretas?

## Suporte

### Como obter ajuda?
1. Consulte esta FAQ
2. Veja os [Tutoriais](./04-tutoriais.md)
3. Acesse o [Manual do Usuário](./02-manual-usuario.md)
4. Contate o suporte técnico

### Onde reportar bugs?
Reporte bugs através do sistema de suporte ou contate o administrador do sistema.

---

**Última Atualização**: Janeiro 2026
