# Finanças Mobile

Aplicativo mobile de controle financeiro pessoal com lançamentos locais, saldo, previsão e gráficos mensais.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

_Populate as you build — short repo map plus pointers to the source-of-truth file for DB schema, API contracts, theme files, etc._

## Architecture decisions

_Populate as you build — non-obvious choices a reader couldn't infer from the code (3-5 bullets)._

## Product

- Dashboard com saldo atual e acesso rápido a novos lançamentos.
- Transações com navegação por mês, saldo acumulado, previsão e estados de carregamento/erro/vazio.
- Formulário de receita/despesa com valor em R$, descrição e indicação de recorrência.
- Gráfico de barras de receitas e despesas dos últimos seis meses, alimentado pelos lançamentos reais.
- Persistência local via AsyncStorage, sem autenticação ou backend no MVP.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- O Expo precisa ser executado pelo workflow `artifacts/financas-mobile: expo`.
- O app usa Expo SDK 54 e mantém o `metro-runtime` como dependência direta para o Metro funcionar corretamente neste workspace pnpm.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
