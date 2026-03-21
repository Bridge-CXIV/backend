"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createImpactUpdate = exports.getRequestById = exports.listRequests = exports.createRequest = void 0;
const db_1 = __importDefault(require("../config/db"));
const hfsService_1 = require("../services/hfsService");
const storageService_1 = require("../services/storageService");
const hcsService_1 = require("../services/hcsService");
const cacheService_1 = require("../services/cacheService");
const apiError_1 = require("../middleware/apiError");
const isEvmAddress = (value) => typeof value === "string" && /^0x[a-fA-F0-9]{40}$/.test(value);
const toJsonSafe = (value) => JSON.parse(JSON.stringify(value, (_key, currentValue) => typeof currentValue === "bigint" ? currentValue.toString() : currentValue));
/**
 * POST /api/requests
 *
 * Create a new charity or grant request.
 * Uploads metadata to HFS, images to Cloudinary, and persists to DB.
 */
const createRequest = async (req, res, next) => {
    try {
        const user = req.user;
        if (!user)
            throw new apiError_1.ApiError(401, "Authentication required");
        const { type, title, description, purpose, goalAmount, timelineEnd, 
        // Grant-specific
        businessType, } = req.body;
        if (!type || !title || !description || !purpose || !goalAmount || !timelineEnd) {
            throw new apiError_1.ApiError(400, "Missing required fields");
        }
        if (type === "GRANT" && !businessType) {
            throw new apiError_1.ApiError(400, "businessType is required for grant requests");
        }
        // Fetch the creator's wallet address
        const creator = await db_1.default.user.findUnique({ where: { id: user.userId } });
        if (!creator)
            throw new apiError_1.ApiError(404, "User not found");
        const walletAddress = isEvmAddress(creator.walletAddress)
            ? creator.walletAddress
            : isEvmAddress(creator.hederaAccountId)
                ? creator.hederaAccountId
                : "";
        if (!walletAddress) {
            throw new apiError_1.ApiError(400, "User must have a valid EVM wallet address to create a request");
        }
        // Upload request metadata to HFS
        const metadataPayload = {
            title,
            description,
            purpose,
            goalAmount,
            timelineEnd,
            type,
            businessType,
            createdAt: new Date().toISOString(),
        };
        const hfsFileId = await (0, hfsService_1.uploadMetadata)(metadataPayload);
        // Handle image upload if present (multer file)
        let imageUrl;
        const file = req.file;
        if (file) {
            const result = await (0, storageService_1.uploadFile)(file.buffer, file.originalname);
            imageUrl = result.url;
        }
        // Handle document uploads for grant requests
        let businessPlanHfsId;
        let proofOfBusinessHfsId;
        const files = req.files;
        if (type === "GRANT" && files) {
            if (files["businessPlan"]?.[0]) {
                businessPlanHfsId = await (0, hfsService_1.uploadDocument)(files["businessPlan"][0].buffer);
            }
            if (files["proofOfBusiness"]?.[0]) {
                proofOfBusinessHfsId = await (0, hfsService_1.uploadDocument)(files["proofOfBusiness"][0].buffer);
            }
        }
        const request = await db_1.default.request.create({
            data: {
                type,
                title,
                description,
                purpose,
                goalAmount,
                timelineEnd: new Date(timelineEnd),
                walletAddress,
                hfsFileId,
                imageUrl,
                businessType,
                businessPlanHfsId,
                proofOfBusinessHfsId,
                creatorId: user.userId,
                metadata: metadataPayload,
            },
        });
        // Invalidate cached request list
        await (0, cacheService_1.deleteCachedValue)("requests:list:all");
        res.status(201).json({ request });
    }
    catch (error) {
        next(error);
    }
};
exports.createRequest = createRequest;
/**
 * GET /api/requests
 *
 * List requests with optional filters and pagination.
 * Query params: status, type, page, limit
 */
const listRequests = async (req, res, next) => {
    try {
        const { status, type, page = "1", limit = "20" } = req.query;
        const pageNum = Math.max(1, Number(page));
        const limitNum = Math.min(100, Math.max(1, Number(limit)));
        const skip = (pageNum - 1) * limitNum;
        // Try cache for unfiltered first page
        const cacheKey = `requests:list:${status ?? "all"}:${type ?? "all"}:${pageNum}:${limitNum}`;
        const cached = await (0, cacheService_1.getCachedValue)(cacheKey);
        if (cached) {
            return res.json(JSON.parse(cached));
        }
        const where = {};
        if (status) {
            where.status = status;
        }
        else {
            // Default: show only approved/live/funded projects for the public view
            where.status = { in: ["LIVE", "FUNDED"] };
        }
        if (type)
            where.type = type;
        const [requests, total] = await Promise.all([
            db_1.default.request.findMany({
                where,
                skip,
                take: limitNum,
                orderBy: { createdAt: "desc" },
                include: {
                    creator: {
                        select: { id: true, displayName: true, hederaAccountId: true },
                    },
                    _count: { select: { donations: true } },
                },
            }),
            db_1.default.request.count({ where }),
        ]);
        const result = {
            requests,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages: Math.ceil(total / limitNum),
            },
        };
        // Cache for 2 minutes
        await (0, cacheService_1.setCachedValue)(cacheKey, JSON.stringify(result), 120);
        res.json(result);
    }
    catch (error) {
        next(error);
    }
};
exports.listRequests = listRequests;
/**
 * GET /api/requests/:id
 *
 * Get a single request with all related data.
 */
const getRequestById = async (req, res, next) => {
    try {
        const { id } = req.params;
        const request = await db_1.default.request.findUnique({
            where: { id },
            include: {
                creator: {
                    select: { id: true, displayName: true, hederaAccountId: true },
                },
                donations: {
                    orderBy: { createdAt: "desc" },
                    take: 50,
                    include: {
                        donor: {
                            select: { id: true, displayName: true, hederaAccountId: true },
                        },
                    },
                },
                hcsMessages: {
                    orderBy: { sequenceNumber: "asc" },
                },
                adminSignatures: {
                    include: {
                        admin: {
                            select: { id: true, displayName: true },
                        },
                    },
                },
                impactUpdates: {
                    orderBy: { createdAt: "desc" },
                },
            },
        });
        if (!request) {
            throw new apiError_1.ApiError(404, "Request not found");
        }
        res.json(toJsonSafe({ request }));
    }
    catch (error) {
        next(error);
    }
};
exports.getRequestById = getRequestById;
/**
 * POST /api/requests/:id/impact-updates
 *
 * Post an expense/impact update for a request.
 * Only the request creator can post updates.
 * The update is logged to the request's HCS topic.
 */
const createImpactUpdate = async (req, res, next) => {
    try {
        const user = req.user;
        if (!user)
            throw new apiError_1.ApiError(401, "Authentication required");
        const { id } = req.params;
        const { title, body } = req.body;
        if (!title || !body) {
            throw new apiError_1.ApiError(400, "title and body are required");
        }
        const request = await db_1.default.request.findUnique({ where: { id } });
        if (!request)
            throw new apiError_1.ApiError(404, "Request not found");
        if (request.creatorId !== user.userId) {
            throw new apiError_1.ApiError(403, "Only the request creator can post impact updates");
        }
        if (!request.hcsTopicId) {
            throw new apiError_1.ApiError(400, "Request does not have an HCS topic yet (not yet verified)");
        }
        // Log to HCS
        const hcsMessage = JSON.stringify({
            event: "IMPACT_UPDATE",
            requestId: id,
            title,
            body,
            authorId: user.userId,
            timestamp: new Date().toISOString(),
        });
        await (0, hcsService_1.submitMessage)(request.hcsTopicId, hcsMessage);
        // Persist in DB
        const update = await db_1.default.impactUpdate.create({
            data: {
                title,
                body,
                requestId: id,
                authorId: user.userId,
            },
        });
        res.status(201).json({ update });
    }
    catch (error) {
        next(error);
    }
};
exports.createImpactUpdate = createImpactUpdate;
