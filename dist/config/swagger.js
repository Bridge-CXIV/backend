"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.swaggerSpec = void 0;
const swagger_jsdoc_1 = __importDefault(require("swagger-jsdoc"));
const options = {
    definition: {
        openapi: "3.0.0",
        info: {
            title: "GlassGive — Transparent Charity Tracker API",
            version: "1.0.0",
            description: "RESTful API for the GlassGive platform powered by Hedera Hashgraph. " +
                "Supports dual authentication (Magic.link / HashConnect), charity & grant request management, " +
                "donation tracking with NFT receipts, admin multi-signature verification, and a real-time dashboard.",
            contact: {
                name: "GlassGive Team",
            },
        },
        servers: [
            {
                url: "/api",
                description: "API base path",
            },
        ],
        components: {
            securitySchemes: {
                BearerAuth: {
                    type: "http",
                    scheme: "bearer",
                    bearerFormat: "JWT",
                    description: "JWT obtained from /api/auth/magic or /api/auth/wallet",
                },
            },
            schemas: {
                User: {
                    type: "object",
                    properties: {
                        id: { type: "string" },
                        hederaAccountId: { type: "string", nullable: true },
                        email: { type: "string", nullable: true },
                        displayName: { type: "string", nullable: true },
                        role: { type: "string", enum: ["USER", "ADMIN", "DONOR"] },
                    },
                },
                Request: {
                    type: "object",
                    properties: {
                        id: { type: "string" },
                        type: { type: "string", enum: ["CHARITY", "GRANT"] },
                        status: {
                            type: "string",
                            enum: ["PENDING_VERIFICATION", "LIVE", "FUNDED", "EXPIRED", "REJECTED"],
                        },
                        title: { type: "string" },
                        description: { type: "string" },
                        purpose: { type: "string" },
                        goalAmount: { type: "number" },
                        currentAmount: { type: "number" },
                        timelineEnd: { type: "string", format: "date-time" },
                        walletAddress: { type: "string" },
                        hcsTopicId: { type: "string", nullable: true },
                        hfsFileId: { type: "string", nullable: true },
                        imageUrl: { type: "string", nullable: true },
                        businessType: { type: "string", nullable: true },
                        businessPlanHfsId: { type: "string", nullable: true },
                        proofOfBusinessHfsId: { type: "string", nullable: true },
                        createdAt: { type: "string", format: "date-time" },
                        updatedAt: { type: "string", format: "date-time" },
                    },
                },
                Donation: {
                    type: "object",
                    properties: {
                        id: { type: "string" },
                        amount: { type: "number" },
                        nftId: { type: "string", nullable: true },
                        tokenId: { type: "string", nullable: true },
                        transactionHash: { type: "string", nullable: true },
                        memo: { type: "string", nullable: true },
                        requestId: { type: "string" },
                        donorId: { type: "string", nullable: true },
                        createdAt: { type: "string", format: "date-time" },
                    },
                },
                ImpactUpdate: {
                    type: "object",
                    properties: {
                        id: { type: "string" },
                        title: { type: "string" },
                        body: { type: "string" },
                        hcsMessageId: { type: "string", nullable: true },
                        requestId: { type: "string" },
                        authorId: { type: "string" },
                        createdAt: { type: "string", format: "date-time" },
                    },
                },
                AdminSignature: {
                    type: "object",
                    properties: {
                        id: { type: "string" },
                        adminId: { type: "string" },
                        requestId: { type: "string" },
                        signature: { type: "string" },
                        createdAt: { type: "string", format: "date-time" },
                    },
                },
                Pagination: {
                    type: "object",
                    properties: {
                        page: { type: "integer" },
                        limit: { type: "integer" },
                        total: { type: "integer" },
                        totalPages: { type: "integer" },
                    },
                },
                Error: {
                    type: "object",
                    properties: {
                        error: { type: "string" },
                    },
                },
            },
        },
    },
    apis: ["./src/routes/*.ts"],
};
exports.swaggerSpec = (0, swagger_jsdoc_1.default)(options);
