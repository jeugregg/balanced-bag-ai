import React from "react";

interface Props {
  isLoading: boolean;
  totalWalletValue: number;
  selectedSolution: string;
  handleSolutionSelect: (solution: string) => void;
}

const InvestmentStrategyButtons: React.FC<Props> = ({
  isLoading,
  totalWalletValue,
  selectedSolution,
  handleSolutionSelect,
}) => {
  if (isLoading || totalWalletValue <= 0) return null;
  return (
    <>
      <h3>Choose Your Investment Strategy</h3>
      <div>
        <button
          title="A conservative approach that prioritizes stability and low risk. This strategy allocates a larger portion of your portfolio to stablecoins and low-volatility assets."
          className={`investment-button ${selectedSolution === 'Secure' ? 'selected' : ''}`}
          onClick={() => handleSolutionSelect('Secure')}
        >
          Secure
        </button>
        <button
          title="A balanced approach that balances risk and returns. This strategy allocates an equal portion of your portfolio to both stablecoins and high-volatility assets."
          className={`investment-button ${selectedSolution === 'Balanced' ? 'selected' : ''}`}
          onClick={() => handleSolutionSelect('Balanced')}
        >
          Balanced
        </button>
        <button
          title="An aggressive approach that prioritizes high returns and is willing to take on higher risk. This strategy allocates a larger portion of your portfolio to higher-risk assets, such as cryptocurrencies with high growth potential."
          className={`investment-button ${selectedSolution === 'Offensive' ? 'selected' : ''}`}
          onClick={() => handleSolutionSelect('Offensive')}
        >
          Offensive
        </button>
      </div>
    </>
  );
};

export default InvestmentStrategyButtons;
