import { Router } from "express";
import { getDashboard, getMyDashboard } from "../controllers/dashboardController";
import { authenticate, requireAuth } from "../middleware/auth";

const router = Router();

/**
 * @swagger
 * /dashboard/me:
 *   get:
 *     summary: Get personalized dashboard for the current user
 *     tags: [Dashboard]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Personalized dashboard data
 */
router.get("/me", authenticate, requireAuth, getMyDashboard);

/**
 * @swagger
 * /dashboard:
 *   get:
 *     summary: Get dashboard summary
 *     description: >
 *       Returns aggregated platform statistics including total amount donated,
 *       request counts by status, the 10 most recent donations, and the top 5
 *       causes by amount raised. Results are cached for 2 minutes.
 *     tags: [Dashboard]
 *     responses:
 *       200:
 *         description: Dashboard summary
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalDonated:
 *                   type: number
 *                   description: Total HBAR donated across all requests
 *                 requestCounts:
 *                   type: object
 *                   properties:
 *                     live:
 *                       type: integer
 *                     funded:
 *                       type: integer
 *                     expired:
 *                       type: integer
 *                     pending:
 *                       type: integer
 *                 recentDonations:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Donation'
 *                 topCauses:
 *                   type: array
 *                   items:
 *                     allOf:
 *                       - $ref: '#/components/schemas/Request'
 *                       - type: object
 *                         properties:
 *                           _count:
 *                             type: object
 *                             properties:
 *                               donations:
 *                                 type: integer
 */
router.get("/", getDashboard);

export default router;
