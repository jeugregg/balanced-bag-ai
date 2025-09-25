import React from "react";
import { PieChart, Pie, Cell } from "recharts";

interface InvestmentBreakdownData {
  [token: string]: {
    amount: number;
    percentage: number;
  };
}

interface Props {
  investmentBreakdown: InvestmentBreakdownData;
  pieChartData: { name: string; value: number }[];
  COLORS: string[];
}

const InvestmentBreakdown: React.FC<Props> = ({
  investmentBreakdown,
  pieChartData,
  COLORS,
}) => (
  <>
    <h4>Your Investment Breakdown</h4>
    <div className="breakdown-container">
      <div className="breakdown-column">
        <table className="breakdown-table">
          <thead>
            <tr>
              <th className="table-header">Token</th>
              <th className="table-header">Amount ($)</th>
              <th className="table-header">Percentage (%)</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(investmentBreakdown).map(([token, data]) => (
              <tr key={token}>
                <td>{token}</td>
                <td>{data.amount.toFixed(2)}</td>
                <td>{data.percentage.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="breakdown-column">
        <PieChart width={400} height={300} className="breakdown-chart" margin={{ top: 5, right: 5, left: 20, bottom: 5 }}>
          <Pie
            data={pieChartData}
            cx={150}
            cy={150}
            outerRadius={80}
            fill="#8884d8"
            paddingAngle={5}
            dataKey="value"
            labelLine={true}
            label={({ name, value }) => `${name} ${value.toFixed(1)}%`}
          >
            {pieChartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
        </PieChart>
      </div>
    </div>
  </>
);

export default InvestmentBreakdown;
