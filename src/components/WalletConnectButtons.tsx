import React from "react";

interface Props {
  handleConnectWallet: () => void;
  handleConnectAptosWallet: () => void;
}

const WalletConnectButtons: React.FC<Props> = ({
  handleConnectWallet,
  handleConnectAptosWallet,
}) => (
  <div>
    <button onClick={handleConnectWallet}>Connect Starknet Wallet</button> -{" "}
    <button onClick={handleConnectAptosWallet}>Connect Aptos Wallet</button>
  </div>
);

export default WalletConnectButtons;
