"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startContractLogIndexer = void 0;
const db_1 = __importDefault(require("../config/db"));
const mirrorNodeService_1 = require("../services/mirrorNodeService");
const cacheService_1 = require("../services/cacheService");
const ethers_1 = require("ethers");
const pollInterval = Number(process.env.MIRROR_POLL_INTERVAL ?? 60000);
// Event signature hash for DonationReceieved(address,uint256,uint256)
const DONATION_EVENT_TOPIC = ethers_1.ethers.id("DonationReceieved(address,uint256,uint256)");
const processContractLogs = async (contractAddress, requestId) => {
    try {
        const cacheKey = `mirror:lastLogTimestamp:${contractAddress}`;
        const lastTimestamp = await (0, cacheService_1.getCachedValue)(cacheKey);
        const data = await (0, mirrorNodeService_1.fetchContractLogs)(contractAddress, lastTimestamp || undefined);
        const logs = data?.logs ?? [];
        for (const log of logs) {
            if (log.topics[0] !== DONATION_EVENT_TOPIC)
                continue;
            const timestamp = log.consensus_timestamp;
            // Decode data: amount (uint256), timestamp (uint256)
            // log.data is a hex string
            // log.topics[1] is indexed donor address (32 bytes hex)
            const donorEvmAddress = `0x${log.topics[1].slice(26)}`; // Extract 20 bytes from address topic
            const decodedData = ethers_1.ethers.AbiCoder.defaultAbiCoder().decode(["uint256", "uint256"], log.data);
            const amount = decodedData[0]; // BigInt
            const amountDecimal = Number(amount) / 1e18; // Assuming 18 decimals for HBAR/Token
            // Find user by walletAddress
            const user = await db_1.default.user.findFirst({
                where: { walletAddress: { equals: donorEvmAddress, mode: 'insensitive' } }
            });
            // Update Database
            await db_1.default.$transaction(async (tx) => {
                // 1. Create Donation Record
                await tx.donation.create({
                    data: {
                        amount: amountDecimal,
                        transactionHash: log.transaction_hash,
                        requestId: requestId,
                        donorId: user?.id || null,
                        memo: `On-chain donation from ${donorEvmAddress}`,
                    }
                });
                // 2. Update Request currentAmount
                await tx.request.update({
                    where: { id: requestId },
                    data: {
                        currentAmount: {
                            increment: amountDecimal
                        }
                    }
                });
            });
            await (0, cacheService_1.setCachedValue)(cacheKey, timestamp, 0);
        }
    }
    catch (error) {
        console.warn(`Mirror contract log poll failed for ${contractAddress}`, error);
    }
};
const run = async () => {
    const campaigns = await db_1.default.request.findMany({
        where: {
            contractAddress: { not: null },
            status: "LIVE",
        },
        select: {
            id: true,
            contractAddress: true,
        },
    });
    await Promise.all(campaigns.map(({ id, contractAddress }) => {
        if (!contractAddress)
            return Promise.resolve();
        return processContractLogs(contractAddress, id);
    }));
};
const startContractLogIndexer = () => {
    run().catch((error) => {
        console.error("Contract log init failed", error);
    });
    setInterval(() => {
        run().catch((error) => {
            console.error("Contract log poll failed", error);
        });
    }, pollInterval);
};
exports.startContractLogIndexer = startContractLogIndexer;
