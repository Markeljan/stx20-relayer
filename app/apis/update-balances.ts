import { Prisma, PrismaClient } from "@prisma/client/edge";
import { stx20Api } from "./api-stx20";
const prisma = new PrismaClient();

export const updateBalances = async () => {
  // get unique addresses TBD where to get them from
  const uniqueAddresses = new Set<string>();

  // fetch balances form api
  const { data: balances } = await stx20Api.fetchManyBalances(Array.from(uniqueAddresses));

  // prepare balances for upsert
  const balancesToUpsert: Prisma.BalanceUpsertArgs[] = [];

  balances.forEach((balance) => {
    balance.balances.forEach((b) => {
      balancesToUpsert.push({
        where: {
          address_ticker: {
            address: balance.address,
            ticker: b.ticker,
          },
        },
        create: {
          address: balance.address,
          ticker: b.ticker,
          balance: b.balance,
          updateDate: b.updateDate,
        },
        update: {
          balance: b.balance,
          updateDate: b.updateDate,
        },
      });
    });
  });

  if (balancesToUpsert.length === 0) {
    console.log("No balances need updates.");
    return balances;
  }

  try {
    // Execute all upsert operations concurrently
    const result = await prisma.$transaction(balancesToUpsert.map((b) => prisma.balance.upsert(b)));
    console.log("Balances updated:", result);
    return result;
  } catch (error) {
    console.error("An error occurred while updating balances:", error);
    throw error;
  }
};
