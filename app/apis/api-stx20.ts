import { Token } from "@prisma/client";

type TokensApiResponse = {
  page: number;
  limit: number;
  total: number;
  data: Token[];
};

type TokenDetailsApiResponse =
  | {
      data: Token[];
    }
  | { success: boolean; message: string };

type Balance = {
  ticker: string;
  balance: string;
  updateDate: string;
};
type BalanceApiResponse = {
  address: string;
  balances: Balance[];
};

type ManyBalancesApiResponse = {
  data: BalanceApiResponse[];
};

class Stx20Api {
  private basePath: string;

  constructor() {
    this.basePath = "https://api.stx20.com/api/v1/";
  }

  async fetchAllTokens(): Promise<TokensApiResponse> {
    const tokens: Token[] = [];
    while (true) {
      const page = tokens.length / 200;
      const { data: tokensResponse, total } = await this.fetchManyTokens(page);
      tokens.push(...tokensResponse);
      if (tokens.length >= total) break;
    }
    return { page: 1, limit: 10000, total: tokens.length, data: tokens };
  }

  async fetchManyTokens(page: number): Promise<TokensApiResponse> {
    const response = await fetch(`${this.basePath}token?page=${page}&limit=200`);
    const json = (await response.json()) as TokensApiResponse;
    return json;
  }

  async fetchToken(ticker: string): Promise<TokenDetailsApiResponse> {
    const response = await fetch(`${this.basePath}token/${ticker}`);
    const json = (await response.json()) as TokenDetailsApiResponse;
    return json;
  }

  async fetchBalances(address: string): Promise<BalanceApiResponse> {
    const response = await fetch(`${this.basePath}balance/${address}`);
    const json = (await response.json()) as BalanceApiResponse;
    return json;
  }

  async fetchManyBalances(addresses: string[]): Promise<ManyBalancesApiResponse> {
    // recursively fetch balances for each address one by one in a promise all
    const promises = addresses.map((addresses) => this.fetchBalances(addresses));
    const balances = await Promise.all(promises);
    return { data: balances };
  }
}

export const stx20Api = new Stx20Api();
