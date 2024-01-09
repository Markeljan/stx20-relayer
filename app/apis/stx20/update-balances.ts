import { Prisma, PrismaClient } from "@prisma/client";
import { stx20Api } from "./config";
const prisma = new PrismaClient();

export const updateBalances = async (_transactions?: Prisma.TransactionCreateInput[]) => {
  // get unique addresses from transaction table
  const uniqueAddresses = new Set<string>();

  const transactions =
    _transactions ??
    (await prisma.transaction.findMany({
      select: {
        sender: true,
        recipient: true,
      },
    }));

  transactions.forEach((t) => {
    if (t.sender) uniqueAddresses.add(t.sender);
    if (t.recipient) uniqueAddresses.add(t.recipient);
  });

  const addresses = Array.from(uniqueAddresses);

  // fetch balances from indexer
  const { data: balances } = await stx20Api.fetchManyBalances(addresses);

  // upsert balance updates / inserts
  const balancesToUpsert: Prisma.BalanceUpsertArgs[] = [];

  balances.forEach((balance) => {
    balance.balances.forEach((b) => {
      balancesToUpsert.push({
        where: {
          ticker_address: {
            ticker: b.ticker,
            address: balance.address,
          },
        },
        create: {
          address: balance.address,
          ticker: b.ticker,
          balance: string,
        },
        update: {
          balance: b.balance,
        },
      });
    });
  });

  try {
    // Execute all upsert operations concurrently
    const result = await prisma.$transaction(balancesToUpsert.map((b) => prisma.balance.upsert(b)));
    console.log("Balances updated:", result);
  } catch (error) {
    console.error("An error occurred while updating balances:", error);
    throw error;
  }
};
