import { PriceChange, Prisma, PrismaClient, Token } from "@prisma/client";

import { calculatePriceInSats, calculatePriceInUsd } from "../utils/conversions";
import { coinCapApi } from "./api-coincap";

const prisma = new PrismaClient();
export const updateTokenPrices = async () => {
  const { btcPriceFloat, stxPriceFloat } = await coinCapApi.fetchFloatBtcAndStxPrices();

  // update all tokens with a floor price or in the listings table
  const tokensToUpdate = await prisma.token.findMany({
    where: {
      OR: [
        {
          floorPriceUsd: {
            gt: 0,
          },
        },
        {
          listings: {
            some: {
              priceRate: {
                gt: 0,
              },
            },
          },
        },
      ],
    },
    include: {
      listings: true,
      priceChanges: true,
      priceData: false,
    },
  });

  const tokenUpdateTxs: Prisma.TokenUpdateArgs[] = [];

  const now = new Date();

  for (const token of tokensToUpdate) {
    const listings = token.listings;
    const activeListingsCount = listings.length;
    if (listings && listings.length > 0) {
      // find the lowest priceRate in the listings
      const floorPriceStx = listings.reduce((min, listing) => {
        return listing.priceRate < min ? listing.priceRate : min;
      }, Infinity);
      const marketCapFloat = parseFloat(token.totalSupply.toString()) * floorPriceStx;
      const priceInUsd = calculatePriceInUsd({
        priceMicroStx: floorPriceStx,
        stxPriceFloat: stxPriceFloat,
      });
      const priceInSats = calculatePriceInSats({
        priceInUsd: priceInUsd,
        btcPriceFloat: btcPriceFloat,
      });
      const marketCapInUsd = calculatePriceInUsd({
        priceMicroStx: marketCapFloat,
        stxPriceFloat: stxPriceFloat,
      });
      const historicalPriceData = calculateAllHistoricalPriceChanges(token, priceInUsd);

      await tokenUpdateTxs.push({
        where: {
          ticker: token.ticker,
        },
        data: {
          floorPriceStx: floorPriceStx,
          floorPriceUsd: priceInUsd,
          floorPriceSats: priceInSats,
          marketCap: marketCapFloat,
          marketCapUsd: marketCapInUsd,
          activeListingsCount: activeListingsCount,
          floorPriceUsd1hChange: historicalPriceData["1h"],
          floorPriceUsd6hChange: historicalPriceData["6h"],
          floorPriceUsd24hChange: historicalPriceData["24h"],
          floorPriceUsd7dChange: historicalPriceData["7d"],
          floorPriceUsd30dChange: historicalPriceData["30d"],
          priceChanges: {
            create: {
              priceUsd: priceInUsd,
              updateDate: now,
            },
          },
        },
        include: {
          listings: true,
          priceChanges: true,
          priceData: false,
        },
      });
    }
  }

  if (tokenUpdateTxs.length === 0) {
    console.log("No tokens need price updates.");
    return;
  }

  try {
    // Execute all upsert operations concurrently
    console.log(`Updating ${tokenUpdateTxs.length} token prices...`);
    const result = await prisma.$transaction(tokenUpdateTxs.map((t) => prisma.token.update(t)));
    console.log(`Updated ${result.length} token prices successfully.`);
    return result.length;
  } catch (error) {
    console.error(`Failed to update token prices. ${error}`);
    throw new Error(`Failed to update token prices. ${error}`);
  }
};

type HistoricInterval = "1h" | "6h" | "24h" | "7d" | "30d";

const INTERVALS: HistoricInterval[] = ["1h", "6h", "24h", "7d", "30d"];

// map of interval to number of milliseconds
const INTERVAL_MILLISECONDS: Record<HistoricInterval, number> = {
  "1h": 60 * 60 * 1000,
  "6h": 6 * 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
};

// calculate all historical price change percentages for a token and return an object containing all priceChanges 1h, 6h, 24h, 7d, 30d
const calculateAllHistoricalPriceChanges = (token: Token & { priceChanges: PriceChange[] }, currentPrice: number) => {
  const priceChanges = token.priceChanges ?? [];
  const now = new Date();
  const historicalPriceChanges: Record<HistoricInterval, number> = {
    "1h": 0,
    "6h": 0,
    "24h": 0,
    "7d": 0,
    "30d": 0,
  };

  for (const interval of INTERVALS) {
    const intervalMilliseconds = INTERVAL_MILLISECONDS[interval];
    const intervalAgo = new Date(now.getTime() - intervalMilliseconds);
    // find the closest price change to the intervalAgo date (if the time has passed, we compare the oldest price change to the current price)
    const closestPriceChange = priceChanges.reduce((closest, priceChange) => {
      const closestDate = new Date(closest.updateDate);
      const priceChangeDate = new Date(priceChange.updateDate);
      if (priceChangeDate <= intervalAgo && priceChangeDate > closestDate) {
        return priceChange;
      } else {
        return closest;
      }
    }, priceChanges[0]);

    // calculate the percentage change between the closest price change to the interval and the current price
    const percentageChange = ((currentPrice - closestPriceChange.priceUsd) / currentPrice) * 100;
    historicalPriceChanges[interval] = percentageChange;
  }

  return historicalPriceChanges;
};
