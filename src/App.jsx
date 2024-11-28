import React, { useState, useEffect } from "react";
import { Contract, WalletAccount, uint256, constants, RpcProvider } from "starknet";
import { connect } from '@starknet-io/get-starknet';
import { BrianSDK } from "@brian-ai/sdk";

const mode_debug = false;


// Replace with actual token contract addresses
const tokenAddresses_default = {
  ETH: "0x049D36570D4e46f48e99674bd3fcc84644DdD6b96F7C741B1562B82f9e004dC7",
  STRK: "0x04718f5a0Fc34cC1AF16A1cdee98fFB20C31f5cD61D6Ab07201858f4287c938D",
  USDC: "0x053c91253bc9682c04929ca02ed00b3e423f6710d2ee7e0d5ebb06f3ecf368a8",
  USDT: "0x068F5c6a61780768455de69077E07e89787839bf8166dEcfBf92B645209c0fB8",
  WBTC: "0x03fe2b97c1fd336e750087d68b9b867997fd64a2661ff3ca5a7c771641e8e7ac"
};

function findIndexBySymbol(data, symbol_search) {
  for (let i = 0; i < data.length; i++) {
    if (data[i].symbol === symbol_search) {
      return i;
    }
  }
  return -1; // Return -1 if symbol not found
}

async function getMarket() {
  const response = await fetch('https://starknet.impulse.avnu.fi/v1/tokens', {
    method: 'GET',
    headers: {},
  });
  // example : data[0] =
  // {position: 1, name: 'Ethereum', symbol: 'ETH', address: '0x49d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7', decimals: 18, …}

  const data = await response.json();

  // Check if data is valid JSON before storing
  if (typeof data === 'object') {
    try {
      // patch "8"  
      const index_8 = findIndexBySymbol(data, "\b8");
      if (index_8 != -1) {
        data[index_8].symbol = "8";
      }
      // patch "SCHIZODIO "
      const index_SCHIZODIO = findIndexBySymbol(data, "SCHIZODIO ");
      if (index_SCHIZODIO == -1) {
        data[index_SCHIZODIO].symbol = "SCHIZODIO";
        data[index_SCHIZODIO].name = "SCHIZODIO";
      }

      localStorage.setItem('starknetTokens', JSON.stringify(data));
      console.log('Starknet tokens saved to localStorage.');
      return data;
    } catch (error) {
      console.error('Error saving Starknet tokens to localStorage:', error);
    }
  } else {
    console.error('Invalid JSON data received from API.');
  }
  return null;
}

function getMarketTokenSymbol(tokens = null) {
  // get all token symbol 
  // tokens is a list of data like that : 
  // {"position":1,"name":"Ethereum","symbol":"ETH","address":"0x49d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7","decim...
  //const tokenSymbols = tokens.map(token => token.symbol).filter(symbol => symbol != "\b8");
  if (tokens === null) {
    tokens = loadTokens();
  }
  const tokenSymbols = tokens.map(token => token.symbol);
  return tokenSymbols;
}

function getMarketTokenAddress(tokens = null) {
  // get all token address from localstorage
  if (tokens === null) {
    tokens = loadTokens();
  }
  // get all token symbol 
  // tokens is a list of data like that : 
  // {"position":1,"name":"Ethereum","symbol":"ETH","address":"0x49d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7","decim...
  // return structure  {token1:  address1, token2: address2...} 
  //let tokenAddresses = tokens.map(token => ({[token.symbol]: token.address}));
  const tokenAddresses = tokens.reduce((acc, token) => ({ ...acc, [token.symbol]: token.address }), {});
  return tokenAddresses;
}

function getMarketTokenPrice(tokens = null) {
  // get all token price from localstorage
  if (tokens === null) {
    tokens = loadTokens();
  }
  // get all token symbol 
  // tokens is a list of data like that : 
  // {"position":1,"name":"Ethereum","symbol":"ETH","address":"0x49d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7","decim...
  // return structure  {token1:  address1, token2: address2...} 
  //let tokenPrices = tokens.map(token => ({[token.symbol]: token.market.currentPrice}));
  const tokenPrices = tokens.reduce((acc, token) => ({ ...acc, [token.symbol]: token.market.currentPrice }), {});
  return tokenPrices;
}

function extractPrices(data, tokenSymbol) {
  if (!data || data.length === 0) {
    return [];
  }

  // Find the token data based on the symbol
  const tokenData = data.find(token => token.symbol === tokenSymbol);

  if (!tokenData || !tokenData.linePriceFeedInUsd) {
    return [];
  }

  return tokenData.linePriceFeedInUsd.map(priceData => priceData.value);
}

function loadTokens() {
  const storedTokens = localStorage.getItem('starknetTokens');
  const tokens = JSON.parse(storedTokens);
  return tokens;
}
function getMarketTokenMcap(tokens = null) {
  // get Market Cap from localstorage
  if (tokens === null) {
    tokens = loadTokens();
  }

  const tokenMcaps = tokens.reduce((acc, token) => ({
    ...acc,
    [token.symbol]: token.market.marketCap === 0 ? token.market.starknetTvl : token.market.marketCap
  }), {});

  return tokenMcaps;
}

// Assuming brianBalances is an array of objects returned by the Brian API
function extractBrianBalances(brianBalance) {
  if (!brianBalance || brianBalance.length === 0) {
    return 0; // No balances to check
  }

  const extractedParams = brianBalance["extractedParams"];
  if (!extractedParams) {
    return 0; // No extractedParams found
  }

  if (
    extractedParams.action === "balance" &&
    extractedParams.chain === "Starknet"
  ) {
    const token = brianBalance["extractedParams"]["token1"];
    const balance = parseFloat(brianBalance["data"]["formattedValue"]);
    // return a structure {token: balance}
    return { [token]: balance };
  }
}

function extractAllBrianBalances(brianBalances) {
  if (!brianBalances || brianBalances.length === 0) {
    return 0; // No balances to check
  }
  // for all elems in brianBalances get token balanc into a structure
  // use token symbol as key, and balance as value, list of structure
  // use extractBrianBalances for each elem in brianBalances
  const extractedBalances = [];
  for (const brianBalance of brianBalances) {
    const balance = extractBrianBalances(brianBalance);
    if (balance !== 0) {
      const symbol = brianBalance["extractedParams"]["symbol"];
      // append balance structure to array extractedBalances
      extractedBalances.push(balance);
      //extractedBalances[symbol] = balance;
    }
  }
  return extractedBalances;
}

function calculateEMA7HourlyAndMaxStdDev(prices) {
  let length = prices.length;
  if (length < 168) {
    if (length < 3) {
      throw new Error("EMA7 need more longer prices history");
    }
  }

  // Définir le multiplicateur
  const multiplier = 2 / (length + 1);

  // Calculer l'EMA en parcourant les prix du plus récent au plus ancien
  let ema = prices[length - 1];
  let lastWeekEMAs = [ema];

  for (let i = length - 2; i >= 0; i--) {
    ema = prices[i] * multiplier + ema * (1 - multiplier);
    lastWeekEMAs.unshift(ema);
    if (lastWeekEMAs.length > 168) {
      lastWeekEMAs.pop();
    }
  }

  // Calculer la variance maximale des 168 dernières MME
  const meanEMA = lastWeekEMAs.reduce((sum, value) => sum + value, 0) / length;
  const maxStdDev = Math.sqrt(Math.max(...lastWeekEMAs.map(value => Math.pow(value - meanEMA, 2)))) / meanEMA * 100;

  return { ema, maxStdDev };
}

const reduceTokenList = (tokens) => {
  // reduce list of tokens by removing ???
  // TODO : make it better
  const uniqueTokens = {};
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
  const listReducedTokens = filteredTokens.map((token) => token.symbol);
  return listReducedTokens;
};

function removeTokensWithSuffix(tokens, suffix) {
  return tokens.filter(token => !token.endsWith(suffix) || token === suffix);
}

function filterTokens(tokens, listReducedTokensInput = null) {
  // if listReducedTokensInput is not null, use it
  if (listReducedTokensInput) {
    const goodTokens = tokens.filter(token => {
      return listReducedTokensInput.includes(token.symbol) && !listReducedTokensInput.some(reducedToken => token.symbol !== reducedToken && token.symbol.includes(reducedToken));
    });
    return goodTokens;
  }

  // if listReducedTokensInput is null, use localStorage
  const listReducedTokensString = localStorage.getItem('listReducedTokens');
  // if data in localStorage
  if (listReducedTokensString) {
    const listReducedTokens = JSON.parse(listReducedTokensString);
    const goodTokens = tokens.filter(token => {
      return listReducedTokens.includes(token.symbol) && !listReducedTokens.some(reducedToken => token.symbol !== reducedToken && token.symbol.includes(reducedToken));
    });
    return goodTokens;
  }
  // if no data in localStorage, return all tokens
  return tokens;
}

function App() {
  const [myWalletAccount, setMyWalletAccount] = useState(null);
  const [account, setAccount] = useState(null);
  const [balances, setBalances] = useState({});
  const [balancesWithBrian, setBalancesWithBrian] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [totalWalletValue, setTotalWalletValue] = useState(0);
  const [investmentAmount, setInvestmentAmount] = useState("");
  const [selectedSolution, setSelectedSolution] = useState('Balanced'); // Set 'Balanced' as default
  const [investmentBreakdown, setInvestmentBreakdown] = useState(null);

  // Access the API key from environment variables
  const brianApiKey = import.meta.env.VITE_BRIAN_API_KEY;
  const rcpApiKey = import.meta.env.VITE_RCP_API_KEY;
  const options = {
    apiKey: brianApiKey,
  };
  console.log("Brian API Key:", brianApiKey);
  const brian = new BrianSDK(options);

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

  const handleSolutionSelect = (solution) => {
    setSelectedSolution(solution);

    // Replace with your logic to get investment breakdown for the selected solution
    const breakdown = getInvestmentBreakdown(solution, investmentAmount);
    setInvestmentBreakdown(breakdown);
  };

  // Placeholder function to simulate getting investment breakdown data
  const getInvestmentBreakdown = (solution, amount) => {
    // Replace this with your actual logic to fetch or calculate the breakdown
    // based on the selected solution and investment amount.

    if (solution === 'Secure') {
      return {
        USDC: 0.6 * amount,
        ETH: 0.3 * amount,
        WBTC: 0.1 * amount,
      };
    } else if (solution === 'Balanced') {
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
      sortedTokens = sortedTokens.slice(0, 10);
      let sortedTokensData = filterTokens(goodTokensData, sortedTokens);
      // get token actual prices
      const tokenPrices = getMarketTokenPrice(sortedTokensData);
      let tokenEMA7Hourly = {};
      let tokenMaxStdDev = {};
      for (const token of sortedTokens) {
        const tokenPriceHistory = extractPrices(sortedTokensData, token);
        try {
          const tokenEMA7HourlyAndMaxStdDev = calculateEMA7HourlyAndMaxStdDev(tokenPriceHistory);
          tokenEMA7Hourly[token] = tokenEMA7HourlyAndMaxStdDev.ema;
          tokenMaxStdDev[token] = tokenEMA7HourlyAndMaxStdDev.maxStdDev;
          // detect stable coin and excluded
          if (tokenMaxStdDev[token] < 2) {
            if (tokenPrices[token] < 1.07 && tokenPrices[token] > 0.93) {
              delete tokenEMA7Hourly[token];
              delete tokenMaxStdDev[token];
              sortedTokens = sortedTokens.filter(t => t !== token);
            }
          }
        } catch (error) {
          console.error(`Error calculating EMA and MaxStdDev for ${token}:`, error);
          setError(error.message);
          return null;
        }

      }
      sortedTokensData = filterTokens(sortedTokensData, sortedTokens)
      console.log("sortedTokens:");
      console.log(sortedTokens);
      // calculate % distribution per assets
      // approx: EMA7D(Mcap) = Mcap(Today) * EMA7D(Price) / Price(Today)
      // approx alpha to have 3% for the last asset with smallest Mcap
      const alpha = 0.75 * Math.log(0.03) / (Math.log(tokenMcaps[sortedTokens.slice(-1)[0]] / tokenMcaps[sortedTokens.slice(0)[0]]))
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
      if (sum < 1.0001 && sum > 0.9999) {
        console.error("Sum of tokenDistribution is not 1");
      }
      console.log("tokenDistribution:");
      console.log(tokenDistribution);
      console.log("tokenEMA7Hourly:")
      console.log(tokenEMA7Hourly)
      console.log("tokenMaxStdDev:")
      console.log(tokenMaxStdDev)


      return {
        ETH: 0.5 * amount,
        USDC: 0.3 * amount,
        STRK: 0.2 * amount,
      };
    } else if (solution === 'Offensive') {
      return {
        STRK: 0.7 * amount,
        ETH: 0.2 * amount,
        WBTC: 0.1 * amount,
      };
    }

    return null;
  };
  const handleInvestmentInputChange = (e) => {
    let inputValue = e.target.value;

    // Check if input ends with '%' (percentage)
    if (inputValue.endsWith('%')) {
      const percentage = parseFloat(inputValue.slice(0, -1)) / 100;
      inputValue = (totalWalletValue * percentage).toFixed(5);
    } else {
      // If it's a number, ensure it doesn't exceed the total wallet value
      const amount = parseFloat(inputValue);
      if (amount > totalWalletValue) {
        inputValue = totalWalletValue.toFixed(5);
      }
    }

    setInvestmentAmount(inputValue);
  };

  const handlePercentageSelect = (percentage) => {
    const amount = (totalWalletValue * (percentage / 100)).toFixed(5);
    setInvestmentAmount(amount);
  };
  const handleConnectWallet = async () => {
    try {
      console.log("enter");
      const selectedWalletSWO = await connect({ modalMode: "alwaysAsk", modalTheme: "light" });
      console.log("selectedWalletSWO:");
      console.log(selectedWalletSWO);
      const newWalletAccount = new WalletAccount({ nodeUrl: constants.NetworkName.SN_MAIN }, selectedWalletSWO);
      await newWalletAccount.requestAccounts();
      console.log("myWalletAccount:");
      console.log(newWalletAccount);
      //const bl = await myWalletAccount.getBlockNumber();
      //console.log("block n°:" + bl);
      console.log("address:");
      const account = newWalletAccount.address;
      console.log(account);
      setAccount(account);
      setMyWalletAccount(newWalletAccount);
      // retrieve avnu market
      if (mode_debug !== true) {
        const market = await getMarket();
        if (market == null) {
          setError("No price feed");
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
      setError(err.message);
    }
  };

  useEffect(() => {
    // Update investment breakdown whenever investmentAmount changes
    if (investmentAmount && selectedSolution) {
      const breakdown = getInvestmentBreakdown(selectedSolution, parseFloat(investmentAmount));
      setInvestmentBreakdown(breakdown);
    } else {
      setInvestmentBreakdown(null); // Clear breakdown if no amount or solution selected
    }
  }, [investmentAmount, selectedSolution]);

  useEffect(() => {
    const fetchBalances = async () => {
      if (account && myWalletAccount) {
        let newBalances = {};
        //const provider = new RpcProvider({ nodeUrl: constants.NetworkName.SN_MAIN }); // Create RpcProvider
        const provider = new RpcProvider({ nodeUrl: "https://rpc.nethermind.io/mainnet-juno", headers: { 'x-apikey': rcpApiKey } }); // Create RpcProvider
        const tokenAddresses = getMarketTokenAddress();
        const tokenPrices = getMarketTokenPrice();
        try {
          for (const token in tokenAddresses) {
            try {
              console.log(tokenAddresses[token]);
              const { abi: abi } = await provider.getClassAt(tokenAddresses[token]); // Fetch ABI using class hash
              const contract = new Contract(abi, tokenAddresses[token], myWalletAccount);

              // Fetch balance and decimals
              const balanceResponse = await contract.balanceOf(account);
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
              setError(err.message);
            }
          }
        } catch (err) {
          console.error("Error fetching balances:", err);
          setError(err.message);
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
        setBalances(mixedBalances);
        // Calculate total wallet value
        const totalWalletValue = mixedBalances.reduce((sum, item) => sum + parseFloat(item.total), 0);
        setTotalWalletValue(totalWalletValue);
        setInvestmentAmount(totalWalletValue.toFixed(5));

      }
    };

    // fetch balance with brian api
    const fetchBalancesWithBrian = async () => {
      if (account && myWalletAccount) {
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
          "address": account
        });

        const newBrianBalances = extractAllBrianBalances(brianBalances);

        setBalancesWithBrian(newBrianBalances);
      }

    };

    fetchBalances();
    //fetchBalancesWithBrian();
  }, [account, myWalletAccount]);

  return (
    <div>
      <h1>StarkNet Portfolio Wallet</h1>
      <h2>Welcome to Automatic Balanced Bag by AI</h2>
      <h3>1- Select amount to invest</h3>
      {error && <div style={{ color: "red" }}>{error}</div>}
      {account ? (
        <>
          <h4>Wallet Address: {account}</h4>
          {isLoading ? (
            <p>Loading balances...</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th className="table-header">Asset</th>
                  <th className="table-header">Quantity</th>
                  <th className="table-header">Price</th>
                  <th className="table-header">Total</th>
                </tr>
              </thead>
              <tbody>
                {balances.map((item) => (
                  <tr key={item.token}>
                    <td>{item.token}</td>
                    <td>{item.balance}</td>
                    <td>{item.price.toFixed(5)}</td>
                    <td>{item.total.toFixed(5)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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
          {/* Investment Input Section */}
          {totalWalletValue > 0 && (
            <div>
              <label htmlFor="investmentInput">
                Enter investment amount (in $): $
              </label>
              <input
                type="text"
                id="investmentInput"
                value={investmentAmount}
                onChange={handleInvestmentInputChange} // Use the new handler
              />
              {/* Percentage Buttons */}
              <div>
                <button onClick={() => handlePercentageSelect(25)}>25%</button>
                <button onClick={() => handlePercentageSelect(50)}>50%</button>
                <button onClick={() => handlePercentageSelect(100)}>100%</button>
              </div>
            </div>
          )}
          {/* Conditionally display Investment Solution Section */}
          {!isLoading && totalWalletValue > 0 && (
            <>
              <h3>2- Select investment solution</h3> {/* New section title */}
              <div>
                <button
                  onClick={() => handleSolutionSelect('Secure')}
                  style={{ backgroundColor: selectedSolution === 'Secure' ? 'lightblue' : 'white' }} >Secure</button>
                <button
                  onClick={() => handleSolutionSelect('Balanced')}
                  style={{ backgroundColor: selectedSolution === 'Balanced' ? 'lightblue' : 'white' }}>Balanced</button>
                <button
                  onClick={() => handleSolutionSelect('Offensive')}
                  style={{ backgroundColor: selectedSolution === 'Offensive' ? 'lightblue' : 'white' }}>Offensive</button>
              </div>
            </>
          )}
          {/* Display Investment Breakdown Table */}
          {investmentBreakdown && (
            <>
              <h4>Investment Breakdown:</h4>
              <table>
                <thead>
                  <tr>
                    <th className="table-header">Token</th>
                    <th className="table-header">Amount ($)</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(investmentBreakdown).map(([token, amount]) => (
                    <tr key={token}>
                      <td>{token}</td>
                      <td>{amount.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

        </>
      ) : (
        <button onClick={handleConnectWallet}>Connect Wallet</button>
      )}
    </div>
  );
}

export default App;
