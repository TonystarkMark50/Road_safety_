import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import reportsRouter from "./reports";
import emergencyRouter from "./emergency";
import dashboardRouter from "./dashboard";
import roadsRouter from "./roads";
import budgetRouter from "./budget";
import notificationsRouter from "./notifications";
import openaiRouter from "./openai";
import mapRouter from "./map";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(reportsRouter);
router.use(emergencyRouter);
router.use(dashboardRouter);
router.use(roadsRouter);
router.use(budgetRouter);
router.use(notificationsRouter);
router.use(openaiRouter);
router.use(mapRouter);

export default router;
