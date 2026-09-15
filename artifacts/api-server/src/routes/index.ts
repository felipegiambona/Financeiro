import { Router, type IRouter } from "express";
import healthRouter from "./health";
import transactionsRouter from "./transactions";
import walletsRouter from "./wallets";
import accountRouter from "./account";
import categoriesRouter from "./categories";
import limitsRouter from "./limits";
import goalsRouter from "./goals";
import cardsRouter from "./cards";
import financialProfilesRouter from "./financialProfiles";
import investmentsRouter from "./investments";
import investmentDividendsRouter from "./investmentDividends";
import legalRouter from "./legal";
import privacyRouter from "./privacy";

const router: IRouter = Router();

router.use(healthRouter);
router.use(legalRouter);
router.use(financialProfilesRouter);
router.use(investmentsRouter);
router.use(investmentDividendsRouter);
router.use(transactionsRouter);
router.use(walletsRouter);
router.use(accountRouter);
router.use(categoriesRouter);
router.use(limitsRouter);
router.use(goalsRouter);
router.use(cardsRouter);
router.use(privacyRouter);

export default router;
