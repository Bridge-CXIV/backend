import cloudinary from "../config/cloudinary";
import crypto from "crypto";

/**
 * Upload a file buffer to Cloudinary and return the secure URL + content hash.
 */
export const uploadFile = async (
  buffer: Buffer,
  filename: string,
): Promise<{ url: string; hash: string }> => {
  const hash = crypto.createHash("sha256").update(buffer).digest("hex");

  const result = await new Promise<{ secure_url: string }>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "glassgive",
        public_id: filename.replace(/\.[^/.]+$/, ""), // strip extension
        resource_type: "auto",
      },
      (error, result) => {
        if (error || !result) return reject(error ?? new Error("Upload failed"));
        resolve(result);
      },
    );
    stream.end(buffer);
  });

  return { url: result.secure_url, hash };
};
