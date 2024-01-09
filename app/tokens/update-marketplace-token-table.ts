import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const updateMarketplaceTokenTable = async () => {
  // get marketplaceToken from indexderToken table
  const marketplaceTokens = await prisma.marketplaceToken.findMany();

  // get ticker and minPriceRate from indexerListing table
  const minPriceRates = await prisma.indexerListing.groupBy({
    by: ["ticker"],
    _min: {
      priceRate: true,
    },
  });
  // upsert marketplaceToken table with new marketplaceTokens created from minPriceRates.

  // get tokens for all tickers in minPriceRates
  const relatedTokens = await prisma.indexerToken.findMany({
    where: {
      ticker: {
        in: minPriceRates.map((minPriceRate) => minPriceRate.ticker),
      },
    },
  });

  // create new marketplaceTokens from relatedTokens and minPriceRates
  const newMarketplaceTokens = relatedTokens.map((relatedToken) => {
    const newPriceRate = minPriceRates.find((minPriceRate) => minPriceRate.ticker === relatedToken.ticker)?._min
      .priceRate;
    const marketplaceToken = marketplaceTokens.find(
      (marketplaceToken) => marketplaceToken.ticker === relatedToken.ticker
    );
    if (!newPriceRate) {
      throw new Error(`No newPriceRate found for ticker ${relatedToken.ticker}`);
    }
    // get the pricechangepercentage which is the difference between the current price and the previous price that was saved in the marketplaceToken table
    const priceChangePercentage = marketplaceToken
      ? (newPriceRate - marketplaceToken.unitPriceStx) / marketplaceToken.unitPriceStx
      : 0;
    // get the marketCapStx which is the priceRate * totalSupply
    return {
      ...relatedToken,
      unitPriceStx: newPriceRate,
      priceChangePercentage: priceChangePercentage,
      marketCapStx: newPriceRate * parseFloat(relatedToken.totalSupply),
      totalSupply: parseFloat(relatedToken.totalSupply),
      supplyLeftToMint: parseFloat(relatedToken.supplyLeftToMint),
      mintLimit: parseFloat(relatedToken.mintLimit),
    };
  });

  // upsert new marketplaceTokens
  await prisma.$transaction(async (tx) => {
    await Promise.all(
      newMarketplaceTokens.map(async (newMarketplaceToken) => {
        await prisma.marketplaceToken.upsert({
          where: {
            ticker: newMarketplaceToken.ticker,
          },
          create: newMarketplaceToken,
          update: {
            unitPriceStx: newMarketplaceToken.unitPriceStx,
            priceChangePercentage: newMarketplaceToken.priceChangePercentage,
            marketCapStx: newMarketplaceToken.marketCapStx,
          },
        });
      })
    );
  });
};
