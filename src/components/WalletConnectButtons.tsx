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
    <button
      onClick={handleConnectWallet}
      disabled={true}
      title="Starknet integration temporarily disabled due to Brian AI discontinuation"
      style={{ opacity: 0.5, cursor: "not-allowed" }}
    >
      Connect Starknet Wallet (Disabled)
    </button>
    {" - "}
    <button onClick={handleConnectAptosWallet}>Connect Aptos Wallet</button>
  </div>
);

export default WalletConnectButtons;
