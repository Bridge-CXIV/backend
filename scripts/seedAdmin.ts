import "dotenv/config";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const walletAddress = process.argv[2]?.trim();

if (!walletAddress) {
  console.error("Usage: npm run seed:admin -- <wallet-address>");
  process.exit(1);
}

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const pool = new Pool({ connectionString: databaseUrl });
const adapter = new PrismaPg(pool as any);
const prisma = new PrismaClient({ adapter });

async function main() {
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { walletAddress },
        { walletAddress: { equals: walletAddress, mode: "insensitive" } },
        { hederaAccountId: walletAddress },
      ],
    },
    select: {
      id: true,
      walletAddress: true,
      hederaAccountId: true,
      role: true,
    },
  });

  if (!user) {
    console.error(`No user found for wallet/account: ${walletAddress}`);
    console.error("Have the person log in once first, then rerun this command.");
    process.exit(1);
  }

  if (user.role === "ADMIN") {
    console.log(`User ${user.id} is already an ADMIN.`);
    console.log(JSON.stringify(user, null, 2));
    return;
  }

  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: { role: "ADMIN" },
    select: {
      id: true,
      walletAddress: true,
      hederaAccountId: true,
      role: true,
    },
  });

  console.log("Promoted user to ADMIN:");
  console.log(JSON.stringify(updatedUser, null, 2));
}

main()
  .catch((error) => {
    console.error("Failed to seed admin:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
