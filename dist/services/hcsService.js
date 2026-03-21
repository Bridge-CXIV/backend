"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.submitMessage = exports.createTopic = void 0;
const hedera_1 = __importDefault(require("../config/hedera"));
const sdk_1 = require("@hashgraph/sdk");
const createTopic = async (memo) => {
    const response = await new sdk_1.TopicCreateTransaction().setTopicMemo(memo).execute(hedera_1.default);
    const receipt = await response.getReceipt(hedera_1.default);
    const topicId = receipt.topicId ?? sdk_1.TopicId.fromString("0.0.0");
    return topicId.toString();
};
exports.createTopic = createTopic;
const submitMessage = async (topicId, message) => {
    await new sdk_1.TopicMessageSubmitTransaction()
        .setTopicId(sdk_1.TopicId.fromString(topicId))
        .setMessage(message)
        .execute(hedera_1.default);
};
exports.submitMessage = submitMessage;
