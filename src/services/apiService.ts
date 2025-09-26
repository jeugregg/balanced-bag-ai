import { Contract, uint256, RpcProvider } from "starknet";
import { BrianSDK } from "@brian-ai/sdk";
import { initHyperionSDK } from '@hyperionxyz/sdk'
import { Network } from "@aptos-labs/ts-sdk";
import {
  getMarketTokenAddress,
  getMarketTokenPrice,
  calculateCryptoDelta,
  calculateCryptoSwap,
  extractAllBrianBalances,
  filterTokens,
  extractPrices,
  getMarketTokenMcap,
  calculateEMA7HourlyAndMaxStdDev,
  loadTokens,
} from "./dataUtils";
import { TokenData, BalanceItem, InvestmentBreakdown, Swap } from "../App";
//import { Network } from "@aptos-labs/wallet-adapter-react";

const cgApiKey = import.meta.env.VITE_CG_API_KEY as string;
const rcpApiKey = import.meta.env.VITE_RCP_API_KEY as string;
const aptosApiKey = import.meta.env.VITE_APTOS_API_KEY as string;
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

export async function fetchBalances(
  walletAddress: string | null,
  myWalletAccount: any,
  setWalletBalances: (balances: BalanceItem[]) => void,
  setBalances: (balances: BalanceItem[]) => void,
  setTotalWalletValue: (value: number) => void,
  setInvestmentAmount: (value: string) => void,
  setIsLoading: (loading: boolean) => void,
  setLoadingToken: (token: string | null) => void,
  setErrorWithTimeout: (msg: string) => void
) {
  if (walletAddress && myWalletAccount) {
    let newBalances: Record<string, number> = {};
    //const provider = new RpcProvider({ nodeUrl: "https://rpc.nethermind.io/mainnet-juno" });
    const provider = new RpcProvider({ nodeUrl: "https://rpc.nethermind.io/mainnet-juno", headers: { 'x-apikey': rcpApiKey } }); // Create RpcProvider
    const tokenAddresses = getMarketTokenAddress();
    const tokenPrices = getMarketTokenPrice();
    try {
      for (const token in tokenAddresses) {
        setLoadingToken(token);
        try {
          const { abi } = await provider.getClassAt(tokenAddresses[token]);
          const contract = new Contract(abi, tokenAddresses[token], myWalletAccount);
          const balanceResponse = await contract.balanceOf(walletAddress);
          const decimalsResponse = await contract.decimals();
          if (balanceResponse && decimalsResponse) {
            const balance = uint256.uint256ToBN(balanceResponse).toString();
            const decimals = parseInt(decimalsResponse, 10);
            const adjustedBalance = (balance / 10 ** decimals).toFixed(5);
            newBalances[token] = Number(adjustedBalance);
          } else {
            newBalances[token] = 0;
          }
        } catch (err: any) {
          setErrorWithTimeout(err.message);
        }
      }
    } catch (err: any) {
      setErrorWithTimeout(err.message);
    } finally {
      setIsLoading(false);
    }
    const filteredBalances = Object.fromEntries(
      Object.entries(newBalances).filter(([token, balance]) => balance !== 0)
    );
    let filteredPrices: Record<string, number> = {};
    for (const token in filteredBalances) {
      filteredPrices[token] = tokenPrices[token];
    }
    let mixedBalances: BalanceItem[] = [];
    for (const token in filteredBalances) {
      mixedBalances.push({
        token,
        balance: filteredBalances[token],
        price: filteredPrices[token],
        total: filteredBalances[token] * filteredPrices[token],
      });
    }
    setWalletBalances(mixedBalances);
    for (const token in mixedBalances) {
      if (mixedBalances[token].token === "ETH") {
        mixedBalances[token].balance -= 2 / mixedBalances[token].price;
        mixedBalances[token].total -= 2;
      }
    }
    setBalances(mixedBalances);
    const totalWalletValue = mixedBalances.reduce((sum, item) => sum + parseFloat(item.total), 0);
    setTotalWalletValue(totalWalletValue);
    setInvestmentAmount(totalWalletValue.toFixed(5));
  }
}

export async function fetchBalancesWithBrian(
  walletAddress: string | null,
  myWalletAccount: any,
  setBalancesWithBrian: (balances: Record<string, number>[] | null) => void,
  setErrorWithTimeout: (msg: string) => void
) {
  if (walletAddress && myWalletAccount) {
    const tokenSymbols = getMarketTokenAddress();
    let str_prompt_tokens = "Get wallet balance in ";
    for (const token in tokenSymbols) {
      str_prompt_tokens += tokenSymbols[token] + ", ";
    }
    str_prompt_tokens += "on Starknet";
    try {
      const brian = new BrianSDK({ apiKey: import.meta.env.VITE_BRIAN_API_KEY });
      const brianBalances = await brian.transact({
        prompt: str_prompt_tokens,
        address: walletAddress,
      });
      const newBrianBalances = extractAllBrianBalances(brianBalances);
      setBalancesWithBrian(newBrianBalances);
    } catch (err: any) {
      setErrorWithTimeout(err.message);
    }
  }
}

export function handleSwapPrepare(
  balances: BalanceItem[],
  investmentBreakdown: InvestmentBreakdown,
  setSwapsToPrepare: (swaps: Swap[]) => void
) {
  const currentWallet = balances.reduce((acc, item) => ({ ...acc, [item.token]: parseFloat(item.total) }), {});
  const targetWallet: Record<string, number> = {};
  for (const token in investmentBreakdown) {
    targetWallet[token] = parseFloat(investmentBreakdown[token].amount);
  }
  const swapAmounts = calculateCryptoDelta(currentWallet, targetWallet);
  const swaps = calculateCryptoSwap(swapAmounts);
  setSwapsToPrepare(swaps);
}

export async function handlePrepareSwapTransactions(
  swapsToPrepare: Swap[],
  setSwapStatuses: (statuses: string[]) => void,
  setTransactionsCompleted: (completed: boolean) => void,
  brian: BrianSDK,
  walletAddress: string | null,
  myWalletAccount: any,
  setErrorWithTimeout: (msg: string) => void
) {
  setTransactionsCompleted(false);
  const newSwapStatuses = swapsToPrepare.map(() => 'pending');
  setSwapStatuses(newSwapStatuses);

  let allTransactionsSuccessful = true;
  for (let i = 0; i < swapsToPrepare.length; i++) {
    newSwapStatuses[i] = 'loading';
    setSwapStatuses([...newSwapStatuses]);
    const swap = swapsToPrepare[i];
    const prompt = `Swap $${swap.amount.toFixed(2)} worth of '${swap.sell}' to '${swap.buy}' on Starknet`;
    try {
      const brianResponse = await brian.transact({
        prompt: prompt,
        address: walletAddress,
      });
      if ((Number(brianResponse[0]["data"]["toAmountUSD"]) - Number(brianResponse[0]["data"]["fromAmountUSD"])) / Number(brianResponse[0]["data"]["fromAmountUSD"]) < -0.01) {
        setErrorWithTimeout(`Price Impact too high preparing swap for ${swap.sell} to ${swap.buy}`);
        newSwapStatuses[i] = 'error';
        setSwapStatuses([...newSwapStatuses]);
        continue;
      }
      const extractedParams = brianResponse[0]["extractedParams"];
      if (
        extractedParams &&
        extractedParams.action === "swap" &&
        extractedParams.chain === "Starknet" &&
        extractedParams.token1 === swap.sell &&
        extractedParams.token2 === swap.buy
      ) {
        const txSteps = brianResponse[0]["data"]["steps"];
        const { transaction_hash: transferTxHash } = await myWalletAccount.execute(txSteps);
        await myWalletAccount.waitForTransaction(transferTxHash);
        newSwapStatuses[i] = 'success';
        setSwapStatuses([...newSwapStatuses]);
      } else {
        setErrorWithTimeout("Unexpected response from Brian. Please check the console.");
        newSwapStatuses[i] = 'error';
        setSwapStatuses([...newSwapStatuses]);
      }
    } catch (error: any) {
      setErrorWithTimeout(`Error preparing swap for ${swap.sell} to ${swap.buy}`);
      allTransactionsSuccessful = false;
      newSwapStatuses[i] = 'error';
      setSwapStatuses([...newSwapStatuses]);
    }
  }
  setTransactionsCompleted(allTransactionsSuccessful);
}

export function getInvestmentBreakdown(
  solution: string,
  amount: number
): InvestmentBreakdown | null {
  const tokensData = loadTokens();
  const goodTokensData = filterTokens(tokensData);
  let tokenMcaps = getMarketTokenMcap(goodTokensData);
  let sortedTokens = Object.keys(tokenMcaps).sort((a, b) => tokenMcaps[b] - tokenMcaps[a]);
  sortedTokens = sortedTokens.slice(0, 15);
  let sortedTokensData = filterTokens(goodTokensData, sortedTokens);
  const tokenPrices = getMarketTokenPrice(sortedTokensData);
  let tokenEMA7Hourly: Record<string, number> = {};
  let tokenMaxStdDev: Record<string, number> = {};
  for (const token of sortedTokens) {
    const tokenPriceHistory = extractPrices(sortedTokensData, token);
    try {
      const tokenEMA7HourlyAndMaxStdDev = calculateEMA7HourlyAndMaxStdDev(tokenPriceHistory);
      tokenEMA7Hourly[token] = tokenEMA7HourlyAndMaxStdDev.ema;
      tokenMaxStdDev[token] = tokenEMA7HourlyAndMaxStdDev.maxStdDev;
      if (tokenMaxStdDev[token] < 2) {
        if (tokenPrices[token] < 1.07 && tokenPrices[token] > 0.93) {
          delete tokenEMA7Hourly[token];
          delete tokenMaxStdDev[token];
          sortedTokens = sortedTokens.filter(t => t !== token);
        }
      }
    } catch (error) {
      return null;
    }
  }
  let k_alpha = 0.75;
  let k_mini = 0.03;
  let n_tokens = 10;
  if (solution === 'Secure') {
    k_alpha = 0.8;
    k_mini = 0.03;
    n_tokens = 5;
  } else if (solution === 'Offensive') {
    k_alpha = 0.5;
    k_mini = 0.03;
    n_tokens = 10;
  }
  sortedTokens = sortedTokens.slice(0, n_tokens);
  tokenEMA7Hourly = Object.fromEntries(sortedTokens.map(token => [token, tokenEMA7Hourly[token]]));
  tokenMaxStdDev = Object.fromEntries(sortedTokens.map(token => [token, tokenMaxStdDev[token]]));
  sortedTokensData = filterTokens(sortedTokensData, sortedTokens);
  const alpha = k_alpha * Math.log(k_mini) / (Math.log(tokenMcaps[sortedTokens.slice(-1)[0]] / tokenMcaps[sortedTokens.slice(0)[0]]));
  let tokenDistribution: Record<string, number> = {};
  for (const token in tokenEMA7Hourly) {
    tokenDistribution[token] = Math.pow(tokenMcaps[token] * tokenEMA7Hourly[token] / tokenPrices[token], alpha);
  }
  const totalDistribution = Object.values(tokenDistribution).reduce((total, value) => total + value, 0);
  for (const token in tokenEMA7Hourly) {
    tokenDistribution[token] = tokenDistribution[token] / totalDistribution;
  }
  let breakdown: InvestmentBreakdown = {};
  for (const token in tokenDistribution) {
    breakdown[token] = {
      amount: tokenDistribution[token] * amount,
      percentage: tokenDistribution[token] * 100,
    };
  }
  return breakdown;
}

export async function connectStarknetWallet(
  rcpApiKey: string,
  setWalletAddress: (address: string) => void,
  setMyWalletAccount: (account: any) => void,
  setErrorWithTimeout: (msg: string) => void,
  mode_debug: boolean,
  getMarket: () => Promise<any>,
  askReduceList: () => Promise<any>
) {
  try {
    const { connect } = await import('@starknet-io/get-starknet');
    const { WalletAccount } = await import("starknet");
    const selectedWalletSWO = await connect({ modalMode: "alwaysAsk", modalTheme: "light" });
    const newWalletAccount = new WalletAccount(
      {
        nodeUrl: "https://rpc.nethermind.io/mainnet-juno",
        headers: { 'x-apikey': rcpApiKey }
      },
      selectedWalletSWO
    );
    await newWalletAccount.requestAccounts();
    const walletAddress = newWalletAccount.address;
    setWalletAddress(walletAddress);
    setMyWalletAccount(newWalletAccount);
    if (!mode_debug) {
      const market = await getMarket();
      if (market == null) {
        setErrorWithTimeout("No price feed");
      }
    }
    await askReduceList();
  } catch (err: any) {
    setErrorWithTimeout(err.message);
  }
}

export async function connectAptosWallet(
  aptosWallet: any,
  availableWallets: any[],
  setShowAptosWalletMsg: (show: boolean) => void,
  setMyAptosWalletAccount: (account: any) => void,
  setWalletAddress: (address: string) => void,
  setErrorWithTimeout: (msg: string) => void
) {
    try {
        if (availableWallets.length === 0) {
            setShowAptosWalletMsg(true);
            return;
        }
        if (aptosWallet.connected === false) {
            try {
                await aptosWallet.connect("Petra");
            } catch (error: any) {
                setShowAptosWalletMsg(true);
                return;
            }

        }
        const walletAddress = aptosWallet.account.address.toString();

        /* const sdk = initHyperionSDK({
            network: Network.MAINNET, 
            APTOS_API_KEY: aptosApiKey
        });
        
        const poolItems = await sdk.Pool.fetchAllPools();
        console.log(poolItems)
        let marketAptos = {};
        const tokens_default = [
            {  
                name:"bitcoin",
                symbol:"WBTC"
            },
            {
                name:"ethereum",
                symbol:"WETH"
            },
            {
                name:"aptos",
                symbol:"APT"
            },
            {
                name:"solana",
                symbol:"SOL"
            },
            {
                name:"usd-coin",
                symbol:"USDC"
            },
            {
                name:"tether",
                symbol:"USDT"

            }
        ];
           
        //const tokens_symbols = ["WBTC", "WETH", "APT", "SOL", "USDC", "USDT"];

        for (const token of tokens_default) {
            const token_symbol = token["symbol"];
            const token_id = token["name"];
            const url = `https://api.coingecko.com/api/v3/simple/price?ids=${token_id}&vs_currencies=usd&include_market_cap=true`;
            const options = {
                method: 'GET',
                headers: { accept: 'application/json', 'x-cg-demo-api-key': cgApiKey }
            };
            const res_cg = await fetch(url, options);
            const data_cg = await res_cg.json();
            console.log(data_cg);
            const index_token = poolItems.findIndex((pool: any) => (pool.pool.token1Info.symbol === token_symbol) || (pool.pool.token2Info.symbol === token_symbol));
            console.log(index_token);

            if (index_token != -1) {
                const pools_token = poolItems.filter((pool: any) => (pool.pool.token1Info.symbol === token_symbol) || (pool.pool.token2Info.symbol === token_symbol));
                if (pools_token.length > 1) {
                    let tvlUSD = 0;
                    for (const pool of pools_token) {
                        tvlUSD += parseFloat(pool["tvlUSD"]);
                    }
                    if (tvlUSD > 50000) {
                        marketAptos[token_symbol] = {
                            currentPrice: data_cg[token_id]["usd"],
                            marketCap: data_cg[token_id]["usd_market_cap"],
                            aptosTvl: tvlUSD,
                        };
                    };
                };
                //poolItems[index_token]["market"]["marketCap"] = data_cg[token_id]["usd_market_cap"];
            }
        } */
        const marketAptos = await getMarketAptos();
        console.log(marketAptos);
        localStorage.setItem('aptosTokens', JSON.stringify(marketAptos));
        setMyAptosWalletAccount(aptosWallet);
        setWalletAddress(walletAddress);
    } catch (err: any) {
        setErrorWithTimeout(err.message);
    }
}

export async function getMarketAptos(): Promise<Record<string, any>> {
    const sdk = initHyperionSDK({
        network: Network.MAINNET, 
        APTOS_API_KEY: aptosApiKey
    });

    const poolItems = await sdk.Pool.fetchAllPools();
    let marketAptos: Record<string, any> = {};
    const tokens_default = [
        { name: "bitcoin", symbol: "WBTC", shortName: "BTC" },
        { name: "ethereum", symbol: "WETH", shortName: "ETH" },
        { name: "aptos", symbol: "APT", shortName: "APT" },
        { name: "solana", symbol: "SOL", shortName: "SOL" },
        { name: "usd-coin", symbol: "USDC", shortName: "USD" },
        { name: "tether", symbol: "USDT", shortName: "USD" }
    ];

    for (const token of tokens_default) {
        const token_symbol = token.symbol;
        const token_id = token.name;
        const url = `https://api.coingecko.com/api/v3/simple/price?ids=${token_id}&vs_currencies=usd&include_market_cap=true`;
        const options = {
            method: 'GET',
            headers: { accept: 'application/json', 'x-cg-demo-api-key': cgApiKey }
        };
        // pause for 1 second to avoid rate limit
        await new Promise(resolve => setTimeout(resolve, 1000));
        const res_cg = await fetch(url, options);
        const data_cg = await res_cg.json();
        const index_token = poolItems.findIndex((pool: any) => (pool.pool.token1Info.symbol === token_symbol) || (pool.pool.token2Info.symbol === token_symbol));
        if (index_token != -1) {
            const pools_token = poolItems.filter((pool: any) => (pool.pool.token1Info.symbol === token_symbol) || (pool.pool.token2Info.symbol === token_symbol));
            if (pools_token.length > 1) {
                let tvlUSD = 0;
                for (const pool of pools_token) {
                    tvlUSD += parseFloat(pool["tvlUSD"]);
                }
                if (tvlUSD > 50000) {
                    marketAptos[token_symbol] = {
                        currentPrice: data_cg[token_id]["usd"],
                        marketCap: data_cg[token_id]["usd_market_cap"],
                        aptosTvl: tvlUSD,
                    };
                }
            }
        }
    }

    // select low cap tokens in hyperion pools
    for (const pool of poolItems) {
        const token1 = pool.pool.token1Info;
        const token2 = pool.pool.token2Info;
        const tvlUSDpool = parseFloat(pool["tvlUSD"]);
        if (tvlUSDpool < 50000) {
            continue;
        }
        // skip all default tokens pools
        console.log("current pool", token1.symbol, token2.symbol);
        let isDefaultPool = false;
        let token1IsDefault = false;
        let token2IsDefault = false;
        for (const defaultToken of tokens_default) {
            // compare symbols case-insensitively
            if (token1.symbol.toLowerCase().includes(defaultToken.shortName.toLowerCase()) ) {
                token1IsDefault = true;
            }
            if (token2.symbol.toLowerCase().includes(defaultToken.shortName.toLowerCase()) ) {
                token2IsDefault = true;
            }
            if (token1IsDefault && token2IsDefault) {
                console.log("skip : default pool", token1.symbol, token2.symbol);
                isDefaultPool = true;
                break;
            }
        }
        if (isDefaultPool) {
            continue;
        }

        // check if either token is a low cap token
        if (marketAptos[token1.symbol] && marketAptos[token2.symbol]) {
                break;
        }
        
  
        // check if either token is a low cap token
        if (marketAptos[token1.symbol] && marketAptos[token2.symbol]) {
            console.log("skip : both tokens are default tokens", token1.symbol, token2.symbol);
            continue;
        }

        // if we reached this point, it means we have a valid pool
        // we can add it to the list of low cap pools
        const tokenToAdd = marketAptos[token1.symbol] ? token2 : token1;
        if (!marketAptos[tokenToAdd.symbol]) {
            const pools_token = poolItems.filter((pool: any) => (pool.pool.token1Info.symbol === tokenToAdd.symbol) || (pool.pool.token2Info.symbol === tokenToAdd.symbol));
            if (pools_token.length > 1) {
                    let tvlUSD = 0;
                    for (const pool of pools_token) {
                        tvlUSD += parseFloat(pool["tvlUSD"]);
                }
                // TODO : fetch price and market cap from coingecko
                console.log("OK : add low cap token", tokenToAdd.symbol, "tvlUSD", tvlUSD);
                marketAptos[tokenToAdd.symbol] = {
                    currentPrice: 0,
                    marketCap: 0,
                    aptosTvl: tvlUSD,
                };
            }
        }

    }
    console.log(marketAptos);
    localStorage.setItem('aptosTokens', JSON.stringify(marketAptos));
    return marketAptos;
}

