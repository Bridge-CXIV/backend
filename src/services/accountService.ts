import hederaClient from "../config/hedera";
import { AccountCreateTransaction, Hbar, PublicKey } from "@hashgraph/sdk";

/**
 * Creates a new Hedera account.
 * If a publicKey is provided (e.g. from Magic.link), it is assigned to the account.
 * Otherwise the operator key is used as the account key.
 */
export const createHederaAccount = async (
  options: { publicKey?: string; initialBalance?: number } = {},
): Promise<string> => {
  const { publicKey, initialBalance = 0.1 } = options;

  const tx = new AccountCreateTransaction().setInitialBalance(
    new Hbar(initialBalance),
  );

  if (publicKey) {
    tx.setKey(PublicKey.fromString(publicKey));
  } else {
    tx.setKey(hederaClient.operatorPublicKey!);
  }

  const response = await tx.execute(hederaClient);
  const receipt = await response.getReceipt(hederaClient);
  return receipt.accountId?.toString() ?? "";
};
