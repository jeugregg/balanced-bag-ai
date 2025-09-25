import { BrianSDK } from "@brian-ai/sdk";
import { TokenData } from "../App";

const cgApiKey = import.meta.env.VITE_CG_API_KEY as string;

export async function getMarket(): Promise<TokenData[] | null> {
  const response = await fetch('https://starknet.impulse.avnu.fi/v1/tokens', {
    method: 'GET',
    headers: {},
  });
  const data = await response.json();
  if (typeof data === 'object') {
    try {
      // patch "8"
      const index_8 = data.findIndex((token: TokenData) => token.symbol === "\b8");
      if (index_8 != -1) {
        data[index_8].symbol = "8";
      }
      // patch "SCHIZODIO "
      const index_SCHIZODIO = data.findIndex((token: TokenData) => token.symbol === "SCHIZODIO ");
      if (index_SCHIZODIO != -1) {
        data[index_SCHIZODIO].symbol = "SCHIZODIO";
        data[index_SCHIZODIO].name = "SCHIZODIO";
      }
      // WBTC : get BTC Mcap
      const url = 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_market_cap=true';
      const options = {
        method: 'GET',
        headers: { accept: 'application/json', 'x-cg-demo-api-key': cgApiKey }
      };
      const res_cg = await fetch(url, options);
      const data_cg = await res_cg.json();
      const index_WBTC = data.findIndex((token: TokenData) => token.symbol === "WBTC");
      if (index_WBTC != -1) {
        data[index_WBTC]["market"]["marketCap"] = data_cg["bitcoin"]["usd_market_cap"];
      }
      localStorage.setItem('starknetTokens', JSON.stringify(data));
      return data;
    } catch (error) {
      console.error('Error saving Starknet tokens to localStorage:', error);
    }
  } else {
    console.error('Invalid JSON data received from API.');
  }
  return null;
}

export async function askReduceList(brian: BrianSDK): Promise<string[]> {
  const tokens = JSON.parse(localStorage.getItem('starknetTokens') || "[]");
  const symbols = tokens.map((token: TokenData) => token.symbol);
  let prompt = `From this list of assets on Starknet and particularly on app.avnu.fi : '${symbols.join("', '")}`;
  prompt += "' extract a new list by removing stablecoins when you are sure that it is a stablecoin. Don't explain your answer, just write the new list"
  const result = await brian.ask({
    prompt: prompt,
    kb: "public-knowledge-box",
  });
  prompt = "From this list of assets on Starknet and particularly on app.avnu.fi :";
  prompt += result["answer"];
  prompt += ", extract a new list by removing liquid staking tokens only when you are sure that it is a liquid staking token.";
  prompt += " Don't explain your answer, just write the new list"
  const result_lst = await brian.ask({
    prompt: prompt,
    kb: "public-knowledge-box",
  });
  let listReducedTokens: string[] = [];
  for (const symbol of symbols) {
    if (result_lst["answer"].includes(`'${symbol}'`)) {
      listReducedTokens.push(symbol);
    }
  }
  // remove tokens with STRK suffix
  listReducedTokens = listReducedTokens.filter(token => !token.endsWith("STRK") || token === "STRK");
  localStorage.setItem('listReducedTokens', JSON.stringify(listReducedTokens));
  return listReducedTokens;
}
