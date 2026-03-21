"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.transferNft = exports.mintDonationReceipt = void 0;
const hedera_1 = __importDefault(require("../config/hedera"));
const sdk_1 = require("@hashgraph/sdk");
const mintDonationReceipt = async (tokenId, metadata) => {
    const response = await new sdk_1.TokenMintTransaction()
        .setTokenId(sdk_1.TokenId.fromString(tokenId))
        .setMetadata([metadata])
        .execute(hedera_1.default);
    const receipt = await response.getReceipt(hedera_1.default);
    const serial = receipt.serials?.at(-1) ?? 0n;
    return serial.toString();
};
exports.mintDonationReceipt = mintDonationReceipt;
/**
 * Transfers an NFT from the treasury (operator) to a receiver.
 * Note: Receiver must be associated with the token.
 */
const transferNft = async (tokenId, serialNumber, receiverId) => {
    const operatorId = process.env.HEDERA_OPERATOR_ID;
    const response = await new sdk_1.TransferTransaction()
        .addNftTransfer(sdk_1.TokenId.fromString(tokenId), Number(serialNumber), sdk_1.AccountId.fromString(operatorId), sdk_1.AccountId.fromString(receiverId))
        .execute(hedera_1.default);
    await response.getReceipt(hedera_1.default);
};
exports.transferNft = transferNft;
