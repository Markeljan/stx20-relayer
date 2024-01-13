import express, { Request, Response } from "express";
import * as fs from "fs";
import path from "path";

import { PrismaClient } from "@prisma/client";
import RestApiHandler from "@zenstackhq/server/api/rest";

import ZenStackMiddlewarePkg from "@zenstackhq/server/express";
import cors from "cors";
import swaggerUI from "swagger-ui-express";
const { ZenStackMiddleware } = ZenStackMiddlewarePkg;

//////////////////////////////////////////////
/////////////// CONFIG ///////////////////////
//////////////////////////////////////////////

const app = express();
app.use(express.json({ limit: "2mb" }));
app.use(cors());

const prisma = new PrismaClient();

const apiHandler = RestApiHandler({ endpoint: "http://stx20-api.com/api" });

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

app.get(
  "/api/marketplace",
  // create a custom express.Handler to handle the request
  (req: any, res: any) => {
    // do something with the request
    res.send("Hello from /api/marketplace");
  }
);

//////////////////////////////////////////////
/////////////// Generated ////////////////////
//////////////////////////////////////////////

const __dirname = path.resolve();

// Vercel can't properly serve the Swagger UI CSS from its npm package, here we
// load it from a public location
const options = { customCssUrl: "https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.18.3/swagger-ui.css" };
const spec = JSON.parse(fs.readFileSync(path.join(__dirname, "../stx20-api.json"), "utf8"));

app.use("/api/docs", swaggerUI.serve, swaggerUI.setup(spec, options));

app.use(
  "/api",
  ZenStackMiddleware({
    getPrisma: () => prisma,
    handler: wrappedApiHandler,
  })
);

export default app;
