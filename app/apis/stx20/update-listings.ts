import { Prisma, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const updateListings = async () => {
  try {
    const { data: listings } = (await fetchListings()) as {
      data: (Prisma.IndexerListingCreateInput & { _id?: string; __v?: number })[];
    };
const number: number = 210000000000000000000;
    // format response to match supported prisma values
    listings.forEach((listing) => {
      listing.id = listing?._id || "";
      listing.v = listing?.__v || 0;
      try {
        typeof listing.priceRate === "string" && console.log("Null priceRate:", listing.priceRate);
        listing.priceRate = listing.priceRate;
      } catch (error) {
        console.log("error:", listing.priceRate);
        throw error;
      }
      delete listing._id;
      delete listing.__v;
    });
    const newListingsMap = new Map(listings.map((listing) => [listing.id, listing]));
    const existingListings = await fetchExistingListings(Array.from(newListingsMap.keys()));

    const newListings: Prisma.IndexerListingCreateInput[] = [];
    const updateListingsPromises: Promise<Prisma.IndexerListingCreateInput>[] = [];

    existingListings.forEach((existingListing) => {
      const newListing = newListingsMap.get(existingListing.id);
      if (newListing && needsUpdate(existingListing, newListing)) {
        updateListingsPromises.push(
          prisma.indexerListing.update({
            where: { id: existingListing.id },
            data: newListing,
          })
        );
      }
      newListingsMap.delete(existingListing.id);
    });

    newListings.push(...newListingsMap.values());

    const [createdListings, updatedListings] = await prisma.$transaction(async (tx) => [
      await prisma.indexerListing.createMany({
        data: newListings,
        skipDuplicates: true,
      }),
      await Promise.all(updateListingsPromises),
    ]);

    console.log(`Fetched ${listings.length} listings.`);
    console.log(`Created ${createdListings.count} new listings.`);
    console.log(`Updated ${updatedListings.length} existing listings.`);
  } catch (error) {
    console.error("Failed to update listings list:", error);
    throw error;
  }
};

// API
const fetchListings = async () => {
  try {
    const response = await fetch(
      "https://api-marketplace.stx20.com/api/v1/sell-requests/search?sort=created_asc&limit=10000",
      {
        method: "POST",
        body: JSON.stringify({
          pendingTx: true,
        }),
      }
    );
    const json = await response.json();
    return json;
  } catch (error: any) {
    console.error("Failed to fetch Listings:", error.statusText);
    throw error;
  }
};

// HELPERS
const fetchExistingListings = (ids: string[]) => {
  return prisma.indexerListing.findMany({
    where: {
      id: {
        in: ids,
      },
    },
  });
};

const needsUpdate = (
  existingListing: Prisma.IndexerListingCreateInput,
  newListing: Prisma.IndexerListingCreateInput
) => {
  return existingListing.id !== newListing.id;
};
