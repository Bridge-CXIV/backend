"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startMirrorNodeIndexer = void 0;
const db_1 = __importDefault(require("../config/db"));
const mirrorNodeService_1 = require("../services/mirrorNodeService");
const cacheService_1 = require("../services/cacheService");
const pollInterval = Number(process.env.MIRROR_POLL_INTERVAL ?? 60000);
const persistTopicMessages = async (topicId, requestId) => {
    try {
        const data = await (0, mirrorNodeService_1.fetchMessagesForTopic)(topicId);
        const messages = data?.messages ?? [];
        const cacheKey = `mirror:lastSequence:${topicId}`;
        const cachedSequence = await (0, cacheService_1.getCachedValue)(cacheKey);
        const lastSequence = cachedSequence ? BigInt(cachedSequence) : 0n;
        for (const message of messages) {
            const sequenceNumber = BigInt(message.sequence_number ?? 0);
            if (sequenceNumber <= lastSequence) {
                continue;
            }
            const timestampMs = Math.floor(Number(message.consensus_timestamp ?? Date.now() / 1000) * 1000);
            // Mirror Node returns message bodies as base64
            let decodedBody = message.message ?? "";
            try {
                decodedBody = Buffer.from(decodedBody, "base64").toString("utf-8");
            }
            catch {
                // If decoding fails, store as-is
            }
            await db_1.default.hcsMessage.upsert({
                where: {
                    topicId_sequenceNumber: {
                        topicId,
                        sequenceNumber,
                    },
                },
                create: {
                    topicId,
                    sequenceNumber,
                    body: decodedBody,
                    loggedAt: new Date(timestampMs),
                    requestId,
                },
                update: {
                    body: decodedBody,
                    loggedAt: new Date(timestampMs),
                },
            });
            await (0, cacheService_1.setCachedValue)(cacheKey, sequenceNumber.toString(), 0);
        }
    }
    catch (error) {
        console.warn(`mirror poll failed for topic ${topicId}`, error);
    }
};
const run = async () => {
    const topics = await db_1.default.request.findMany({
        where: {
            hcsTopicId: { not: null },
            status: "LIVE",
        },
        select: {
            id: true,
            hcsTopicId: true,
        },
    });
    await Promise.all(topics.map(({ id, hcsTopicId }) => {
        if (!hcsTopicId) {
            return Promise.resolve();
        }
        return persistTopicMessages(hcsTopicId, id);
    }));
};
const startMirrorNodeIndexer = () => {
    run().catch((error) => {
        console.error("Mirror init failed", error);
    });
    setInterval(() => {
        run().catch((error) => {
            console.error("Mirror poll failed", error);
        });
    }, pollInterval);
};
exports.startMirrorNodeIndexer = startMirrorNodeIndexer;
