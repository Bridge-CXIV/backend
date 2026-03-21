import { Router } from "express";
import { authenticate, requireAuth } from "../middleware/auth";
import { createDonation, listDonations } from "../controllers/donationController";

const router = Router();

/**
 * @swagger
 * /donations:
 *   get:
 *     summary: List donations
 *     description: Returns a paginated list of donations. Can filter by requestId or donorId.
 *     tags: [Donations]
 *     parameters:
 *       - in: query
 *         name: requestId
 *         schema:
 *           type: string
 *         description: Filter donations by request
 *       - in: query
 *         name: donorId
 *         schema:
 *           type: string
 *         description: Filter donations by donor
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 100
 *     responses:
 *       200:
 *         description: Paginated list of donations
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 donations:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Donation'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 */
router.get("/", listDonations);

/**
 * @swagger
 * /donations:
 *   post:
 *     summary: Record a donation
 *     description: >
 *       Records a donation in the database, mints an NFT receipt via Hedera Token Service,
 *       logs the event to the request's HCS topic, and updates the request's cumulative total.
 *       If the goal amount is met, the request is automatically marked as FUNDED.
 *     tags: [Donations]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [requestId, amount]
 *             properties:
 *               requestId:
 *                 type: string
 *                 description: ID of the request to donate to
 *               amount:
 *                 type: number
 *                 description: Donation amount in HBAR
 *                 example: 100
 *               transactionHash:
 *                 type: string
 *                 description: On-chain transaction hash (if available)
 *               memo:
 *                 type: string
 *                 description: Optional donor message
 *     responses:
 *       201:
 *         description: Donation recorded
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 donation:
 *                   $ref: '#/components/schemas/Donation'
 *                 nftSerial:
 *                   type: string
 *                   description: Serial number of the minted NFT receipt
 *                 funded:
 *                   type: boolean
 *                   description: Whether the request goal has been fully met
 *       400:
 *         description: Validation error or request not live
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Request not found
 */
router.post("/", authenticate, requireAuth, createDonation);

export default router;
