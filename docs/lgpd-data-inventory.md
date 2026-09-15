# Inventário de dados e responsabilidades — Finanças Mobile

Status: **rascunho operacional para validação jurídica e empresarial**. Brasil como mercado inicial. A razão social, o responsável/encarregado e os e-mails formais ainda precisam ser preenchidos por quem opera o produto.

## Matriz de dados

| Categoria | Exemplos | Finalidade | Onde é tratado | Retenção operacional | Acesso/fornecedor | Base legal a validar |
| --- | --- | --- | --- | --- | --- | --- |
| Conta e autenticação | nome, e-mail, identificador da conta, sessões | criar conta, autenticar, recuperar acesso e proteger a sessão | Clerk e API | enquanto a conta existir; registros técnicos pelo prazo definido no procedimento de retenção | usuário, equipe mínima autorizada, Clerk | execução de contrato, segurança e outra base a confirmar |
| Perfil financeiro | tipo pessoal/empresarial, nome do negócio, imagem escolhida pelo usuário | separar contextos e apresentar o perfil ativo | API e banco da aplicação | enquanto o perfil existir; exclusão ativa sob solicitação | usuário e equipe mínima autorizada | execução de contrato |
| Organização financeira | carteiras, categorias, limites, metas, movimentos e lançamentos | oferecer organização e acompanhamento financeiro | API e banco da aplicação | enquanto o usuário mantiver a conta; exclusão ativa e backups conforme política aprovada | usuário e equipe mínima autorizada | execução de contrato |
| Cartões e investimentos | cartões, faturas, ativos, favoritos e cotações | exibir controles solicitados pelo usuário | API, banco e fontes públicas de cotação quando usadas | enquanto os registros forem mantidos pelo usuário | usuário, equipe mínima autorizada e provedores de cotação aplicáveis | execução de contrato; validar fonte pública |
| Imagens | foto pessoal no provedor de identidade e imagem empresarial no perfil | personalizar a conta/perfil | Clerk ou banco da aplicação | até substituição, remoção ou exclusão da conta | usuário, equipe mínima autorizada e fornecedor correspondente | consentimento/execução de contrato a validar |
| Consentimentos e solicitações | versão aceita, datas, pedidos de acesso/correção/exclusão e suporte | comprovar escolhas, atender titulares e operar suporte | banco da aplicação e ferramentas de atendimento aprovadas | pelo prazo de auditoria e obrigação aplicável | equipe de privacidade/suporte com acesso mínimo | obrigação legal e exercício regular de direitos a validar |
| Telemetria e logs | método, rota, status, request id e erros técnicos sem corpo financeiro | segurança, diagnóstico e auditoria | logs da infraestrutura | retenção curta e documentada; nunca usar corpo financeiro por padrão | equipe técnica autorizada | segurança e obrigação legal a validar |
| Futuras conexões bancárias | tokens, contas, saldos e transações obtidos de agregador | **fora do escopo atual; somente após avaliação própria** | fornecedor a escolher e API | a definir antes da integração | somente acessos explicitamente aprovados | nova análise jurídica e de segurança obrigatória |

## Regras de responsabilidade

- A entidade que publica o app deve ser confirmada como controladora ou definir contratualmente os papéis aplicáveis.
- Clerk, hospedagem do banco, e-mail, cobrança, analytics e qualquer agregador futuro precisam entrar na lista de operadores/fornecedores antes de produção.
- O perfil empresarial não transforma automaticamente todos os dados em dados da empresa: o fluxo precisa definir quem está autorizado e como atender solicitações quando houver mais de um titular.
- A equipe de suporte deve pedir apenas o mínimo necessário e nunca solicitar senha, código de autenticação ou número completo de cartão/conta.

## Retenção e exclusão

1. A exclusão solicitada pelo usuário remove dados financeiros e perfis do ambiente ativo.
2. Registros mínimos de segurança, consentimentos e solicitações podem ser preservados para auditoria, segurança ou obrigação legal, com acesso restrito.
3. Backups devem ter prazo, criptografia, controle de acesso e procedimento de expiração documentados antes do lançamento.
4. O prazo real para cada linha deve ser confirmado pelo responsável legal, contábil e jurídico; este inventário não define uma obrigação legal por conta própria.