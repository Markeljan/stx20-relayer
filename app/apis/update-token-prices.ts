import { PriceData, Prisma, PrismaClient, Token } from "@prisma/client";
import { coinCapApi } from "./api-coincap";

const prisma = new PrismaClient();
export const updateTokenPrices = async () => {
  // get priceData from db
  const dbPriceData = await prisma.priceData.findMany();

  const [btcPriceData, stxPriceData] = await Promise.all([
    coinCapApi.fetchPriceData("bitcoin"),
    coinCapApi.fetchPriceData("stacks"),
  ]);

  const btcPriceFloat = parseFloat(btcPriceData.data.priceUsd);
  const stxPriceFloat = parseFloat(stxPriceData.data.priceUsd);

  // convert from micro-stx to stx ( / 10^6) then to usd ( * stxPriceFloat)
  const calculatePriceInUsd = (priceMicroStx: number) => (priceMicroStx / 10 ** 6) * stxPriceFloat;
  const calculatePriceInSats = (priceInUsd: number) => (priceInUsd / btcPriceFloat) * 10 ** 8;

  // update floorPrice (priceData.minPriceRate) and marketCap token.totalSupply * priceData.minPriceRate for all tokens
  const tokensToUpdate = await prisma.token.findMany({
    where: {
      ticker: {
        in: dbPriceData.map((pd) => pd.ticker),
      },
    },
    include: {
      listings: true,
      priceData: true,
    },
  });
  // get the amount of active listings for each token

  const tokenUpdateTxs: Prisma.TokenUpdateArgs[] = [];

  tokensToUpdate.forEach(async (token) => {
    const priceData = token.priceData;
    const activeListingsCount = token.listings.length;
    if (priceData) {
      const floorPrice = priceData.minPriceRate;
      const marketCapFloat = parseFloat(token.totalSupply.toString()) * floorPrice;
      const priceInUsd = calculatePriceInUsd(floorPrice);
      const priceInSats = calculatePriceInSats(priceInUsd);
      const marketCapInUsd = calculatePriceInUsd(marketCapFloat);
      const historicalPriceData = calculateAllHistoricalPriceData(token, priceData);

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
    return result;
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
const calculateAllHistoricalPriceData = (token: Token, priceData: PriceData) => {
  const now = new Date();
  const result: Record<string, number | Date> = {};

  INTERVALS.forEach((interval) => {
    const historicalDataResults = calculateHistoricalPriceData(token, priceData, interval, now);
    result[`floorPrice${interval}Change`] = historicalDataResults.change;
    if (historicalDataResults.value) {
      result[`floorPrice${interval}Value`] = historicalDataResults.value;
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
  change: number;
};

const calculateHistoricalPriceData = (token: Token, priceData: PriceData, interval: HistoricInterval, now: Date) => {
  const value = token[`floorPrice${interval}Value`];
  const date = token[`floorPrice${interval}Date`];
  const change = token[`floorPrice${interval}Change`];

  const result: calculateHistoricalPriceDataResult = {
    change: change,
  };

  // if minPriceRate is 0, return because there is no available market data
  if (!priceData.minPriceRate) {
    return result;
  }

  // CASE: initalize
  // if the value is null or undefined or 0, set it to the current floor price. (make sure current floor price is not 0)
  if (!value || value === 0) {
    result.value = priceData.minPriceRate;
    result.date = now;
    result.change = 0;
  } else {
    // CASE: update
    // if the value is not null or undefined, calculate the change and update the value and date if the interval has passed
    const change = ((priceData.minPriceRate - value) / value) * 100;

    // CASE: interval has passed
    if (now.getTime() - date.getTime() > INTERVAL_MILLISECONDS[interval]) {
      result.value = priceData.minPriceRate;
      result.date = now;
    }
  }

  return result;
};
