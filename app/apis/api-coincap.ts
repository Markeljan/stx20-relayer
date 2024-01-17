type TokenPriceData = {
  id: string;
  rank: string;
  symbol: string;
  name: string;
  supply: string;
  maxSupply: string;
  marketCapUsd: string;
  volumeUsd24Hr: string;
  priceUsd: string;
  changePercent24Hr: string;
  vwap24Hr: string;
  explorer: string;
};

export type CoinCapResponse = {
  data: TokenPriceData;
  timestamp: number;
};

class CoincapApi {
  private basePath: string;
  private apiKey: string;

  constructor() {
    this.basePath = "https://api.coincap.io/v2/assets/";
    this.apiKey = `${process.env.COINCAP_API_KEY}`;
  }

  async fetchPriceData(ticker: string): Promise<CoinCapResponse> {
    const response = await fetch(`${this.basePath}${ticker}`, {
      headers: { Authorization: `Bearer ${this.apiKey}` },
    });
    const json = (await response.json()) as CoinCapResponse;
    return json;
  }
}

export const coinCapApi = new CoincapApi();
