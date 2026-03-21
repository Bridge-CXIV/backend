import hederaClient from "../config/hedera";
import { TopicCreateTransaction, TopicId, TopicMessageSubmitTransaction } from "@hashgraph/sdk";

export const createTopic = async (memo: string): Promise<string> => {
  const response = await new TopicCreateTransaction().setTopicMemo(memo).execute(hederaClient);
  const receipt = await response.getReceipt(hederaClient);
  const topicId = receipt.topicId ?? TopicId.fromString("0.0.0");
  return topicId.toString();
};

export const submitMessage = async (topicId: string, message: string) => {
  await new TopicMessageSubmitTransaction()
    .setTopicId(TopicId.fromString(topicId))
    .setMessage(message)
    .execute(hederaClient);
};
