/**
 * @file This file contains the main application logic for the Automatic Balanced Bag by AI.
 * @version 0.0.1
 * @author jeugregg
 * 
 * @description This React application allows users to connect their Starknet wallet, view their token balances, 
 * and automatically rebalance their portfolio based on different investment strategies powered by Brian AI.
 * 
 * @features
 * - Connect to a Starknet wallet using Argent X.
 * - Display current wallet balances with token quantities, prices, and total values.
 * - Fetch token prices and market cap data from Impulse API and CoinGecko.
 * - Use Brian AI to:
 *   -  Reduce the token list by excluding stablecoins, liquid staking tokens, and correlated tokens.
 *   -  Generate swap transactions for rebalancing.
 * - Select from different investment strategies: Secure, Balanced, Offensive.
 * - Generate an investment breakdown with target token allocation percentages and amounts.
 * - Prepare and execute swap transactions through Brian AI.
 * - Display swap transaction statuses (pending, loading, success, error).
 * - Error handling and display.
 * 
 * @dependencies
 * - React
 * - Starknet.js
 * - @starknet-io/get-starknet
 * - @brian-ai/sdk
 * - Recharts
 * - FontAwesome
 * 
 * @environmentVariables
 * - VITE_BRIAN_API_KEY: Brian AI API key.
 * - VITE_RCP_API_KEY: Nethermind RCP API key.
 * - VITE_CG_API_KEY: CoinGecko API key.
 * 
 * @notes
 * - This application is currently in beta.
 * - It is designed for use on the Starknet mainnet.
 * - The token list and investment strategies are subject to change.
 * 
 * @usage
 * 1. Set up environment variables with your API keys.
 * 2. Run the application using a development server (e.g., `npm start`).
 * 3. Connect your Starknet wallet using Argent X.
 * 4. View your current wallet balances.
 * 5. Choose an investment strategy.
 * 6. Enter the desired investment amount or select a percentage of your total wallet value.
 * 7. Review the generated investment breakdown.
 * 8. Click "Swap All" to prepare and execute swap transactions.
 * 9. Monitor the swap transaction statuses.
 * 
 * @futureImprovements
 * - Support more Starknet wallets.
 * - Add more investment strategies.
 * - Improve user interface and user experience.
 * - Integrate with a decentralized exchange (DEX) aggregator for optimal swap execution.
 */

import React, { useState, useEffect, useRef, ChangeEvent } from "react";
import './App.css';
import { Contract, WalletAccount, uint256, RpcProvider } from "starknet";
import { connect } from '@starknet-io/get-starknet';
import { BrianSDK } from "@brian-ai/sdk";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faTimes, faSpinner, faHandSpock } from '@fortawesome/free-solid-svg-icons';
import { PieChart, Pie, Cell } from 'recharts';
import { faGithub } from '@fortawesome/free-brands-svg-icons';
import { groupAndSortWallets, WalletName, useWallet, WalletContextState } from "@aptos-labs/wallet-adapter-react";
import WalletConnectButtons from "./components/WalletConnectButtons";
import ErrorMessageBox from "./components/ErrorMessageBox";
import WalletBalances from "./components/WalletBalances";
import InvestmentBreakdown from "./components/InvestmentBreakdown";
import SwapTable from "./components/SwapTable";
import {
  getMarket,
  askReduceList,
} from "./services/apiService";
import {
  findIndexBySymbol,
  getMarketTokenSymbol,
  getMarketTokenAddress,
  getMarketTokenPrice,
  extractPrices,
  loadTokens,
  getMarketTokenMcap,
  filterTokens,
  removeTokensWithSuffix,
  calculateCryptoDelta,
  calculateCryptoSwap,
  extractBrianBalances,
  extractAllBrianBalances,
  calculateEMA7HourlyAndMaxStdDev,
  reduceTokenList,
} from "./services/dataUtils";

const mode_debug = false;

const cgApiKey = import.meta.env.VITE_CG_API_KEY as string;

interface TokenData {
  position: number;
  name: string;
  symbol: string;
  address: string;
  decimals: number;
  market: {
    currentPrice: number;
    marketCap: number;
    starknetTvl: number;
  };
  linePriceFeedInUsd?: { value: number }[];
}

interface BalanceItem {
  token: string;
  balance: number;
  price: number;
  total: number;
}

interface InvestmentBreakdown {
  [token: string]: {
    amount: number;
    percentage: number;
  };
}

interface Swap {
  sell: string;
  buy: string;
  amount: number;
}

const tokenAddresses_default: Record<string, string> = {
  ETH: "0x049D36570D4e46f48e99674bd3fcc84644DdD6b96F7C741B1562B82f9e004dC7",
  STRK: "0x04718f5a0Fc34cC1AF16A1cdee98fFB20C31f5cD61D6Ab07201858f4287c938D",
  USDC: "0x053c91253bc9682c04929ca02ed00b3e423f6710d2ee7e0d5ebb06f3ecf368a8",
  USDT: "0x068F5c6a61780768455de69077E07e89787839bf8166dEcfBf92B645209c0fB8",
  WBTC: "0x03fe2b97c1fd336e750087d68b9b867997fd64a2661ff3ca5a7c771641e8e7ac"
};

const ethAmountToKeep = 2;

function App() {
  const [myWalletAccount, setMyWalletAccount] = useState<WalletAccount | null>(null);
  const [myAptosWalletAccount, setMyAptosWalletAccount] = useState<WalletContextState | null>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  //const [aptosWalletAddress, setAptosWalletAddress] = useState<string | null>(null);
  const [walletBalances, setWalletBalances] = useState<BalanceItem[]>([]);
  const [balances, setBalances] = useState<BalanceItem[]>([]);
  const [balancesWithBrian, setBalancesWithBrian] = useState<Record<string, number>[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorColor, setErrorColor] = useState<string>('blue');
  const errorTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [showErrorContainer, setShowErrorContainer] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [totalWalletValue, setTotalWalletValue] = useState<number>(0);
  const [investmentAmount, setInvestmentAmount] = useState<string>("");
  const [selectedSolution, setSelectedSolution] = useState<string>('Balanced');
  const [investmentBreakdown, setInvestmentBreakdown] = useState<InvestmentBreakdown | null>(null);
  const [swapsToPrepare, setSwapsToPrepare] = useState<Swap[]>([]);
  const [transactionsCompleted, setTransactionsCompleted] = useState<boolean>(false);
  const [swapStatuses, setSwapStatuses] = useState<string[]>([]);
  const [loadingToken, setLoadingToken] = useState<string | null>(null);
  const [showAptosWalletMsg, setShowAptosWalletMsg] = useState(false);

  // Access the API key from environment variables
  const brianApiKey = import.meta.env.VITE_BRIAN_API_KEY;
  const rcpApiKey = import.meta.env.VITE_RCP_API_KEY;
  const options = {
    apiKey: brianApiKey,
  };
  const brian = new BrianSDK(options);
  const aptosWallet = useWallet(); // <-- Move hook here
  
  const { aptosConnectWallets, availableWallets, installableWallets } =
            groupAndSortWallets(
            [...aptosWallet.wallets, ...aptosWallet.notDetectedWallets]
  );

  // Updated setError function to handle color change and timeout
  const setErrorWithTimeout = (errorMessage: string) => {
    setError(errorMessage);
    setErrorColor('red');
    setShowErrorContainer(true); // Show the container
    clearTimeout(errorTimeoutRef.current);
    errorTimeoutRef.current = setTimeout(() => {
      setErrorColor('blue');
      setShowErrorContainer(false); // Hide the container after 5 seconds
    }, 5000);
  };

  const askReduceList = async () => {
    // Ask BRIAN AI to reduce token list by excluded :
    // - stable coins, 
    // - liquid staking tokens,
    // - and correletated coins
    const tokens = loadTokens();
    // transform tokens symbols in list of string with '' :
    const symbols = tokens.map((token) => token.symbol);
    let prompt = `From this list of assets on Starknet and particularly on app.avnu.fi : '${symbols.join("', '")}`;
    prompt += "' extract a new list by removing stablecoins when you are sure that it is a stablecoin. Don't explain your answer, just write the new list"
    const result = await brian.ask({
      prompt: prompt,
      kb: "public-knowledge-box",
    });
    console.log("result stablecoin: ")
    console.log(result["answer"]);
    prompt = "From this list of assets on Starknet and particularly on app.avnu.fi :"
    prompt += result["answer"];
    prompt += ", extract a new list by removing liquid staking tokens only when you are sure that it is a liquid staking token.";
    prompt += " Don't explain your answer, just write the new list"
    const result_lst = await brian.ask({
      prompt: prompt,
      kb: "public-knowledge-box",
    });
    console.log("result lst: ")
    console.log(result_lst["answer"]);
    // for each symbol of tokens, check if the symbol is into long string result
    let listReducedTokens = [];
    for (const symbol of symbols) {
      if (result_lst["answer"].includes(`'${symbol}'`)) {
        listReducedTokens.push(symbol);
      }
    }
    console.log("listReducedTokens identified: ");
    console.log(listReducedTokens);
    // remove tokens with STRK suffix
    listReducedTokens = removeTokensWithSuffix(listReducedTokens, "STRK");
    console.log("listReducedTokens after STRK suffixes removed: ")
    console.log(listReducedTokens);
    // save in localstorage
    localStorage.setItem('listReducedTokens', JSON.stringify(listReducedTokens));
    return listReducedTokens;
  }

  const handleSolutionSelect = (solution: string) => {
    setSelectedSolution(solution);

    // Replace with your logic to get investment breakdown for the selected solution
    const breakdown = getInvestmentBreakdown(solution, investmentAmount);
    setInvestmentBreakdown(breakdown);
  };

  // Placeholder function to simulate getting investment breakdown data
  const getInvestmentBreakdown = (solution: string, amount: string) => {
    // Replace this with your actual logic to fetch or calculate the breakdown
    // based on the selected solution and investment amount.
    // load tokens data
    const tokensData = loadTokens();
    // keep only good token 
    const goodTokensData = filterTokens(tokensData);
    console.log("filterTokens: ");
    console.log(goodTokensData);
    // select first biggest Market Cap
    let tokenMcaps = getMarketTokenMcap(goodTokensData);
    // sort by Market Cap
    let sortedTokens = Object.keys(tokenMcaps).sort((a, b) => tokenMcaps[b] - tokenMcaps[a]);
    // keep only 10th first
    sortedTokens = sortedTokens.slice(0, 15);
    let sortedTokensData = filterTokens(goodTokensData, sortedTokens);
    // get token actual prices
    const tokenPrices = getMarketTokenPrice(sortedTokensData);
    // get statistics about tokens
    let tokenEMA7Hourly = {};
    let tokenMaxStdDev = {};
    for (const token of sortedTokens) {
      const tokenPriceHistory = extractPrices(sortedTokensData, token);
      try {
        const tokenEMA7HourlyAndMaxStdDev = calculateEMA7HourlyAndMaxStdDev(tokenPriceHistory);
        tokenEMA7Hourly[token] = tokenEMA7HourlyAndMaxStdDev.ema;
        tokenMaxStdDev[token] = tokenEMA7HourlyAndMaxStdDev.maxStdDev;
        // detect stablecoin and exclude them
        if (tokenMaxStdDev[token] < 2) {
          if (tokenPrices[token] < 1.07 && tokenPrices[token] > 0.93) {
            delete tokenEMA7Hourly[token];
            delete tokenMaxStdDev[token];
            sortedTokens = sortedTokens.filter(t => t !== token);
          }
        }
      } catch (error) {
        console.error(`Error calculating EMA and MaxStdDev for ${token}:`, error);
        setErrorWithTimeout(error.message);
        return null;
      }
    }
    // Hyperparameters Solution Selection 
    // def Balanced
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
    };

    // reduce number of tokens to n_tokens
    sortedTokens = sortedTokens.slice(0, n_tokens);
    // Create a new tokenEMA7Hourly object in the order of sortedTokens
    tokenEMA7Hourly = Object.fromEntries(
      sortedTokens.map(token => [token, tokenEMA7Hourly[token]])
    );

    // Apply the same logic to tokenMaxStdDev
    tokenMaxStdDev = Object.fromEntries(
      sortedTokens.map(token => [token, tokenMaxStdDev[token]])
    );
    sortedTokensData = filterTokens(sortedTokensData, sortedTokens);
    console.log("sortedTokens:");
    console.log(sortedTokens);
    // calculate % distribution per assets
    // approx: EMA7D(Mcap) = Mcap(Today) * EMA7D(Price) / Price(Today)
    // approx alpha to have 3% for the last asset with smallest Mcap
    const alpha = k_alpha * Math.log(k_mini) / (Math.log(tokenMcaps[sortedTokens.slice(-1)[0]] / tokenMcaps[sortedTokens.slice(0)[0]]))
    // take sqrt of EMA7Hourly
    let tokenDistribution = {};
    for (const token in tokenEMA7Hourly) {
      tokenDistribution[token] = Math.pow(tokenMcaps[token] * tokenEMA7Hourly[token] / tokenPrices[token], alpha);
    }
    // calculate totalEma7Hourly
    const totalDistribution = Object.values(tokenDistribution).reduce((total, value) => total + value, 0);
    // calculate % distribution per assets
    for (const token in tokenEMA7Hourly) {
      tokenDistribution[token] = tokenDistribution[token] / totalDistribution;
    }

    // check sum of tokenDistribution == 1 
    const sum = Object.values(tokenDistribution).reduce((total, value) => total + value, 0);
    if (sum < 1.001 && sum > 0.999) {
      console.log("sum: " + sum);
      console.error("Sum of tokenDistribution is not 1");

    }
    console.log("tokenDistribution:");
    console.log(tokenDistribution);
    console.log("tokenEMA7Hourly:");
    console.log(tokenEMA7Hourly);
    console.log("tokenMaxStdDev:");
    console.log(tokenMaxStdDev);

    // Create investment breakdown based on tokenDistribution
    let breakdown = {};

    for (const token in tokenDistribution) {
      breakdown[token] = {
        amount: tokenDistribution[token] * amount,
        percentage: tokenDistribution[token] * 100
      };
    }
    return breakdown;

  };
  const handleInvestmentInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    let inputValue = e.target.value;

    // Check if input ends with '%' (percentage)
    if (inputValue.endsWith('%')) {
      const percentage = parseFloat(inputValue.slice(0, -1)) / 100;
      inputValue = (totalWalletValue * percentage);
    } else {
      // If it's a number, ensure it doesn't exceed the total wallet value
      const amount = parseFloat(inputValue);
      if (amount > totalWalletValue - 0) {
        inputValue = totalWalletValue - 0;
      }
    }

    setInvestmentAmount(inputValue);

    const newBalances = walletBalances.map(item => ({
      ...item,
      balance: (item.balance / totalWalletValue) * inputValue, // Adjust balance proportionally
      total: (item.total / totalWalletValue) * inputValue   // Adjust total proportionally
    }));
    setBalances(newBalances);
  };

  const handlePercentageSelect = (percentage: number) => {
    let maxAmountToInvest = totalWalletValue - 0;
    let amount = Math.min(totalWalletValue * (percentage / 100), maxAmountToInvest).toFixed(5);
    setInvestmentAmount(amount);
    // update balances with same percentage
    // Update balances proportionally based on the percentage
    const newBalances = walletBalances.map(item => ({
      ...item,
      balance: (item.balance / totalWalletValue) * amount, // Adjust balance proportionally
      total: (item.total / totalWalletValue) * amount   // Adjust total proportionally
    }));
    setBalances(newBalances);
  };
  const handleConnectWallet = async () => {
    try {
      console.log("enter");
      const selectedWalletSWO = await connect({ modalMode: "alwaysAsk", modalTheme: "light" });
      console.log("selectedWalletSWO:");
      console.log(selectedWalletSWO);
      const newWalletAccount = new WalletAccount(
        {
          nodeUrl: "https://rpc.nethermind.io/mainnet-juno",
          headers: { 'x-apikey': rcpApiKey }
        },
        selectedWalletSWO
      );
      await newWalletAccount.requestAccounts();
      console.log("myWalletAccount:");
      console.log(newWalletAccount);
      //const bl = await myWalletAccount.getBlockNumber();
      //console.log("block n°:" + bl);
      console.log("address:");
      const walletAddress = newWalletAccount.address;
      console.log(walletAddress);
      setWalletAddress(walletAddress);
      setMyWalletAccount(newWalletAccount);
      // retrieve avnu market
      if (mode_debug !== true) {
        const market = await getMarket();
        if (market == null) {
          setErrorWithTimeout("No price feed");
        }
        console.log("market:");
        console.log(market);
      }
      // get a reduced list without liquid staking tokens, correleted coins, or stable coins
      const listReducedTokens = await askReduceList();
      console.log("listReducedTokens:");
      console.log(listReducedTokens);

    } catch (err) {
      console.error("Error connecting wallet:", err);
      setErrorWithTimeout(err.message);
    }
  };
  const handleConnectAptosWallet = async () => {
    try {
      console.log("wallet aptos connect...");
      console.log("Connected Aptos wallet:", aptosWallet.connected);
      console.log("Available Aptos wallets:", availableWallets);
      console.log("Installable Aptos wallets:", installableWallets);
      if (availableWallets.length === 0) {
        setShowAptosWalletMsg(true);
        return;
      }
      // You can use aptosWallet.connect() or other methods here if needed
      if (aptosWallet.connected === false) {
        try {
            // Change below to the desired wallet name instead of "Petra"
            await aptosWallet.connect("Petra" as WalletName<"Petra">);
            console.log('Connected to wallet:', aptosWallet.account.address.toString());
        } catch (error) {
            console.error('Failed to connect to wallet:', error);
            setShowAptosWalletMsg(true);
            return;
        }
      } else {
        const walletAddress = aptosWallet.account.address.toString();
        console.log('Already connected to wallet:', walletAddress);
        setMyAptosWalletAccount(aptosWallet);
        setWalletAddress(walletAddress);

      }


    } catch (err) {
      console.error("Error connecting wallet:", err);
      setErrorWithTimeout((err as Error).message);
    }
  };



  const handleDisconnectWallet = () => {
    // Reset state variables related to the wallet
    setMyWalletAccount(null);
    setWalletAddress(null);
    setWalletBalances({});
    setBalances({});
    setIsLoading(true); // Optionally set isLoading to true while balances are cleared
  };
  const handleReloadBalances = async () => {
    setIsLoading(true);
    setInvestmentBreakdown(null);
    setSelectedSolution('Balanced');
    setSwapsToPrepare([]);
    setTransactionsCompleted(false);
    setSwapStatuses([]);
    setWalletBalances({}); // Clear wallet balances
    setBalances({});        // Clear balances

    if (mode_debug !== true) {
      const market = await getMarket();
      if (market === null) {
        setErrorWithTimeout("No price feed");
      }
      console.log("market:", market);
    }

    const listReducedTokens = await askReduceList();
    console.log("listReducedTokens:", listReducedTokens);

    // After clearing, immediately start fetching new balances
    if (walletAddress && myWalletAccount) {
      await fetchBalances();
    }
  };


  const handleSwapPrepare = () => {
    // Create currentWallet and targetWallet objects for calculateCryptoSwap
    const currentWallet = balances.reduce((acc, item) => ({ ...acc, [item.token]: parseFloat(item.total) }), {});
    const targetWallet = {};
    for (const token in investmentBreakdown) {
      targetWallet[token] = parseFloat(investmentBreakdown[token].amount);
    }

    // Calculate the swaps needed using the new function
    const swapAmounts = calculateCryptoDelta(currentWallet, targetWallet);
    // Generate the list of swaps to prepare based on swapAmounts
    const swaps = calculateCryptoSwap(swapAmounts);

    setSwapsToPrepare(swaps);
  };

  const handlePrepareSwapTransactions = async () => {
    setTransactionsCompleted(false); // Reset transactionsCompleted state
    const newSwapStatuses = swapsToPrepare.map(() => 'pending'); // Set initial status to loading
    setSwapStatuses(newSwapStatuses);

    let allTransactionsSuccessful = true;
    for (let i = 0; i < swapsToPrepare.length; i++) {
      newSwapStatuses[i] = 'loading'; // Update status to loading before execution
      setSwapStatuses([...newSwapStatuses]);
      const swap = swapsToPrepare[i];
      const prompt = `Swap $${swap.amount.toFixed(2)} worth of '${swap.sell}' to '${swap.buy}' on Starknet`;
      console.log(`Sending prompt to Brian: ${prompt}`);

      try {
        const brianResponse = await brian.transact({
          prompt: prompt,
          address: walletAddress,
        });

        console.log("Brian's Response:", brianResponse);

        // Check Brian's extractedParams
        if ((Number(brianResponse[0]["data"]["toAmountUSD"]) - Number(brianResponse[0]["data"]["fromAmountUSD"])) / Number(brianResponse[0]["data"]["fromAmountUSD"]) < -0.01) {
          console.error(`Price Impact too high preparing swap for ${swap.sell} to ${swap.buy}:`);
          setErrorWithTimeout(`Price Impact too high preparing swap for ${swap.sell} to ${swap.buy}`);
          newSwapStatuses[i] = 'error'; // Set status to error
          setSwapStatuses([...newSwapStatuses]); // Update swapStatuses state
          continue; // Skip to the next swap
        }

        const extractedParams = brianResponse[0]["extractedParams"];
        if (
          extractedParams &&
          extractedParams.action === "swap" &&
          extractedParams.chain === "Starknet" &&
          extractedParams.token1 === swap.sell &&
          extractedParams.token2 === swap.buy
        ) {
          console.log("Swap successfully prepared:", extractedParams);
          const txSteps = brianResponse[0]["data"]["steps"];

          const { transaction_hash: transferTxHash } = await myWalletAccount.execute(txSteps);
          await myWalletAccount.waitForTransaction(transferTxHash);
          console.log("transaction_hash:", transferTxHash);
          console.log("End Tx execution.");

          newSwapStatuses[i] = 'success'; // Set status to success
          setSwapStatuses([...newSwapStatuses]); // Update swapStatuses state
        } else {
          console.error("Unexpected response from Brian:", extractedParams);
          setErrorWithTimeout("Unexpected response from Brian. Please check the console.");
          newSwapStatuses[i] = 'error'; // Set status to error
          setSwapStatuses([...newSwapStatuses]); // Update swapStatuses state
        }

      } catch (error) {
        console.error(`Error preparing swap for ${swap.sell} to ${swap.buy}:`, error);
        setErrorWithTimeout(`Error preparing swap for ${swap.sell} to ${swap.buy}`);
        allTransactionsSuccessful = false;
        newSwapStatuses[i] = 'error'; // Set status to error
        setSwapStatuses([...newSwapStatuses]); // Update swapStatuses state
      }
    }

    // Update transactionsCompleted state based on allTransactionsSuccessful flag
    setTransactionsCompleted(allTransactionsSuccessful);
  };

  const fetchBalances = async () => {
    if (walletAddress && myWalletAccount) {
      let newBalances = {};
      //const provider = new RpcProvider({ nodeUrl: constants.NetworkName.SN_MAIN }); // Create RpcProvider
      const provider = new RpcProvider({ nodeUrl: "https://rpc.nethermind.io/mainnet-juno", headers: { 'x-apikey': rcpApiKey } }); // Create RpcProvider
      const tokenAddresses = getMarketTokenAddress();
      const tokenPrices = getMarketTokenPrice();
      try {
        for (const token in tokenAddresses) {
          setLoadingToken(token); // Update the loading token state
          try {
            console.log(tokenAddresses[token]);
            const { abi: abi } = await provider.getClassAt(tokenAddresses[token]); // Fetch ABI using class hash
            const contract = new Contract(abi, tokenAddresses[token], myWalletAccount);

            // Fetch balance and decimals
            const balanceResponse = await contract.balanceOf(walletAddress);
            const decimalsResponse = await contract.decimals(); // Assuming the token has a "decimals" function

            if (balanceResponse && decimalsResponse) {
              const balance = uint256.uint256ToBN(balanceResponse).toString();
              const decimals = parseInt(decimalsResponse, 10); // Convert decimals to integer
              const adjustedBalance = (balance / 10 ** decimals).toFixed(5); // Adjust balance based on decimals
              newBalances[token] = adjustedBalance;
            } else {
              console.warn(`Balance or decimals undefined for ${token}`);
              newBalances[token] = 0; // Or handle it differently
            }
          } catch (err) {
            console.error(`Error fetching balance for ${token}:`, err);
            setErrorWithTimeout(err.message);
          }
        }
      } catch (err) {
        console.error("Error fetching balances:", err);
        setErrorWithTimeout(err.message);
      } finally {
        setIsLoading(false);
      }
      // filter token with zero balance 
      const filteredBalances = Object.fromEntries(
        Object.entries(newBalances).filter(([token, balance]) => balance !== 0)
      );
      // get price of these tokens from filteredBalances 
      // filteredBalances ex : {ETH: '0.00211', USDC: '9.00000', TWC: '2232.42801'}
      // to have {token, price}
      let filteredPrices = {};
      for (const token in filteredBalances) {
        filteredPrices[token] = tokenPrices[token];
      }
      // mix filteredBalances and filteredPrices to have : 
      // an array of {"token": token, "balance": balance, "price": price, "total", balance*price}
      let mixedBalances = [];
      for (const token in filteredBalances) {
        mixedBalances.push({ "token": token, "balance": filteredBalances[token], "price": filteredPrices[token], "total": filteredBalances[token] * filteredPrices[token] });
      }
      setWalletBalances(mixedBalances);
      // for ETH balance, keep ethAmountToKeep $ worth of ETH
      for (const token in mixedBalances) {
        if (mixedBalances[token].token === "ETH") {
          // keep ethAmountToKeep $ worth of ETH in mixedBalances
          mixedBalances[token].balance -= ethAmountToKeep / mixedBalances[token].price;
          mixedBalances[token].total -= ethAmountToKeep;
        }
      }
      // Set investment amount
      setBalances(mixedBalances);
      // Calculate total wallet value
      const totalWalletValue = mixedBalances.reduce((sum, item) => sum + parseFloat(item.total), 0);
      setTotalWalletValue(totalWalletValue);
      setInvestmentAmount(totalWalletValue.toFixed(5));

    }
  };

  const pieChartData = investmentBreakdown ? Object.entries(investmentBreakdown).map(([token, data]) => ({
    name: token,
    value: data.percentage
  })) : [];


  const pieChartDataBalances = !isLoading && Array.isArray(balances) ? balances.map((item) => ({
    name: item.token,
    value: parseFloat(item.total)
  })) : [];


  // Expanded color palette with 15 colors
  const COLORS = [
    '#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#AF19FF', '#D9D9D9',
    '#82ca9d', '#a4de6c', '#d0ed57', '#ffc658', '#ff9830', '#ff6f00',
    '#e91e63', '#9c27b0', '#673ab7'
  ];


  useEffect(() => {
    // Call handleSwapPrepare whenever investmentBreakdown changes and is not null
    if (investmentBreakdown) {
      handleSwapPrepare();
    }
  }, [investmentBreakdown]
  );

  useEffect(() => {
    // Update investment breakdown whenever investmentAmount changes
    if (investmentAmount && selectedSolution) {
      const breakdown = getInvestmentBreakdown(selectedSolution, parseFloat(investmentAmount));
      setInvestmentBreakdown(breakdown);
    } else {
      setInvestmentBreakdown(null); // Clear breakdown if no amount or solution selected
    }
  }, [investmentAmount, selectedSolution]
  );

  useEffect(() => {
    // fetch balance with brian api
    const fetchBalancesWithBrian = async () => {
      if (walletAddress && myWalletAccount) {
        const tokenSymbols = getMarketTokenSymbol();
        console.log("tokenSymbols:");
        console.log(tokenSymbols);
        let str_prompt_tokens = "Get wallet balance in ";
        for (const token in tokenSymbols) {
          // concat all symbols in one string
          str_prompt_tokens += tokenSymbols[token] + ", ";
        }
        str_prompt_tokens += "on Starknet";
        console.log(str_prompt_tokens);

        const brianBalances = await brian.transact({
          prompt: str_prompt_tokens,
          "address": walletAddress
        });

        const newBrianBalances = extractAllBrianBalances(brianBalances);

        setBalancesWithBrian(newBrianBalances);
      }

    };

    fetchBalances();
    //fetchBalancesWithBrian();
  }, [walletAddress, myWalletAccount]);

  return (
    <div>
      {/* Header */}
      <header className="app-header">
        <h1>Automatic Balanced Bag by AI</h1>
        <p>
          Rebalance your <a href="https://starkware.co/starknet/" target="_blank" rel="noopener noreferrer">StarkNet</a> portfolio using AI-powered strategies.
        </p>
        <p> <i>Powered by <a href="https://app.avnu.fi/" target="_blank" rel="noopener noreferrer">AVNU Finance</a> and{' '}
          <a href="https://www.brianknows.org/" target="_blank" rel="noopener noreferrer">Brian AI Agent</a>.
        </i></p>
      </header>

      <ErrorMessageBox
        showErrorContainer={showErrorContainer}
        error={error}
        errorColor={errorColor}
        showAptosWalletMsg={showAptosWalletMsg}
        setShowAptosWalletMsg={setShowAptosWalletMsg}
      />

      <div className="app-content">
        <h2>Beta Version - 0.0.2 - Starknet & Aptos</h2>
        {walletAddress ? (
          <>
            <h4>Wallet: {`${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`}</h4>
            <button onClick={handleDisconnectWallet}>Log Out</button>
            {/* <button onClick={handleReloadBalances} className="reload-button"> */}
            {/*   <FontAwesomeIcon icon={faSyncAlt} /> {/* Use the reload icon */}
            {/* </button> */}
            <h3>
              Wallet balance to invest
            </h3>
            {/* Investment Input Section */}
            {totalWalletValue > 0 && (
              <div>
                <label htmlFor="investmentInput">
                  Choose Wallet Amount: $
                </label>
                <input
                  type="text"
                  id="investmentInput"
                  value={investmentAmount}
                  onChange={handleInvestmentInputChange} // Use the new handler
                  className="investment-input"
                />
                {/* Percentage Buttons */}
                <div>
                  <button onClick={() => handlePercentageSelect(25)}>25%</button>
                  <button onClick={() => handlePercentageSelect(50)}>50%</button>
                  <button onClick={() => handlePercentageSelect(100)}>100%</button>
                </div>
              </div>
            )}
            {isLoading ? (
              <div className="loading-container">
                <FontAwesomeIcon icon={faSpinner} spin />
                <p>Loading balances... {loadingToken}</p>
              </div>
            ) : (
              <WalletBalances
                balances={balances}
                isLoading={isLoading}
                loadingToken={loadingToken}
                totalWalletValue={totalWalletValue}
                walletBalances={walletBalances}
                investmentAmount={investmentAmount}
                handleInvestmentInputChange={handleInvestmentInputChange}
                handlePercentageSelect={handlePercentageSelect}
                pieChartDataBalances={pieChartDataBalances}
                COLORS={COLORS}
              />
            )}

            {/* Conditionally display Total Wallet Value */}
            {totalWalletValue > 0 && (
              <p>Total Wallet Value: ${totalWalletValue.toFixed(5)}</p>
            )}
            {/* display only if brianBalances is not empty */}
            {balancesWithBrian && Object.keys(balancesWithBrian).length > 0 && (
              <>
                <h3>Table by Brian AI</h3> {/* New table */}
                <table>
                  <thead>
                    <tr>
                      <th className="table-header">Asset</th>
                      <th className="table-header">Quantity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(balancesWithBrian || {}).map(([token, balance]) => (
                      <tr key={token}>
                        <td>{token}</td>
                        <td>{balance || "0"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}

            {/* Conditionally display Investment Solution Section */}
            {!isLoading && totalWalletValue > 0 && (
              <>
                <h3>Choose Your Investment Strategy</h3> {/* New section title */}
                <div>
                  <button
                    title="A conservative approach that prioritizes stability and low risk. This strategy allocates a larger portion of your portfolio to stablecoins and low-volatility assets."
                    className={`investment-button ${selectedSolution === 'Secure' ? 'selected' : ''}`}
                    onClick={() => handleSolutionSelect('Secure')}
                  >
                    Secure
                  </button>
                  <button
                    title="A balanced approach that balances risk and returns. This strategy allocates an equal portion of your portfolio to both stablecoins and high-volatility assets."
                    className={`investment-button ${selectedSolution === 'Balanced' ? 'selected' : ''}`}
                    onClick={() => handleSolutionSelect('Balanced')}
                  >
                    Balanced
                  </button>
                  <button
                    title="An aggressive approach that prioritizes high returns and is willing to take on higher risk. This strategy allocates a larger portion of your portfolio to higher-risk assets, such as cryptocurrencies with high growth potential."
                    className={`investment-button ${selectedSolution === 'Offensive' ? 'selected' : ''}`}
                    onClick={() => handleSolutionSelect('Offensive')}
                  >
                    Offensive
                  </button>
                </div>
              </>
            )}
            {/* Display Investment Breakdown Table */}
            {investmentBreakdown && (
              <>
                <InvestmentBreakdown
                  investmentBreakdown={investmentBreakdown}
                  pieChartData={pieChartData}
                  COLORS={COLORS}
                />
                <SwapTable
                  swapsToPrepare={swapsToPrepare}
                  swapStatuses={swapStatuses}
                  handlePrepareSwapTransactions={handlePrepareSwapTransactions}
                />
              </>
            )}

          </>
        ) : (
          <WalletConnectButtons
            handleConnectWallet={handleConnectWallet}
            handleConnectAptosWallet={handleConnectAptosWallet}
          />
        )}
      </div>
      {/* Footer */}
      <footer className="app-footer">

        <a href="https://github.com/jeugregg/balanced-bag-ai" target="_blank" rel="noopener noreferrer" className="footer-text">
          <FontAwesomeIcon icon={faGithub} className="footer-icon" /> GitHub Repository
        </a> - 2025 - Built by jeugregg
      </footer>
    </div >
  );
}

export default App;