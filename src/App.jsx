import React, { useState, useEffect } from "react";
import { Contract, WalletAccount, uint256, constants, RpcProvider } from "starknet";
import { connect } from '@starknet-io/get-starknet';
import { BrianSDK } from "@brian-ai/sdk";
// Replace with actual token contract addresses
const tokenAddresses_default = {
  ETH: "0x049D36570D4e46f48e99674bd3fcc84644DdD6b96F7C741B1562B82f9e004dC7",
  STRK: "0x04718f5a0Fc34cC1AF16A1cdee98fFB20C31f5cD61D6Ab07201858f4287c938D",
  USDC: "0x053c91253bc9682c04929ca02ed00b3e423f6710d2ee7e0d5ebb06f3ecf368a8",
  USDT: "0x068F5c6a61780768455de69077E07e89787839bf8166dEcfBf92B645209c0fB8",
  WBTC: "0x03fe2b97c1fd336e750087d68b9b867997fd64a2661ff3ca5a7c771641e8e7ac"
};

async function getMarket() {
  const response = await fetch('https://starknet.impulse.avnu.fi/v1/tokens', {
    method: 'GET',
    headers: {},
  });

  const data = await response.json();

  // Check if data is valid JSON before storing
  if (typeof data === 'object') {
    try {
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

function getMarketTokenSymbol() {
  const storedTokens = localStorage.getItem('starknetTokens');
  const tokens = JSON.parse(storedTokens);
  // get all token symbol 
  // tokens is a list of data like that : 
  // {"position":1,"name":"Ethereum","symbol":"ETH","address":"0x49d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7","decim...
  //const tokenSymbols = tokens.map(token => token.symbol).filter(symbol => symbol != "\b8");
  const tokenSymbols = tokens.map(token => token.symbol);
  return tokenSymbols;
}

function getMarketTokenAddress() {
  // get all token address from localstorage
  const storedTokens = localStorage.getItem('starknetTokens');
  const tokens = JSON.parse(storedTokens);
  // get all token symbol 
  // tokens is a list of data like that : 
  // {"position":1,"name":"Ethereum","symbol":"ETH","address":"0x49d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7","decim...
  // return structure  {token1:  address1, token2: address2...} 
  //let tokenAddresses = tokens.map(token => ({[token.symbol]: token.address}));
  const tokenAddresses = tokens.reduce((acc, token) => ({ ...acc, [token.symbol]: token.address }), {});
  return tokenAddresses;
}

function getMarketTokenPrice() {
  // get all token price from localstorage
  const storedTokens = localStorage.getItem('starknetTokens');
  const tokens = JSON.parse(storedTokens);
  // get all token symbol 
  // tokens is a list of data like that : 
  // {"position":1,"name":"Ethereum","symbol":"ETH","address":"0x49d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7","decim...
  // return structure  {token1:  address1, token2: address2...} 
  //let tokenPrices = tokens.map(token => ({[token.symbol]: token.market.currentPrice}));
  const tokenPrices = tokens.reduce((acc, token) => ({ ...acc, [token.symbol]: token.market.currentPrice }), {});
  return tokenPrices;
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

function App() {
  const [myWalletAccount, setMyWalletAccount] = useState(null);
  const [account, setAccount] = useState(null);
  const [balances, setBalances] = useState({});
  const [balancesWithBrian, setBalancesWithBrian] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [totalWalletValue, setTotalWalletValue] = useState(0);
  const [investmentAmount, setInvestmentAmount] = useState("");

  // Access the API key from environment variables
  const brianApiKey = import.meta.env.VITE_BRIAN_API_KEY;
  const rcpApiKey = import.meta.env.VITE_RCP_API_KEY;
  const options = {
    apiKey: brianApiKey,
  };
  console.log("Brian API Key:", brianApiKey);
  const brian = new BrianSDK(options);

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
      const market = await getMarket();
      if (market == null) {
        setError("No price feed");
      }
      console.log("market:");
      console.log(market);
    } catch (err) {
      console.error("Error connecting wallet:", err);
      setError(err.message);
    }
  };

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
            </div>
          )}

        </>
      ) : (
        <button onClick={handleConnectWallet}>Connect Wallet</button>
      )}
    </div>
  );
}

export default App;
