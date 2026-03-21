"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const admin_1 = require("@magic-sdk/admin");
const magicSecret = process.env.MAGIC_SECRET_KEY;
if (!magicSecret) {
    throw new Error("MAGIC_SECRET_KEY must be provided");
}
const magic = new admin_1.Magic(magicSecret);
exports.default = magic;
