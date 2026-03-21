"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchContractLogs = exports.fetchTransactionRecord = exports.fetchContractResults = exports.fetchTokenNfts = exports.fetchMessagesForTopic = void 0;
const axios_1 = __importDefault(require("axios"));
const mirrorNodeUrl = process.env.MIRROR_NODE_URL ?? "https://testnet.mirrornode.hedera.com";
const fetchMessagesForTopic = async (topicId) => {
    const { data } = await axios_1.default.get(`${mirrorNodeUrl}/api/v1/topics/${topicId}/messages`);
    return data;
};
exports.fetchMessagesForTopic = fetchMessagesForTopic;
const fetchTokenNfts = async (tokenId) => {
    const { data } = await axios_1.default.get(`${mirrorNodeUrl}/api/v1/tokens/${tokenId}/nfts`);
    return data;
};
exports.fetchTokenNfts = fetchTokenNfts;
const fetchContractResults = async (contractId) => {
    const { data } = await axios_1.default.get(`${mirrorNodeUrl}/api/v1/contracts/${contractId}/results`);
    return data;
};
exports.fetchContractResults = fetchContractResults;
const fetchTransactionRecord = async (transactionId) => {
    const { data } = await axios_1.default.get(`${mirrorNodeUrl}/api/v1/transactions/${transactionId}`);
    return data;
};
exports.fetchTransactionRecord = fetchTransactionRecord;
const fetchContractLogs = async (contractId, timestamp) => {
    let url = `${mirrorNodeUrl}/api/v1/contracts/${contractId}/results/logs?order=asc`;
    if (timestamp) {
        url += `&timestamp=gt:${timestamp}`;
    }
    const { data } = await axios_1.default.get(url);
    return data;
};
exports.fetchContractLogs = fetchContractLogs;
