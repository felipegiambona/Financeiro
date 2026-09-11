import { and, asc, eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { categoriesTable, db, limitsTable } from "@workspace/db";
import {
  CreateLimitBody,
  CreateLimitResponse,
  DeleteLimitParams,
  ListLimitsResponse,
  UpdateLimitBody,
  UpdateLimitParams,
  UpdateLimitResponse,
} from "@workspace/api-zod";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth";

const router: IRouter = Router();
router.use("/limits", requireAuth);

function userIdFrom(req: unknown): string {
  return (req as AuthenticatedRequest).userId;
}

function toResponse(row: typeof limitsTable.$inferSelect) {
  return {
    ...row,
    amount: Number(row.amount),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function userCategoryExists(userId: string, categoryId: string): Promise<boolean> {
  const [category] = await db.select({ id: categoriesTable.id }).from(categoriesTable)
    .where(and(eq(categoriesTable.id, categoryId), eq(categoriesTable.userId, userId)));
  return Boolean(category);
}

router.get("/limits", async (req, res): Promise<void> => {
  const rows = await db.select().from(limitsTable)
    .where(eq(limitsTable.userId, userIdFrom(req)))
    .orderBy(asc(limitsTable.createdAt));
  res.json(ListLimitsResponse.parse(rows.map(toResponse)));
});

router.post("/limits", async (req, res): Promise<void> => {
  const parsed = CreateLimitBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const userId = userIdFrom(req);
  if (!(await userCategoryExists(userId, parsed.data.categoryId))) {
    res.status(400).json({ error: "Category not found" });
    return;
  }
  const [row] = await db.insert(limitsTable).values({
    userId,
    categoryId: parsed.data.categoryId,
    description: parsed.data.description?.trim() || null,
    amount: String(parsed.data.amount),
    period: parsed.data.period,
  }).returning();
  res.status(201).json(CreateLimitResponse.parse(toResponse(row)));
});

router.patch("/limits/:id", async (req, res): Promise<void> => {
  const params = UpdateLimitParams.safeParse(req.params);
  const body = UpdateLimitBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Invalid limit update" });
    return;
  }
  const userId = userIdFrom(req);
  if (body.data.categoryId !== undefined && !(await userCategoryExists(userId, body.data.categoryId))) {
    res.status(400).json({ error: "Category not found" });
    return;
  }
  const updates = {
    ...(body.data.categoryId === undefined ? {} : { categoryId: body.data.categoryId }),
    ...(body.data.description === undefined ? {} : { description: body.data.description?.trim() || null }),
    ...(body.data.amount === undefined ? {} : { amount: String(body.data.amount) }),
    ...(body.data.period === undefined ? {} : { period: body.data.period }),
  };
  const [row] = await db.update(limitsTable).set(updates)
    .where(and(eq(limitsTable.id, params.data.id), eq(limitsTable.userId, userId)))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Limit not found" });
    return;
  }
  res.json(UpdateLimitResponse.parse(toResponse(row)));
});

router.delete("/limits/:id", async (req, res): Promise<void> => {
  const params = DeleteLimitParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid limit id" });
    return;
  }
  const [row] = await db.delete(limitsTable)
    .where(and(eq(limitsTable.id, params.data.id), eq(limitsTable.userId, userIdFrom(req))))
    .returning({ id: limitsTable.id });
  if (!row) {
    res.status(404).json({ error: "Limit not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;