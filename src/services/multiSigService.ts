import prisma from "../config/db";
import { createTopic, submitMessage } from "./hcsService";
import { contractService } from "./contractService";

const threshold = Number(process.env.ADMIN_SIG_THRESHOLD ?? 2);
const isEvmAddress = (value?: string | null): value is string =>
  typeof value === "string" && /^0x[a-fA-F0-9]{40}$/.test(value);

export const recordSignature = async (
  adminId: string,
  requestId: string,
  signature: string,
) => {
  return prisma.adminSignature.create({
    data: {
      adminId,
      requestId,
      signature,
    },
  });
};

export const countSignatures = async (requestId: string) => {
  return prisma.adminSignature.count({
    where: { requestId },
  });
};

/**
 * After a new signature is recorded, check whether the threshold
 * has been met. If so, create a dedicated HCS topic for the request,
 * log the verification event, and set the request status to LIVE.
 *
 * Returns `true` if the request was activated.
 */
export const checkThresholdAndActivate = async (
  requestId: string,
): Promise<boolean> => {
  const sigCount = await countSignatures(requestId);

  if (sigCount < threshold) {
    return false;
  }

  const request = await prisma.request.findUnique({
    where: { id: requestId },
  });

  if (!request || request.status !== "PENDING_VERIFICATION") {
    return false;
  }

  // 1. Deploy the campaign contract
  const campaignType = request.type === "CHARITY" ? 0 : 1;
  const deadline = Math.floor(request.timelineEnd.getTime() / 1000);

  if (!isEvmAddress(request.walletAddress)) {
    throw new Error(
      "Request creator does not have a valid EVM wallet address. Reconnect the creator wallet or recreate the request with a 0x address.",
    );
  }

  // contractService.createCampaign returns the EVM address
  const contractAddress = await contractService.createCampaign(
    request.walletAddress,
    deadline,
    campaignType
  );

  // 2. Create a dedicated HCS topic for this request
  const topicId = await createTopic(
    `GlassGive | ${request.type} | ${request.title}`,
  );

  // 3. Log the verification event as the first message on the topic
  const verificationMessage = JSON.stringify({
    event: "VERIFICATION_COMPLETE",
    requestId: request.id,
    title: request.title,
    type: request.type,
    contractAddress,
    signatures: sigCount,
    threshold,
    timestamp: new Date().toISOString(),
  });
  await submitMessage(topicId, verificationMessage);

  // 4. Activate the request in DB
  await prisma.request.update({
    where: { id: requestId },
    data: {
      status: "LIVE",
      hcsTopicId: topicId,
      contractAddress,
    },
  });

  return true;
};
