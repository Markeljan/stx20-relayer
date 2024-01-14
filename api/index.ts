import express from "express";

import makeHandler from "@zenstackhq/server/api/rest";

import cors from "cors";
import swaggerUI from "swagger-ui-express";
const { ZenStackMiddleware } = require("@zenstackhq/server/express");
const { PrismaClient } = require("@prisma/client");
const openApiSpec = require("/stx20-api.json");
//////////////////////////////////////////////
/////////////// CONFIG ///////////////////////
//////////////////////////////////////////////

const app = express();
app.use(express.json({ limit: "2mb" }));
app.use(cors());

const prisma = new PrismaClient();

const apiHandler = makeHandler({ endpoint: "http://stx20api.vercel.app/api" });

const wrappedApiHandler = async (req: any) => {
  try {
    // Call the original handler and wait for its response
    const response = await apiHandler(req);

    // Assuming the response data is in response.body
    if (response && response.body) {
      // Process the response to remove null values
      response.body = removeNulls(response.body);
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
const options = { customCssUrl: "/swagger.css" };

app.use("/api/docs", swaggerUI.serve, swaggerUI.setup(openApiSpec, options));

app.use(
  "/api",
  ZenStackMiddleware({
    getPrisma: () => prisma,
    handler: wrappedApiHandler,
  })
);

export default app;
