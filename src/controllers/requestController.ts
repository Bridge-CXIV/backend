import type { Request, Response, NextFunction } from "express";
import prisma from "../config/db";
import { uploadMetadata, uploadDocument } from "../services/hfsService";
import { uploadFile } from "../services/storageService";
import { submitMessage } from "../services/hcsService";
import { getCachedValue, setCachedValue, deleteCachedValue } from "../services/cacheService";
import { ApiError } from "../middleware/apiError";

const isEvmAddress = (value?: string | null): value is string =>
  typeof value === "string" && /^0x[a-fA-F0-9]{40}$/.test(value);

const toJsonSafe = <T>(value: T): T =>
  JSON.parse(
    JSON.stringify(value, (_key, currentValue) =>
      typeof currentValue === "bigint" ? currentValue.toString() : currentValue,
    ),
  ) as T;

/**
 * POST /api/requests
 *
 * Create a new charity or grant request.
 * Uploads metadata to HFS, images to Cloudinary, and persists to DB.
 */
export const createRequest = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user;
    if (!user) throw new ApiError(401, "Authentication required");

    const {
      type,
      title,
      description,
      purpose,
      goalAmount,
      timelineEnd,
      category,
      // Grant-specific
      businessType,
      registrationId,
    } = req.body as {
      type: "CHARITY" | "GRANT";
      title: string;
      description: string;
      purpose: string;
      goalAmount: number;
      timelineEnd: string;
      category?: string;
      businessType?: string;
      registrationId?: string;
    };

    if (!type || !title || !description || !purpose || !goalAmount || !timelineEnd) {
      throw new ApiError(400, "Missing required fields");
    }

    if (type === "GRANT" && !businessType) {
      throw new ApiError(400, "businessType is required for grant requests");
    }

    // Fetch the creator's wallet address
    const creator = await prisma.user.findUnique({ where: { id: user.userId } });
    if (!creator) throw new ApiError(404, "User not found");

    const walletAddress = isEvmAddress(creator.walletAddress)
      ? creator.walletAddress
      : isEvmAddress(creator.hederaAccountId)
        ? creator.hederaAccountId
        : "";

    if (!walletAddress) {
      throw new ApiError(400, "User must have a valid EVM wallet address to create a request");
    }

    // Upload request metadata to HFS
    const metadataPayload = {
      title,
      description,
      purpose,
      goalAmount,
      timelineEnd,
      type,
      category: category || undefined,
      businessType: businessType || undefined,
      registrationId: registrationId || undefined,
      createdAt: new Date().toISOString(),
    };
    const hfsFileId = await uploadMetadata(metadataPayload);

    // Handle uploads (multer fields)
    let imageUrl: string | undefined;
    const files = (req as any).files as Record<string, Express.Multer.File[]> | undefined;
    const imageFile = files?.["image"]?.[0];
    if (imageFile) {
      const result = await uploadFile(imageFile.buffer, imageFile.originalname);
      imageUrl = result.url;
    }

    // Handle document uploads for grant requests
    let businessPlanHfsId: string | undefined;
    let proofOfBusinessHfsId: string | undefined;

    if (type === "GRANT" && files) {
      if (files["businessPlan"]?.[0]) {
        businessPlanHfsId = await uploadDocument(files["businessPlan"][0].buffer);
      }
      if (files["proofOfBusiness"]?.[0]) {
        proofOfBusinessHfsId = await uploadDocument(files["proofOfBusiness"][0].buffer);
      }
    }

    const request = await prisma.request.create({
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
    await deleteCachedValue("requests:list:all");

    res.status(201).json({ request });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/requests
 *
 * List requests with optional filters and pagination.
 * Query params: status, type, page, limit
 */
export const listRequests = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, type, page = "1", limit = "20" } = req.query as {
      status?: string;
      type?: string;
      page?: string;
      limit?: string;
    };

    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(100, Math.max(1, Number(limit)));
    const skip = (pageNum - 1) * limitNum;

    // Try cache for unfiltered first page
    const cacheKey = `requests:list:${status ?? "all"}:${type ?? "all"}:${pageNum}:${limitNum}`;
    const cached = await getCachedValue(cacheKey);
    if (cached) {
      return res.json(JSON.parse(cached));
    }

    const where: Record<string, any> = {};
    if (status) {
      where.status = status;
    } else {
      // Default: show only approved/live/funded projects for the public view
      where.status = { in: ["LIVE", "FUNDED"] };
    }
    if (type) where.type = type;

    const [requests, total] = await Promise.all([
      prisma.request.findMany({
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
      prisma.request.count({ where }),
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
    await setCachedValue(cacheKey, JSON.stringify(result), 120);

    res.json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/requests/:id
 *
 * Get a single request with all related data.
 */
export const getRequestById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const request = await prisma.request.findUnique({
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
      throw new ApiError(404, "Request not found");
    }

    res.json(toJsonSafe({ request }));
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/requests/:id/impact-updates
 *
 * Post an expense/impact update for a request.
 * Only the request creator can post updates.
 * The update is logged to the request's HCS topic.
 */
export const createImpactUpdate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user;
    if (!user) throw new ApiError(401, "Authentication required");

    const { id } = req.params;
    const { title, body } = req.body as { title: string; body: string };

    if (!title || !body) {
      throw new ApiError(400, "title and body are required");
    }

    const request = await prisma.request.findUnique({ where: { id } });
    if (!request) throw new ApiError(404, "Request not found");

    if (request.creatorId !== user.userId) {
      throw new ApiError(403, "Only the request creator can post impact updates");
    }

    if (!request.hcsTopicId) {
      throw new ApiError(400, "Request does not have an HCS topic yet (not yet verified)");
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
    await submitMessage(request.hcsTopicId, hcsMessage);

    // Persist in DB
    const update = await prisma.impactUpdate.create({
      data: {
        title,
        body,
        requestId: id,
        authorId: user.userId,
      },
    });

    res.status(201).json({ update });
  } catch (error) {
    next(error);
  }
};
