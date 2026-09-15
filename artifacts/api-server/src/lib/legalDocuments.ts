export type LegalDocumentKey = "privacy" | "terms" | "contact";

const LEGAL_ENTITY_NAME = process.env.LEGAL_ENTITY_NAME ?? "[RAZÃO SOCIAL PENDENTE]";
const PRIVACY_EMAIL = process.env.LEGAL_PRIVACY_EMAIL ?? "[E-MAIL DE PRIVACIDADE PENDENTE]";
const SUPPORT_EMAIL = process.env.LEGAL_SUPPORT_EMAIL ?? "[E-MAIL DE SUPORTE PENDENTE]";
const LEGAL_REPRESENTATIVE = process.env.LEGAL_REPRESENTATIVE ?? "[RESPONSÁVEL LEGAL/ENCARREGADO PENDENTE]";
const DOCUMENT_VERSION = process.env.LEGAL_DOCUMENT_VERSION ?? "0.1.0-draft";

export const legalDocumentVersion = DOCUMENT_VERSION;
export const legalDocumentsAreDrafts = process.env.LEGAL_DOCUMENTS_APPROVED !== "true";

type LegalDocument = {
  key: LegalDocumentKey;
  title: string;
  version: string;
  isDraft: boolean;
  lastUpdated: string;
  requiresAcceptance: boolean;
  body: string[];
};

const commonNotice = legalDocumentsAreDrafts
  ? "Este documento é um rascunho operacional e deve ser revisado e aprovado por profissional jurídico habilitado no Brasil antes do lançamento. Ele não constitui parecer jurídico nem declaração de conformidade."
  : "Este documento deve ser lido em conjunto com as informações exibidas no app e será atualizado quando houver mudança relevante.";

export const legalDocuments: Record<LegalDocumentKey, LegalDocument> = {
  privacy: {
    key: "privacy",
    title: "Política de Privacidade",
    version: DOCUMENT_VERSION,
    isDraft: legalDocumentsAreDrafts,
    lastUpdated: "2026-09-15",
    requiresAcceptance: true,
    body: [
      commonNotice,
      `Controlador: ${LEGAL_ENTITY_NAME}. Contato de privacidade: ${PRIVACY_EMAIL}. Responsável/encarregado: ${LEGAL_REPRESENTATIVE}. Os campos entre colchetes permanecem pendentes de preenchimento.`,
      "O Finanças Mobile atende pessoas físicas e pequenos negócios. Coletamos dados de conta (nome e e-mail), dados de autenticação tratados pelo provedor de identidade, perfis financeiros, carteiras, categorias, lançamentos, cartões, metas e investimentos informados pelo usuário, além de registros técnicos necessários para segurança e operação.",
      "Usamos esses dados para criar e proteger a conta, separar perfis pessoais e empresariais, apresentar os recursos financeiros solicitados, atender solicitações, prevenir abuso, corrigir falhas e cumprir obrigações legais aplicáveis. Não vendemos dados financeiros nem usamos lançamentos para publicidade comportamental.",
      "O armazenamento da aplicação é feito em banco de dados da infraestrutura configurada pelo projeto. A autenticação é fornecida pela Clerk. Cada fornecedor deve ser validado, contratado e incluído na matriz operacional antes do lançamento. Não há conexão bancária automática ativa neste escopo.",
      "Mantemos os dados enquanto a conta estiver ativa ou enquanto forem necessários para as finalidades informadas. Após uma solicitação de exclusão, os dados financeiros e o perfil são removidos do ambiente ativo; registros mínimos e cópias de backup podem permanecer pelo prazo necessário para segurança, auditoria ou obrigação legal, com acesso restrito e posterior eliminação conforme o procedimento de retenção.",
      "O titular pode solicitar confirmação de tratamento, acesso, correção, portabilidade/exportação, eliminação, informação sobre compartilhamentos e revisão de consentimentos, conforme aplicável. Use a Central de privacidade no app ou o contato indicado acima. Solicitações podem exigir validação de identidade e podem ter limitações legais justificadas.",
      "Não inclua senhas, códigos de autenticação ou dados bancários completos em solicitações de suporte. O suporte deve trabalhar com o mínimo necessário e mascarar dados financeiros.",
      "Mudanças materiais serão comunicadas no app e poderão exigir novo aceite. A versão, data e usuário do aceite são registrados para auditoria.",
    ],
  },
  terms: {
    key: "terms",
    title: "Termos de Uso",
    version: DOCUMENT_VERSION,
    isDraft: legalDocumentsAreDrafts,
    lastUpdated: "2026-09-15",
    requiresAcceptance: true,
    body: [
      commonNotice,
      `Estes Termos são propostos por ${LEGAL_ENTITY_NAME}. A razão social, o responsável legal e os canais formais precisam ser confirmados antes da publicação final.`,
      "O Finanças Mobile é uma ferramenta de organização e acompanhamento financeiro. Ele não é banco, instituição de pagamento, contador, consultor de investimentos, sistema ERP ou serviço de aconselhamento financeiro personalizado.",
      "O usuário é responsável pela veracidade dos dados inseridos, pela proteção de suas credenciais e por manter seus dispositivos seguros. Em um perfil empresarial, o usuário também deve ter autorização para inserir e administrar os dados do negócio.",
      "O plano gratuito e eventuais planos pagos, seus limites, recursos, preço, ciclo, renovação, cancelamento, reembolso, tributos e recibos devem ser publicados antes de qualquer cobrança. Nenhum plano pago está definido ou ativado por este documento.",
      "Podemos suspender recursos para manutenção, segurança, abuso ou cumprimento legal. Quando houver indisponibilidade relevante, comunicaremos o ocorrido pelos canais disponíveis, sem prometer disponibilidade contínua nesta versão.",
      "A conta pode ser encerrada pelo usuário na área de perfil. A exclusão remove os dados financeiros do ambiente ativo, observadas as retenções legais e operacionais informadas na Política de Privacidade.",
      "A versão vigente, o aceite e as mudanças materiais devem ser registrados. Este texto não deve ser tratado como final sem revisão jurídica brasileira.",
    ],
  },
  contact: {
    key: "contact",
    title: "Contato e confiança",
    version: DOCUMENT_VERSION,
    isDraft: legalDocumentsAreDrafts,
    lastUpdated: "2026-09-15",
    requiresAcceptance: false,
    body: [
      commonNotice,
      `Suporte operacional: ${SUPPORT_EMAIL}`,
      `Privacidade e direitos do titular: ${PRIVACY_EMAIL}`,
      "No app, use a Central de privacidade para solicitar acesso, exportação, correção, exclusão ou revogação de consentimentos. Para suporte, informe a categoria, o que aconteceu e o horário aproximado, sem enviar senhas, códigos ou dados financeiros completos.",
      "As solicitações autenticadas ficam vinculadas à conta e podem ser acompanhadas no app. O prazo de atendimento, a identidade do responsável e o canal formal devem ser confirmados antes do lançamento.",
    ],
  },
};

export function getLegalDocument(key: string): LegalDocument | undefined {
  if (key !== "privacy" && key !== "terms" && key !== "contact") return undefined;
  return legalDocuments[key];
}

export function publicLegalDocument(document: LegalDocument) {
  return document;
}