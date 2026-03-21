import { Client } from "@hashgraph/sdk";

const operatorId = process.env.HEDERA_OPERATOR_ID;
const operatorKey = process.env.HEDERA_OPERATOR_KEY;

if (!operatorId || !operatorKey) {
  throw new Error("HEDERA_OPERATOR_ID and HEDERA_OPERATOR_KEY must be set");
}

const hederaClient = Client.forTestnet();
hederaClient.setOperator(operatorId, operatorKey);

export default hederaClient;
