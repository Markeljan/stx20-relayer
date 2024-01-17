import { Prisma, PrismaClient } from "@prisma/client";
import { stx20MarketplaceApi } from "./api-stx20-marketplace";

const prisma = new PrismaClient();
export const updatePriceData = async () => {
  // create a set of tickers from db listings & existing price data
  const existingPriceData = await prisma.priceData.findMany();
  const listings = await prisma.listing.findMany();
  const tickersToUpdate = new Set(existingPriceData.map((pd) => pd.ticker));
  // add tickers from listings to tickerToPriceData
  listings.forEach((listing) => tickersToUpdate.add(listing.ticker));

  // get price data for all tickers in tickerToPriceData
  const priceDataToFetch = Array.from(tickersToUpdate);

  // fetch price data for tokens that need it using promise.all
  const priceDataWithTicker = await Promise.all(
    priceDataToFetch.map(async (ticker) => {
      const { data: priceData } = await stx20MarketplaceApi.fetchTokenFloorPrice(ticker);
      const dataWithTicker = { ...priceData, ticker };
      return dataWithTicker;
    })
  );

  const priceDataUpserts: Prisma.PriceDataUpsertArgs[] = [];

  // prepare priceData for upsert
  priceDataWithTicker.forEach((priceData) => {
    priceDataUpserts.push({
      where: {
        ticker: priceData.ticker,
      },
      create: {
        ticker: priceData.ticker,
        maxPriceRate: priceData.maxPriceRate,
        meanPriceRate: priceData.meanPriceRate,
        medianMaxPriceRate: priceData.medianMaxPriceRate,
        medianMinPriceRate: priceData.medianMinPriceRate,
        minPriceRate: priceData.minPriceRate,
        medianPriceRate: priceData.medianPriceRate,
      },
      update: {
        maxPriceRate: priceData.maxPriceRate,
        meanPriceRate: priceData.meanPriceRate,
        medianMaxPriceRate: priceData.medianMaxPriceRate,
        medianMinPriceRate: priceData.medianMinPriceRate,
        minPriceRate: priceData.minPriceRate,
        medianPriceRate: priceData.medianPriceRate,
      },
    });
  });

  if (priceDataUpserts.length === 0) {
    console.log("No price data needs updates.");
    return priceDataWithTicker;
  }

  // Execute all upsert operations concurrently
  try {
    console.log(`Updating ${priceDataUpserts.length} price data...`);
    const result = await prisma.$transaction(priceDataUpserts.map((pd) => prisma.priceData.upsert(pd)));
    console.log(`Updated ${result.length} price data successfully.`);
    return priceDataWithTicker;
  } catch (error) {
    console.error(error);
    throw new Error("Error updating price data.");
  }
};
