import React from "react";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faTimes, faSpinner, faHandSpock } from '@fortawesome/free-solid-svg-icons';

interface Swap {
  sell: string;
  buy: string;
  amount: number;
}

interface Props {
  swapsToPrepare: Swap[];
  swapStatuses: string[];
  handlePrepareSwapTransactions: () => void;
}

const SwapTable: React.FC<Props> = ({
  swapsToPrepare,
  swapStatuses,
  handlePrepareSwapTransactions,
}) => (
  <>
    <h3>Swap All for Rebalancing</h3>
    <button onClick={handlePrepareSwapTransactions}>Swap All</button>
    <h4>Swaps Details</h4>
    <table className="swaps-table">
      <thead>
        <tr>
          <th className="table-header">Sell Token</th>
          <th className="table-header">Buy Token</th>
          <th className="table-header">Amount ($)</th>
          <th className="table-header">Status</th>
        </tr>
      </thead>
      <tbody>
        {swapsToPrepare.map((swap, index) => (
          <tr key={index}>
            <td>{swap.sell}</td>
            <td>{swap.buy}</td>
            <td>{swap.amount.toFixed(2)}</td>
            <td>
              {swapStatuses[index] === 'pending' && (
                <FontAwesomeIcon icon={faHandSpock} />
              )}
              {swapStatuses[index] === 'loading' && (
                <FontAwesomeIcon icon={faSpinner} spin />
              )}
              {swapStatuses[index] === 'success' && (
                <FontAwesomeIcon icon={faCheck} style={{ color: 'green' }} />
              )}
              {swapStatuses[index] === 'error' && (
                <FontAwesomeIcon icon={faTimes} style={{ color: 'red' }} />
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </>
);

export default SwapTable;
