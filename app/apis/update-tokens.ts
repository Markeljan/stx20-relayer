import { Prisma, PrismaClient } from "@prisma/client";
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
    (t) =>
      !dbTokens.find(
        (dbToken) => dbToken.ticker === t.ticker && dbToken.supplyLeftToMint === toSafeBigInt(t.supplyLeftToMint)
      )
  );
  // then, add them to the upsert array
  tokensToUpdate.forEach((token) => {
    //cast values to BigInt
    const totalSupplyBigInt = toSafeBigInt(token.totalSupply);
    const mintLimitBigint = toSafeBigInt(token.mintLimit);
    const supplyLeftToMintBigInt = toSafeBigInt(token.supplyLeftToMint);
    // Convert BigInts to strings and then to floats
    const totalSupplyFloat = parseFloat(token.totalSupply);
    const supplyLeftToMintFloat = parseFloat(token.supplyLeftToMint);
    // Calculate the percentage as a float
    const percentageMintedFloat = ((totalSupplyFloat - supplyLeftToMintFloat) / totalSupplyFloat) * 100;

    tokensToUpsert.push({
      where: {
        ticker: token.ticker,
      },
      create: {
        ticker: token.ticker,
        totalSupply: totalSupplyBigInt,
        mintLimit: mintLimitBigint,
        creationDate: token.creationDate,
        supplyLeftToMint: supplyLeftToMintBigInt,
        percentageMinted: percentageMintedFloat,
      },
      update: {
        supplyLeftToMint: supplyLeftToMintBigInt,
        percentageMinted: percentageMintedFloat,
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

//function to prevent overflow in db. Max BigInt is 9223372036854775807n if over this number, return max value
function toSafeBigInt(value: string) {
  const valueBigInt = BigInt(value);
  const maxValue = 9223372036854775807n;
  if (valueBigInt > maxValue) {
    return maxValue;
  } else {
    return valueBigInt;
  }
}
