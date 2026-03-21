import type { Request, Response, NextFunction } from "express";
import prisma from "../config/db";
import { getCachedValue, setCachedValue } from "../services/cacheService";

/**
 * GET /api/dashboard
 *
 * Returns aggregated stats for the public dashboard:
 * - Total amount donated across all requests
 * - Count of requests by status (live, funded, expired)
 * - Recent donations
 * - Top causes by amount raised
 */
export const getDashboard = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    // Try cache first (2-minute TTL)
    const cacheKey = "dashboard:summary";
    const cached = await getCachedValue(cacheKey);
    if (cached) {
      return res.json(JSON.parse(cached));
    }

    const [
      totalDonated,
      liveCount,
      fundedCount,
      expiredCount,
      pendingCount,
      recentDonations,
      topCauses,
    ] = await Promise.all([
      // Sum of all donations
      prisma.donation.aggregate({ _sum: { amount: true } }),

      // Request counts by status
      prisma.request.count({ where: { status: "LIVE" } }),
      prisma.request.count({ where: { status: "FUNDED" } }),
      prisma.request.count({ where: { status: "EXPIRED" } }),
      prisma.request.count({ where: { status: "PENDING_VERIFICATION" } }),

      // 10 most recent donations
      prisma.donation.findMany({
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
      prisma.request.findMany({
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

    await setCachedValue(cacheKey, JSON.stringify(result), 120);

    res.json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/dashboard/me
 *
 * Returns personalized stats for the authenticated user:
 * - Total amount donated by the user
 * - User's own requests (if any)
 * - Recent donations made by the user
 */
export const getMyDashboard = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const [totalDonated, myRequests, myDonations] = await Promise.all([
      // Sum of user's donations
      prisma.donation.aggregate({
        where: { donorId: user.userId },
        _sum: { amount: true },
      }),

      // User's own requests
      prisma.request.findMany({
        where: { creatorId: user.userId },
        orderBy: { createdAt: "desc" },
      }),

      // User's 10 most recent donations
      prisma.donation.findMany({
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
  } catch (error) {
    next(error);
  }
};
