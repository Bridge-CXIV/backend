"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listDonations = exports.createDonation = void 0;
const db_1 = __importDefault(require("../config/db"));
const htsService_1 = require("../services/htsService");
const hcsService_1 = require("../services/hcsService");
const apiError_1 = require("../middleware/apiError");
const nftTokenId = process.env.NFT_TOKEN_ID ?? "";
/**
 * POST /api/donations
 *
 * Record a donation, mint an NFT receipt via HTS,
 * log the event to the request's HCS topic, and update totals.
 *
 * Body: { requestId, amount, transactionHash?, memo? }
 */
const createDonation = async (req, res, next) => {
    try {
        const user = req.user;
        if (!user)
            throw new apiError_1.ApiError(401, "Authentication required");
        const { requestId, amount, transactionHash, memo } = req.body;
        if (!requestId || !amount || amount <= 0) {
            throw new apiError_1.ApiError(400, "requestId and a positive amount are required");
        }
        const request = await db_1.default.request.findUnique({ where: { id: requestId } });
        if (!request)
            throw new apiError_1.ApiError(404, "Request not found");
        if (request.status !== "LIVE") {
            throw new apiError_1.ApiError(400, "Donations can only be made to live requests");
        }
        // Mint an NFT donation receipt via HTS
        let nftSerial;
        if (nftTokenId) {
            const metadata = Buffer.from(JSON.stringify({
                donor: user.hederaAccountId ?? user.userId,
                amount,
                requestId,
                requestTitle: request.title,
                hcsTopicId: request.hcsTopicId,
                timestamp: new Date().toISOString(),
            }));
            nftSerial = await (0, htsService_1.mintDonationReceipt)(nftTokenId, metadata);
            // Attempt to transfer the NFT to the donor if they have a Hedera ID
            if (user.hederaAccountId) {
                try {
                    await (0, htsService_1.transferNft)(nftTokenId, Number(nftSerial), user.hederaAccountId);
                }
                catch (error) {
                    // If transfer fails (usually association missing), we log it but don't fail the donation
                    console.warn(`NFT transfer failed for serial ${nftSerial}: ${error.message}`);
                }
            }
        }
        // Persist the donation
        const donation = await db_1.default.donation.create({
            data: {
                amount,
                nftId: nftSerial,
                tokenId: nftTokenId || undefined,
                transactionHash,
                memo,
                requestId,
                donorId: user.userId,
            },
        });
        // Upgrade user role to DONOR if they are currently a basic USER
        if (user.role === "USER") {
            await db_1.default.user.update({
                where: { id: user.userId },
                data: { role: "DONOR" },
            });
        }
        // Update cumulative amount on the request
        const updatedRequest = await db_1.default.request.update({
            where: { id: requestId },
            data: {
                currentAmount: {
                    increment: amount,
                },
            },
        });
        // Check if the goal has been met
        if (Number(updatedRequest.currentAmount) >= Number(updatedRequest.goalAmount)) {
            await db_1.default.request.update({
                where: { id: requestId },
                data: { status: "FUNDED" },
            });
        }
        // Log the donation event to the request's HCS topic
        if (request.hcsTopicId) {
            const hcsMessage = JSON.stringify({
                event: "DONATION",
                donationId: donation.id,
                donorAccount: user.hederaAccountId ?? user.userId,
                amount,
                nftSerial,
                transactionHash,
                timestamp: new Date().toISOString(),
            });
            await (0, hcsService_1.submitMessage)(request.hcsTopicId, hcsMessage);
        }
        res.status(201).json({
            donation,
            nftSerial,
            funded: Number(updatedRequest.currentAmount) >= Number(updatedRequest.goalAmount),
        });
    }
    catch (error) {
        next(error);
    }
};
exports.createDonation = createDonation;
/**
 * GET /api/donations
 *
 * List donations with optional filtering by requestId or donorId.
 * Query params: requestId, donorId, page, limit
 */
const listDonations = async (req, res, next) => {
    try {
        const { requestId, donorId, page = "1", limit = "20" } = req.query;
        const pageNum = Math.max(1, Number(page));
        const limitNum = Math.min(100, Math.max(1, Number(limit)));
        const skip = (pageNum - 1) * limitNum;
        const where = {};
        if (requestId)
            where.requestId = requestId;
        if (donorId)
            where.donorId = donorId;
        const [donations, total] = await Promise.all([
            db_1.default.donation.findMany({
                where,
                skip,
                take: limitNum,
                orderBy: { createdAt: "desc" },
                include: {
                    donor: {
                        select: { id: true, displayName: true, hederaAccountId: true },
                    },
                    request: {
                        select: { id: true, title: true, type: true },
                    },
                },
            }),
            db_1.default.donation.count({ where }),
        ]);
        res.json({
            donations,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages: Math.ceil(total / limitNum),
            },
        });
    }
    catch (error) {
        next(error);
    }
};
exports.listDonations = listDonations;
