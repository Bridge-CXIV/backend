"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const adminGuard_1 = require("../middleware/adminGuard");
const adminController_1 = require("../controllers/adminController");
const router = (0, express_1.Router)();
// Admin routes require authentication AND admin role
router.use(auth_1.authenticate, auth_1.requireAuth, adminGuard_1.requireAdmin);
/**
 * @swagger
 * /admin/users:
 *   get:
 *     summary: List all users with roles and contract status
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 */
router.get("/users", adminController_1.listUsers);
/**
 * @swagger
 * /admin/role:
 *   post:
 *     summary: Update a user's role in the database
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 */
router.post("/role", adminController_1.updateUserRole);
/**
 * @swagger
 * /admin/contract-sync:
 *   post:
 *     summary: Sync admin status to smart contract
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 */
router.post("/contract-sync", adminController_1.syncContractAdmin);
/**
 * @swagger
 * /admin/signatures:
 *   post:
 *     summary: Submit an admin verification signature
 *     description: >
 *       Records an admin's verification signature for a pending request.
 *       When the required threshold of signatures is met, the request is
 *       automatically activated — an HCS topic is created, the verification
 *       event is logged, and the request status changes to LIVE.
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [requestId, signature]
 *             properties:
 *               requestId:
 *                 type: string
 *                 description: ID of the request to verify
 *               signature:
 *                 type: string
 *                 description: Admin's cryptographic signature
 *     responses:
 *       200:
 *         description: Signature recorded
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 activated:
 *                   type: boolean
 *                   description: Whether the threshold was met and request activated
 *       400:
 *         description: Request not pending verification
 *       403:
 *         description: Admin privileges required
 *       404:
 *         description: Request not found
 *       409:
 *         description: Admin has already signed this request
 */
router.post("/signatures", adminController_1.submitSignature);
/**
 * @swagger
 * /admin/pending:
 *   get:
 *     summary: List pending requests awaiting verification
 *     description: >
 *       Returns all requests with status PENDING_VERIFICATION,
 *       including current signature counts and remaining signatures needed.
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of pending requests
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 requests:
 *                   type: array
 *                   items:
 *                     allOf:
 *                       - $ref: '#/components/schemas/Request'
 *                       - type: object
 *                         properties:
 *                           signatureCount:
 *                             type: integer
 *                           threshold:
 *                             type: integer
 *                           remainingSignatures:
 *                             type: integer
 *                           adminSignatures:
 *                             type: array
 *                             items:
 *                               $ref: '#/components/schemas/AdminSignature'
 *       403:
 *         description: Admin privileges required
 */
router.get("/pending", adminController_1.listPendingApprovals);
/**
 * @swagger
 * /admin/approve:
 *   post:
 *     summary: Directly approve a pending request
 *     description: >
 *       Directly approve a request without waiting for multi-sig threshold.
 *       Creates an HCS topic and activates the request (status -> LIVE).
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [requestId]
 *             properties:
 *               requestId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Request approved
 *       400:
 *         description: Invalid state
 *       403:
 *         description: Admin required
 *       404:
 *         description: Not found
 */
router.post("/approve", adminController_1.approveRequest);
/**
 * @swagger
 * /admin/reject:
 *   post:
 *     summary: Reject a pending request
 *     description: Rejects a request with an optional reason. Status -> REJECTED.
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [requestId]
 *             properties:
 *               requestId:
 *                 type: string
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Request rejected
 */
router.post("/reject", adminController_1.rejectRequest);
exports.default = router;
