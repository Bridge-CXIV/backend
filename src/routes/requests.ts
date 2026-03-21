import { Router } from "express";
import multer from "multer";
import { authenticate, requireAuth } from "../middleware/auth";
import {
  createRequest,
  getRequestById,
  listRequests,
  createImpactUpdate,
} from "../controllers/requestController";

const upload = multer({ storage: multer.memoryStorage() });

const router = Router();

/**
 * @swagger
 * /requests:
 *   get:
 *     summary: List charity & grant requests
 *     description: Returns a paginated list of requests. Supports filtering by status and type.
 *     tags: [Requests]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING_VERIFICATION, LIVE, FUNDED, EXPIRED, REJECTED]
 *         description: Filter by request status. If omitted, defaults to showing LIVE and FUNDED projects for the public view.
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [CHARITY, GRANT]
 *         description: Filter by request type
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
 *         description: Paginated list of requests
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 requests:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Request'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 */
router.get("/", listRequests);

/**
 * @swagger
 * /requests/{id}:
 *   get:
 *     summary: Get a request by ID
 *     description: >
 *       Returns the full details of a request including related donations,
 *       HCS audit messages, admin signatures, and impact updates.
 *     tags: [Requests]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Request ID
 *     responses:
 *       200:
 *         description: Request details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 request:
 *                   $ref: '#/components/schemas/Request'
 *       404:
 *         description: Request not found
 */
router.get("/:id", getRequestById);

/**
 * @swagger
 * /requests:
 *   post:
 *     summary: Create a new charity or grant request
 *     description: >
 *       Submit a new charity or grant request. Metadata is uploaded to Hedera File Service,
 *       images to Cloudinary, and the request is persisted in the database with
 *       status PENDING_VERIFICATION.
 *     tags: [Requests]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [type, title, description, purpose, goalAmount, timelineEnd]
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [CHARITY, GRANT]
 *               title:
 *                 type: string
 *                 example: "Clean Water for Village X"
 *               description:
 *                 type: string
 *               purpose:
 *                 type: string
 *               goalAmount:
 *                 type: number
 *                 example: 5000
 *               timelineEnd:
 *                 type: string
 *                 format: date-time
 *                 example: "2026-06-30T00:00:00Z"
 *               businessType:
 *                 type: string
 *                 description: Required for GRANT type only
 *               image:
 *                 type: string
 *                 format: binary
 *                 description: Optional cover image
 *               businessPlan:
 *                 type: string
 *                 format: binary
 *                 description: Required for GRANT — business plan document
 *               proofOfBusiness:
 *                 type: string
 *                 format: binary
 *                 description: Required for GRANT — proof of business document
 *     responses:
 *       201:
 *         description: Request created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 request:
 *                   $ref: '#/components/schemas/Request'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Authentication required
 */
router.post(
  "/",
  authenticate,
  requireAuth,
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "businessPlan", maxCount: 1 },
    { name: "proofOfBusiness", maxCount: 1 }
  ]),
  createRequest
);

/**
 * @swagger
 * /requests/{id}/impact-updates:
 *   post:
 *     summary: Post an impact/expense update
 *     description: >
 *       Only the request creator can post updates. Each update is logged to the
 *       request's HCS topic for immutable auditability.
 *     tags: [Requests]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Request ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, body]
 *             properties:
 *               title:
 *                 type: string
 *                 example: "Q1 Expense Report"
 *               body:
 *                 type: string
 *                 example: "Spent 1200 HBAR on water filtration equipment..."
 *     responses:
 *       201:
 *         description: Impact update created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 update:
 *                   $ref: '#/components/schemas/ImpactUpdate'
 *       400:
 *         description: Validation error or request not yet verified
 *       403:
 *         description: Only the request creator can post updates
 *       404:
 *         description: Request not found
 */
router.post("/:id/impact-updates", authenticate, requireAuth, createImpactUpdate);

export default router;
