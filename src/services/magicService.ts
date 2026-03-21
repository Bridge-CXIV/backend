import magic from "../config/magic";

export const verifyDidToken = async (token: string) => {
  magic.token.validate(token);
};

export const getIssuer = async (token: string) => {
  return magic.token.getIssuer(token);
};

export const getUserMetadata = async (issuer: string) => {
  return magic.users.getMetadataByIssuer(issuer);
};
