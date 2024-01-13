import { Prisma, PrismaClient } from "@prisma/client/edge";

const prisma = new PrismaClient();

async function main() {
  console.log(`Start seeding ...`);
  // seed database here
  console.log(`Finished seeding.`);
}

await main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
