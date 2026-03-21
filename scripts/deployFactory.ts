import "dotenv/config";
import fs from "fs";
import path from "path";
import {
  AccountId,
  Client,
  ContractCreateFlow,
  ContractFunctionParameters,
  PrivateKey,
  TokenId,
} from "@hashgraph/sdk";

type FactoryArtifact = {
  bytecode?: {
    object?: string;
  };
};

const treasuryAddress = process.argv[2]?.trim();

if (!treasuryAddress) {
  console.error("Usage: npm run deploy:factory -- <treasury-evm-address>");
  process.exit(1);
}

if (!treasuryAddress.startsWith("0x")) {
  console.error("Treasury address must be an EVM address starting with 0x");
  process.exit(1);
}

const operatorId = process.env.HEDERA_OPERATOR_ID;
const operatorKey = process.env.HEDERA_OPERATOR_KEY;
const nftTokenIdRaw = process.env.NFT_TOKEN_ID;

if (!operatorId || !operatorKey) {
  console.error("HEDERA_OPERATOR_ID and HEDERA_OPERATOR_KEY must be set");
  process.exit(1);
}

if (!nftTokenIdRaw) {
  console.error("NFT_TOKEN_ID must be set");
  process.exit(1);
}

const artifactPath = path.resolve(
  __dirname,
  "../../contract/out/GlassGiveFactory.sol/GlassGiveFactory.json",
);

const artifact = JSON.parse(
  fs.readFileSync(artifactPath, "utf8"),
) as FactoryArtifact;

const bytecode = artifact.bytecode?.object;

if (!bytecode) {
  console.error(`Factory bytecode not found in ${artifactPath}`);
  process.exit(1);
}

const factoryBytecode = bytecode;

const nftTokenAddress = nftTokenIdRaw.startsWith("0x")
  ? nftTokenIdRaw
  : `0x${TokenId.fromString(nftTokenIdRaw).toSolidityAddress()}`;

const client = Client.forTestnet();
client.setOperator(
  AccountId.fromString(operatorId),
  PrivateKey.fromString(operatorKey),
);

async function main() {
  const transaction = new ContractCreateFlow()
    .setGas(4_000_000)
    .setBytecode(factoryBytecode)
    .setConstructorParameters(
      new ContractFunctionParameters()
        .addAddress(treasuryAddress)
        .addAddress(nftTokenAddress),
    );

  const response = await transaction.execute(client);
  const receipt = await response.getReceipt(client);
  const record = await response.getRecord(client);
  const contractId = receipt.contractId;

  if (!contractId) {
    throw new Error("Factory deployment did not return a contract ID");
  }

  const contractEvmAddress = `0x${contractId.toSolidityAddress()}`;
  const transactionHash =
    typeof record.transactionHash === "string"
      ? record.transactionHash
      : Buffer.from(record.transactionHash).toString("hex");

  console.log("-----------------------------------------");
  console.log("Factory deployed successfully");
  console.log("Contract ID (Hedera):", contractId.toString());
  console.log("Contract EVM Address:", contractEvmAddress);
  console.log("Deployment Tx Hash:", transactionHash.startsWith("0x") ? transactionHash : `0x${transactionHash}`);
  console.log("-----------------------------------------");
  console.log("Update backend/.env:");
  console.log(`FACTORY_CONTRACT_ID=\"${contractEvmAddress}\"`);
  console.log("-----------------------------------------");
}

main()
  .catch((error) => {
    console.error("Failed to deploy factory:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    client.close();
  });
