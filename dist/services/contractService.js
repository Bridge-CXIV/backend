"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.contractService = void 0;
const sdk_1 = require("@hashgraph/sdk");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
class ContractService {
    constructor() {
        const operatorId = process.env.HEDERA_OPERATOR_ID;
        const operatorKey = process.env.HEDERA_OPERATOR_KEY;
        if (!operatorId || !operatorKey) {
            throw new Error("HEDERA_OPERATOR_ID and HEDERA_OPERATOR_KEY must be set");
        }
        this.client = sdk_1.Client.forTestnet();
        this.client.setOperator(sdk_1.AccountId.fromString(operatorId), sdk_1.PrivateKey.fromString(operatorKey));
    }
    /**
     * Deploys a new campaign contract via the Factory
     * @param requesterEvmAddress The EVM address of the charity/grant seeker
     * @param deadline Unix timestamp
     * @param campaignType 0 for CHARITY, 1 for GRANT
     * @returns The EVM address of the deployed campaign
     */
    async createCampaign(requesterEvmAddress, deadline, campaignType) {
        const factoryId = process.env.FACTORY_CONTRACT_ID;
        if (!factoryId) {
            throw new Error("FACTORY_CONTRACT_ID must be set");
        }
        const transaction = new sdk_1.ContractExecuteTransaction()
            .setContractId(sdk_1.ContractId.fromString(factoryId))
            .setGas(1000000) // Adjust gas as needed
            .setFunction("createCampaign", new sdk_1.ContractFunctionParameters()
            .addAddress(requesterEvmAddress)
            .addUint256(deadline)
            .addUint8(campaignType));
        const response = await transaction.execute(this.client);
        const receipt = await response.getReceipt(this.client);
        // In Hedera, the address of the newly created contract is usually in the record's contract call result
        // Or we can parse the logs if we have the ABI.
        // Simplifying: The factory emits CampaignCreated(campaign, requester, type, deadline, timestamp)
        // For now, we'll return a placeholder or implement log parsing if needed.
        // To get the deployed address reliably, we should fetch the transaction record.
        const record = await response.getRecord(this.client);
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
    async getTotalRaised(campaignContractId) {
        const query = new sdk_1.ContractCallQuery()
            .setContractId(sdk_1.ContractId.fromString(campaignContractId))
            .setGas(100000)
            .setFunction("totalRaised");
        const result = await query.execute(this.client);
        return BigInt(result.getUint256(0).toString());
    }
    /**
     * Queries if the funds have been released
     */
    async isReleased(campaignContractId) {
        const query = new sdk_1.ContractCallQuery()
            .setContractId(sdk_1.ContractId.fromString(campaignContractId))
            .setGas(100000)
            .setFunction("released");
        const result = await query.execute(this.client);
        return result.getBool(0);
    }
    /**
     * Adds a new admin to the Factory contract
     */
    async addAdmin(adminEvmAddress) {
        const factoryId = process.env.FACTORY_CONTRACT_ID;
        if (!factoryId)
            throw new Error("FACTORY_CONTRACT_ID missing");
        const transaction = new sdk_1.ContractExecuteTransaction()
            .setContractId(sdk_1.ContractId.fromString(factoryId))
            .setGas(200000)
            .setFunction("addAdmin", new sdk_1.ContractFunctionParameters().addAddress(adminEvmAddress));
        const response = await transaction.execute(this.client);
        return response.getReceipt(this.client);
    }
    /**
     * Removes an admin from the Factory contract
     */
    async removeAdmin(adminEvmAddress) {
        const factoryId = process.env.FACTORY_CONTRACT_ID;
        if (!factoryId)
            throw new Error("FACTORY_CONTRACT_ID missing");
        const transaction = new sdk_1.ContractExecuteTransaction()
            .setContractId(sdk_1.ContractId.fromString(factoryId))
            .setGas(200000)
            .setFunction("removeAdmin", new sdk_1.ContractFunctionParameters().addAddress(adminEvmAddress));
        const response = await transaction.execute(this.client);
        return response.getReceipt(this.client);
    }
    /**
     * Checks if an address is an admin on the Factory contract
     */
    async getIsAdmin(adminEvmAddress) {
        const factoryId = process.env.FACTORY_CONTRACT_ID;
        if (!factoryId)
            throw new Error("FACTORY_CONTRACT_ID missing");
        const query = new sdk_1.ContractCallQuery()
            .setContractId(sdk_1.ContractId.fromString(factoryId))
            .setGas(100000)
            .setFunction("isAdmin", new sdk_1.ContractFunctionParameters().addAddress(adminEvmAddress));
        const result = await query.execute(this.client);
        return result.getBool(0);
    }
}
exports.contractService = new ContractService();
