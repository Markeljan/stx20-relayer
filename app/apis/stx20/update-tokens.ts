import { Prisma, PrismaClient } from "@prisma/client";
import { stx20Api } from "./config";

const prisma = new PrismaClient();

export const updateTokens = async () => {
  const { data: tokens } = await stx20Api.fetchAllTokens();
  const newTokenMap = new Map(tokens.map((token) => [token.ticker, token]));
  const existingTokens = await fetchExistingTokens(Array.from(newTokenMap.keys()));

  const newTokens: Prisma.IndexerTokenCreateInput[] = [];
  const updateTokenPromises: Promise<Prisma.IndexerTokenCreateInput>[] = [];

  existingTokens.forEach((existingToken) => {
    const newToken = newTokenMap.get(existingToken.ticker);
    if (newToken && needsUpdate(existingToken, newToken)) {
      updateTokenPromises.push(
        prisma.indexerToken.update({
          where: { ticker: existingToken.ticker },
          data: newToken,
        })
      );
    }
    newTokenMap.delete(existingToken.ticker);
  });

  newTokens.push(...newTokenMap.values());

  const [createdTokens, updatedTokens] = await prisma.$transaction(async (tx) => [
    await prisma.indexerToken.createMany({
      data: newTokens,
      skipDuplicates: true,
    }),
    await Promise.all(updateTokenPromises),
  ]);

  console.log(`Fetched ${tokens.length} tokens.`);
  console.log(`Created ${createdTokens.count} new tokens.`);
  console.log(`Updated ${updatedTokens.length} existing tokens.`);
};

// HELPERS
const fetchExistingTokens = (tickers: string[]) => {
  return prisma.indexerToken.findMany({
    where: {
      ticker: {
        in: tickers,
      },
    },
  });
};

const needsUpdate = (existingToken: Prisma.IndexerTokenCreateInput, newToken: Prisma.IndexerTokenCreateInput) => {
  return existingToken.supplyLeftToMint !== newToken.supplyLeftToMint;
};
