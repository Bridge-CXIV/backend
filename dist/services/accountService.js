"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createHederaAccount = void 0;
const hedera_1 = __importDefault(require("../config/hedera"));
const sdk_1 = require("@hashgraph/sdk");
/**
 * Creates a new Hedera account.
 * If a publicKey is provided (e.g. from Magic.link), it is assigned to the account.
 * Otherwise the operator key is used as the account key.
 */
const createHederaAccount = async (options = {}) => {
    const { publicKey, initialBalance = 0.1 } = options;
    const tx = new sdk_1.AccountCreateTransaction().setInitialBalance(new sdk_1.Hbar(initialBalance));
    if (publicKey) {
        tx.setKey(sdk_1.PublicKey.fromString(publicKey));
    }
    else {
        tx.setKey(hedera_1.default.operatorPublicKey);
    }
    const response = await tx.execute(hedera_1.default);
    const receipt = await response.getReceipt(hedera_1.default);
    return receipt.accountId?.toString() ?? "";
};
exports.createHederaAccount = createHederaAccount;
