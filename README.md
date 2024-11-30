# Balanced bag by AI

## For StarkNet Wallet

This web app is a portfolio manager on the StarkNet blockchain ([StarkNet website](https://starkware.co/starknet/)) designed to automatically rebalance your wallet assets using AI.

To be effective, you need to execute it every weeks or months.

Web App link : [https://balanced-bag-ai.netlify.app/](https://balanced-bag-ai.netlify.app/)

Video demo link : [https://youtu.be/xfpcEbP8ETc](https://youtu.be/xfpcEbP8ETc)  

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

This project is for educational and demonstration purposes only. Use it at your own risk. Always do your own research before investing in cryptocurrencies.

## Issues

- **Token Availability and Prices:** Please note that all tokens on StarkNet and their corresponding prices may not always be available. This can be due to various factors such as market volatility, data provider limitations, or temporary technical issues. 
- **Swap Issues (USDC and Low Liquidity Tokens):** You might encounter difficulties when swapping USDC or tokens with low liquidity. These issues could manifest as failed transactions or unfavorable exchange rates. This is often due to insufficient liquidity in the corresponding pools. 

