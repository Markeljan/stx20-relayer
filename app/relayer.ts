import { connectWebSocketClient } from "@stacks/blockchain-api-client";
import { updateListings } from "./apis/update-listings";
import { updateTokens } from "./apis/update-tokens";

const stackClient = await connectWebSocketClient();

const main = async () => {
  // update stx20 listings, tokens, and marketplace token table
  await updateTokens();
  await updateListings();
};

// Update tokens and listings on startup
await main();

// listen for new blocks
stackClient.subscribeBlocks((block) => {
  console.log("New block:", block.height);
  // add a 10 second delay to allow for indexing
  console.log("Waiting 10 seconds for indexing...");
  setTimeout(async () => {
    await main();
    console.log("Listening for new blocks...");
  }, 10000);
});

console.log("Listening for new blocks...");
