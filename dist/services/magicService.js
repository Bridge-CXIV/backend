"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUserMetadata = exports.getIssuer = exports.verifyDidToken = void 0;
const magic_1 = __importDefault(require("../config/magic"));
const verifyDidToken = async (token) => {
    magic_1.default.token.validate(token);
};
exports.verifyDidToken = verifyDidToken;
const getIssuer = async (token) => {
    return magic_1.default.token.getIssuer(token);
};
exports.getIssuer = getIssuer;
const getUserMetadata = async (issuer) => {
    return magic_1.default.users.getMetadataByIssuer(issuer);
};
exports.getUserMetadata = getUserMetadata;
