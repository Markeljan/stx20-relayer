import { Prisma, PrismaClient } from "@prisma/client";
import { calculatePriceInBtc, calculatePriceInUsd } from "../utils/conversions";
import { coinCapApi } from "./api-coincap";
import { stx20MarketplaceApi } from "./api-stx20-marketplace";

const prisma = new PrismaClient();

export const updateListings = async () => {
  const { data: listings } = await stx20MarketplaceApi.fetchAllListings({ pendingTx: false });

  const { btcPriceFloat, stxPriceFloat } = await coinCapApi.fetchFloatBtcAndStxPrices();

  console.log(`Fetched ${listings.length} listings.`);

  // first, get all listings from the db
  const dbListings = await prisma.listing.findMany();

  console.log(`Found ${dbListings.length} listings in the database.`);

  // delete listings from db that are not in the new listings
  const listingsToDelete = dbListings.filter((dbListing) => !listings.find((listing) => dbListing.id === listing._id));

  console.log(`Found ${listingsToDelete.length} listings to delete.`);

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
            dbListing.isBuried === l.isBuried)
      )
  );

  // perpare listings for upsert
  const listingUpserts: Prisma.ListingUpsertArgs[] = [];

  // then, add them to the upsert array and add the tickers to priceDataToFetch
  listingsToUpdate.forEach((listing) => {
    const usdValue = calculatePriceInUsd({
      priceMicroStx: Number(listing.stxValue),
      stxPriceFloat: stxPriceFloat,
    });
    const btcValue = calculatePriceInBtc({
      priceInUsd: usdValue,
      btcPriceFloat: btcPriceFloat,
    });
    const priceRateUsd = calculatePriceInUsd({
      priceMicroStx: Number(listing.priceRate),
      stxPriceFloat: stxPriceFloat,
    });
    const priceRateSats = calculatePriceInBtc({
      priceInUsd: priceRateUsd,
      btcPriceFloat: btcPriceFloat,
    });
    listingUpserts.push({
      where: {
        id: listing._id,
      },
      create: {
        id: listing._id,
        creatorAddress: listing.creatorAddress,
        creationDate: listing.creationDate,
        ticker: listing.ticker,
        value: Number(listing.value),
        stxValue: Number(listing.stxValue),
        usdValue: usdValue,
        btcValue: btcValue,
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
        priceRateUsd: priceRateUsd,
        priceRateSats: priceRateSats,
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
  });

  if (listingUpserts.length === 0) {
    console.log(`No listings need updates.`);
    return listings;
  }
  try {
    // Execute all upsert operations concurrently
    console.log(`Updating ${listingUpserts.length} listings `);
    const result = await prisma.$transaction([...listingUpserts.map((l) => prisma.listing.upsert(l))]);
    console.log(`Updated ${result.length} listings successfully.`);

    return result;
  } catch (error) {
    console.error(`Failed to update listings:`, error);
    throw error;
  }
};
