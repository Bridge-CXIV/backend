import { Router } from "express";
import {
  adminMagicLogin,
  adminWalletLogin,
  magicLogin,
  walletLogin,
} from "../controllers/authController";

const router = Router();

/**
 * @swagger
 * /auth/magic:
 *   post:
 *     summary: Sign in with Magic.link (Google OAuth)
 *     description: >
 *       Validates a Magic DID token from the Authorization header.
 *       If the user is new, a Hedera testnet account is automatically created.
 *       Returns a JWT for subsequent authenticated requests.
 *     tags: [Authentication]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [didToken]
 *             properties:
 *               didToken:
 *                 type: string
 *                 description: "Magic.link DID token obtained from the frontend SDK"
 *                 example: "did:ethr:0x123..."
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                   description: JWT token for authenticated requests
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         description: DID token missing
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Invalid DID token
 */
router.post("/magic", magicLogin);
router.post("/admin/magic", adminMagicLogin);

/**
 * @swagger
 * /auth/wallet:
 *   post:
 *     summary: Sign in with a Hedera wallet (HashConnect)
 *     description: >
 *       Accepts a Hedera account ID and a signed message for wallet-based
 *       login. Upserts the user and returns a JWT.
 *     tags: [Authentication]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [accountId, signature]
 *             properties:
 *               accountId:
 *                 type: string
 *                 description: Hedera account ID (e.g. "0.0.12345")
 *                 example: "0.0.12345"
 *               signature:
 *                 type: string
 *                 description: Signed login message
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         description: Missing fields
 */
router.post("/wallet", walletLogin);
router.post("/admin/wallet", adminWalletLogin);

export default router;
