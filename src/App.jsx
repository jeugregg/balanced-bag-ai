import React, { useState, useEffect } from "react";
    import { Contract, WalletAccount, uint256, constants, RpcProvider } from "starknet";
    import { connect } from '@starknet-io/get-starknet';
    import { BrianSDK } from "@brian-ai/sdk";
    // Replace with actual token contract addresses
    const tokenAddresses = {
      ETH: "0x049D36570D4e46f48e99674bd3fcc84644DdD6b96F7C741B1562B82f9e004dC7",
      STARK: "0x04718f5a0Fc34cC1AF16A1cdee98fFB20C31f5cD61D6Ab07201858f4287c938D",
      USDC: "0x053c91253bc9682c04929ca02ed00b3e423f6710d2ee7e0d5ebb06f3ecf368a8",
      USDT: "0x068F5c6a61780768455de69077E07e89787839bf8166dEcfBf92B645209c0fB8",
      WBTC: "0x03fe2b97c1fd336e750087d68b9b867997fd64a2661ff3ca5a7c771641e8e7ac" // WBTC contract address
    };

    // Assuming brianBalances is an array of objects returned by the Brian API

    function checkBrianBalances(brianBalances, token) {
      if (!brianBalances || brianBalances.length === 0) {
        return false; // No balances to check
      }

      const extractedParams = brianBalances[0]["extractedParams"];
      if (!extractedParams) {
        return false; // No extractedParams found
      }

      return (
        extractedParams.action === "balance" &&
        extractedParams.token1 === token && // Use the token parameter here
        extractedParams.chain === "Starknet"
      );
    }

    function App() {
      const [myWalletAccount, setMyWalletAccount] = useState(null);
      const [account, setAccount] = useState(null);
      const [balances, setBalances] = useState({});
      const [balancesWithBrian, setBalancesWithBrian] = useState(null);
      const [error, setError] = useState(null);

      // Access the API key from environment variables
      const brianApiKey = import.meta.env.VITE_BRIAN_API_KEY;
      const options = {
        apiKey: brianApiKey,
      };
      console.log("Brian API Key:", brianApiKey);
      const brian = new BrianSDK(options);

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
        } catch (err) {
          console.error("Error connecting wallet:", err);
          setError(err.message);
        }
      };

      useEffect(() => {
        const fetchBalances = async () => {
          if (account && myWalletAccount) {
            const newBalances = {};
            const provider = new RpcProvider({ nodeUrl: constants.NetworkName.SN_MAIN }); // Create RpcProvider

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
                  newBalances[token] = "0"; // Or handle it differently
                }
              } catch (err) {
                console.error(`Error fetching balance for ${token}:`, err);
                setError(err.message);
              }
            }
            setBalances(newBalances);
          }
        };

        // fetch balance with brian api
        const fetchBalancesWithBrian = async () => {
          if (account && myWalletAccount) {
            try {
              const brianBalances = await brian.transact({
                prompt: "Get wallet balance in USDC on Starknet",
                "address": account
              });
              //setBalances(brianBalances);
              console.log("brianBalances:", brianBalances);
              // check if brianBalances[0]["extractedParams"] contains these fields :
              //   action: "balance",
              //   token1: "USDC",
              //   chain: "Starknet"
              // Check for a different token (e.g., ETH)
              if (checkBrianBalances(brianBalances, "USDC")) {
                console.log("brianBalances[0] contains the specified fields for ");
              } else {
                console.log("brianBalances[0] does not contain the specified fields for");
              }
              
              const nb_token = brianBalances[0]["data"]["formattedValue"];
              console.log("nb_token:", nb_token);

              setBalancesWithBrian(nb_token);
            } catch (err) {
              console.error("Error fetching balance with Brian:", err);
              setError(err.message);
            }

          }
        };

        fetchBalances();
        fetchBalancesWithBrian();
      }, [account, myWalletAccount]);

      return (
        <div>
          <h1>StarkNet Portfolio Wallet</h1>
          {error && <div style={{ color: "red" }}>{error}</div>}
          {account ? (
            <>
              <h2>Wallet Address: {account}</h2>
              <table>
                <thead>
                  <tr>
                    <th className="table-header">Asset</th>
                    <th className="table-header">Quantity</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(balances).map(([token, balance]) => (
                    <tr key={token}>
                      <td>{token}</td>
                      <td>{balance}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <h3>Table by Brian AI</h3> {/* New table */}
              <table>
                <thead>
                  <tr>
                    <th className="table-header">Asset</th>
                    <th className="table-header">Quantity</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>USDC</td>
                    <td>{balancesWithBrian || "0"}</td> {/* Display USDC balance or 0 if undefined */}
                  </tr>
                </tbody>
              </table>
            </>
          ) : (
            <button onClick={handleConnectWallet}>Connect Wallet</button>
          )}
        </div>
      );
    }

    export default App;
