"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncContractAdmin = exports.updateUserRole = exports.listUsers = exports.rejectRequest = exports.approveRequest = exports.listPendingApprovals = exports.submitSignature = void 0;
const db_1 = __importDefault(require("../config/db"));
const multiSigService_1 = require("../services/multiSigService");
const hcsService_1 = require("../services/hcsService");
const contractService_1 = require("../services/contractService");
const apiError_1 = require("../middleware/apiError");
const isEvmAddress = (value) => typeof value === "string" && /^0x[a-fA-F0-9]{40}$/.test(value);
/**
 * POST /api/admin/signatures
 *
 * Record an admin's verification signature for a request.
 * If the threshold is met, the request is automatically activated
 * (HCS topic created, status → LIVE).
 *
 * Body: { requestId, signature }
 */
const submitSignature = async (req, res, next) => {
    try {
        const user = req.user;
        if (!user)
            throw new apiError_1.ApiError(401, "Authentication required");
        const { requestId, signature } = req.body;
        if (!requestId || !signature) {
            throw new apiError_1.ApiError(400, "requestId and signature are required");
        }
        // Verify the request exists and is pending
        const request = await db_1.default.request.findUnique({ where: { id: requestId } });
        if (!request)
            throw new apiError_1.ApiError(404, "Request not found");
        if (request.status !== "PENDING_VERIFICATION") {
            throw new apiError_1.ApiError(400, "Request is not pending verification");
        }
        // Check for duplicate signature
        const existing = await db_1.default.adminSignature.findUnique({
            where: {
                adminId_requestId: {
                    adminId: user.userId,
                    requestId,
                },
            },
        });
        if (existing) {
            throw new apiError_1.ApiError(409, "You have already signed this request");
        }
        // Record the signature
        await (0, multiSigService_1.recordSignature)(user.userId, requestId, signature);
        // Check threshold and potentially activate
        const activated = await (0, multiSigService_1.checkThresholdAndActivate)(requestId);
        res.json({
            message: activated
                ? "Signature recorded. Threshold met — request is now LIVE."
                : "Signature recorded. Awaiting more signatures.",
            activated,
        });
    }
    catch (error) {
        next(error);
    }
};
exports.submitSignature = submitSignature;
/**
 * GET /api/admin/pending
 *
 * List all requests pending admin verification, including
 * current signature counts.
 */
const listPendingApprovals = async (_req, res, next) => {
    try {
        const threshold = Number(process.env.ADMIN_SIG_THRESHOLD ?? 2);
        const requests = await db_1.default.request.findMany({
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
        const result = requests.map((r) => ({
            ...r,
            signatureCount: r.adminSignatures.length,
            threshold,
            remainingSignatures: Math.max(0, threshold - r.adminSignatures.length),
        }));
        res.json({ requests: result });
    }
    catch (error) {
        next(error);
    }
};
exports.listPendingApprovals = listPendingApprovals;
/**
 * POST /api/admin/approve
 *
 * Directly approve a pending request — creates an HCS topic,
 * logs the verification event, and sets the request status to LIVE.
 *
 * Body: { requestId }
 */
const approveRequest = async (req, res, next) => {
    try {
        const user = req.user;
        if (!user)
            throw new apiError_1.ApiError(401, "Authentication required");
        const { requestId } = req.body;
        if (!requestId)
            throw new apiError_1.ApiError(400, "requestId is required");
        const request = await db_1.default.request.findUnique({ where: { id: requestId } });
        if (!request)
            throw new apiError_1.ApiError(404, "Request not found");
        if (request.status !== "PENDING_VERIFICATION") {
            throw new apiError_1.ApiError(400, "Request is not pending verification");
        }
        // ENFORCE: Min 2 signatures required before deployment
        const threshold = Number(process.env.ADMIN_SIG_THRESHOLD ?? 2);
        const signatureCount = await db_1.default.adminSignature.count({
            where: { requestId },
        });
        if (signatureCount < threshold) {
            throw new apiError_1.ApiError(400, `Minimum of ${threshold} signatures required. Current: ${signatureCount}`);
        }
        // 1. Deploy the campaign contract
        const campaignType = request.type === "CHARITY" ? 0 : 1;
        const deadline = Math.floor(request.timelineEnd.getTime() / 1000);
        if (!isEvmAddress(request.walletAddress)) {
            throw new apiError_1.ApiError(400, "Request creator does not have a valid EVM wallet address. Reconnect the creator wallet or recreate the request with a 0x address.");
        }
        // contractService.createCampaign returns the EVM address
        let contractAddress;
        try {
            contractAddress = await contractService_1.contractService.createCampaign(request.walletAddress, deadline, campaignType);
        }
        catch (error) {
            if ((0, contractService_1.isFactoryOwnerRevert)(error)) {
                throw new apiError_1.ApiError(403, "Campaign deployment failed because the backend Hedera operator is not the factory owner. Update HEDERA_OPERATOR_ID/HEDERA_OPERATOR_KEY to the deployer account.");
            }
            if (error instanceof contractService_1.ContractRevertError) {
                throw new apiError_1.ApiError(400, `Campaign deployment failed: ${error.message}`);
            }
            throw error;
        }
        // 2. Create a dedicated HCS topic for this request
        const topicId = await (0, hcsService_1.createTopic)(`GlassGive | ${request.type} | ${request.title}`);
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
        await (0, hcsService_1.submitMessage)(topicId, approvalMessage);
        // 4. Activate the request in DB
        const updated = await db_1.default.request.update({
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
    }
    catch (error) {
        next(error);
    }
};
exports.approveRequest = approveRequest;
/**
 * POST /api/admin/reject
 *
 * Reject a pending request with a reason.
 * The rejection is logged on HCS if the request already has a topic.
 *
 * Body: { requestId, reason }
 */
const rejectRequest = async (req, res, next) => {
    try {
        const user = req.user;
        if (!user)
            throw new apiError_1.ApiError(401, "Authentication required");
        const { requestId, reason } = req.body;
        if (!requestId)
            throw new apiError_1.ApiError(400, "requestId is required");
        const request = await db_1.default.request.findUnique({ where: { id: requestId } });
        if (!request)
            throw new apiError_1.ApiError(404, "Request not found");
        if (request.status !== "PENDING_VERIFICATION") {
            throw new apiError_1.ApiError(400, "Request is not pending verification");
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
            await (0, hcsService_1.submitMessage)(request.hcsTopicId, rejectionMessage);
        }
        const updated = await db_1.default.request.update({
            where: { id: requestId },
            data: { status: "REJECTED" },
        });
        res.json({
            message: "Request has been rejected.",
            request: updated,
        });
    }
    catch (error) {
        next(error);
    }
};
exports.rejectRequest = rejectRequest;
/**
 * GET /api/admin/users
 *
 * List all users with their roles and on-chain admin status.
 */
const listUsers = async (_req, res, next) => {
    try {
        const users = await db_1.default.user.findMany({
            orderBy: { createdAt: "desc" },
        });
        // Augment with on-chain status if they have a wallet
        const result = await Promise.all(users.map(async (user) => {
            let isContractAdmin = false;
            if (user.walletAddress) {
                try {
                    isContractAdmin = await contractService_1.contractService.getIsAdmin(user.walletAddress);
                }
                catch (err) {
                    console.error(`Failed to check contract admin for ${user.walletAddress}:`, err);
                }
            }
            return {
                ...user,
                isContractAdmin,
            };
        }));
        res.json({ users: result });
    }
    catch (error) {
        next(error);
    }
};
exports.listUsers = listUsers;
/**
 * POST /api/admin/role
 *
 * Update a user's role in the database.
 * Body: { userId, role }
 */
const updateUserRole = async (req, res, next) => {
    try {
        const { userId, role } = req.body;
        if (!userId || !role)
            throw new apiError_1.ApiError(400, "userId and role are required");
        const updated = await db_1.default.user.update({
            where: { id: userId },
            data: { role },
        });
        res.json({
            message: "User role updated successfully.",
            user: updated,
        });
    }
    catch (error) {
        next(error);
    }
};
exports.updateUserRole = updateUserRole;
/**
 * POST /api/admin/contract-sync
 *
 * Sync a user's admin status to the Factory smart contract.
 * Body: { userId, action: 'ADD' | 'REMOVE' }
 */
const syncContractAdmin = async (req, res, next) => {
    try {
        const { userId, action } = req.body;
        if (!userId || !action)
            throw new apiError_1.ApiError(400, "userId and action are required");
        const user = await db_1.default.user.findUnique({ where: { id: userId } });
        if (!user || !user.walletAddress) {
            throw new apiError_1.ApiError(400, "User not found or has no wallet connected.");
        }
        try {
            if (action === "ADD") {
                await contractService_1.contractService.addAdmin(user.walletAddress);
            }
            else {
                await contractService_1.contractService.removeAdmin(user.walletAddress);
            }
        }
        catch (error) {
            if ((0, contractService_1.isFactoryOwnerRevert)(error)) {
                throw new apiError_1.ApiError(403, "On-chain admin sync failed because the backend Hedera operator is not the factory owner. Update HEDERA_OPERATOR_ID/HEDERA_OPERATOR_KEY to the deployer account.");
            }
            if (error instanceof contractService_1.ContractRevertError) {
                throw new apiError_1.ApiError(400, `On-chain admin sync failed: ${error.message}`);
            }
            throw error;
        }
        res.json({
            message: `Successfully ${action === "ADD" ? "added" : "removed"} admin on-chain.`,
        });
    }
    catch (error) {
        next(error);
    }
};
exports.syncContractAdmin = syncContractAdmin;
