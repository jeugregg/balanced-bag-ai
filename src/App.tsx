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
import "./App.css";
import { WalletAccount } from "starknet";
import { BrianSDK } from "@brian-ai/sdk";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSpinner } from "@fortawesome/free-solid-svg-icons";
import { faGithub } from "@fortawesome/free-brands-svg-icons";
import {
  groupAndSortWallets,
  useWallet,
  WalletContextState,
} from "@aptos-labs/wallet-adapter-react";

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
  prepareSwapTransactions,
  handleSwapPrepare,
  getInvestmentBreakdown,
  connectStarknetWallet,
  connectAptosWallet,
  fetchAptosBalances,
} from "./services/apiService";

const mode_debug = false;
const cgApiKey = import.meta.env.VITE_CG_API_KEY as string;

interface BalanceItem {
  token: string;
  balance: number;
  price: number;
  total: number;
}
interface InvestmentBreakdownMap {
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

const ethAmountToKeep = 2;

function App() {
  const [myWalletAccount, setMyWalletAccount] = useState<WalletAccount | null>(null);
  const [myAptosWalletAccount, setMyAptosWalletAccount] = useState<WalletContextState | null>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);

  const [walletBalances, setWalletBalances] = useState<BalanceItem[]>([]);
  const [balances, setBalances] = useState<BalanceItem[]>([]);
  const [balancesWithBrian, setBalancesWithBrian] = useState<Record<string, number>[] | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [errorColor, setErrorColor] = useState<string>("blue");
  const errorTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [showErrorContainer, setShowErrorContainer] = useState<boolean>(false);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [totalWalletValue, setTotalWalletValue] = useState<number>(0);
  const [investmentAmount, setInvestmentAmount] = useState<string>("");

  const [selectedSolution, setSelectedSolution] = useState<string>("Balanced");
  const [investmentBreakdown, setInvestmentBreakdown] = useState<InvestmentBreakdownMap | null>(null);

  const [swapsToPrepare, setSwapsToPrepare] = useState<Swap[]>([]);
  const [transactionsCompleted, setTransactionsCompleted] = useState<boolean>(false);
  const [swapStatuses, setSwapStatuses] = useState<string[]>([]);
  const [loadingToken, setLoadingToken] = useState<string | null>(null);
  const [showAptosWalletMsg, setShowAptosWalletMsg] = useState(false);

  // SDK & Wallets
  const brianApiKey = import.meta.env.VITE_BRIAN_API_KEY;
  const rcpApiKey = import.meta.env.VITE_RCP_API_KEY;
  const brian = new BrianSDK({ apiKey: brianApiKey });

  const aptosWallet = useWallet();
  const { aptosConnectWallets, availableWallets, installableWallets } = groupAndSortWallets([
    ...aptosWallet.wallets,
    ...aptosWallet.notDetectedWallets,
  ]);

  // Error helper
  const setErrorWithTimeout = (errorMessage: string) => {
    setError(errorMessage);
    setErrorColor("red");
    setShowErrorContainer(true);
    clearTimeout(errorTimeoutRef.current as any);
    errorTimeoutRef.current = setTimeout(() => {
      setErrorColor("blue");
      setShowErrorContainer(false);
    }, 5000);
  };

  // Handlers
  const handleSolutionSelect = (solution: string) => {
    setSelectedSolution(solution);
    const breakdown = getInvestmentBreakdown(solution, parseFloat(investmentAmount), myAptosWalletAccount);
    setInvestmentBreakdown(breakdown);
  };

  const handleInvestmentInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    let inputValue: any = e.target.value;

    if (String(inputValue).endsWith("%")) {
      const percentage = parseFloat(String(inputValue).slice(0, -1)) / 100;
      inputValue = totalWalletValue * percentage;
    } else {
      const amount = parseFloat(inputValue);
      if (amount > totalWalletValue - 0) inputValue = totalWalletValue - 0;
    }

    setInvestmentAmount(inputValue);

    const newBalances = walletBalances.map((item) => ({
      ...item,
      balance: (item.balance / totalWalletValue) * Number(inputValue),
      total: (item.total / totalWalletValue) * Number(inputValue),
    }));
    setBalances(newBalances);
  };

  const handlePercentageSelect = (percentage: number) => {
    const maxAmountToInvest = totalWalletValue - 0;
    const amount = Math.min(totalWalletValue * (percentage / 100), maxAmountToInvest).toFixed(5);
    setInvestmentAmount(amount);

    const newBalances = walletBalances.map((item) => ({
      ...item,
      balance: (item.balance / totalWalletValue) * Number(amount),
      total: (item.total / totalWalletValue) * Number(amount),
    }));
    setBalances(newBalances);
  };

  const handleConnectWallet = async () => {
    await connectStarknetWallet(
      rcpApiKey,
      setWalletAddress,
      setMyWalletAccount,
      setErrorWithTimeout,
      mode_debug,
      getMarket,
      askReduceList
    );
  };
  const handleConnectAptosWallet = async () => {
    await connectAptosWallet(
      aptosWallet,
      availableWallets,
      setShowAptosWalletMsg,
      setMyAptosWalletAccount,
      setWalletAddress,
      setErrorWithTimeout
    );
  };

  const handlePrepareSwapTransactions = async () => {
    await prepareSwapTransactions(
      swapsToPrepare,
      setSwapStatuses,
      setTransactionsCompleted,
      brian,
      walletAddress,
      myWalletAccount,
      myAptosWalletAccount,
      setErrorWithTimeout
    );
  };

  const handleDisconnectWallet = () => {
    setMyWalletAccount(null);
    setWalletAddress(null);
    setWalletBalances([]); // important: vider avec []
    setBalances([]);       // important: vider avec []
    setIsLoading(true);
  };

  const handleReloadBalances = async () => {
    setIsLoading(true);
    setInvestmentBreakdown(null);
    setSelectedSolution("Balanced");
    setSwapsToPrepare([]);
    setTransactionsCompleted(false);
    setSwapStatuses([]);
    setWalletBalances([]); // vider
    setBalances([]);       // vider

    if (mode_debug !== true) {
      const market = await getMarket();
      if (market === null) setErrorWithTimeout("No price feed");
    }

    await askReduceList();
    if (walletAddress && myWalletAccount) await fetchBalances();
  };

  // Effects
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
  }, [myWalletAccount]);

  useEffect(() => {
    fetchAptosBalances(
      walletAddress,
      myAptosWalletAccount,
      setWalletBalances,
      setBalances,
      setTotalWalletValue,
      setInvestmentAmount,
      setIsLoading,
      setLoadingToken,
      setErrorWithTimeout
    );
  }, [myAptosWalletAccount]);

  useEffect(() => {
    if (investmentBreakdown) handleSwapPrepare(balances, investmentBreakdown, setSwapsToPrepare);
  }, [investmentBreakdown]);

  useEffect(() => {
    if (investmentAmount && selectedSolution) {
      const breakdown = getInvestmentBreakdown(
        selectedSolution,
        parseFloat(investmentAmount),
        myAptosWalletAccount
      );
      setInvestmentBreakdown(breakdown);
    } else {
      setInvestmentBreakdown(null);
    }
  }, [investmentAmount, selectedSolution]);

  // Charts data
  const pieChartData = investmentBreakdown
    ? Object.entries(investmentBreakdown).map(([token, data]) => ({
        name: token,
        value: data.percentage,
      }))
    : [];

  const pieChartDataBalances =
    !isLoading && Array.isArray(balances)
      ? balances.map((item) => ({ name: item.token, value: parseFloat(String(item.total)) }))
      : [];

  // Palette
  const COLORS = [
    "#0088FE",
    "#00C49F",
    "#FFBB28",
    "#FF8042",
    "#AF19FF",
    "#D9D9D9",
    "#82ca9d",
    "#a4de6c",
    "#d0ed57",
    "#ffc658",
    "#ff9830",
    "#ff6f00",
    "#e91e63",
    "#9c27b0",
    "#673ab7",
  ];

  return (
    <div>
      {/* Header */}
      <header className="app-header">
        <h1>Automatic Balanced Bag by AI</h1>
        <p>Rebalance your Wallet Portfolio using AI-powered strategies.</p>
        <p>
          <i>
            Aptos : Powered by{" "}
            <a href="https://hyperion.xyz/" target="_blank" rel="noopener noreferrer">
              Hyperion
            </a>{" "}
            and{" "}
            <a href="https://scrt.network/secret-ai" target="_blank" rel="noopener noreferrer">
              Secrect AI (Secret Network)
            </a>.
          </i>
        </p>
        <p>
          <i>
            Starknet : Powered by{" "}
            <a href="https://app.avnu.fi/" target="_blank" rel="noopener noreferrer">
              AVNU Finance
            </a>{" "}
            and{" "}
            <a href="https://www.brianknows.org/" target="_blank" rel="noopener noreferrer">
              Brian AI Agent (discountinued)
            </a>.
          </i>
        </p>
      </header>

      <ErrorMessageBox
        showErrorContainer={showErrorContainer}
        error={error}
        errorColor={errorColor}
        showAptosWalletMsg={showAptosWalletMsg}
        setShowAptosWalletMsg={setShowAptosWalletMsg}
      />

      <main className="app-content">
        <h2>Beta Version - 0.0.2 - Starknet & Aptos</h2>

        {/* ============ STEP 1 ============ */}
        <section className="step-section">
          <div className="step-head">
            <div className="step-badge">1</div>
            <div className="step-title">
              <div className="kicker">Step 1</div>
              <h3>Login & Wallet balance to invest</h3>
              <div className="step-desc">
                Connecte ton wallet et choisis un montant (ou 25 / 50 / 100%).
              </div>
            </div>
          </div>

          <div className="step-body">
            {!walletAddress ? (
              <div className="card" style={{ margin: 0 }}>
                <WalletConnectButtons
                  handleConnectWallet={handleConnectWallet}
                  handleConnectAptosWallet={handleConnectAptosWallet}
                />
              </div>
            ) : (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <h4 style={{ margin: 0 }}>
                    Wallet: {`${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`}
                  </h4>
                  <button onClick={handleDisconnectWallet}>Log Out</button>
                </div>

                <div style={{ marginTop: 12 }}>
                  <h3 style={{ margin: "8px 0" }}>Wallet balance to invest</h3>

                  {totalWalletValue > 0 && (
                    <div style={{ display: "grid", gap: 8 }}>
                      <label htmlFor="investmentInput">Choose Wallet Amount: $</label>
                      <input
                        type="text"
                        id="investmentInput"
                        value={investmentAmount}
                        onChange={handleInvestmentInputChange}
                        className="investment-input"
                      />

                      {/* Groupe de boutons 25/50/100 (espacement 3px) */}
                      <div className="btn-group">
                        <button onClick={() => handlePercentageSelect(25)} className="btn btn--chip">25%</button>
                        <button onClick={() => handlePercentageSelect(50)} className="btn btn--chip">50%</button>
                        <button onClick={() => handlePercentageSelect(100)} className="btn btn--chip">100%</button>
                      </div>
                    </div>
                  )}

                  {isLoading ? (
                    <div className="loading-container" style={{ gap: 10 }}>
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

                  {totalWalletValue > 0 && (
                    <p style={{ marginTop: 8 }}>Total Wallet Value: ${totalWalletValue.toFixed(5)}</p>
                  )}

                  <BrianBalancesTable balancesWithBrian={balancesWithBrian} />
                </div>
              </>
            )}
          </div>
        </section>

        {/* ============ STEP 2 ============ */}
        <section className={`step-section ${!walletAddress || !totalWalletValue ? "step--disabled" : ""}`}>
          <div className="step-head">
            <div className="step-badge">2</div>
            <div className="step-title">
              <div className="kicker">Step 2</div>
              <h3>Choose your investment strategy</h3>
              <div className="step-desc">
                Sélectionne Secure / Balanced / Offensive et vérifie la répartition.
              </div>
            </div>
          </div>

          <div className="step-body">
            <InvestmentStrategyButtons
              isLoading={isLoading}
              totalWalletValue={totalWalletValue}
              selectedSolution={selectedSolution}
              handleSolutionSelect={handleSolutionSelect}
            />

            {investmentBreakdown && (
              <InvestmentBreakdown
                investmentBreakdown={investmentBreakdown}
                pieChartData={pieChartData}
                COLORS={COLORS}
              />
            )}
          </div>
        </section>

        {/* ============ STEP 3 ============ */}
        <section className={`step-section ${!investmentBreakdown ? "step--disabled" : ""}`}>
          <div className="step-head">
            <div className="step-badge">3</div>
            <div className="step-title">
              <div className="kicker">Step 3</div>
              <h3>Swap all for rebalancing</h3>
              <div className="step-desc">Prépare et exécute les swaps pour atteindre la cible.</div>
            </div>
          </div>

          <div className="step-body">
            {investmentBreakdown && (
              <SwapTable
                swapsToPrepare={swapsToPrepare}
                swapStatuses={swapStatuses}
                handlePrepareSwapTransactions={handlePrepareSwapTransactions}
              />
            )}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="app-footer">
        <a
          href="https://github.com/jeugregg/balanced-bag-ai"
          target="_blank"
          rel="noopener noreferrer"
          className="footer-text"
        >
          <FontAwesomeIcon icon={faGithub} className="footer-icon" /> GitHub Repository
        </a>{" "}
        - 2025 - Built by jeugregg
      </footer>
    </div>
  );
}

export default App;
