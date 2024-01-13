import { Prisma, PrismaClient } from "@prisma/client/edge";
import { stx20Api } from "./api-stx20";

const prisma = new PrismaClient();

export const updateTokens = async () => {
  const { data: tokens } = await stx20Api.fetchAllTokens();
  console.log(`Fetched ${tokens.length} tokens.`);

  // prepare tokens for upsert
  const tokensToUpsert: Prisma.TokenUpsertArgs[] = [];

  // we only need to update tokens that are new or have a different supplyLeftToMint
  // first, get all tokens from the db
  const dbTokens = await prisma.token.findMany();
  // then, filter out tokens that are already in the db with the same supplyLeftToMint
  const tokensToUpdate = tokens.filter(
    (t) => !dbTokens.find((dbToken) => dbToken.ticker === t.ticker && dbToken.supplyLeftToMint === t.supplyLeftToMint)
  );
  // then, add them to the upsert array
  tokensToUpdate.forEach((token) => {
    tokensToUpsert.push({
      where: {
        ticker: token.ticker,
      },
      create: {
        ticker: token.ticker,
        totalSupply: token.totalSupply,
        mintLimit: token.mintLimit,
        creationDate: token.creationDate,
        supplyLeftToMint: token.supplyLeftToMint,
      },
      update: {
        supplyLeftToMint: token.supplyLeftToMint,
      },
    });
  });

  if (tokensToUpsert.length === 0) {
    console.log("No tokens need updates.");
    return tokens;
  }

  try {
    // Execute all upsert operations concurrently
    console.log(`Updating ${tokensToUpsert.length} tokens...`);
    const result = await prisma.$transaction(tokensToUpsert.map((t) => prisma.token.upsert(t)));
    console.log(`Updated ${result.length} tokens successfully.`);
    return result;
  } catch (error) {
    console.error(`Failed to update tokens:`, error);
    throw error;
  }
};
