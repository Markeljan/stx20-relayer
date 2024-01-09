import { HttpsProxyAgent } from "https-proxy-agent";
import fetch, { RequestInfo, RequestInit, Response } from "node-fetch";

const proxies = [
  "http://162.243.184.21:10005",
  "http://38.45.65.94:37289",
  "http://20.79.103.91:80",
  "http://104.143.10.175:3128",
  "http://38.45.65.241:37289",
  "http://162.19.7.49:35406",
];

export async function proxyFetch(url: URL | RequestInfo, init?: RequestInit): Promise<Response> {
  const proxyUrl = proxies[Math.floor(Math.random() * proxies.length)];
  const proxyAgent = new HttpsProxyAgent(proxyUrl);
  const response = fetch(url, { agent: proxyAgent, ...init });
  return response;
}
