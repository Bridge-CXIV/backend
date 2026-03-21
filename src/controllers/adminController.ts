import type { Request, Response, NextFunction } from "express";
import prisma from "../config/db";
import {
  recordSignature,
  checkThresholdAndActivate,
} from "../services/multiSigService";
import { createTopic, submitMessage } from "../services/hcsService";
import {
  ContractRevertError,
  contractService,
  isFactoryOwnerRevert,
} from "../services/contractService";
import { ApiError } from "../middleware/apiError";

const isEvmAddress = (value?: string | null): value is string =>
  typeof value === "string" && /^0x[a-fA-F0-9]{40}$/.test(value);

/**
 * POST /api/admin/signatures
 *
 * Record an admin's verification signature for a request.
 * If the threshold is met, the request is automatically activated
 * (HCS topic created, status → LIVE).
 *
 * Body: { requestId, signature }
 */
export const submitSignature = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user;
    if (!user) throw new ApiError(401, "Authentication required");

    const { requestId, signature } = req.body as {
      requestId: string;
      signature: string;
    };

    if (!requestId || !signature) {
      throw new ApiError(400, "requestId and signature are required");
    }

    // Verify the request exists and is pending
    const request = await prisma.request.findUnique({ where: { id: requestId } });
    if (!request) throw new ApiError(404, "Request not found");

    if (request.status !== "PENDING_VERIFICATION") {
      throw new ApiError(400, "Request is not pending verification");
    }

    // Check for duplicate signature
    const existing = await prisma.adminSignature.findUnique({
      where: {
        adminId_requestId: {
          adminId: user.userId,
          requestId,
        },
      },
    });
    if (existing) {
      throw new ApiError(409, "You have already signed this request");
    }

    // Record the signature
    await recordSignature(user.userId, requestId, signature);

    // Check threshold and potentially activate
    const activated = await checkThresholdAndActivate(requestId);

    res.json({
      message: activated
        ? "Signature recorded. Threshold met — request is now LIVE."
        : "Signature recorded. Awaiting more signatures.",
      activated,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/admin/pending
 *
 * List all requests pending admin verification, including
 * current signature counts.
 */
export const listPendingApprovals = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const threshold = Number(process.env.ADMIN_SIG_THRESHOLD ?? 2);

    const requests = await prisma.request.findMany({
      where: { status: "PENDING_VERIFICATION" },
      orderBy: { createdAt: "desc" },
      include: {
        creator: {
          select: { id: true, displayName: true, email: true, hederaAccountId: true },
        },
        adminSignatures: {
          include: {
            admin: {
              select: { id: true, displayName: true },
            },
          },
        },
      },
    });

    const result = requests.map((r: any) => ({
      ...r,
      signatureCount: r.adminSignatures.length,
      threshold,
      remainingSignatures: Math.max(0, threshold - r.adminSignatures.length),
    }));

    res.json({ requests: result });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/approve
 *
 * Directly approve a pending request — creates an HCS topic,
 * logs the verification event, and sets the request status to LIVE.
 *
 * Body: { requestId }
 */
export const approveRequest = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user;
    if (!user) throw new ApiError(401, "Authentication required");

    const { requestId } = req.body as { requestId: string };
    if (!requestId) throw new ApiError(400, "requestId is required");

    const request = await prisma.request.findUnique({ where: { id: requestId } });
    if (!request) throw new ApiError(404, "Request not found");

    if (request.status !== "PENDING_VERIFICATION") {
      throw new ApiError(400, "Request is not pending verification");
    }

    // ENFORCE: Min 2 signatures required before deployment
    const threshold = Number(process.env.ADMIN_SIG_THRESHOLD ?? 2);
    const signatureCount = await prisma.adminSignature.count({
      where: { requestId },
    });

    if (signatureCount < threshold) {
      throw new ApiError(400, `Minimum of ${threshold} signatures required. Current: ${signatureCount}`);
    }

    // 1. Deploy the campaign contract
    const campaignType = request.type === "CHARITY" ? 0 : 1;
    const deadline = Math.floor(request.timelineEnd.getTime() / 1000);

    if (!isEvmAddress(request.walletAddress)) {
      throw new ApiError(
        400,
        "Request creator does not have a valid EVM wallet address. Reconnect the creator wallet or recreate the request with a 0x address.",
      );
    }
    
    // contractService.createCampaign returns the EVM address
    let contractAddress: string;
    try {
      contractAddress = await contractService.createCampaign(
        request.walletAddress,
        deadline,
        campaignType
      );
    } catch (error) {
      if (isFactoryOwnerRevert(error)) {
        throw new ApiError(
          403,
          "Campaign deployment failed because the backend Hedera operator is not the factory owner. Update HEDERA_OPERATOR_ID/HEDERA_OPERATOR_KEY to the deployer account.",
        );
      }

      if (error instanceof ContractRevertError) {
        throw new ApiError(400, `Campaign deployment failed: ${error.message}`);
      }

      throw error;
    }

    // 2. Create a dedicated HCS topic for this request
    const topicId = await createTopic(
      `GlassGive | ${request.type} | ${request.title}`,
    );

    // 3. Log the approval event
    const approvalMessage = JSON.stringify({
      event: "ADMIN_APPROVAL",
      requestId: request.id,
      title: request.title,
      type: request.type,
      contractAddress,
      approvedBy: user.userId,
      timestamp: new Date().toISOString(),
    });
    await submitMessage(topicId, approvalMessage);

    // 4. Activate the request in DB
    const updated = await prisma.request.update({
      where: { id: requestId },
      data: {
        status: "LIVE",
        hcsTopicId: topicId,
        contractAddress,
      },
    });

    res.json({
      message: "Request approved and is now LIVE.",
      request: updated,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/reject
 *
 * Reject a pending request with a reason.
 * The rejection is logged on HCS if the request already has a topic.
 *
 * Body: { requestId, reason }
 */
export const rejectRequest = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user;
    if (!user) throw new ApiError(401, "Authentication required");

    const { requestId, reason } = req.body as {
      requestId: string;
      reason?: string;
    };
    if (!requestId) throw new ApiError(400, "requestId is required");

    const request = await prisma.request.findUnique({ where: { id: requestId } });
    if (!request) throw new ApiError(404, "Request not found");

    if (request.status !== "PENDING_VERIFICATION") {
      throw new ApiError(400, "Request is not pending verification");
    }

    // If there's already an HCS topic, log the rejection
    if (request.hcsTopicId) {
      const rejectionMessage = JSON.stringify({
        event: "ADMIN_REJECTION",
        requestId: request.id,
        rejectedBy: user.userId,
        reason: reason ?? "No reason provided",
        timestamp: new Date().toISOString(),
      });
      await submitMessage(request.hcsTopicId, rejectionMessage);
    }

    const updated = await prisma.request.update({
      where: { id: requestId },
      data: { status: "REJECTED" },
    });

    res.json({
      message: "Request has been rejected.",
      request: updated,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/admin/users
 *
 * List all users with their roles and on-chain admin status.
 */
export const listUsers = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
    });

    // Augment with on-chain status if they have a wallet
    const result = await Promise.all(
      users.map(async (user) => {
        let isContractAdmin = false;
        if (user.walletAddress) {
          try {
            isContractAdmin = await contractService.getIsAdmin(user.walletAddress);
          } catch (err) {
            console.error(`Failed to check contract admin for ${user.walletAddress}:`, err);
          }
        }
        return {
          ...user,
          isContractAdmin,
        };
      })
    );

    res.json({ users: result });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/role
 *
 * Update a user's role in the database.
 * Body: { userId, role }
 */
export const updateUserRole = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, role } = req.body as { userId: string; role: any };
    if (!userId || !role) throw new ApiError(400, "userId and role are required");

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { role },
    });

    res.json({
      message: "User role updated successfully.",
      user: updated,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/contract-sync
 *
 * Sync a user's admin status to the Factory smart contract.
 * Body: { userId, action: 'ADD' | 'REMOVE' }
 */
export const syncContractAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, action } = req.body as { userId: string; action: "ADD" | "REMOVE" };
    if (!userId || !action) throw new ApiError(400, "userId and action are required");

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.walletAddress) {
      throw new ApiError(400, "User not found or has no wallet connected.");
    }

    try {
      if (action === "ADD") {
        await contractService.addAdmin(user.walletAddress);
      } else {
        await contractService.removeAdmin(user.walletAddress);
      }
    } catch (error) {
      if (isFactoryOwnerRevert(error)) {
        throw new ApiError(
          403,
          "On-chain admin sync failed because the backend Hedera operator is not the factory owner. Update HEDERA_OPERATOR_ID/HEDERA_OPERATOR_KEY to the deployer account.",
        );
      }

      if (error instanceof ContractRevertError) {
        throw new ApiError(400, `On-chain admin sync failed: ${error.message}`);
      }

      throw error;
    }

    res.json({
      message: `Successfully ${action === "ADD" ? "added" : "removed"} admin on-chain.`,
    });
  } catch (error) {
    next(error);
  }
};
