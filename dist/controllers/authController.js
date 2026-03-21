"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.walletLogin = exports.magicLogin = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const db_1 = __importDefault(require("../config/db"));
const magicService_1 = require("../services/magicService");
const accountService_1 = require("../services/accountService");
const apiError_1 = require("../middleware/apiError");
const jwtSecret = process.env.JWT_SECRET ?? "changeme";
/**
 * POST /api/auth/magic
 *
 * Accepts a Magic DID token in the Authorization header, verifies it,
 * upserts the user, creates a Hedera account if it's a new user,
 * and returns a signed JWT.
 */
const magicLogin = async (req, res, next) => {
    try {
        const { didToken: bodyToken } = req.body;
        const headerToken = req.headers.authorization?.replace("Bearer ", "");
        const didToken = bodyToken || headerToken;
        if (!didToken) {
            throw new apiError_1.ApiError(400, "DID token is required (either in body as 'didToken' or in Authorization header)");
        }
        // Validate the token (throws if invalid)
        await (0, magicService_1.verifyDidToken)(didToken);
        // Extract user info from the token
        const issuer = await (0, magicService_1.getIssuer)(didToken);
        const metadata = await (0, magicService_1.getUserMetadata)(issuer);
        const email = metadata.email ?? undefined;
        // Upsert the user
        let user = await db_1.default.user.findUnique({
            where: { magicUserId: issuer },
        });
        if (!user) {
            // First-time user: create a Hedera account for them
            const publicKey = metadata.publicAddress ?? undefined;
            const hederaAccountId = await (0, accountService_1.createHederaAccount)({ publicKey });
            user = await db_1.default.user.create({
                data: {
                    magicUserId: issuer,
                    hederaAccountId,
                    walletAddress: metadata.publicAddress ?? undefined,
                    email,
                    role: "USER",
                },
            });
        }
        else {
            // Update email if it changed
            if (email && email !== user.email) {
                user = await db_1.default.user.update({
                    where: { id: user.id },
                    data: { email },
                });
            }
        }
        // Sign a JWT
        const token = jsonwebtoken_1.default.sign({
            userId: user.id,
            role: user.role,
            magicUserId: user.magicUserId,
            hederaAccountId: user.hederaAccountId,
            email: user.email,
        }, jwtSecret, { expiresIn: "7d" });
        res.json({
            token,
            user: {
                id: user.id,
                hederaAccountId: user.hederaAccountId,
                email: user.email,
                role: user.role,
            },
        });
    }
    catch (error) {
        next(error);
    }
};
exports.magicLogin = magicLogin;
/**
 * POST /api/auth/wallet
 *
 * Accepts a Hedera account ID and a signed message for wallet-based login.
 * Upserts the user and returns a signed JWT.
 *
 * Body: { accountId: string, signature: string, message: string }
 */
const walletLogin = async (req, res, next) => {
    try {
        const { accountId, signature } = req.body;
        if (!accountId || !signature) {
            throw new apiError_1.ApiError(400, "accountId and signature are required");
        }
        // In a production implementation, we would verify the signature
        // against the account's public key via the Mirror Node.
        // For the testnet/hackathon phase, we trust the signed request.
        // Upsert user by wallet / Hedera account
        let user = await db_1.default.user.findFirst({
            where: {
                OR: [
                    { hederaAccountId: accountId },
                    { walletAddress: accountId },
                ],
            },
        });
        if (!user) {
            user = await db_1.default.user.create({
                data: {
                    hederaAccountId: accountId,
                    walletAddress: accountId,
                    role: "USER",
                },
            });
        }
        const token = jsonwebtoken_1.default.sign({
            userId: user.id,
            role: user.role,
            hederaAccountId: user.hederaAccountId,
        }, jwtSecret, { expiresIn: "7d" });
        res.json({
            token,
            user: {
                id: user.id,
                hederaAccountId: user.hederaAccountId,
                role: user.role,
            },
        });
    }
    catch (error) {
        next(error);
    }
};
exports.walletLogin = walletLogin;
