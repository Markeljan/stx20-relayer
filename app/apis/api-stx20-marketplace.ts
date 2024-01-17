import { Listing } from "@prisma/client";

type MarketplaceListing = Omit<Listing, "id, v"> & { _id: string; __v: number };

type Pagination = {
  page: number;
  limit: number;
  count: number;
};
type ListingsApiResponse = {
  success: boolean;
  data: MarketplaceListing[];
  pagination: Pagination;
};

type FloorPriceApiResponse = {
  success: boolean;
  data: {
    minPriceRate: number;
    maxPriceRate: number;
    medianPriceRate: number;
    meanPriceRate: number;
    medianMinPriceRate: number;
    medianMaxPriceRate: number;
  };
};

class Stx20MarketplaceApi {
  private basePath: string;

  constructor() {
    this.basePath = "https://api-marketplace.stx20.com/api/v1/";
  }

  async fetchAllListings({ pendingTx }: { pendingTx: boolean }): Promise<ListingsApiResponse> {
    const response = await fetch(`${this.basePath}sell-requests/search?sort=created_asc&limit=10000`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        pendingTx,
      }),
    });
    const json = (await response.json()) as ListingsApiResponse;
    return json;
  }

  async fetchTokenFloorPrice(ticker: string): Promise<FloorPriceApiResponse> {
    const response = await fetch(`${this.basePath}sell-requests/floor-price/${ticker}`);
    const json = (await response.json()) as FloorPriceApiResponse;
    return json;
  }
}

export const stx20MarketplaceApi = new Stx20MarketplaceApi();
