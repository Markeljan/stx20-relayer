import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const deleteToken = async (ticker: string) => {
  const token = await prisma.token.delete({
    where: {
      ticker,
    },
  });
  if (token.ticker !== ticker) throw new Error(`Failed to delete token ${ticker}.`);
  console.log(`Deleted token ${ticker}.`);
  return token;
};

await deleteToken("TIFFANY");
