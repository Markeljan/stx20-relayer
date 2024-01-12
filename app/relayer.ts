import { connectWebSocketClient } from "@stacks/blockchain-api-client";
import { updateListings } from "./apis/stx20-marketplace/update-listings";
import { updateTokens } from "./apis/stx20/update-tokens";

const stackClient = await connectWebSocketClient();

const main = async () => {
  // update stx20 listings, tokens, and marketplace token table
  await updateTokens();
  await updateListings();
};

// RUN MAIN
await main();

// listen for new blocks
stackClient.subscribeBlocks((block) => {
  console.log("New block:", block.height);
  // add a 10 second delay to allow for indexing
  console.log("Waiting 10 seconds for indexing...");
  setTimeout(async () => {
    await main();
  }, 10000);

  main();
  console.log("Listening for new blocks...");
});

console.log("Listening for new blocks...");
