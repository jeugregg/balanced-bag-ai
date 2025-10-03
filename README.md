# Balanced bag by AI

A portfolio manager for both StarkNet and Aptos blockchains designed to automatically rebalance your wallet assets using AI.

Web Live App link : [https://balanced-bag-ai.netlify.app/](https://balanced-bag-ai.netlify.app/)

Video demo link : [https://youtu.be/T-NDKHDWJD0](https://youtu.be/T-NDKHDWJD0)  
## Common Features

**Strategies:**

* **Secure:** Conservative approach with focus on established tokens
* **Balanced:** Moderate risk-reward with market cap weighted allocations
* **Offensive:** Aggressive strategy for higher potential returns
* **AI-Powered:** Dynamic allocation using AI market analysis

**Technology:**

* **React & TypeScript:** Modern front-end development
* **Vite:** Fast build tool and development server
* **AI Integration:** Smart portfolio optimization
* **Multi-Chain Support:** Unified interface for both StarkNet and Aptos


## Supported Blockchains

This project is for educational and demonstration purposes only. Use it at your own risk. Always do your own research before investing in cryptocurrencies.

### Aptos Wallet

Built on the Aptos blockchain ([Aptos website](https://aptosfoundation.org/)), this integration provides fast, secure, and efficient portfolio management.

**Features:**

* **Native Aptos Support:** Seamless integration with Aptos blockchain
* **Hyperion DEX Integration:** Direct access to Hyperion's liquidity pools  [https://hyperion.xyz/pools](https://hyperion.xyz/pools)
* **Real-time Market Data:** Live pricing and liquidity information
* **Automated Portfolio Rebalancing:** AI-powered portfolio optimization

**Technology Stack for Aptos:**

* **Aptos Blockchain:** A Layer-1 blockchain built for safe and scalable applications
* **Hyperion DEX:** Leading decentralized exchange on Aptos providing deep liquidity and efficient swaps
* **Secret Network AI:** AI platform for optimizing portfolio allocations
* **Petra Wallet:** Official Aptos wallet for secure transactions



### StarkNet Wallet

This web app is a portfolio manager on the StarkNet blockchain ([StarkNet website](https://starkware.co/starknet/)) designed to automatically rebalance your wallet assets using AI.

To be effective, you need to execute it every weeks or months.


**Features:**

* **Automated Rebalancing:**  Rebalance your portfolio based on chosen strategies.
* **AI-Powered Strategies:** Utilize AI for token selection and swap preparation.
* **Three Strategy Options:** Choose from Secure, Balanced, or Offensive strategies.
* **Market Data Integration:** Integrates with AVNU Finance for real-time market data.
* **AVNU Finance Swaps:**  Execute swaps directly on AVNU Finance.

**Strategies:**

* **Balanced:** This strategy primarily follows a function of the 7-day Exponential Moving Average (EMA) of the market cap for asset allocation.

**Technology:**

* **StarkNet:**  A Layer-2 scaling solution for Ethereum that provides fast and low-cost transactions.
* **Brian AI:** An AI platform used for token selection and swap preparation (https://www.brianknows.org/).
* **AVNU Finance:** A decentralized exchange (DEX) on StarkNet providing market data and swap functionality (https://app.avnu.fi/).
* **React:**  A JavaScript library for building user interfaces.
* **Vite:** A build tool that significantly improves the front-end development experience.

**Code Overview:**

* **`getMarket()`:** Fetches token data from the AVNU Finance API and stores it in local storage.
* **`findIndexBySymbol()`:** Helper function to find the index of a token in an array based on its symbol.
* **`extractBrianBalances()`:** Extracts relevant balance information from Brian AI's response.
* **`getInvestmentBreakdown()`:**  This function analyzes your current portfolio holdings and returns a breakdown of your investments. 
    * It uses `extractBrianBalances` to determine the value of your assets.
    * It then calculates the percentage allocation of each token in your portfolio.
    * This information can be used to display a summary of your investment distribution to the user. 


**How It Works:**

1. **Market Data Fetching:** The app fetches token data from the AVNU Finance API.
2. **Strategy Selection:** The user selects a portfolio rebalancing strategy (e.g., Balanced).
3. **AI-Powered Analysis:** Brian AI is used to analyze market data and suggest token allocations based on the chosen strategy.
4. **Swap Execution:** The app facilitates swaps on AVNU Finance to rebalance the portfolio according to the AI's recommendations.


**Future Development:**

* **Enhanced UI:** Improve the user interface for better visualization and control.
* **More Strategies:** Implement additional portfolio rebalancing strategies.
* **User Customization:** Allow users to customize strategy parameters.
* **Security Audits:** Conduct thorough security audits to ensure the safety of user funds. 

**Disclaimer:** 


## Issues

- **Token Availability and Prices:** Token availability and pricing may vary across both StarkNet and Aptos networks.
- **Liquidity Considerations:** 
  - StarkNet: USDC and low liquidity tokens may face swap issues on AVNU
  - Aptos: Some token pairs may have limited liquidity on Hyperion
- **Network-Specific Limitations:** Each blockchain may have its own transaction speed and cost considerations

## Security

This dApp connects to your wallet but never stores private keys. All transactions require explicit user approval through your wallet (Argent X for StarkNet, Petra for Aptos).

**Disclaimer:** 

This project is for educational and demonstration purposes. Use at your own risk. Always DYOR (Do Your Own Research) before investing in cryptocurrencies.

