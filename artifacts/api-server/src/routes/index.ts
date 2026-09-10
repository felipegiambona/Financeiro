import { Router, type IRouter } from "express";
import healthRouter from "./health";
import transactionsRouter from "./transactions";
import walletsRouter from "./wallets";
import accountRouter from "./account";

const router: IRouter = Router();

router.use(healthRouter);
router.use(transactionsRouter);
router.use(walletsRouter);
router.use(accountRouter);

export default router;
