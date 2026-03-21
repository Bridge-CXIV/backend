import hederaClient from "../config/hedera";
import { 
  TokenId, 
  TokenMintTransaction, 
  TransferTransaction, 
  AccountId 
} from "@hashgraph/sdk";

export const mintDonationReceipt = async (tokenId: string, metadata: Buffer): Promise<string> => {
  const response = await new TokenMintTransaction()
    .setTokenId(TokenId.fromString(tokenId))
    .setMetadata([metadata])
    .execute(hederaClient);

  const receipt = await response.getReceipt(hederaClient);
  const serial = receipt.serials?.at(-1) ?? 0n;
  return serial.toString();
};

/**
 * Transfers an NFT from the treasury (operator) to a receiver.
 * Note: Receiver must be associated with the token.
 */
export const transferNft = async (
  tokenId: string,
  serialNumber: number,
  receiverId: string,
) => {
  const operatorId = process.env.HEDERA_OPERATOR_ID!;
  
  const response = await new TransferTransaction()
    .addNftTransfer(
      TokenId.fromString(tokenId),
      Number(serialNumber),
      AccountId.fromString(operatorId),
      AccountId.fromString(receiverId),
    )
    .execute(hederaClient);

  await response.getReceipt(hederaClient);
};
