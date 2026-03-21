import {
  Client,
  AccountId,
  PrivateKey,
  ContractExecuteTransaction,
  ContractCallQuery,
  ContractFunctionParameters,
  TransactionReceipt,
  ContractId,
  ReceiptStatusError,
  Status,
  TransactionRecord,
} from "@hashgraph/sdk";
import dotenv from "dotenv";

dotenv.config();

const parseFactoryContractId = (value: string): ContractId => {
  if (value.startsWith("0x")) {
    return ContractId.fromEvmAddress(0, 0, value);
  }

  return ContractId.fromString(value);
};

export const isFactoryOwnerRevert = (error: unknown): boolean =>
  error instanceof Error &&
  error.message.includes("Not the owner");

export class ContractRevertError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ContractRevertError";
  }
}

const getRevertMessage = (record: TransactionRecord | null): string | null => {
  const errorMessage = record?.contractFunctionResult?.errorMessage?.trim();
  return errorMessage ? errorMessage : null;
};

class ContractService {
  private client: Client;

  constructor() {
    const operatorId = process.env.HEDERA_OPERATOR_ID;
    const operatorKey = process.env.HEDERA_OPERATOR_KEY;

    if (!operatorId || !operatorKey) {
      throw new Error("HEDERA_OPERATOR_ID and HEDERA_OPERATOR_KEY must be set");
    }

    this.client = Client.forTestnet();
    this.client.setOperator(
      AccountId.fromString(operatorId),
      PrivateKey.fromString(operatorKey)
    );
  }

  /**
   * Deploys a new campaign contract via the Factory
   * @param requesterEvmAddress The EVM address of the charity/grant seeker
   * @param deadline Unix timestamp
   * @param campaignType 0 for CHARITY, 1 for GRANT
   * @returns The EVM address of the deployed campaign
   */
  async createCampaign(
    requesterEvmAddress: string,
    deadline: number,
    campaignType: number
  ): Promise<string> {
    const factoryId = process.env.FACTORY_CONTRACT_ID;
    if (!factoryId) {
      throw new Error("FACTORY_CONTRACT_ID must be set");
    }
    const contractId = parseFactoryContractId(factoryId);

    const transaction = new ContractExecuteTransaction()
      .setContractId(contractId)
      .setGas(4_000_000)
      .setFunction(
        "createCampaign",
        new ContractFunctionParameters()
          .addAddress(requesterEvmAddress)
          .addUint256(deadline)
          .addUint8(campaignType)
      );

    const response = await transaction.execute(this.client);
    let record: TransactionRecord | null = null;

    try {
      await response.getReceipt(this.client);
    } catch (error) {
      if (
        error instanceof ReceiptStatusError &&
        error.status.toString() === Status.ContractRevertExecuted.toString()
      ) {
        try {
          record = await response.getRecord(this.client);
        } catch {
          record = null;
        }

        throw new ContractRevertError(
          getRevertMessage(record) ?? "Factory contract reverted during campaign deployment",
        );
      }

      throw error;
    }

    // In Hedera, the address of the newly created contract is usually in the record's contract call result
    // Or we can parse the logs if we have the ABI.
    // Simplifying: The factory emits CampaignCreated(campaign, requester, type, deadline, timestamp)
    
    // For now, we'll return a placeholder or implement log parsing if needed.
    // To get the deployed address reliably, we should fetch the transaction record.
    record = record ?? await response.getRecord(this.client);
    const result = record.contractFunctionResult;
    
    if (!result) {
      throw new Error("No contract function result found");
    }

    // The return value of createCampaign is the address of the new campaign
    const campaignEvmAddress = result.getAddress(0);
    return `0x${campaignEvmAddress}`;
  }

  /**
   * Queries the total raised amount for a campaign
   * @param campaignContractId The Contract ID or EVM address of the campaign
   */
  async getTotalRaised(campaignContractId: string): Promise<bigint> {
    const query = new ContractCallQuery()
      .setContractId(ContractId.fromString(campaignContractId))
      .setGas(100000)
      .setFunction("totalRaised");

    const result = await query.execute(this.client);
    return BigInt(result.getUint256(0).toString());
  }

  /**
   * Queries if the funds have been released
   */
  async isReleased(campaignContractId: string): Promise<boolean> {
    const query = new ContractCallQuery()
      .setContractId(ContractId.fromString(campaignContractId))
      .setGas(100000)
      .setFunction("released");

    const result = await query.execute(this.client);
    return result.getBool(0);
  }

  /**
   * Adds a new admin to the Factory contract
   */
  async addAdmin(adminEvmAddress: string): Promise<TransactionReceipt> {
    const factoryId = process.env.FACTORY_CONTRACT_ID;
    if (!factoryId) throw new Error("FACTORY_CONTRACT_ID missing");
    const contractId = parseFactoryContractId(factoryId);

    const transaction = new ContractExecuteTransaction()
      .setContractId(contractId)
      .setGas(200000)
      .setFunction(
        "addAdmin",
        new ContractFunctionParameters().addAddress(adminEvmAddress)
      );

    const response = await transaction.execute(this.client);

    try {
      return await response.getReceipt(this.client);
    } catch (error) {
      if (
        error instanceof ReceiptStatusError &&
        error.status.toString() === Status.ContractRevertExecuted.toString()
      ) {
        let record: TransactionRecord | null = null;
        try {
          record = await response.getRecord(this.client);
        } catch {
          record = null;
        }

        throw new ContractRevertError(
          getRevertMessage(record) ?? "Factory contract reverted while adding admin",
        );
      }

      throw error;
    }
  }

  /**
   * Removes an admin from the Factory contract
   */
  async removeAdmin(adminEvmAddress: string): Promise<TransactionReceipt> {
    const factoryId = process.env.FACTORY_CONTRACT_ID;
    if (!factoryId) throw new Error("FACTORY_CONTRACT_ID missing");
    const contractId = parseFactoryContractId(factoryId);

    const transaction = new ContractExecuteTransaction()
      .setContractId(contractId)
      .setGas(200000)
      .setFunction(
        "removeAdmin",
        new ContractFunctionParameters().addAddress(adminEvmAddress)
      );

    const response = await transaction.execute(this.client);

    try {
      return await response.getReceipt(this.client);
    } catch (error) {
      if (
        error instanceof ReceiptStatusError &&
        error.status.toString() === Status.ContractRevertExecuted.toString()
      ) {
        let record: TransactionRecord | null = null;
        try {
          record = await response.getRecord(this.client);
        } catch {
          record = null;
        }

        throw new ContractRevertError(
          getRevertMessage(record) ?? "Factory contract reverted while removing admin",
        );
      }

      throw error;
    }
  }

  /**
   * Checks if an address is an admin on the Factory contract
   */
  async getIsAdmin(adminEvmAddress: string): Promise<boolean> {
    const factoryId = process.env.FACTORY_CONTRACT_ID;
    if (!factoryId) throw new Error("FACTORY_CONTRACT_ID missing");
    const contractId = parseFactoryContractId(factoryId);

    const query = new ContractCallQuery()
      .setContractId(contractId)
      .setGas(100000)
      .setFunction(
        "isAdmin",
        new ContractFunctionParameters().addAddress(adminEvmAddress)
      );

    const result = await query.execute(this.client);
    return result.getBool(0);
  }
}

export const contractService = new ContractService();
