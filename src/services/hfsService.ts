import hederaClient from "../config/hedera";
import {
  FileCreateTransaction,
  FileId,
  Status,
  TransactionId,
} from "@hashgraph/sdk";

const createFreshTransactionId = () => {
  if (!hederaClient.operatorAccountId) {
    throw new Error("Hedera operator account is not configured");
  }

  return TransactionId.generate(hederaClient.operatorAccountId);
};

const createFile = async (contents: Uint8Array): Promise<string> => {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await new FileCreateTransaction()
        .setTransactionId(createFreshTransactionId())
        .setContents(contents)
        .execute(hederaClient);

      const receipt = await response.getReceipt(hederaClient);
      const fileId = receipt.fileId ?? FileId.fromString("0.0.0");
      return fileId.toString();
    } catch (error) {
      const isDuplicateTransaction =
        typeof error === "object" &&
        error !== null &&
        "status" in error &&
        (error as { status?: Status }).status?._code ===
          Status.DuplicateTransaction._code;

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
export const uploadMetadata = async (
  payload: Record<string, unknown>,
): Promise<string> => {
  const contents = Buffer.from(JSON.stringify(payload));
  return createFile(contents);
};

/**
 * Upload a raw buffer (e.g. business plan PDF, proof-of-business doc) to HFS.
 */
export const uploadDocument = async (buffer: Buffer): Promise<string> => {
  return createFile(buffer);
};
