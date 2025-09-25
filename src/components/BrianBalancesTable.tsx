import React from "react";

interface Props {
  balancesWithBrian: Record<string, number>[] | null;
}

const BrianBalancesTable: React.FC<Props> = ({ balancesWithBrian }) => {
  if (!balancesWithBrian || Object.keys(balancesWithBrian).length === 0) return null;
  return (
    <>
      <h3>Table by Brian AI</h3>
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
  );
};

export default BrianBalancesTable;
