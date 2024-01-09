import { updateListings } from "./apis/stx20/update-listings";
import { updateTokens } from "./apis/stx20/update-tokens";
import { updateMarketplaceTokenTable } from "./tokens/update-marketplace-token-table";

const main = async () => {
  // update stx20 listings, tokens, and marketplace token table
  await updateListings();
  await updateTokens();
  await updateMarketplaceTokenTable();
};

// RUN MAIN
await main();

console.log("Listening for new blocks...");
