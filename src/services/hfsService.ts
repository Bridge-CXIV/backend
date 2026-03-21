import hederaClient from "../config/hedera";
import { FileCreateTransaction, FileId } from "@hashgraph/sdk";

/**
 * Upload a JSON metadata object to Hedera File Service.
 */
export const uploadMetadata = async (
  payload: Record<string, unknown>,
): Promise<string> => {
  const contents = Buffer.from(JSON.stringify(payload));
  const response = await new FileCreateTransaction()
    .setContents(contents)
    .execute(hederaClient);

  const receipt = await response.getReceipt(hederaClient);
  const fileId = receipt.fileId ?? FileId.fromString("0.0.0");
  return fileId.toString();
};

/**
 * Upload a raw buffer (e.g. business plan PDF, proof-of-business doc) to HFS.
 */
export const uploadDocument = async (buffer: Buffer): Promise<string> => {
  const response = await new FileCreateTransaction()
    .setContents(buffer)
    .execute(hederaClient);

  const receipt = await response.getReceipt(hederaClient);
  const fileId = receipt.fileId ?? FileId.fromString("0.0.0");
  return fileId.toString();
};
