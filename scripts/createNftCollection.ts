import { Client, TokenCreateTransaction, TokenType, TokenSupplyType } from "@hashgraph/sdk";
import "dotenv/config";

const main = async () => {
  const client = Client.forTestnet();
  client.setOperator(
    process.env.HEDERA_OPERATOR_ID!,
    process.env.HEDERA_OPERATOR_KEY!,
  );

  const tx = await new TokenCreateTransaction()
    .setTokenName("GlassGive Donation Receipt")
    .setTokenSymbol("GGDR")
    .setTokenType(TokenType.NonFungibleUnique)
    .setSupplyType(TokenSupplyType.Infinite)
    .setTreasuryAccountId(process.env.HEDERA_OPERATOR_ID!)
    .setSupplyKey(client.operatorPublicKey!)
    .execute(client);

  const receipt = await tx.getReceipt(client);
  const tokenId = receipt.tokenId!;
  const evmAddress = `0x${tokenId.toSolidityAddress()}`;
  
  console.log("-----------------------------------------");
  console.log("NFT Token ID (Hedera):", tokenId.toString());
  console.log("NFT Token ID (EVM Address):", evmAddress);
  console.log("-----------------------------------------");
  console.log("Next: Update NFT_TOKEN_ID in backend/.env");
};

main();
