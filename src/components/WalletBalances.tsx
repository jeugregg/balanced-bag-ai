import React from "react";
import { PieChart, Pie, Cell } from "recharts";

interface BalanceItem {
  token: string;
  balance: number;
  price: number;
  total: number;
}

interface Props {
  balances: BalanceItem[];
  isLoading: boolean;
  loadingToken: string | null;
  totalWalletValue: number;
  walletBalances: BalanceItem[];
  investmentAmount: string;
  handleInvestmentInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handlePercentageSelect: (percentage: number) => void;
  pieChartDataBalances: { name: string; value: number }[];
  COLORS: string[];
}

const WalletBalances: React.FC<Props> = ({
  balances,
  isLoading,
  loadingToken,
  totalWalletValue,
  walletBalances,
  investmentAmount,
  handleInvestmentInputChange,
  handlePercentageSelect,
  pieChartDataBalances,
  COLORS,
}) => (
  <>
    <h3>Wallet balance to invest</h3>
    {totalWalletValue > 0 && (
      <div>
        <label htmlFor="investmentInput">Choose Wallet Amount: $</label>
        <input
          type="text"
          id="investmentInput"
          value={investmentAmount}
          onChange={handleInvestmentInputChange}
          className="investment-input"
        />
        <div>
          <button onClick={() => handlePercentageSelect(25)}>25%</button>
          <button onClick={() => handlePercentageSelect(50)}>50%</button>
          <button onClick={() => handlePercentageSelect(100)}>100%</button>
        </div>
      </div>
    )}
    {isLoading ? (
      <div className="loading-container">
        {/* ...loading spinner... */}
        <p>Loading balances... {loadingToken}</p>
      </div>
    ) : (
      <div className="breakdown-container">
        <div className="breakdown-column">
          <table>
            <thead>
              <tr>
                <th className="table-header">Token</th>
                <th className="table-header">Quantity</th>
                <th className="table-header">Price</th>
                <th className="table-header">Total</th>
              </tr>
            </thead>
            <tbody>
              {balances.map((item) => (
                <tr key={item.token}>
                  <td>{item.token}</td>
                  <td>{Number(item.balance).toFixed(5)}</td>
                  <td>{item.price.toFixed(5)}</td>
                  <td>{item.total.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="breakdown-column">
          <PieChart width={400} height={300} className="breakdown-chart" margin={{ top: 5, right: 5, left: 20, bottom: 5 }}>
            <Pie
              data={pieChartDataBalances}
              cx={150}
              cy={150}
              outerRadius={80}
              fill="#8884d8"
              paddingAngle={5}
              dataKey="value"
              labelLine={true}
              label={({ name, value }) => `${name} ${((value / totalWalletValue) * 100).toFixed(1)}%`}
            >
              {pieChartDataBalances.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
          </PieChart>
        </div>
      </div>
    )}
    {totalWalletValue > 0 && (
      <p>Total Wallet Value: ${totalWalletValue.toFixed(5)}</p>
    )}
  </>
);

export default WalletBalances;
