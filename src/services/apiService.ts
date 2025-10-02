import { Contract, uint256, RpcProvider } from "starknet";
import { BrianSDK } from "@brian-ai/sdk";
import { initHyperionSDK } from '@hyperionxyz/sdk'
import { Network, Aptos, AptosConfig } from "@aptos-labs/ts-sdk";
const aptosConfig = new AptosConfig({ network: Network.MAINNET });
const aptos = new Aptos(aptosConfig);
const MODE_DEBUG = false;
import { AptosJSProClient } from "@aptos-labs/js-pro";
const aptosClient = new AptosJSProClient({
  network: { network: Network.MAINNET },
});

type Coin = { coin: { value: string } };
import {
  getMarketTokenAddress,
  getAptosMarketTokenAddress,
  getMarketTokenPrice,
  getAptosMarketTokenPrice,
  calculateCryptoDelta,
  calculateCryptoSwap,
  extractAllBrianBalances,
  filterTokens,
  extractPrices,
  extractAptosPrices,
  getMarketTokenMcap,
  calculateEMA7HourlyAndMaxStdDev,
  loadTokens,
  loadAptosTokens,
  getAptosMarketTokenMcap,
  filterNonStableTokens,
} from "./dataUtils";
import { TokenData, BalanceItem, InvestmentBreakdown, Swap } from "../App";
//import { Network } from "@aptos-labs/wallet-adapter-react";

const cgApiKey = import.meta.env.VITE_CG_API_KEY as string;
const rcpApiKey = import.meta.env.VITE_RCP_API_KEY as string;
const aptosApiKey = import.meta.env.VITE_APTOS_API_KEY as string;

const hyper_sdk = initHyperionSDK({
    network: Network.MAINNET, 
    APTOS_API_KEY: aptosApiKey
});

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
// fetch balances from Starknet wallet
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
// fetch Starknet wallet balances from Brian AI
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

// fetch balances from Aptos wallet
export async function fetchAptosBalances(
  walletAddress: string | null,
  aptosWallet: any,
  setWalletBalances: (balances: BalanceItem[]) => void,
  setBalances: (balances: BalanceItem[]) => void,
  setTotalWalletValue: (value: number) => void,
  setInvestmentAmount: (value: string) => void,
  setIsLoading: (loading: boolean) => void,
  setLoadingToken: (token: string | null) => void,
  setErrorWithTimeout: (msg: string) => void
) {
  if (aptosWallet && aptosWallet.connected) {
    try {
      //const walletAddress = aptosWallet.account.address.toString();
      console.log("Aptos wallet address:", walletAddress);
      if (!walletAddress) {
        setErrorWithTimeout("Wallet address is missing.");
        return;
      }
      const { nextCursor, prevCursor, balances } = await aptosClient.fetchAccountCoins({
        address: walletAddress,
      });
      console.log("Aptos balances:", balances);
      // filter only market tokens
      const tokenAddresses = getAptosMarketTokenAddress();
      // check for each coin in balances : 
      // example : balances[0].assetTypeV2 == tokenAddresses[balances[0].metadata.symbol]
      const filteredBalances = balances.filter(balance => {
        // tokenAddresses may be an object with symbol as key and address as value
        // balance.metadata.symbol should exist in tokenAddresses
        return Object.prototype.hasOwnProperty.call(tokenAddresses, balance.metadata.symbol);
      });
      console.log("Filtered Aptos balances:", filteredBalances);

      const tokenPrices = getAptosMarketTokenPrice();
      console.log("Aptos tokenAddresses:", tokenAddresses);
      console.log("Aptos tokenPrices:", tokenPrices);
      let newBalances: Record<string, number> = {};
      for (const token in tokenAddresses) {
        setLoadingToken(token);
        // if token is in filteredBalances, get its balance
        const foundBalance = filteredBalances.find(balance => balance.metadata.symbol === token);
        if (foundBalance) {

          newBalances[token] = foundBalance.amount / (10 ** foundBalance.metadata.decimals);
          
        } else {
          newBalances[token] = 0;
        }
      }
      setIsLoading(false);
      console.log("Aptos newBalances:", newBalances);
      const newFilteredBalances = Object.fromEntries(
      Object.entries(newBalances).filter(([token, balance]) => balance !== 0)
      );

      let filteredPrices: Record<string, number> = {};
      for (const token in newFilteredBalances) {
        filteredPrices[token] = tokenPrices[token];
      }
      let mixedBalances: BalanceItem[] = [];
      for (const token in newFilteredBalances) {
        mixedBalances.push({
          token,
          balance: newFilteredBalances[token],
          price: filteredPrices[token],
          total: newFilteredBalances[token] * filteredPrices[token],
        });
      }
      setWalletBalances(mixedBalances);
      for (const token in mixedBalances) {
        if (mixedBalances[token].token === "APT") {
          mixedBalances[token].balance -= 0.1 / mixedBalances[token].price;
          mixedBalances[token].total -= 0.1;
        }
      }
      setBalances(mixedBalances);
      const totalWalletValue = mixedBalances.reduce((sum, item) => sum + parseFloat(item.total), 0);
      setTotalWalletValue(totalWalletValue);
      setInvestmentAmount(totalWalletValue.toFixed(5));

      /* const tokenAddress = "0xbae207659db88bea0cbead6da0ed00aac12edcdda169e591cd41c94180b46f3b";
      const resourceType = `0x1::coin::CoinStore<${tokenAddress}>`;
      const resource = await aptos.getAccountResource<Coin>(
        { accountAddress: walletAddress, resourceType: resourceType }
      );
      if (resource && resource && resource.coin) {
        console.log("Balance:", resource.coin.value);
      } else {
        console.log("Token not held by this wallet.");
      } */

    }
    catch (err: any) {
      setErrorWithTimeout(err.message);
      return;
    } finally {
      setIsLoading(false);
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

export async function prepareSwapTransactions(
  swapsToPrepare: Swap[],
  setSwapStatuses: (statuses: string[]) => void,
  setTransactionsCompleted: (completed: boolean) => void,
  brian: BrianSDK,
  walletAddress: string | null,
  myWalletAccount: any,
  myAptosWalletAccount: any,
  setErrorWithTimeout: (msg: string) => void
) {
  if (swapsToPrepare.length) {
    console.log("Preparing swaps:", swapsToPrepare);
  }

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
      if (!myAptosWalletAccount) {
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
      } else {
        // Aptos swap logic here
        //  using Hyperion SDK:
        const tokens = loadAptosTokens();
        //const currencyAAmount = Math.pow(10,7)
        // calculate amount token 1 (swap.sell) to swap to token 2 (swap.buy) with USD amount = swap.amount
        const currencyAAmount = Math.floor(swap.amount / tokens[swap.sell]["currentPrice"] * (10 ** tokens[swap.sell]["decimals"]));
        const { amountOut: currencyBAmount, path: poolRoute} = await hyper_sdk.Swap.estToAmount({
          amount: currencyAAmount,
          from: tokens[swap.sell].address,
          to: tokens[swap.buy].address,
          // safeMode
          // if safeMode is true, only few swap token pairs will return path route
          // default: true. support from (v0.0.12)
          safeMode: false
        });
        /*
        {
          
          "amountOut": "10000000", // This is for toAmount
          "amountIn": "1279371", // This is for fromAmount
          
          // swap path route
          "path": [
            "0x0d21c2f5628db619957703e90ab07bcb2b13ad6983da2b5d721f24523cae29ff"
          ]
        }
        */

        const params = {
          // here must be fa type
          currencyA: tokens[swap.sell].address,
          currencyB: tokens[swap.buy].address,
          currencyAAmount,
          currencyBAmount,
          slippage: 0.5,
          poolRoute,
          recipient: '',
        };

        const payload = await hyper_sdk.Swap.swapTransactionPayload(params);
        console.log(payload);

        const transaction = await aptos.transaction.build.simple({
          sender: walletAddress,
          data: {
          // All transactions on Aptos are implemented via smart contracts.
          function: "0x1::aptos_account::transfer",
          functionArguments: [walletAddress, 100],
          },
        });
        console.log(transaction);

        const response = await myAptosWalletAccount.signAndSubmitTransaction({data: payload});
        console.log(response);

        // send transaction with aptosWallet
        /* // 1. Build the transaction to preview the impact of it
        const transaction = await aptos.transaction.build.simple({
          sender: walletAddress,
          data: payload,
        });
        console.log(transaction);
        // 2. Simulate to see what would happen if we execute this transaction
        const [userTransactionResponse] = await aptos.transaction.simulate.simple({
            signerPublicKey: myAptosWalletAccount.publicKey,
            transaction,
        });
        console.log(userTransactionResponse); */
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
  amount: number,
  myAptosWalletAccount: any,
): InvestmentBreakdown | null {
  let tokensData: TokenData[] = [];
  let goodTokensData: TokenData[] = [];
  let tokenMcaps = {};
  if (myAptosWalletAccount) {
    tokensData = loadAptosTokens();
    goodTokensData = filterNonStableTokens(tokensData);
    tokenMcaps = getAptosMarketTokenMcap(goodTokensData);
  } else {
    tokensData = loadTokens();
    goodTokensData = filterTokens(tokensData);
    tokenMcaps = getMarketTokenMcap(goodTokensData);
  }
  let sortedTokens = Object.keys(tokenMcaps).sort((a, b) => tokenMcaps[b] - tokenMcaps[a]);
  sortedTokens = sortedTokens.slice(0, 15); // keep only max top 15 by Mcap
  let sortedTokensData;
  let tokenPrices;
  if (myAptosWalletAccount) {
    // sort goodTokensData by sortedTokens ?? why ?
    sortedTokensData = goodTokensData;
    tokenPrices = getAptosMarketTokenPrice(sortedTokensData);
  } else {
    sortedTokensData = filterTokens(goodTokensData, sortedTokens);
    tokenPrices = getMarketTokenPrice(sortedTokensData);
  }

  let tokenEMA7Hourly: Record<string, number> = {};
  let tokenMaxStdDev: Record<string, number> = {};
  for (const token of sortedTokens) {
    let tokenPriceHistory;
    if (myAptosWalletAccount) {
      tokenPriceHistory = extractAptosPrices(sortedTokensData, token);
    } else {
      tokenPriceHistory = extractPrices(sortedTokensData, token);
    }
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
  //sortedTokensData = filterTokens(sortedTokensData, sortedTokens);
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
        setWalletAddress(walletAddress);
        const marketAptos = await getMarketAptos();
        console.log(marketAptos);
        localStorage.setItem('aptosTokens', JSON.stringify(marketAptos));
        setMyAptosWalletAccount(aptosWallet);

    } catch (err: any) {
        setErrorWithTimeout(err.message);
    }
}

export async function getMarketAptos(): Promise<Record<string, any>> {
    // if mode debug, load from localStorage
    if (MODE_DEBUG) {
        const storedTokens = localStorage.getItem('aptosTokens');
        if (storedTokens) {
            return JSON.parse(storedTokens);
        }
    }
    // get hyperion pools


    const poolItems = await hyper_sdk.Pool.fetchAllPools();
    console.log("hyperion pools:", poolItems);
    let marketAptos: Record<string, any> = {};
    const tokens_default = [
        { name: "bitcoin", symbol: "WBTC", shortName: "BTC" },
        { name: "ethereum", symbol: "WETH", shortName: "ETH" },
        { name: "aptos", symbol: "APT", shortName: "APT" },
        { name: "solana", symbol: "SOL", shortName: "SOL" },
        { name: "usd-coin", symbol: "USDC", shortName: "USD" },
        { name: "tether", symbol: "USDT", shortName: "USD" }
    ];

    // select default tokens in hyperion pools
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
                  // get token address from first pool : token 1 or token 2 depending on symbol
                  const tokenAddress = pools_token[0].pool.token1Info.symbol === token_symbol
                      ? pools_token[0].pool.token1
                      : pools_token[0].pool.token2;
                  const decimals = pools_token[0].pool.token1Info.symbol === token_symbol
                      ? pools_token[0].pool.token1Info.decimals
                      : pools_token[0].pool.token2Info.decimals;
                  // console.log("OK : add default token", token_symbol, "tvlUSD", tvlUSD, "decimals", decimals);

                  marketAptos[token_symbol] = {
                      currentPrice: data_cg[token_id]["usd"],
                      marketCap: data_cg[token_id]["usd_market_cap"],
                      aptosTvl: tvlUSD,
                      address: tokenAddress,
                      token_id: token_id,
                      decimals: decimals,
                  };
              }
          }
      }
    }

    // select other low cap tokens in hyperion pools
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
                let marketcap_usd = 0;
                let current_price = 0;
                console.log("OK : add low cap token", tokenToAdd.symbol, "tvlUSD", tvlUSD);

                // get token price and marketcap from coingecko by symbol
                const url_token = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&symbols=${tokenToAdd.symbol}`;
                const options_token = {
                    method: 'GET',
                    headers: { accept: 'application/json', 'x-cg-demo-api-key': cgApiKey }
                };
                // pause for 1 second to avoid rate limit
                await new Promise(resolve => setTimeout(resolve, 1000));
                const res_cg_token = await fetch(url_token, options_token);
                const data_cg_token = await res_cg_token.json();
                if (data_cg_token && data_cg_token.length > 0) {
                    marketcap_usd = data_cg_token[0]["market_cap"];
                    current_price = data_cg_token[0]["current_price"];
                } else {
                    console.log("skip : token not found on coingecko", tokenToAdd.symbol);
                    continue;
        
                }

              // get token address from first pool : token 1 or token 2 depending on symbol
              const tokenAddress = pools_token[0].pool.token1Info.symbol === tokenToAdd.symbol
                  ? pools_token[0].pool.token1
                  : pools_token[0].pool.token2;
              const decimals = pools_token[0].pool.token1Info.symbol === tokenToAdd.symbol
                  ? pools_token[0].pool.token1Info.decimals
                  : pools_token[0].pool.token2Info.decimals;
              // console.log("OK : add low cap token", tokenToAdd.symbol, "tvlUSD", tvlUSD, "decimals", decimals);

              marketAptos[tokenToAdd.symbol] = {
                  currentPrice: current_price,
                  marketCap: marketcap_usd,
                  aptosTvl: tvlUSD,
                  address: tokenAddress,
                  token_id: data_cg_token[0].id,
                  decimals: decimals,
              };
            }
        }

    }

    // get prices range on last 90 days on CoinGecko
    for (const token in marketAptos) {
        const token_id = marketAptos[token].token_id;
        const url = `https://api.coingecko.com/api/v3/coins/${token_id}/market_chart?vs_currency=usd&days=30`;
        const options = {
            method: 'GET',
            headers: { accept: 'application/json', 'x-cg-demo-api-key': cgApiKey },
            body: undefined,
        };
        // pause for 1 second to avoid rate limit
        await new Promise(resolve => setTimeout(resolve, 1000));
        const res_cg = await fetch(url, options);
        const data_cg = await res_cg.json();
        if (data_cg && data_cg.prices) {

          // from data_cg.prices : array of [timestamp, price]
          // extract timestamp and prices in this format : array of {date: timestamp, value: price}
          const prices_90d = data_cg.prices.map((price: number[]) => ({
              date: price[0],
              value: price[1]
          }));
          marketAptos[token]["linePriceFeedInUsd"] = prices_90d;
        }
    }

    console.log(marketAptos);
    localStorage.setItem('aptosTokens', JSON.stringify(marketAptos));
    return marketAptos;
}

