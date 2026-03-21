import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import prisma from "../config/db";
import { verifyDidToken, getIssuer, getUserMetadata } from "../services/magicService";
import { createHederaAccount } from "../services/accountService";
import { ApiError } from "../middleware/apiError";

const jwtSecret = process.env.JWT_SECRET ?? "changeme";

const signAuthToken = (user: {
  id: string;
  role: string;
  magicUserId?: string | null;
  hederaAccountId?: string | null;
  email?: string | null;
}) =>
  jwt.sign(
    {
      userId: user.id,
      role: user.role,
      magicUserId: user.magicUserId ?? undefined,
      hederaAccountId: user.hederaAccountId ?? undefined,
      email: user.email ?? undefined,
    } satisfies Express.AuthPayload,
    jwtSecret,
    { expiresIn: "7d" },
  );

const assertAdminRole = (role: string) => {
  if (role !== "ADMIN") {
    throw new ApiError(403, "Admin privileges are required");
  }
};

const assertStandardUserRole = (role: string) => {
  if (role === "ADMIN") {
    throw new ApiError(403, "Admin accounts must sign in via /admin/login");
  }
};

/**
 * POST /api/auth/magic
 *
 * Accepts a Magic DID token in the Authorization header, verifies it,
 * upserts the user, creates a Hedera account if it's a new user,
 * and returns a signed JWT.
 */
export const magicLogin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { didToken: bodyToken } = req.body as { didToken?: string };
    const headerToken = req.headers.authorization?.replace("Bearer ", "");
    const didToken = bodyToken || headerToken;

    if (!didToken) {
      throw new ApiError(400, "DID token is required (either in body as 'didToken' or in Authorization header)");
    }

    // Validate the token (throws if invalid)
    await verifyDidToken(didToken);

    // Extract user info from the token
    const issuer = await getIssuer(didToken);
    const metadata = await getUserMetadata(issuer);
    const email = metadata.email ?? undefined;

    // Upsert the user
    let user = await prisma.user.findUnique({
      where: { magicUserId: issuer },
    });

    if (!user) {
      // First-time user: create a Hedera account for them
      // We do not pass Magic's publicAddress as a publicKey because it's a 0x EVM address,
      // not a DER-encoded Hedera public key. The account will use the operator key.
      const hederaAccountId = await createHederaAccount();

      try {
        user = await prisma.user.create({
          data: {
            magicUserId: issuer,
            hederaAccountId,
            walletAddress: metadata.publicAddress ?? undefined,
            email,
            role: "USER",
          },
        });
      } catch (err: any) {
        // Handle concurrent request race condition
        if (err.code === "P2002") {
          user = await prisma.user.findUnique({
            where: { magicUserId: issuer },
          });
          if (!user) throw err;
        } else {
          throw err;
        }
      }
    } else {
      // Update email if it changed
      if (email && email !== user.email) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { email },
        });
      }
    }

    assertStandardUserRole(user.role);

    // Sign a JWT
    const token = signAuthToken(user);

    res.json({
      token,
      user: {
        id: user.id,
        hederaAccountId: user.hederaAccountId,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/wallet
 *
 * Accepts a Hedera account ID and a signed message for wallet-based login.
 * Upserts the user and returns a signed JWT.
 *
 * Body: { accountId: string, signature: string, message: string }
 */
export const walletLogin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { accountId, signature } = req.body as {
      accountId?: string;
      signature?: string;
    };

    if (!accountId || !signature) {
      throw new ApiError(400, "accountId and signature are required");
    }

    // In a production implementation, we would verify the signature
    // against the account's public key via the Mirror Node.
    // For the testnet/hackathon phase, we trust the signed request.

    // Upsert user by wallet / Hedera account
    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { hederaAccountId: accountId },
          { walletAddress: accountId },
        ],
      },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          hederaAccountId: accountId,
          walletAddress: accountId,
          role: "USER",
        },
      });
    }

    assertStandardUserRole(user.role);

    const token = signAuthToken(user);

    res.json({
      token,
      user: {
        id: user.id,
        hederaAccountId: user.hederaAccountId,
        role: user.role,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const adminMagicLogin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { didToken: bodyToken } = req.body as { didToken?: string };
    const headerToken = req.headers.authorization?.replace("Bearer ", "");
    const didToken = bodyToken || headerToken;

    if (!didToken) {
      throw new ApiError(400, "DID token is required (either in body as 'didToken' or in Authorization header)");
    }

    await verifyDidToken(didToken);

    const issuer = await getIssuer(didToken);
    const user = await prisma.user.findUnique({
      where: { magicUserId: issuer },
    });

    if (!user) {
      throw new ApiError(403, "Admin account not found");
    }

    assertAdminRole(user.role);

    const token = signAuthToken(user);

    res.json({
      token,
      user: {
        id: user.id,
        hederaAccountId: user.hederaAccountId,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const adminWalletLogin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { accountId, signature } = req.body as {
      accountId?: string;
      signature?: string;
    };

    if (!accountId || !signature) {
      throw new ApiError(400, "accountId and signature are required");
    }

    const user = await prisma.user.findFirst({
      where: {
        OR: [{ hederaAccountId: accountId }, { walletAddress: accountId }],
      },
    });

    if (!user) {
      throw new ApiError(403, "Admin account not found");
    }

    assertAdminRole(user.role);

    const token = signAuthToken(user);

    res.json({
      token,
      user: {
        id: user.id,
        hederaAccountId: user.hederaAccountId,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    next(error);
  }
};
