"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadDocument = exports.uploadMetadata = void 0;
const hedera_1 = __importDefault(require("../config/hedera"));
const sdk_1 = require("@hashgraph/sdk");
/**
 * Upload a JSON metadata object to Hedera File Service.
 */
const uploadMetadata = async (payload) => {
    const contents = Buffer.from(JSON.stringify(payload));
    const response = await new sdk_1.FileCreateTransaction()
        .setContents(contents)
        .execute(hedera_1.default);
    const receipt = await response.getReceipt(hedera_1.default);
    const fileId = receipt.fileId ?? sdk_1.FileId.fromString("0.0.0");
    return fileId.toString();
};
exports.uploadMetadata = uploadMetadata;
/**
 * Upload a raw buffer (e.g. business plan PDF, proof-of-business doc) to HFS.
 */
const uploadDocument = async (buffer) => {
    const response = await new sdk_1.FileCreateTransaction()
        .setContents(buffer)
        .execute(hedera_1.default);
    const receipt = await response.getReceipt(hedera_1.default);
    const fileId = receipt.fileId ?? sdk_1.FileId.fromString("0.0.0");
    return fileId.toString();
};
exports.uploadDocument = uploadDocument;
