import { Router, type IRouter } from "express";
import healthRouter from "./health";
import transactionsRouter from "./transactions";
import walletsRouter from "./wallets";

const router: IRouter = Router();

router.use(healthRouter);
router.use(transactionsRouter);
router.use(walletsRouter);

export default router;
