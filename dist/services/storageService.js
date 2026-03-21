"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadFile = void 0;
const cloudinary_1 = __importDefault(require("../config/cloudinary"));
const crypto_1 = __importDefault(require("crypto"));
/**
 * Upload a file buffer to Cloudinary and return the secure URL + content hash.
 */
const uploadFile = async (buffer, filename) => {
    const hash = crypto_1.default.createHash("sha256").update(buffer).digest("hex");
    const result = await new Promise((resolve, reject) => {
        const stream = cloudinary_1.default.uploader.upload_stream({
            folder: "glassgive",
            public_id: filename.replace(/\.[^/.]+$/, ""), // strip extension
            resource_type: "auto",
        }, (error, result) => {
            if (error || !result)
                return reject(error ?? new Error("Upload failed"));
            resolve(result);
        });
        stream.end(buffer);
    });
    return { url: result.secure_url, hash };
};
exports.uploadFile = uploadFile;
