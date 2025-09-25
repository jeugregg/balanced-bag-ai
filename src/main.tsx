import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { Network } from "@aptos-labs/ts-sdk";
import { AptosWalletAdapterProvider } from "@aptos-labs/wallet-adapter-react";
const rootElement = document.getElementById("root") as HTMLElement;

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <AptosWalletAdapterProvider
        autoConnect={true}
        dappConfig={{ network: Network.MAINNET, aptosApiKeys: import.meta.env.VITE_APTOS_API_KEY }}
        onError={(error) => {
            console.log("error", error);
        }}
    >
        <App />
    </AptosWalletAdapterProvider>
  </React.StrictMode>
);
