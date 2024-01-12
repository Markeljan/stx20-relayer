import { Prisma, PrismaClient } from "@prisma/client";
import { stx20MarketplaceApi } from "./config";

const prisma = new PrismaClient();

export const updateListings = async () => {
  const { data: listings } = await stx20MarketplaceApi.fetchAllListings({ pendingTx: true });
  console.log(`Fetched ${listings.length} listings.`);

  // perpare listings for upsert
  const listingsToUpsert: Prisma.ListingUpsertArgs[] = [];

  // we only need to update listings that are new or have a different pendingPurchaseTx.length, requestStatus, stxSentConfirmed, tokenSentConfirmed, submitted, isBuried, lastReincarnate
  // first, get all listings from the db
  const dbListings = await prisma.listing.findMany();
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
  // then, add them to the upsert array
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
  });

  if (listingsToUpsert.length === 0) {
    console.log(`No listings need updates.`);
    return listings;
  }

  try {
    // Execute all upsert operations concurrently
    console.log(`Updating ${listingsToUpsert.length} listings...`);
    const result = await prisma.$transaction(listingsToUpsert.map((l) => prisma.listing.upsert(l)));
    console.log(`Updated ${result.length} listings successfully.`);
    return listings;
  } catch (error) {
    console.error(`Failed to update listings:`, error);
    throw error;
  }
};
