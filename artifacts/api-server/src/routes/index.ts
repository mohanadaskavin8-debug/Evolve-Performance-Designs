import { Router, type IRouter } from "express";
import healthRouter from "./health";
import collectionsRouter from "./collections";
import productsRouter from "./products";
import reviewsRouter from "./reviews";
import cartRouter from "./cart";
import checkoutRouter from "./checkout";
import ordersRouter from "./orders";
import trackingRouter from "./tracking";
import accountRouter from "./account";
import supportRouter from "./support";
import newsletterRouter from "./newsletter";
import contentRouter from "./content";
import shippingRouter from "./shipping";
import discountsRouter from "./discounts";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/collections", collectionsRouter);
router.use("/products", productsRouter);
router.use("/products", reviewsRouter);
router.use("/cart", cartRouter);
router.use("/checkout", checkoutRouter);
router.use("/orders", ordersRouter);
router.use("/tracking", trackingRouter);
router.use("/account", accountRouter);
router.use("/support", supportRouter);
router.use("/newsletter", newsletterRouter);
router.use("/content", contentRouter);
router.use("/shipping", shippingRouter);
router.use("/discounts", discountsRouter);
router.use("/admin", adminRouter);

export default router;
