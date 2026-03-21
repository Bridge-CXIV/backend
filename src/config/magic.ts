import { Magic } from "@magic-sdk/admin";

const magicSecret = process.env.MAGIC_SECRET_KEY;

if (!magicSecret) {
  throw new Error("MAGIC_SECRET_KEY must be provided");
}

const magic = new Magic(magicSecret);

export default magic;
