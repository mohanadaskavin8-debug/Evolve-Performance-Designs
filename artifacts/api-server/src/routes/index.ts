import { Router } from "express";
import healthRouter from "./health";
import shopRouter from "./shop";
import supportRouter from "./support";
import newsletterRouter from "./newsletter";
import marketingRouter from "./marketing";
import contentRouter from "./content";

const router = Router();

router.use(healthRouter);
router.use("/shop", shopRouter);
router.use("/support", supportRouter);
router.use("/newsletter", newsletterRouter);
router.use("/marketing", marketingRouter);
router.use("/content", contentRouter);

export default router;
