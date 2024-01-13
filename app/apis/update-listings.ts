import { Prisma, PrismaClient } from "@prisma/client/edge";
import { stx20MarketplaceApi } from "./api-stx20-marketplace";

const prisma = new PrismaClient();

export const updateListings = async () => {
  const { data: listings } = await stx20MarketplaceApi.fetchAllListings({ pendingTx: true });
  console.log(`Fetched ${listings.length} listings.`);

  // first, get all listings from the db
  const dbListings = await prisma.listing.findMany();

  // delete listings from db that are not in the new listings
  const listingsToDelete = dbListings.filter((dbListing) => !listings.find((listing) => dbListing.id === listing._id));

  if (listingsToDelete.length > 0) {
    console.log(`Deleting ${listingsToDelete.length} listings...`);
    const ListingDeleteResult = await prisma.listing.deleteMany({
      where: {
        id: {
          in: listingsToDelete.map((l) => l.id),
        },
      },
    });
    // if ListingDeleteResult.count is equal to listingsToDelete.length, remove the deleted listings from dbListings
    if (ListingDeleteResult.count === listingsToDelete.length) {
      listingsToDelete.forEach((l) => {
        const index = dbListings.findIndex((dbListing) => dbListing.id === l.id);
        dbListings.splice(index, 1);
      });
      console.log(`Deleted ${ListingDeleteResult.count} listings successfully.`);
    } else {
      console.error(`Failed to delete listings.`);
      throw new Error(`Failed to delete listings.`);
    }
  }

  // then, filter out listings that are already in the db with the same pendingPurchaseTx.length, requestStatus, stxSentConfirmed, tokenSentConfirmed, submitted, isBuried, or lastReincarnate
  const listingsToUpdate = listings.filter(
    (l) =>
      !dbListings.find(
        (dbListing) =>
          dbListing.id === l._id &&
          (dbListing.pendingPurchaseTx.length === l.pendingPurchaseTx.length ||
            dbListing.requestStatus === l.requestStatus ||
            dbListing.stxSentConfirmed === l.stxSentConfirmed ||
            dbListing.tokenSentConfirmed === l.tokenSentConfirmed ||
            dbListing.submitted === l.submitted ||
            dbListing.isBuried === l.isBuried ||
            dbListing.lastReincarnate === l.lastReincarnate)
      )
  );

  // perpare listings for upsert
  const listingsToUpsert: Prisma.ListingUpsertArgs[] = [];
  const priceDataToFetch: string[] = [];

  // then, add them to the upsert array and add the tickers to priceDataToFetch
  listingsToUpdate.forEach((listing) => {
    listingsToUpsert.push({
      where: {
        id: listing._id,
      },
      create: {
        id: listing._id,
        creatorAddress: listing.creatorAddress,
        creationDate: listing.creationDate,
        ticker: listing.ticker,
        value: listing.value,
        stxValue: listing.stxValue,
        marketFeeValue: listing.marketFeeValue,
        gasFeeValueBuyer: listing.gasFeeValueBuyer,
        gasFeeValueSeller: listing.gasFeeValueSeller,
        totalStxValue: listing.totalStxValue,
        beneficiary: listing.beneficiary,
        requestStatus: listing.requestStatus,
        tokenReceiverMarketplaceAddress: listing.tokenReceiverMarketplaceAddress,
        stxSentConfirmed: listing.stxSentConfirmed,
        tokenSentConfirmed: listing.tokenSentConfirmed,
        priceRate: listing.priceRate,
        submitted: listing.submitted,
        pendingPurchaseTx: listing.pendingPurchaseTx,
        v: listing.__v,
        creationTxId: listing.creationTxId,
        isBuried: listing.isBuried,
        lastReincarnate: listing.lastReincarnate,
      },
      update: {
        requestStatus: listing.requestStatus,
        stxSentConfirmed: listing.stxSentConfirmed,
        tokenSentConfirmed: listing.tokenSentConfirmed,
        submitted: listing.submitted,
        pendingPurchaseTx: listing.pendingPurchaseTx,
        v: listing.__v,
        isBuried: listing.isBuried,
        lastReincarnate: listing.lastReincarnate,
      },
    });
    priceDataToFetch.push(listing.ticker);
  });

  if (listingsToUpsert.length === 0) {
    console.log(`No listings need updates.`);
    return listings;
  }

  // fetch price data for tokens that need it using promise.all
  const priceDataWithTicker = await Promise.all(
    priceDataToFetch.map(async (ticker) => {
      const { data: priceData } = await stx20MarketplaceApi.fetchTokenFloorPrice(ticker);
      // add the ticker to priceData
      const dataWithTicker = { ...priceData, ticker };
      return dataWithTicker;
    })
  );

  // get relevant price data from db
  const dbPriceData = await prisma.priceData.findMany({
    where: {
      ticker: {
        in: priceDataToFetch,
      },
    },
  });

  const priceDataToUpsert: Prisma.PriceDataUpsertArgs[] = [];
  const historicalPriceDataToUpsert: Prisma.HistoricalPriceUpsertArgs[] = [];

  // prepare priceData for upsert
  priceDataWithTicker.forEach((priceData) => {
    priceDataToUpsert.push({
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
    historicalPriceDataToUpsert.push({
      where: {
        ticker_date: {
          ticker: priceData.ticker,
          date: new Date(),
        },
      },
      create: {
        ticker: priceData.ticker,
        date: new Date(),
        price: priceData.minPriceRate,
      },
      update: {
        price: priceData.minPriceRate,
      },
    });
  });

  try {
    // Execute all upsert operations concurrently
    console.log(`Updating ${listingsToUpsert.length} listings and ${priceDataToUpsert.length} price data...`);
    const result = await prisma.$transaction([
      ...listingsToUpsert.map((l) => prisma.listing.upsert(l)),
      ...priceDataToUpsert.map((p) => prisma.priceData.upsert(p)),
      ...historicalPriceDataToUpsert.map((h) => prisma.historicalPrice.upsert(h)),
    ]);
    console.log(`Updated ${result.length} listings, price data, and historical price data successfully.`);

    return result;
  } catch (error) {
    console.error(`Failed to update listings, price data, and historical price data.`, error);
    throw error;
  }
};
