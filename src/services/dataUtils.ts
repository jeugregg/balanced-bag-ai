import { TokenData } from "../App";

export function findIndexBySymbol(data: TokenData[], symbol_search: string): number {
  for (let i = 0; i < data.length; i++) {
    if (data[i].symbol === symbol_search) {
      return i;
    }
  }
  return -1;
}

export function getMarketTokenSymbol(tokens: TokenData[] | null = null): string[] {
  if (tokens === null) {
    tokens = loadTokens();
  }
  return tokens.map(token => token.symbol);
}

export function getMarketTokenAddress(tokens: TokenData[] | null = null): Record<string, string> {
  if (tokens === null) {
    tokens = loadTokens();
  }
  return tokens.reduce((acc, token) => ({ ...acc, [token.symbol]: token.address }), {});
}

export function getAptosMarketTokenAddress(tokens: any = null): Record<string, string> {
  if (tokens === null) {
    tokens = loadAptosTokens();
  }
  // tokens is an object, not an array. Convert to array if needed.
  // If tokens is an object like { BTC: { address: ... }, ETH: { address: ... } }
  // then map over Object.entries
  if (!Array.isArray(tokens)) {
    return Object.entries(tokens).reduce((acc, [symbol, tokenObj]) => {
      acc[symbol] = tokenObj.address;
      return acc;
    }, {} as Record<string, string>);
  }
  // fallback for array format
  return tokens.reduce((acc: Record<string, string>, token: any) => ({ ...acc, [token.symbol]: token.address }), {});
}
export function getMarketTokenPrice(tokens: TokenData[] | null = null): Record<string, number> {
  if (tokens === null) {
    tokens = loadTokens();
  }
  return tokens.reduce((acc, token) => ({ ...acc, [token.symbol]: token.market.currentPrice }), {});
}

export function getAptosMarketTokenPrice(tokens: any = null): Record<string, number> {
  if (tokens === null) {
    tokens = loadAptosTokens();
  }
  // If tokens is an object (not array), convert to array of values
  if (!Array.isArray(tokens)) {
    return Object.entries(tokens).reduce((acc, [symbol, tokenObj]) => {
      acc[symbol] = tokenObj.currentPrice;
      return acc;
    }, {} as Record<string, number>);
  }
  // fallback for array format
  return tokens.reduce((acc: Record<string, number>, token: any) => ({ ...acc, [token.symbol]: token.market.currentPrice }), {});
}

export function extractPrices(data: TokenData[], tokenSymbol: string): number[] {
  if (!data || data.length === 0) return [];
  const tokenData = data.find(token => token.symbol === tokenSymbol);
  if (!tokenData || !tokenData.linePriceFeedInUsd) return [];
  return tokenData.linePriceFeedInUsd.map(priceData => priceData.value);
}

export function extractAptosPrices(data: TokenData[], tokenSymbol: string): number[] {
  // Aptos version of extractPrices : example : 
  //  data : { token1: {...linePriceFeedInUsd: [{date: ..., value: ...,} ...]
  //  token2: {...linePriceFeedInUsd: [{date: ..., value: ...,} ...]
  //  ...
  //  }
  // return value array of prices for the tokenSymbol
  if (!data || data.length === 0) return [];
  return data[tokenSymbol].linePriceFeedInUsd.map(priceData => priceData.value);
}
export function loadTokens(): TokenData[] {
  const storedTokens = localStorage.getItem('starknetTokens');
  return JSON.parse(storedTokens || "[]");
}

export function loadAptosTokens(): TokenData[] {
  const storedTokens = localStorage.getItem('aptosTokens');
  return JSON.parse(storedTokens || "[]");
}

export function getMarketTokenMcap(tokens: TokenData[] | null = null): Record<string, number> {
  if (tokens === null) {
    tokens = loadTokens();
  }
  return tokens.reduce((acc, token) => ({
    ...acc,
    [token.symbol]: token.market.marketCap === 0 ? token.market.starknetTvl : token.market.marketCap
  }), {});
}
export function getAptosMarketTokenMcap(tokens: any = null): Record<string, number> {
  if (tokens === null) {
    tokens = loadAptosTokens();
  }
  // If tokens is an object (not array), convert to array of values
  if (!Array.isArray(tokens)) {
    return Object.entries(tokens).reduce((acc, [symbol, tokenObj]) => {
      acc[symbol] = tokenObj.marketCap === 0 ? tokenObj.tvl : tokenObj.marketCap;
      return acc;
    }, {} as Record<string, number>);
  }
  // fallback for array format
  return tokens.reduce((acc: Record<string, number>, token: any) => ({
    ...acc,
    [token.symbol]: token.market.marketCap === 0 ? token.market.tvl : token.market.marketCap
  }), {});
}

export function filterNonStableTokens(tokens: TokenData[]): TokenData[] {
  const stablecoinSymbols = ['USDT', 'USDC', 'DAI', 'BUSD', 'TUSD', 'UST', 'FRAX', 'GUSD', 'PAX', 'HUSD'];
  // filter token list to exclude stablecoins with this format of token : 
  // tokens = { USDT: token_data_1, BTC: token_data_2, ... }
  return Object.fromEntries(
    Object.entries(tokens).filter(([symbol]) => !stablecoinSymbols.includes(symbol))
  );
}

export function filterTokens(tokens: TokenData[], listReducedTokensInput: string[] | null = null): TokenData[] {
  if (listReducedTokensInput) {
    return tokens.filter(token =>
      listReducedTokensInput.includes(token.symbol) &&
      !listReducedTokensInput.some(reducedToken => token.symbol !== reducedToken && token.symbol.includes(reducedToken))
    );
  }
  const listReducedTokensString = localStorage.getItem('listReducedTokens');
  if (listReducedTokensString) {
    const listReducedTokens = JSON.parse(listReducedTokensString);
    return tokens.filter(token =>
      listReducedTokens.includes(token.symbol) &&
      !listReducedTokens.some(reducedToken => token.symbol !== reducedToken && token.symbol.includes(reducedToken))
    );
  }
  return tokens;
}

export function removeTokensWithSuffix(tokens: string[], suffix: string): string[] {
  return tokens.filter(token => !token.endsWith(suffix) || token === suffix);
}

export function calculateCryptoDelta(currentWallet: Record<string, number>, targetWallet: Record<string, number>): Record<string, number> {
  const deltaTransactions: Record<string, number> = {};
  const allTokens = new Set([...Object.keys(currentWallet), ...Object.keys(targetWallet)]);
  for (const token of allTokens) {
    const targetAmount = targetWallet[token] || 0;
    const currentAmount = currentWallet[token] || 0;
    deltaTransactions[token] = targetAmount - currentAmount;
  }
  return deltaTransactions;
}

export function calculateCryptoSwap(deltaTransactions: Record<string, number>): any[] {
  const swaps = [];
  const deltaArray = Object.entries(deltaTransactions).map(([token, amount]) => ({ token, amount }));
  while (deltaArray.some(({ amount }) => Math.abs(amount) > 1)) {
    deltaArray.sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
    const biggestSell = deltaArray.find(({ amount }) => amount < 0);
    const biggestBuy = deltaArray.find(({ amount }) => amount > 0);
    if (!biggestSell || !biggestBuy) break;
    const swapAmount = Math.min(Math.abs(biggestSell.amount), biggestBuy.amount);
    swaps.push({
      sell: biggestSell.token,
      buy: biggestBuy.token,
      amount: Math.max(0, swapAmount - 0.1),
    });
    biggestSell.amount += swapAmount;
    biggestBuy.amount -= swapAmount;
  }
  return swaps;
}

export function extractBrianBalances(brianBalance: any): Record<string, number> | 0 {
  if (!brianBalance || brianBalance.length === 0) return 0;
  const extractedParams = brianBalance["extractedParams"];
  if (!extractedParams) return 0;
  if (
    extractedParams.action === "balance" &&
    extractedParams.chain === "Starknet"
  ) {
    const token = brianBalance["extractedParams"]["token1"];
    const balance = parseFloat(brianBalance["data"]["formattedValue"]);
    return { [token]: balance };
  }
  return 0;
}

export function extractAllBrianBalances(brianBalances: any[]): Record<string, number>[] | 0 {
  if (!brianBalances || brianBalances.length === 0) return 0;
  const extractedBalances = [];
  for (const brianBalance of brianBalances) {
    const balance = extractBrianBalances(brianBalance);
    if (balance !== 0) {
      extractedBalances.push(balance);
    }
  }
  return extractedBalances;
}

export function calculateEMA7HourlyAndMaxStdDev(prices: number[]): { ema: number, maxStdDev: number } {
  let length = prices.length;
  if (length < 168) {
    if (length < 1) throw new Error("EMA7 need more longer prices history");
  }
  const multiplier = 2 / (length + 1);
  let ema = prices[length - 1];
  let lastWeekEMAs = [ema];
  for (let i = length - 2; i >= 0; i--) {
    ema = prices[i] * multiplier + ema * (1 - multiplier);
    lastWeekEMAs.unshift(ema);
    if (lastWeekEMAs.length > 168) lastWeekEMAs.pop();
  }
  const meanEMA = lastWeekEMAs.reduce((sum, value) => sum + value, 0) / length;
  const maxStdDev = Math.sqrt(Math.max(...lastWeekEMAs.map(value => Math.pow(value - meanEMA, 2)))) / meanEMA * 100;
  return { ema, maxStdDev };
}

export const reduceTokenList = (tokens: TokenData[]): string[] => {
  const uniqueTokens: Record<string, TokenData> = {};
  for (const token of tokens) {
    const symbol = token.symbol;
    for (let i = 0; i <= symbol.length - 3; i++) {
      const shortSymbol = symbol.slice(i, i + 3);
      if (!uniqueTokens[shortSymbol] || symbol.length < uniqueTokens[shortSymbol].length) {
        uniqueTokens[shortSymbol] = token;
      }
    }
  }
  const filteredTokens = Object.values(uniqueTokens);
  return filteredTokens.map((token) => token.symbol);
};
