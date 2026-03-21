import axios from "axios";

const mirrorNodeUrl =
  process.env.MIRROR_NODE_URL ?? "https://testnet.mirrornode.hedera.com";

export const fetchMessagesForTopic = async (topicId: string) => {
  const { data } = await axios.get(
    `${mirrorNodeUrl}/api/v1/topics/${topicId}/messages`,
  );
  return data;
};

export const fetchTokenNfts = async (tokenId: string) => {
  const { data } = await axios.get(
    `${mirrorNodeUrl}/api/v1/tokens/${tokenId}/nfts`,
  );
  return data;
};

export const fetchContractResults = async (contractId: string) => {
  const { data } = await axios.get(
    `${mirrorNodeUrl}/api/v1/contracts/${contractId}/results`,
  );
  return data;
};

export const fetchTransactionRecord = async (transactionId: string) => {
  const { data } = await axios.get(
    `${mirrorNodeUrl}/api/v1/transactions/${transactionId}`,
  );
  return data;
};

export const fetchContractLogs = async (contractId: string, timestamp?: string) => {
  let url = `${mirrorNodeUrl}/api/v1/contracts/${contractId}/results/logs?order=asc`;
  if (timestamp) {
    url += `&timestamp=gt:${timestamp}`;
  }
  const { data } = await axios.get(url);
  return data;
};
