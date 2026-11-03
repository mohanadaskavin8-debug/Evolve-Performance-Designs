import { Router } from "express";
import healthRouter from "./health";
import shopRouter from "./shop";

const router = Router();

router.use(healthRouter);
router.use("/shop", shopRouter);

export default router;
