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
import BrianBalancesTable from "./components/BrianBalancesTable";
import InvestmentStrategyButtons from "./components/InvestmentStrategyButtons";
import {
  getMarket,
  askReduceList,
  fetchBalances,
  handlePrepareSwapTransactions,
  handleSwapPrepare,
  getInvestmentBreakdown,
} from "./services/apiService";

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

  const handleSolutionSelect = (solution: string) => {
    setSelectedSolution(solution);
    const breakdown = getInvestmentBreakdown(solution, parseFloat(investmentAmount));
    setInvestmentBreakdown(breakdown);
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


  useEffect(() => {
    fetchBalances(
      walletAddress,
      myWalletAccount,
      setWalletBalances,
      setBalances,
      setTotalWalletValue,
      setInvestmentAmount,
      setIsLoading,
      setLoadingToken,
      setErrorWithTimeout
    );
    // Optionally, fetch Brian balances:
    // fetchBalancesWithBrian(walletAddress, myWalletAccount, setBalancesWithBrian, setErrorWithTimeout);
  }, [walletAddress, myWalletAccount]);

  useEffect(() => {
    if (investmentBreakdown) {
      handleSwapPrepare(balances, investmentBreakdown, setSwapsToPrepare);
    }
  }, [investmentBreakdown]);

  useEffect(() => {
    if (investmentAmount && selectedSolution) {
      const breakdown = getInvestmentBreakdown(selectedSolution, parseFloat(investmentAmount));
      setInvestmentBreakdown(breakdown);
    } else {
      setInvestmentBreakdown(null);
    }
  }, [investmentAmount, selectedSolution]);

  // For swap transactions:
  // Replace local handlePrepareSwapTransactions with imported version:
  // handlePrepareSwapTransactions(swapsToPrepare, setSwapStatuses, setTransactionsCompleted, brian, walletAddress, myWalletAccount, setErrorWithTimeout);

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
    fetchBalances();
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
            <BrianBalancesTable balancesWithBrian={balancesWithBrian} />
            <InvestmentStrategyButtons
              isLoading={isLoading}
              totalWalletValue={totalWalletValue}
              selectedSolution={selectedSolution}
              handleSolutionSelect={handleSolutionSelect}
            />
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