# Offer Magnet

CRIAR SAAS — CENTRAL DE OFERTAS E AFILIADOS



Quero criar uma plataforma SaaS completa de automação de ofertas para afiliados, inspirada na lógica de plataformas como OfertaFlux e BuboFlow, porém com identidade visual, código, estrutura e experiência próprias. NÃO copie código, textos, layout ou identidade visual dessas plataformas.



O objetivo é criar uma plataforma que futuramente consiga captar ofertas de Shopee, Mercado Livre, Amazon e SHEIN por meio das APIs oficiais/disponíveis de cada plataforma, transformar os produtos em ofertas atrativas, converter os links para links de afiliado, aplicar regras de seleção, gerar copies automaticamente e publicar nos canais/grupos cadastrados.



IMPORTANTE:



- Não invente APIs, endpoints, credenciais ou integrações que não existam.

- Quando uma integração externa ainda não estiver configurada, crie uma arquitetura preparada para recebê-la.

- Não use scraping como solução principal quando houver API oficial disponível.

- A arquitetura deve ser modular, permitindo adicionar novos marketplaces e canais futuramente.

- O sistema deverá ser multiusuário desde o início, porque futuramente será vendido como SaaS para outros afiliados.

- Cada usuário deve ter suas próprias credenciais, links de afiliado, grupos, regras, ofertas e métricas.

- Nunca misture dados de usuários diferentes.

- O sistema deve estar preparado para LGPD, segurança, autenticação e isolamento de dados.



==================================================



1. TECNOLOGIA E ARQUITETURA

   ==================================================



Use:



- React + TypeScript

- Tailwind CSS

- shadcn/ui

- Supabase/PostgreSQL

- autenticação segura

- Row Level Security

- arquitetura modular

- componentes reutilizáveis

- backend/edge functions quando necessário

- variáveis de ambiente para credenciais externas



Crie uma estrutura preparada para produção, não apenas um mockup visual.



Use banco de dados real.



Antes de criar dados fictícios permanentes, estruture as tabelas necessárias.



==================================================

2. IDENTIDADE DA PLATAFORMA



Criar uma identidade moderna, tecnológica e comercial.



Nome provisório da plataforma:

OFERTA HUB



O nome deve ficar fácil de alterar posteriormente.



Estilo:



- moderno

- profissional

- clean

- forte

- visual de SaaS

- excelente experiência em celular

- dashboard semelhante a ferramentas profissionais de marketing

- cards com informações claras

- gráficos

- indicadores

- badges

- status visuais

- navegação simples



Não copiar a identidade visual das plataformas de referência.



==================================================

3. AUTENTICAÇÃO



Criar:



- Login

- Cadastro

- Recuperação de senha

- Logout

- Perfil do usuário

- Configurações da conta



Preparar estrutura para futuramente possuir:



- plano gratuito

- plano básico

- plano profissional

- plano empresarial



Criar também estrutura de permissões:



- administrador

- usuário



==================================================

4. DASHBOARD PRINCIPAL



Criar dashboard com:



Olá, [nome do usuário]



Cards:



🔥 Ofertas encontradas

✅ Ofertas aprovadas

📤 Ofertas publicadas

👆 Cliques

💰 Comissão estimada

🛒 Vendas

📊 Conversão



Criar gráficos:



- ofertas por dia

- cliques por dia

- vendas por dia

- comissão por marketplace

- desempenho por grupo

- desempenho por categoria



Criar seção:



🔥 MELHORES OFERTAS



Mostrar:



- imagem

- produto

- marketplace

- preço anterior

- preço atual

- desconto

- avaliação

- vendas

- comissão

- Oferta Score

- status

- botão visualizar

- botão aprovar

- botão rejeitar

- botão editar



==================================================

5. MARKETPLACES



Criar página:



MARKETPLACES



Cards para:



🟠 Shopee

🔵 Mercado Livre

🟡 Amazon

🔴 SHEIN



Cada marketplace deve possuir:



- status da conexão

- conectar

- desconectar

- configuração

- credenciais/API

- conta de afiliado

- status

- última sincronização



IMPORTANTE:



Não inventar endpoints.



Criar uma camada de integração independente para cada marketplace:



/integrations/shopee

/integrations/mercadolivre

/integrations/amazon

/integrations/shein



Cada integração deve possuir interface padronizada para:



- buscar produtos

- buscar ofertas

- obter detalhes do produto

- obter preço

- obter imagem

- obter disponibilidade

- obter informações de afiliado quando a API permitir

- gerar/converter link quando a API permitir

- sincronizar dados



Quando a API ainda não estiver configurada, mostrar:



"Integração aguardando configuração"



e nunca fingir que está conectada.



==================================================

6. RADAR DE OFERTAS



Criar página:



RADAR DE OFERTAS



Filtros:



- marketplace

- categoria

- palavra-chave

- preço mínimo

- preço máximo

- desconto mínimo

- avaliação mínima

- quantidade de vendas

- comissão mínima

- disponibilidade

- cupom

- frete grátis

- período



Criar ordenação:



- melhor oferta

- maior desconto

- menor preço

- maior comissão

- maior avaliação

- mais vendidos

- mais recentes



Cada oferta deve mostrar:



Imagem

Produto

Marketplace

Preço anterior

Preço atual

Desconto

Avaliação

Quantidade de avaliações

Quantidade de vendas

Cupom

Comissão

Link original

Link afiliado

Oferta Score



==================================================

7. OFERTA SCORE



Criar algoritmo modular chamado:



OFFER_SCORE



Pontuação de 0 a 100.



Considerar, quando os dados estiverem disponíveis:



- desconto

- preço

- histórico de preço

- avaliação

- quantidade de avaliações

- vendas

- comissão

- cupom

- frete

- disponibilidade

- popularidade

- categoria

- potencial de conversão



Exemplo:



94/100 — OFERTA QUENTE



70/100 — BOA OFERTA



50/100 — OFERTA REGULAR



abaixo de 50 — NÃO RECOMENDADA



Permitir que futuramente o administrador altere os pesos.



==================================================

8. HISTÓRICO DE PREÇOS



Criar estrutura para registrar:



- produto

- marketplace

- preço

- preço promocional

- data/hora

- cupom

- disponibilidade



Criar gráfico histórico de preço.



Quando não houver histórico suficiente, informar claramente:



"Histórico ainda insuficiente."



Não inventar histórico.



==================================================

9. LINKS DE AFILIADO



Criar página:



LINKS DE AFILIADO



Permitir configurar cada marketplace.



Campos preparados para:



- ID de afiliado

- API Key

- Secret

- Tracking ID

- Sub ID

- parâmetros de rastreamento

- outras credenciais exigidas pela plataforma



Nunca exibir secrets na interface depois de salvos.



Criar sistema para:



LINK ORIGINAL

↓

IDENTIFICAÇÃO DO MARKETPLACE

↓

CONVERSÃO PARA LINK DE AFILIADO

↓

LINK RASTREÁVEL



Cada usuário deve possuir seus próprios links.



==================================================

10. GRUPOS / CANAIS



Criar página:



MEUS GRUPOS



Permitir cadastrar:



- nome

- descrição

- plataforma

- identificador

- categoria

- status

- horário permitido

- limite de publicações por dia

- intervalo entre publicações

- categorias permitidas

- score mínimo

- template padrão



Plataformas preparadas:



- WhatsApp

- Telegram

- futuramente outros canais



IMPORTANTE SOBRE WHATSAPP:



Não implementar métodos não oficiais ou automações que dependam de burlar limitações da plataforma.



Criar uma camada:



CHANNEL_CONNECTOR



com arquitetura preparada para integração oficial/permitida e para provedores externos compatíveis.



O painel deverá permitir:



Conectar canal

Status da conexão

Grupos disponíveis

Selecionar grupos

Configurar regras

Testar conexão

Fila de publicação



Não fingir que uma conexão existe quando ela não estiver configurada.



==================================================

11. FONTES / ESPELHAMENTO



Criar página:



FONTES



Permitir cadastrar fontes de ofertas autorizadas.



Tipos:



- marketplace

- canal

- grupo

- feed

- API

- fonte externa



Criar estrutura para receber uma oferta de uma fonte:



Produto

Preço

Imagem

Texto

Link

Marketplace

Cupom

Data

Fonte original



Depois processar:



FONTE

↓

IDENTIFICAR PRODUTO

↓

IDENTIFICAR MARKETPLACE

↓

VALIDAR OFERTA

↓

CONVERTER LINK

↓

GERAR COPY

↓

APLICAR REGRAS

↓

ENVIAR PARA FILA



Para espelhamento de grupos, respeitar autorização, termos de uso e direitos de terceiros. Não copiar indiscriminadamente conteúdo protegido.



==================================================

12. DETECÇÃO DE DUPLICIDADE



Criar sistema para evitar:



- mesmo produto repetido

- mesma oferta repetida

- mesmo link repetido

- ofertas muito semelhantes

- spam



Criar fingerprint da oferta usando:



- marketplace

- product ID

- URL normalizada

- SKU quando disponível



Configurar janela de duplicidade.



Exemplo:



Não publicar novamente o mesmo produto por 24 horas.



Permitir alteração nas configurações.



==================================================

13. IA / GERADOR DE COPY



Criar página:



GERADOR DE COPY



A IA deverá transformar os dados do produto em uma postagem.



Exemplo:



🔥 ACHADINHO DO DIA!



Produto



/R$ 89,90/

💰 R$ 39,90



🔥 56% OFF



⭐ 4,8

🛒 +1.000 vendidos



🎟️ Cupom disponível



👉 CONFIRA A OFERTA:

LINK



Criar campos:



- tom da mensagem

- tamanho

- emojis

- CTA

- quantidade de informações

- estilo



Estilos:



- agressivo

- urgente

- clean

- feminino

- casual

- promocional



Permitir criar templates personalizados.



A IA nunca deve inventar preço, desconto, avaliação, vendas ou cupom.



Usar somente dados reais disponíveis.



==================================================

14. TEMPLATES



Criar página:



TEMPLATES



Permitir criar:



- nome

- título

- corpo

- CTA

- emojis

- assinatura

- variáveis



Variáveis:



{{produto}}

{{preco_anterior}}

{{preco}}

{{desconto}}

{{avaliacao}}

{{vendas}}

{{cupom}}

{{link}}

{{marketplace}}

{{comissao}}



Permitir escolher template por grupo.



==================================================

15. AUTOMAÇÕES



Criar página:



AUTOMAÇÕES



Exemplo:



Automação:

"Ofertas para Grupo Casa"



SE:



Marketplace = Shopee

Categoria = Casa

Score >= 80

Desconto >= 30%



ENTÃO:



Enviar para:

Grupo Casa



Horário:

08:00–22:00



Limite:

10 ofertas/dia



Intervalo:

30 minutos



Criar regras:



- marketplace

- categoria

- score

- desconto

- preço

- comissão

- avaliação

- estoque

- cupom

- palavras-chave

- grupo destino

- horário

- limite diário



==================================================

16. FILA DE PUBLICAÇÃO



Criar página:



FILA



Colunas:



- oferta

- grupo

- data

- horário

- status

- tentativa

- erro

- ação



Status:



Pendente

Agendada

Processando

Publicada

Falhou

Cancelada



Permitir:



- editar

- reprogramar

- cancelar

- publicar manualmente

- tentar novamente



==================================================

17. CALENDÁRIO



Criar calendário visual.



Mostrar publicações:



Hoje

Amanhã

Semana



Permitir arrastar/reprogramar quando possível.



==================================================

18. HISTÓRICO



Criar página:



HISTÓRICO DE PUBLICAÇÕES



Registrar:



- produto

- grupo

- marketplace

- horário

- status

- link

- template

- usuário

- erro

- quantidade de tentativas



==================================================

19. MÉTRICAS



Criar página:



ANALYTICS



Métricas:



- cliques

- vendas

- comissão

- CTR

- conversão

- publicações

- ofertas aprovadas

- ofertas rejeitadas



Filtros:



- período

- marketplace

- grupo

- categoria

- produto



Criar gráficos.



==================================================

20. BANCO DE DADOS



Criar estrutura PostgreSQL/Supabase para pelo menos:



profiles

subscriptions

marketplaces

marketplace_connections

affiliate_accounts

products

product_prices

offers

offer_scores

coupons

categories

groups

group_rules

sources

source_messages

templates

automations

automation_rules

publication_queue

publications

clicks

conversions

commissions

notifications

audit_logs



Todos os registros devem possuir relacionamento correto com o usuário quando aplicável.



Implementar Row Level Security para impedir acesso entre usuários.



==================================================

21. ADMINISTRADOR



Criar área administrativa separada.



Admin poderá:



- visualizar usuários

- planos

- marketplaces

- integrações

- categorias

- ofertas

- grupos

- automações

- publicações

- logs

- erros

- métricas gerais



Criar dashboard administrativo.



==================================================

22. NOTIFICAÇÕES



Criar sistema de notificações para:



- integração desconectada

- erro de API

- oferta publicada

- publicação falhou

- limite atingido

- sincronização concluída

- nova oferta quente



==================================================

23. LOGS



Criar logs técnicos para:



- API

- autenticação

- sincronização

- conversão de links

- geração de copy

- publicação

- erros



Nunca armazenar secrets em logs.



==================================================

24. SEGURANÇA



Implementar:



- autenticação

- RLS

- validação de dados

- proteção de rotas

- controle de permissões

- secrets somente em ambiente seguro

- tratamento de erros

- rate limiting quando aplicável

- auditoria



==================================================

25. EXPERIÊNCIA MOBILE



A plataforma será usada principalmente pelo celular.



Priorizar:



- responsividade

- botões grandes

- navegação simples

- cards

- filtros fáceis

- dashboard legível

- ações rápidas



Criar menu lateral no desktop e navegação adaptada para mobile.



==================================================

26. DADOS DEMONSTRATIVOS



Para o dashboard inicial, pode usar dados DEMO claramente identificados.



Não apresentar dados fictícios como se fossem dados reais.



Criar um modo:



DEMO



e preparar a aplicação para substituir posteriormente pelos dados reais das APIs.



==================================================

27. ARQUITETURA PARA FUTURO



Deixar preparada para:



- mais marketplaces

- mais canais

- múltiplas contas

- planos pagos

- Stripe

- sistema de cobrança

- API própria

- webhooks

- inteligência artificial

- recomendação automática

- histórico avançado

- rastreamento de conversões

- white label



==================================================

28. RESULTADO ESPERADO



Quero uma aplicação funcional e navegável, com banco de dados real, autenticação, dashboard, páginas, coCRIAR SAAS — CENTRAL DE OFERTAS E AFILIADOS



Quero criar uma plataforma SaaS completa de automação de ofertas para afiliados, inspirada na lógica de plataformas como OfertaFlux e BuboFlow, porém com identidade visual, código, estrutura e experiência próprias. NÃO copie código, textos, layout ou identidade visual dessas plataformas.



O objetivo é criar uma plataforma que futuramente consiga captar ofertas de Shopee, Mercado Livre, Amazon e SHEIN por meio das APIs oficiais/disponíveis de cada plataforma, transformar os produtos em ofertas atrativas, converter os links para links de afiliado, aplicar regras de seleção, gerar copies automaticamente e publicar nos canais/grupos cadastrados.



IMPORTANTE:



- Não invente APIs, endpoints, credenciais ou integrações que não existam.

- Quando uma integração externa ainda não estiver configurada, crie uma arquitetura preparada para recebê-la.

- Não use scraping como solução principal quando houver API oficial disponível.

- A arquitetura deve ser modular, permitindo adicionar novos marketplaces e canais futuramente.

- O sistema deverá ser multiusuário desde o início, porque futuramente será vendido como SaaS para outros afiliados.

- Cada usuário deve ter suas próprias credenciais, links de afiliado, grupos, regras, ofertas e métricas.

- Nunca misture dados de usuários diferentes.

- O sistema deve estar preparado para LGPD, segurança, autenticação e isolamento de dados.



==================================================



1. TECNOLOGIA E ARQUITETURA

   ==================================================



Use:



- React + TypeScript

- Tailwind CSS

- shadcn/ui

- Supabase/PostgreSQL

- autenticação segura

- Row Level Security

- arquitetura modular

- componentes reutilizáveis

- backend/edge functions quando necessário

- variáveis de ambiente para credenciais externas



Crie uma estrutura preparada para produção, não apenas um mockup visual.



Use banco de dados real.



Antes de criar dados fictícios permanentes, estruture as tabelas necessárias.



==================================================

2. IDENTIDADE DA PLATAFORMA



Criar uma identidade moderna, tecnológica e comercial.



Nome provisório da plataforma:

OFERTA HUB



O nome deve ficar fácil de alterar posteriormente.



Estilo:



- moderno

- profissional

- clean

- forte

- visual de SaaS

- excelente experiência em celular

- dashboard semelhante a ferramentas profissionais de marketing

- cards com informações claras

- gráficos

- indicadores

- badges

- status visuais

- navegação simples



Não copiar a identidade visual das plataformas de referência.



==================================================

3. AUTENTICAÇÃO



Criar:



- Login

- Cadastro

- Recuperação de senha

- Logout

- Perfil do usuário

- Configurações da conta



Preparar estrutura para futuramente possuir:



- plano gratuito

- plano básico

- plano profissional

- plano empresarial



Criar também estrutura de permissões:



- administrador

- usuário



==================================================

4. DASHBOARD PRINCIPAL



Criar dashboard com:



Olá, [nome do usuário]



Cards:



🔥 Ofertas encontradas

✅ Ofertas aprovadas

📤 Ofertas publicadas

👆 Cliques

💰 Comissão estimada

🛒 Vendas

📊 Conversão



Criar gráficos:



- ofertas por dia

- cliques por dia

- vendas por dia

- comissão por marketplace

- desempenho por grupo

- desempenho por categoria



Criar seção:



🔥 MELHORES OFERTAS



Mostrar:



- imagem

- produto

- marketplace

- preço anterior

- preço atual

- desconto

- avaliação

- vendas

- comissão

- Oferta Score

- status

- botão visualizar

- botão aprovar

- botão rejeitar

- botão editar



==================================================

5. MARKETPLACES



Criar página:



MARKETPLACES



Cards para:



🟠 Shopee

🔵 Mercado Livre

🟡 Amazon

🔴 SHEIN



Cada marketplace deve possuir:



- status da conexão

- conectar

- desconectar

- configuração

- credenciais/API

- conta de afiliado

- status

- última sincronização



IMPORTANTE:



Não inventar endpoints.



Criar uma camada de integração independente para cada marketplace:



/integrations/shopee

/integrations/mercadolivre

/integrations/amazon

/integrations/shein



Cada integração deve possuir interface padronizada para:



- buscar produtos

- buscar ofertas

- obter detalhes do produto

- obter preço

- obter imagem

- obter disponibilidade

- obter informações de afiliado quando a API permitir

- gerar/converter link quando a API permitir

- sincronizar dados



Quando a API ainda não estiver configurada, mostrar:



"Integração aguardando configuração"



e nunca fingir que está conectada.



==================================================

6. RADAR DE OFERTAS



Criar página:



RADAR DE OFERTAS



Filtros:



- marketplace

- categoria

- palavra-chave

- preço mínimo

- preço máximo

- desconto mínimo

- avaliação mínima

- quantidade de vendas

- comissão mínima

- disponibilidade

- cupom

- frete grátis

- período



Criar ordenação:



- melhor oferta

- maior desconto

- menor preço

- maior comissão

- maior avaliação

- mais vendidos

- mais recentes



Cada oferta deve mostrar:



Imagem

Produto

Marketplace

Preço anterior

Preço atual

Desconto

Avaliação

Quantidade de avaliações

Quantidade de vendas

Cupom

Comissão

Link original

Link afiliado

Oferta Score



==================================================

7. OFERTA SCORE



Criar algoritmo modular chamado:



OFFER_SCORE



Pontuação de 0 a 100.



Considerar, quando os dados estiverem disponíveis:



- desconto

- preço

- histórico de preço

- avaliação

- quantidade de avaliações

- vendas

- comissão

- cupom

- frete

- disponibilidade

- popularidade

- categoria

- potencial de conversão



Exemplo:



94/100 — OFERTA QUENTE



70/100 — BOA OFERTA



50/100 — OFERTA REGULAR



abaixo de 50 — NÃO RECOMENDADA



Permitir que futuramente o administrador altere os pesos.



==================================================

8. HISTÓRICO DE PREÇOS



Criar estrutura para registrar:



- produto

- marketplace

- preço

- preço promocional

- data/hora

- cupom

- disponibilidade



Criar gráfico histórico de preço.



Quando não houver histórico suficiente, informar claramente:



"Histórico ainda insuficiente."



Não inventar histórico.



==================================================

9. LINKS DE AFILIADO



Criar página:



LINKS DE AFILIADO



Permitir configurar cada marketplace.



Campos preparados para:



- ID de afiliado

- API Key

- Secret

- Tracking ID

- Sub ID

- parâmetros de rastreamento

- outras credenciais exigidas pela plataforma



Nunca exibir secrets na interface depois de salvos.



Criar sistema para:



LINK ORIGINAL

↓

IDENTIFICAÇÃO DO MARKETPLACE

↓

CONVERSÃO PARA LINK DE AFILIADO

↓

LINK RASTREÁVEL



Cada usuário deve possuir seus próprios links.



==================================================

10. GRUPOS / CANAIS



Criar página:



MEUS GRUPOS



Permitir cadastrar:



- nome

- descrição

- plataforma

- identificador

- categoria

- status

- horário permitido

- limite de publicações por dia

- intervalo entre publicações

- categorias permitidas

- score mínimo

- template padrão



Plataformas preparadas:



- WhatsApp

- Telegram

- futuramente outros canais



IMPORTANTE SOBRE WHATSAPP:



Não implementar métodos não oficiais ou automações que dependam de burlar limitações da plataforma.



Criar uma camada:



CHANNEL_CONNECTOR



com arquitetura preparada para integração oficial/permitida e para provedores externos compatíveis.



O painel deverá permitir:



Conectar canal

Status da conexão

Grupos disponíveis

Selecionar grupos

Configurar regras

Testar conexão

Fila de publicação



Não fingir que uma conexão existe quando ela não estiver configurada.



==================================================

11. FONTES / ESPELHAMENTO



Criar página:



FONTES



Permitir cadastrar fontes de ofertas autorizadas.



Tipos:



- marketplace

- canal

- grupo

- feed

- API

- fonte externa



Criar estrutura para receber uma oferta de uma fonte:



Produto

Preço

Imagem

Texto

Link

Marketplace

Cupom

Data

Fonte original



Depois processar:



FONTE

↓

IDENTIFICAR PRODUTO

↓

IDENTIFICAR MARKETPLACE

↓

VALIDAR OFERTA

↓

CONVERTER LINK

↓

GERAR COPY

↓

APLICAR REGRAS

↓

ENVIAR PARA FILA



Para espelhamento de grupos, respeitar autorização, termos de uso e direitos de terceiros. Não copiar indiscriminadamente conteúdo protegido.



==================================================

12. DETECÇÃO DE DUPLICIDADE



Criar sistema para evitar:



- mesmo produto repetido

- mesma oferta repetida

- mesmo link repetido

- ofertas muito semelhantes

- spam



Criar fingerprint da oferta usando:



- marketplace

- product ID

- URL normalizada

- SKU quando disponível



Configurar janela de duplicidade.



Exemplo:



Não publicar novamente o mesmo produto por 24 horas.



Permitir alteração nas configurações.



==================================================

13. IA / GERADOR DE COPY



Criar página:



GERADOR DE COPY



A IA deverá transformar os dados do produto em uma postagem.



Exemplo:



🔥 ACHADINHO DO DIA!



Produto



/R$ 89,90/

💰 R$ 39,90



🔥 56% OFF



⭐ 4,8

🛒 +1.000 vendidos



🎟️ Cupom disponível



👉 CONFIRA A OFERTA:

LINK



Criar campos:



- tom da mensagem

- tamanho

- emojis

- CTA

- quantidade de informações

- estilo



Estilos:



- agressivo

- urgente

- clean

- feminino

- casual

- promocional



Permitir criar templates personalizados.



A IA nunca deve inventar preço, desconto, avaliação, vendas ou cupom.



Usar somente dados reais disponíveis.



==================================================

14. TEMPLATES



Criar página:



TEMPLATES



Permitir criar:



- nome

- título

- corpo

- CTA

- emojis

- assinatura

- variáveis



Variáveis:



{{produto}}

{{preco_anterior}}

{{preco}}

{{desconto}}

{{avaliacao}}

{{vendas}}

{{cupom}}

{{link}}

{{marketplace}}

{{comissao}}



Permitir escolher template por grupo.



==================================================

15. AUTOMAÇÕES



Criar página:



AUTOMAÇÕES



Exemplo:



Automação:

"Ofertas para Grupo Casa"



SE:



Marketplace = Shopee

Categoria = Casa

Score >= 80

Desconto >= 30%



ENTÃO:



Enviar para:

Grupo Casa



Horário:

08:00–22:00



Limite:

10 ofertas/dia



Intervalo:

30 minutos



Criar regras:



- marketplace

- categoria

- score

- desconto

- preço

- comissão

- avaliação

- estoque

- cupom

- palavras-chave

- grupo destino

- horário

- limite diário



==================================================

16. FILA DE PUBLICAÇÃO



Criar página:



FILA



Colunas:



- oferta

- grupo

- data

- horário

- status

- tentativa

- erro

- ação



Status:



Pendente

Agendada

Processando

Publicada

Falhou

Cancelada



Permitir:



- editar

- reprogramar

- cancelar

- publicar manualmente

- tentar novamente



==================================================

17. CALENDÁRIO



Criar calendário visual.



Mostrar publicações:



Hoje

Amanhã

Semana



Permitir arrastar/reprogramar quando possível.



==================================================

18. HISTÓRICO



Criar página:



HISTÓRICO DE PUBLICAÇÕES



Registrar:



- produto

- grupo

- marketplace

- horário

- status

- link

- template

- usuário

- erro

- quantidade de tentativas



==================================================

19. MÉTRICAS



Criar página:



ANALYTICS



Métricas:



- cliques

- vendas

- comissão

- CTR

- conversão

- publicações

- ofertas aprovadas

- ofertas rejeitadas



Filtros:



- período

- marketplace

- grupo

- categoria

- produto



Criar gráficos.



==================================================

20. BANCO DE DADOS



Criar estrutura PostgreSQL/Supabase para pelo menos:



profiles

subscriptions

marketplaces

marketplace_connections

affiliate_accounts

products

product_prices

offers

offer_scores

coupons

categories

groups

group_rules

sources

source_messages

templates

automations

automation_rules

publication_queue

publications

clicks

conversions

commissions

notifications

audit_logs



Todos os registros devem possuir relacionamento correto com o usuário quando aplicável.



Implementar Row Level Security para impedir acesso entre usuários.



==================================================

21. ADMINISTRADOR



Criar área administrativa separada.



Admin poderá:



- visualizar usuários

- planos

- marketplaces

- integrações

- categorias

- ofertas

- grupos

- automações

- publicações

- logs

- erros

- métricas gerais



Criar dashboard administrativo.



==================================================

22. NOTIFICAÇÕES



Criar sistema de notificações para:



- integração desconectada

- erro de API

- oferta publicada

- publicação falhou

- limite atingido

- sincronização concluída

- nova oferta quente



==================================================

23. LOGS



Criar logs técnicos para:



- API

- autenticação

- sincronização

- conversão de links

- geração de copy

- publicação

- erros



Nunca armazenar secrets em logs.



==================================================

24. SEGURANÇA



Implementar:



- autenticação

- RLS

- validação de dados

- proteção de rotas

- controle de permissões

- secrets somente em ambiente seguro

- tratamento de erros

- rate limiting quando aplicável

- auditoria



==================================================

25. EXPERIÊNCIA MOBILE



A plataforma será usada principalmente pelo celular.



Priorizar:



- responsividade

- botões grandes

- navegação simples

- cards

- filtros fáceis

- dashboard legível

- ações rápidas



Criar menu lateral no desktop e navegação adaptada para mobile.



==================================================

26. DADOS DEMONSTRATIVOS



Para o dashboard inicial, pode usar dados DEMO claramente identificados.



Não apresentar dados fictícios como se fossem dados reais.



Criar um modo:



DEMO



e preparar a aplicação para substituir posteriormente pelos dados reais das APIs.



==================================================

27. ARQUITETURA PARA FUTURO



Deixar preparada para:



- mais marketplaces

- mais canais

- múltiplas contas

- planos pagos

- Stripe

- sistema de cobrança

- API própria

- webhooks

- inteligência artificial

- recomendação automática

- histórico avançado

- rastreamento de conversões

- white label



==================================================

28. RESULTADO ESPERADO



Quero uma aplicação funcional e navegável, com banco de dados real, autenticação, dashboard, páginas, componentes e arquitetura de backend.



Não quero apenas uma landing page.



Quero que o projeto seja a base de um SaaS real.



Antes de implementar integrações externas, crie interfaces e adaptadores bem definidos para que cada marketplace e canal possa ser conectado posteriormente sem reescrever o sistema inteiro.



Ao finalizar, verifique:



- rotas funcionando

- autenticação funcionando

- banco funcionando

- RLS funcionando

- dashboard funcionando

- CRUD de grupos funcionando

- CRUD de templates funcionando

- CRUD de automações funcionando

- CRUD de ofertas funcionando

- fila funcionando

- responsividade funcionando

- tratamento de erros funcionando



Crie uma interface profissional, moderna e pronta para evoluir para produção.mponentes e arquitetura de backend.



Não quero apenas uma landing page.



Quero que o projeto seja a base de um SaaS real.



Antes de implementar integrações externas, crie interfaces e adaptadores bem definidos para que cada marketplace e canal possa ser conectado posteriormente sem reescrever o sistema inteiro.



Ao finalizar, verifique:



- rotas funcionando

- autenticação funcionando

- banco funcionando

- RLS funcionando

- dashboard funcionando

- CRUD de grupos funcionando

- CRUD de templates funcionando

- CRUD de automações funcionando

- CRUD de ofertas funcionando

- fila funcionando

- responsividade funcionando

- tratamento de erros funcionando



Crie uma interface profissional, moderna e pronta para evoluir para produção.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/1ef21bb8-c207-4b30-aa17-a648f3bf4c85).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
