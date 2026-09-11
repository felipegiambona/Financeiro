import { and, asc, eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { db, categoriesTable, limitsTable, transactionsTable } from "@workspace/db";
import {
  CreateCategoryBody,
  CreateCategoryResponse,
  ListCategoriesResponse,
  UpdateCategoryBody,
  UpdateCategoryParams,
} from "@workspace/api-zod";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth";

const router: IRouter = Router();
router.use("/categories", requireAuth);

function userIdFrom(req: unknown): string {
  return (req as AuthenticatedRequest).userId;
}

function toResponse(row: typeof categoriesTable.$inferSelect) {
  return {
    ...row,
    createdAt: row.createdAt.toISOString(),
  };
}

router.get("/categories", async (req, res): Promise<void> => {
  const rows = await db.select().from(categoriesTable)
    .where(eq(categoriesTable.userId, userIdFrom(req)))
    .orderBy(asc(categoriesTable.name), asc(categoriesTable.createdAt));
  res.json(ListCategoriesResponse.parse(rows.map(toResponse)));
});

router.post("/categories", async (req, res): Promise<void> => {
  const parsed = CreateCategoryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  try {
    const [row] = await db.insert(categoriesTable).values({
      userId: userIdFrom(req),
      name: parsed.data.name.trim(),
      color: parsed.data.color ?? "#72A17D",
    }).returning();
    res.status(201).json(CreateCategoryResponse.parse(toResponse(row)));
  } catch (error) {
    if (error instanceof Error && error.message.includes("finance_categories_user_name_idx")) {
      res.status(409).json({ error: "Category already exists" });
      return;
    }
    throw error;
  }
});

router.patch("/categories/:id", async (req, res): Promise<void> => {
  const params = UpdateCategoryParams.safeParse(req.params);
  const body = UpdateCategoryBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Invalid category update" });
    return;
  }
  const updates = {
    ...(body.data.name === undefined ? {} : { name: body.data.name.trim() }),
    ...(body.data.color === undefined ? {} : { color: body.data.color }),
  };
  try {
    const [row] = await db.update(categoriesTable).set(updates)
      .where(and(eq(categoriesTable.id, params.data.id), eq(categoriesTable.userId, userIdFrom(req))))
      .returning();
    if (!row) {
      res.status(404).json({ error: "Category not found" });
      return;
    }
    res.json(CreateCategoryResponse.parse(toResponse(row)));
  } catch (error) {
    if (error instanceof Error && error.message.includes("finance_categories_user_name_idx")) {
      res.status(409).json({ error: "Category already exists" });
      return;
    }
    throw error;
  }
});

router.delete("/categories/:id", async (req, res): Promise<void> => {
  const params = UpdateCategoryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid category id" });
    return;
  }
  const userId = userIdFrom(req);
  const [category] = await db.select().from(categoriesTable)
    .where(and(eq(categoriesTable.id, params.data.id), eq(categoriesTable.userId, userId)));
  if (!category) {
    res.status(404).json({ error: "Category not found" });
    return;
  }
  await db.transaction(async (tx) => {
    await tx.update(transactionsTable)
      .set({ categoryId: null })
      .where(and(eq(transactionsTable.userId, userId), eq(transactionsTable.categoryId, category.id)));
    await tx.delete(limitsTable)
      .where(and(eq(limitsTable.userId, userId), eq(limitsTable.categoryId, category.id)));
    await tx.delete(categoriesTable)
      .where(and(eq(categoriesTable.id, category.id), eq(categoriesTable.userId, userId)));
  });
  res.sendStatus(204);
});

export default router;