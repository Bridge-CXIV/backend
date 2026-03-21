"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMyDashboard = exports.getDashboard = void 0;
const db_1 = __importDefault(require("../config/db"));
const cacheService_1 = require("../services/cacheService");
/**
 * GET /api/dashboard
 *
 * Returns aggregated stats for the public dashboard:
 * - Total amount donated across all requests
 * - Count of requests by status (live, funded, expired)
 * - Recent donations
 * - Top causes by amount raised
 */
const getDashboard = async (_req, res, next) => {
    try {
        // Try cache first (2-minute TTL)
        const cacheKey = "dashboard:summary";
        const cached = await (0, cacheService_1.getCachedValue)(cacheKey);
        if (cached) {
            return res.json(JSON.parse(cached));
        }
        const [totalDonated, liveCount, fundedCount, expiredCount, pendingCount, recentDonations, topCauses,] = await Promise.all([
            // Sum of all donations
            db_1.default.donation.aggregate({ _sum: { amount: true } }),
            // Request counts by status
            db_1.default.request.count({ where: { status: "LIVE" } }),
            db_1.default.request.count({ where: { status: "FUNDED" } }),
            db_1.default.request.count({ where: { status: "EXPIRED" } }),
            db_1.default.request.count({ where: { status: "PENDING_VERIFICATION" } }),
            // 10 most recent donations
            db_1.default.donation.findMany({
                take: 10,
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
            // Top 5 causes by current amount
            db_1.default.request.findMany({
                where: { status: { in: ["LIVE", "FUNDED"] } },
                take: 5,
                orderBy: { currentAmount: "desc" },
                select: {
                    id: true,
                    title: true,
                    type: true,
                    goalAmount: true,
                    currentAmount: true,
                    imageUrl: true,
                    _count: { select: { donations: true } },
                },
            }),
        ]);
        const result = {
            totalDonated: totalDonated._sum.amount ?? 0,
            requestCounts: {
                live: liveCount,
                funded: fundedCount,
                expired: expiredCount,
                pending: pendingCount,
            },
            recentDonations,
            topCauses,
        };
        await (0, cacheService_1.setCachedValue)(cacheKey, JSON.stringify(result), 120);
        res.json(result);
    }
    catch (error) {
        next(error);
    }
};
exports.getDashboard = getDashboard;
/**
 * GET /api/dashboard/me
 *
 * Returns personalized stats for the authenticated user:
 * - Total amount donated by the user
 * - User's own requests (if any)
 * - Recent donations made by the user
 */
const getMyDashboard = async (req, res, next) => {
    try {
        const user = req.user;
        if (!user) {
            return res.status(401).json({ message: "Authentication required" });
        }
        const [totalDonated, myRequests, myDonations] = await Promise.all([
            // Sum of user's donations
            db_1.default.donation.aggregate({
                where: { donorId: user.userId },
                _sum: { amount: true },
            }),
            // User's own requests
            db_1.default.request.findMany({
                where: { creatorId: user.userId },
                orderBy: { createdAt: "desc" },
            }),
            // User's 10 most recent donations
            db_1.default.donation.findMany({
                where: { donorId: user.userId },
                take: 10,
                orderBy: { createdAt: "desc" },
                include: {
                    request: {
                        select: { id: true, title: true, type: true, contractAddress: true },
                    },
                },
            }),
        ]);
        res.json({
            user: {
                id: user.userId,
                email: user.email,
                displayName: user.displayName,
                hederaAccountId: user.hederaAccountId,
            },
            stats: {
                totalDonated: totalDonated._sum.amount ?? 0,
                donationCount: myDonations.length,
                requestCount: myRequests.length,
            },
            requests: myRequests,
            donations: myDonations,
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getMyDashboard = getMyDashboard;
