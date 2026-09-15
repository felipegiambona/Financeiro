# Procedimento inicial de resposta a incidentes

Documento operacional inicial para revisão pelo responsável de segurança, jurídico e negócio.

## 1. Detectar e registrar

Abra um registro com data/hora, sistema afetado, sintomas, dados potencialmente envolvidos, quem detectou e evidências mínimas. Não copie lançamentos financeiros para o ticket; use ids técnicos e dados mascarados.

## 2. Conter

Revogue credenciais comprometidas, limite o endpoint afetado, suspenda integrações ou acessos desnecessários e preserve evidências. Não apague logs antes de definir a retenção do incidente.

## 3. Avaliar

Classifique alcance, titulares afetados, tipo de dado, duração, probabilidade de dano e fornecedores envolvidos. O responsável legal e o encarregado devem decidir comunicações regulatórias e aos titulares quando aplicável.

## 4. Recuperar

Restaure a partir de backup conhecido, valide isolamento entre perfis e confira operações de exclusão/exportação. Registre o que foi restaurado e quais cópias ainda aguardam expiração.

## 5. Comunicar e aprender

Use o canal formal aprovado, sem especular ou expor dados pessoais. Depois, faça análise de causa, ações corretivas, revisão de fornecedores e atualização do checklist de lançamento.

## Controles mínimos antes do lançamento

- acesso administrativo individual e revisado;
- segredos fora do código e separados por ambiente;
- logs técnicos sem corpo financeiro ou credenciais;
- backups com acesso restrito, prazo de retenção e teste de restauração;
- canal de privacidade e suporte confirmados;
- modelo de comunicação aprovado por jurídico.