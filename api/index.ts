import express from "express";

import makeHandler from "@zenstackhq/server/api/rest";

import { PrismaClient } from "@prisma/client";
import cors from "cors";
import swaggerUI from "swagger-ui-express";
import openApiSpec from "../stx20-api.json";
const { ZenStackMiddleware } = require("@zenstackhq/server/express");
// const { PrismaClient } = require("@prisma/client");

//////////////////////////////////////////////
/////////////// CONFIG ///////////////////////
//////////////////////////////////////////////
const APP_DOMAIN = "https://stx20-api.com";
const app = express();
app.use(express.json({ limit: "2mb" }));
app.use(cors());

const prisma = new PrismaClient();

const apiHandler = makeHandler({ endpoint: `${APP_DOMAIN}/api` });

const wrappedApiHandler = async (req: any) => {
  try {
    // Call the original handler and wait for its response
    const response = await apiHandler(req);

    // Assuming the response data is in response.body
    if (response.body) {
      // Process the response to remove null values
      response.body = removeNulls(response.body);
      // if req is for /api/token append priceInSatoshis and priceInUsd to response
    }

    return response;
  } catch (error) {
    // Handle or rethrow the error as appropriate for your application
    console.error("Error in wrappedApiHandler: ", error);
    throw error;
  }
};

const removeNulls = (obj: any) => {
  Object.entries(obj).forEach(([key, val]) => {
    if (val && typeof val === "object") {
      removeNulls(val);
    } else if (val === null) {
      delete obj[key];
    }
  });
  return obj;
};
//////////////////////////////////////////////
/////////////// API //////////////////////////
//////////////////////////////////////////////

app.get("/", (req: any, res: any) => {
  res.send("Welcome to the STX20 API. Visit /api/docs for documentation");
});

//////////////////////////////////////////////
/////////////// Generated ////////////////////
//////////////////////////////////////////////

// Vercel can't properly serve the Swagger UI CSS from its npm package, here we
// load it from a public location

const options = { customCssUrl: "https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.18.3/swagger-ui.css" };

app.use("/api/docs", swaggerUI.serve, swaggerUI.setup(openApiSpec, options));

app.use(
  "/api",
  ZenStackMiddleware({
    getPrisma: () => prisma,
    handler: wrappedApiHandler,
  })
);

export default app;
