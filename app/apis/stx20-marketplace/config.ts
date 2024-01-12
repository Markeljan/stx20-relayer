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

type ListingDetailsApiResponse =
  | {
      data: Listing;
    }
  | { success: boolean; message: string };

class Stx20MarketplaceApi {
  private basePath: string;

  constructor() {
    this.basePath = "https://api-marketplace.stx20.com/api/v1/";
  }

  async fetchAllListings({ pendingTx }: { pendingTx: boolean }): Promise<ListingsApiResponse> {
    const response = await fetch(`${this.basePath}sell-requests/search?sort=created_asc&limit=10000`, {
      method: "POST",
      body: JSON.stringify({ pendingTx }),
    });
    const json = (await response.json()) as ListingsApiResponse;
    return json;
  }

  async fetchListingDetails(id: string): Promise<ListingDetailsApiResponse> {
    const response = await fetch(`${this.basePath}sell-request/${id}`);
    const json = (await response.json()) as ListingDetailsApiResponse;
    return json;
  }

  // Additional methods similar to Stx20Api can be added here as needed.
}

export const stx20MarketplaceApi = new Stx20MarketplaceApi();
