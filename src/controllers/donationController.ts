import type { Request, Response, NextFunction } from "express";
import prisma from "../config/db";
import { mintDonationReceipt, transferNft } from "../services/htsService";
import { keccak256 } from "ethers";
import { submitMessage } from "../services/hcsService";
import { ApiError } from "../middleware/apiError";

const nftTokenId = process.env.NFT_TOKEN_ID ?? "";

const buildCompactDonationMetadata = (
  donorId: string,
  amount: number,
  requestId: string,
) => {
  const compactMetadata = [
    "GG",
    donorId.slice(-8),
    Number(amount).toString(),
    requestId.slice(-8),
    Date.now().toString(36),
  ].join("|");

  const rawBytes = Buffer.from(compactMetadata);
  const hashHex = keccak256(rawBytes);
  return Buffer.from(hashHex.slice(2), "hex");
};

/**
 * POST /api/donations
 *
 * Record a donation, mint an NFT receipt via HTS,
 * log the event to the request's HCS topic, and update totals.
 *
 * Body: { requestId, amount, transactionHash?, memo? }
 */
export const createDonation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user;
    if (!user) throw new ApiError(401, "Authentication required");

    const { requestId, amount, transactionHash, memo } = req.body as {
      requestId: string;
      amount: number;
      transactionHash?: string;
      memo?: string;
    };

    if (!requestId || !amount || amount <= 0) {
      throw new ApiError(400, "requestId and a positive amount are required");
    }

    const request = await prisma.request.findUnique({ where: { id: requestId } });
    if (!request) throw new ApiError(404, "Request not found");
    if (request.status !== "LIVE") {
      throw new ApiError(400, "Donations can only be made to live requests");
    }

    // Mint an NFT donation receipt via HTS
    let nftSerial: string | undefined;
    if (nftTokenId) {
      const metadata = buildCompactDonationMetadata(
        user.hederaAccountId ?? user.userId,
        amount,
        requestId,
      );
      if (metadata.length > 100) {
        throw new ApiError(400, "HTS: metadata too long");
      }
      nftSerial = await mintDonationReceipt(nftTokenId, metadata);

      // Attempt to transfer the NFT to the donor if they have a Hedera ID
      if (user.hederaAccountId) {
        try {
          await transferNft(nftTokenId, Number(nftSerial), user.hederaAccountId);
        } catch (error: any ) {
          // If transfer fails (usually association missing), we log it but don't fail the donation
          console.warn(`NFT transfer failed for serial ${nftSerial}: ${error.message}`);
        }
      }
    }

    // Persist the donation
    const donation = await prisma.donation.create({
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
      await prisma.user.update({
        where: { id: user.userId },
        data: { role: "DONOR" },
      });
    }

    // Update cumulative amount on the request
    const updatedRequest = await prisma.request.update({
      where: { id: requestId },
      data: {
        currentAmount: {
          increment: amount,
        },
      },
    });

    // Check if the goal has been met
    if (Number(updatedRequest.currentAmount) >= Number(updatedRequest.goalAmount)) {
      await prisma.request.update({
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
      await submitMessage(request.hcsTopicId, hcsMessage);
    }

    res.status(201).json({
      donation,
      nftSerial,
      funded: Number(updatedRequest.currentAmount) >= Number(updatedRequest.goalAmount),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/donations
 *
 * List donations with optional filtering by requestId or donorId.
 * Query params: requestId, donorId, page, limit
 */
export const listDonations = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { requestId, donorId, page = "1", limit = "20" } = req.query as {
      requestId?: string;
      donorId?: string;
      page?: string;
      limit?: string;
    };

    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(100, Math.max(1, Number(limit)));
    const skip = (pageNum - 1) * limitNum;

    const where: Record<string, unknown> = {};
    if (requestId) where.requestId = requestId;
    if (donorId) where.donorId = donorId;

    const [donations, total] = await Promise.all([
      prisma.donation.findMany({
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
      prisma.donation.count({ where }),
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
  } catch (error) {
    next(error);
  }
};
