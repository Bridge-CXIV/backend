"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadDocument = exports.uploadMetadata = void 0;
const hedera_1 = __importDefault(require("../config/hedera"));
const sdk_1 = require("@hashgraph/sdk");
const createFreshTransactionId = () => {
    if (!hedera_1.default.operatorAccountId) {
        throw new Error("Hedera operator account is not configured");
    }
    return sdk_1.TransactionId.generate(hedera_1.default.operatorAccountId);
};
const createFile = async (contents) => {
    for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
            const response = await new sdk_1.FileCreateTransaction()
                .setTransactionId(createFreshTransactionId())
                .setContents(contents)
                .execute(hedera_1.default);
            const receipt = await response.getReceipt(hedera_1.default);
            const fileId = receipt.fileId ?? sdk_1.FileId.fromString("0.0.0");
            return fileId.toString();
        }
        catch (error) {
            const isDuplicateTransaction = typeof error === "object" &&
                error !== null &&
                "status" in error &&
                error.status?._code ===
                    sdk_1.Status.DuplicateTransaction._code;
            if (!isDuplicateTransaction || attempt === 1) {
                throw error;
            }
        }
    }
    throw new Error("File upload failed");
};
/**
 * Upload a JSON metadata object to Hedera File Service.
 */
const uploadMetadata = async (payload) => {
    const contents = Buffer.from(JSON.stringify(payload));
    return createFile(contents);
};
exports.uploadMetadata = uploadMetadata;
/**
 * Upload a raw buffer (e.g. business plan PDF, proof-of-business doc) to HFS.
 */
const uploadDocument = async (buffer) => {
    return createFile(buffer);
};
exports.uploadDocument = uploadDocument;
