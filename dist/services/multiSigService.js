"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkThresholdAndActivate = exports.countSignatures = exports.recordSignature = void 0;
const db_1 = __importDefault(require("../config/db"));
const hcsService_1 = require("./hcsService");
const contractService_1 = require("./contractService");
const threshold = Number(process.env.ADMIN_SIG_THRESHOLD ?? 2);
const isEvmAddress = (value) => typeof value === "string" && /^0x[a-fA-F0-9]{40}$/.test(value);
const recordSignature = async (adminId, requestId, signature) => {
    return db_1.default.adminSignature.create({
        data: {
            adminId,
            requestId,
            signature,
        },
    });
};
exports.recordSignature = recordSignature;
const countSignatures = async (requestId) => {
    return db_1.default.adminSignature.count({
        where: { requestId },
    });
};
exports.countSignatures = countSignatures;
/**
 * After a new signature is recorded, check whether the threshold
 * has been met. If so, create a dedicated HCS topic for the request,
 * log the verification event, and set the request status to LIVE.
 *
 * Returns `true` if the request was activated.
 */
const checkThresholdAndActivate = async (requestId) => {
    const sigCount = await (0, exports.countSignatures)(requestId);
    if (sigCount < threshold) {
        return false;
    }
    const request = await db_1.default.request.findUnique({
        where: { id: requestId },
    });
    if (!request || request.status !== "PENDING_VERIFICATION") {
        return false;
    }
    // 1. Deploy the campaign contract
    const campaignType = request.type === "CHARITY" ? 0 : 1;
    const deadline = Math.floor(request.timelineEnd.getTime() / 1000);
    if (!isEvmAddress(request.walletAddress)) {
        throw new Error("Request creator does not have a valid EVM wallet address. Reconnect the creator wallet or recreate the request with a 0x address.");
    }
    // contractService.createCampaign returns the EVM address
    const contractAddress = await contractService_1.contractService.createCampaign(request.walletAddress, deadline, campaignType);
    // 2. Create a dedicated HCS topic for this request
    const topicId = await (0, hcsService_1.createTopic)(`GlassGive | ${request.type} | ${request.title}`);
    // 3. Log the verification event as the first message on the topic
    const verificationMessage = JSON.stringify({
        event: "VERIFICATION_COMPLETE",
        requestId: request.id,
        title: request.title,
        type: request.type,
        contractAddress,
        signatures: sigCount,
        threshold,
        timestamp: new Date().toISOString(),
    });
    await (0, hcsService_1.submitMessage)(topicId, verificationMessage);
    // 4. Activate the request in DB
    await db_1.default.request.update({
        where: { id: requestId },
        data: {
            status: "LIVE",
            hcsTopicId: topicId,
            contractAddress,
        },
    });
    return true;
};
exports.checkThresholdAndActivate = checkThresholdAndActivate;
