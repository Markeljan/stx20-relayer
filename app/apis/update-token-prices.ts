import { Prisma, PrismaClient, Token } from "@prisma/client";
import { coinCapApi } from "./api-coincap";

const prisma = new PrismaClient();
export const updateTokenPrices = async () => {
  const [btcPriceData, stxPriceData] = await Promise.all([
    coinCapApi.fetchPriceData("bitcoin"),
    coinCapApi.fetchPriceData("stacks"),
  ]);

  const btcPriceFloat = parseFloat(btcPriceData.data.priceUsd);
  const stxPriceFloat = parseFloat(stxPriceData.data.priceUsd);

  // convert from micro-stx to stx ( / 10^6) then to usd ( * stxPriceFloat)
  const calculatePriceInUsd = (priceMicroStx: number) => (priceMicroStx / 10 ** 6) * stxPriceFloat;
  const calculatePriceInSats = (priceInUsd: number) => (priceInUsd / btcPriceFloat) * 10 ** 8;

  // update all tokens with a floor price
  const tokensToUpdate = await prisma.token.findMany({
    where: {
      floorPriceUsd: {
        gt: 0,
      },
    },
    include: {
      listings: true,
      priceData: false,
    },
  });

  const tokenUpdateTxs: Prisma.TokenUpdateArgs[] = [];
  tokensToUpdate.forEach((token) => {
    const listings = token.listings;
    const activeListingsCount = listings.length;
    if (listings && listings.length > 0) {
      // find the lowest priceRate in the listings
      const floorPrice = listings.reduce((min, listing) => {
        return listing.priceRate < min ? listing.priceRate : min;
      }, Infinity);
      const marketCapFloat = parseFloat(token.totalSupply.toString()) * floorPrice;
      const priceInUsd = calculatePriceInUsd(floorPrice);
      const priceInSats = calculatePriceInSats(priceInUsd);
      const marketCapInUsd = calculatePriceInUsd(marketCapFloat);
      const historicalPriceData = calculateAllHistoricalPriceData(token, priceInUsd);

      tokenUpdateTxs.push({
        where: {
          ticker: token.ticker,
        },
        data: {
          floorPrice: floorPrice,
          floorPriceUsd: priceInUsd,
          floorPriceSats: priceInSats,
          marketCap: marketCapFloat,
          marketCapUsd: marketCapInUsd,
          activeListingsCount: activeListingsCount,
          ...historicalPriceData,
        },
      });
    }
  });

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
    console.error(`Failed to update token prices.`);
    throw new Error(`Failed to update token prices.`);
  }
};

// helper function to calculate historical price data.  Updates all intervals change values, only updates the actual interval value if the time has passed.  Reset intervalDate if the interval has passed.

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

// calculate all historical price data for a token and return an object with the updated values to be deconstructed and added to the token update transaction
const calculateAllHistoricalPriceData = (token: Token, priceInUsd: number) => {
  const now = new Date();
  const result: Record<string, number | Date> = {};

  INTERVALS.forEach((interval) => {
    const historicalDataResults = calculateHistoricalPriceData(token, priceInUsd, interval, now);
    if (historicalDataResults.change) {
      result[`floorPrice${interval}Change`] = historicalDataResults.change;
    }
    if (historicalDataResults.value) {
      result[`floorPrice${interval}Usd`] = historicalDataResults.value;
    }
    if (historicalDataResults.date) {
      result[`floorPrice${interval}Date`] = historicalDataResults.date;
    }
  });
  return result;
};

type calculateHistoricalPriceDataResult = {
  value?: number;
  date?: Date;
  change?: number;
};

const calculateHistoricalPriceData = (token: Token, priceInUsd: number, interval: HistoricInterval, now: Date) => {
  const existingValue = token[`floorPrice${interval}Usd`];
  const existingDate = token[`floorPrice${interval}Date`];
  const existingChange = token[`floorPrice${interval}Change`];

  const result: calculateHistoricalPriceDataResult = {};

  // if minPriceRate is 0, return because there is no available market data
  if (!priceInUsd) {
    return result;
  }

  // CASE: initalize
  // if the value is null or undefined or 0, set it to the current floor price. (make sure current floor price is not 0)
  if (!existingValue || existingValue === 0) {
    result.value = priceInUsd;
    result.date = now;
    result.change = 0;
  } else {
    // CASE: update
    // if the value is not null or undefined, calculate the change and update the value and date if the interval has passed
    result.change = ((priceInUsd - existingValue) / existingValue) * 100;

    // CASE: interval has passed
    if (now.getTime() - existingDate.getTime() > INTERVAL_MILLISECONDS[interval]) {
      result.value = priceInUsd;
      result.date = now;
    }
  }

  return result;
};
