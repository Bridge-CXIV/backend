import { Router } from "express";
import adminRoutes from "./admin";
import authRoutes from "./auth";
import dashboardRoutes from "./dashboard";
import donationRoutes from "./donations";
import requestRoutes from "./requests";

const router = Router();

router.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

router.use("/auth", authRoutes);
router.use("/requests", requestRoutes);
router.use("/donations", donationRoutes);
router.use("/admin", adminRoutes);
router.use("/dashboard", dashboardRoutes);

export default router;
