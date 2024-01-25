import express, { Express, NextFunction, Request, Response } from "express";

import makeHandler from "@zenstackhq/server/api/rest";

import { PrismaClient } from "@prisma/client";
import { RequestContext } from "@zenstackhq/server/api/base";
import cors from "cors";
import swaggerUI from "swagger-ui-express";
import openApiSpec from "../stx20-api.json";
const { ZenStackMiddleware } = require("@zenstackhq/server/express");

//////////////////////////////////////////////
/////////////// CONFIG ///////////////////////
//////////////////////////////////////////////
const APP_DOMAIN = "https://stx20-api.com";
const BITFLOW_API_KEY = process.env.BITFLOW_API_KEY;
const DEV_API_KEY = process.env.DEV_API_KEY;

const prisma = new PrismaClient();

const app: Express = express();

// dynamically set cors options based on the api key.  Public api key is only allowed to be called from the app.bitflow.finance domain
const dynamicCors = (req: Request, callback: any) => {
  const apiKey = req.headers["x-api-key"] as string;
  console.log("received request with api key: ", apiKey);
  console.log("Comparing to dev api key: ", DEV_API_KEY);
  console.log("Comparing to bitflow api key: ", BITFLOW_API_KEY);
  let corsOptions;

  if (apiKey === DEV_API_KEY) {
    corsOptions = { origin: true }; // Allow any origin for private API key
  } else if (apiKey === BITFLOW_API_KEY) {
    corsOptions = { origin: "https://app.bitflow.finance" }; // Allow only specific origin for public API key
  } else {
    corsOptions = { origin: false }; // Disallow CORS for other cases
  }

  callback(null, corsOptions);
};

const apiKeyAuthMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const apiKey = req.headers["x-api-key"] as string;
  if (!apiKey) {
    return res.status(401).send({ error: "No API key provided" });
  } else if (apiKey !== BITFLOW_API_KEY && apiKey !== DEV_API_KEY) {
    return res.status(401).send({ error: "Invalid API key" });
  }
  // If valid, proceed to the next middleware
  next();
};

const apiHandler = makeHandler({ endpoint: `${APP_DOMAIN}/api` });

const wrappedApiHandler = async (req: RequestContext) => {
  // prevent any method other than GET from being called.
  if (req.method !== "GET") {
    return {
      statusCode: 405,
      body: {
        error: "Method not allowed.  This is a read-only API.",
      },
    };
  }
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
/////////////// Generated ////////////////////
//////////////////////////////////////////////

// Vercel can't properly serve the Swagger UI CSS from its npm package, here we
// load it from a public location
const swaggerOptions = { customCssUrl: "https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.3.0/swagger-ui.min.css" };

// Set up the middleware
app.use(express.json({ limit: "2mb" }));
app.use(cors(dynamicCors));
app.use("/api", apiKeyAuthMiddleware);
app.use("/api/docs", swaggerUI.serve, swaggerUI.setup(openApiSpec, swaggerOptions));
app.use(
  "/api",
  ZenStackMiddleware({
    getPrisma: () => prisma,
    handler: wrappedApiHandler,
  })
);

export default app;
