import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL as string,
});

const prisma = new PrismaClient({ adapter });

async function main() {
  const daysArg = Number.parseInt(process.argv[2] ?? "30", 10);
  const days = Number.isFinite(daysArg) && daysArg > 0 ? daysArg : 30;

  const totalUsers = await prisma.users.count({
    where: { deletedAt: null },
  });

  const dailyRows = await prisma.$queryRaw<Array<{ day: Date; count: bigint }>>`
    SELECT DATE("createdAt") AS day, COUNT(*)::bigint AS count
    FROM "Users"
    WHERE "deletedAt" IS NULL
    GROUP BY DATE("createdAt")
    ORDER BY day DESC
    LIMIT ${days}
  `;

  console.log(`Total users: ${totalUsers}`);
  console.log(`Daily signups (last ${days} days with activity):`);
  for (const row of dailyRows) {
    console.log(`${row.day.toISOString().slice(0, 10)} -> ${Number(row.count)}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

