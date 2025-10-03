import React, { useMemo, useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

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
  // value = montant $ par token (somme pour le centre)
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
}) => {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const formatCurrency = (n: number) =>
    n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 2 });

  const sum = useMemo(() => {
    const s = pieChartDataBalances.reduce((acc, d) => acc + (Number(d.value) || 0), 0);
    return s > 0 ? s : 1;
  }, [pieChartDataBalances]);

  const centerAmount = useMemo(() => {
    const s = pieChartDataBalances.reduce((acc, d) => acc + (Number(d.value) || 0), 0);
    return s > 0 ? s : totalWalletValue;
  }, [pieChartDataBalances, totalWalletValue]);

  const isPctActive = (pct: number) => {
    const amt = Number(investmentAmount || 0);
    if (!totalWalletValue || !isFinite(amt)) return false;
    const target = totalWalletValue * (pct / 100);
    const tol = Math.max(totalWalletValue * 0.001, 0.01);
    return Math.abs(amt - target) <= tol;
  };

  const sorted = useMemo(
    () => [...pieChartDataBalances].sort((a, b) => (b.value || 0) - (a.value || 0)),
    [pieChartDataBalances]
  );

  return (
    <>
      <h3>Wallet balance to invest</h3>

      {totalWalletValue > 0 && (
        <div style={{ display: "grid", gap: 8, marginBottom: 12 }}>
          <label htmlFor="investmentInput">Choose Wallet Amount: $</label>
          <input
            type="text"
            id="investmentInput"
            value={investmentAmount}
            onChange={handleInvestmentInputChange}
            className="investment-input"
          />
          <div className="btn-group">
            <button
              className={`btn btn--chip ${isPctActive(25) ? "is-active" : ""}`}
              onClick={() => handlePercentageSelect(25)}
            >
              25%
            </button>
            <button
              className={`btn btn--chip ${isPctActive(50) ? "is-active" : ""}`}
              onClick={() => handlePercentageSelect(50)}
            >
              50%
            </button>
            <button
              className={`btn btn--chip ${isPctActive(100) ? "is-active" : ""}`}
              onClick={() => handlePercentageSelect(100)}
            >
              100%
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="loading-container">
          <p>Loading balances... {loadingToken}</p>
        </div>
      ) : (
        <div className="two-col">
          {/* TABLE à gauche */}
          <div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Token</th>
                    <th>Quantity</th>
                    <th>Price</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {balances.map((item) => (
                    <tr key={item.token}>
                      <td>{item.token}</td>
                      <td className="num">{Number(item.balance).toFixed(5)}</td>
                      <td className="num">{item.price.toFixed(5)}</td>
                      <td className="num">{item.total.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* DONUT + LÉGENDE à droite */}
          <div className="chart-col">
            <div className="chart-box">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={sorted}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={110}
                    innerRadius={70}
                    paddingAngle={3}
                    label={false}
                    labelLine={false}
                      cornerRadius={6}
                    stroke="#0f1831"
                    strokeWidth={2}
                    onMouseLeave={() => setHoverIndex(null)}
                  >
                    {sorted.map((_, i) => (
                      <Cell
                        key={i}
                        fill={COLORS[i % COLORS.length]}
                        className={hoverIndex !== null && hoverIndex !== i ? "slice-dim" : ""}
                        onMouseEnter={() => setHoverIndex(i)}
                      />
                    ))}
                  </Pie>
                  <Tooltip
  wrapperStyle={{ outline: "none" }}
  contentStyle={{
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 8,
    padding: "6px 8px",
    color: "#111827",          // texte sombre
    boxShadow: "0 8px 24px rgba(0,0,0,.12)",
  }}
  itemStyle={{ fontSize: 11, lineHeight: 1.1, color: "#111827" }}
  labelStyle={{ fontSize: 10, color: "#6b7280", marginBottom: 2 }}
  formatter={(v: any, n: any) => {
    const num = Number(v) || 0;
    const pretty =
      Math.abs(num) >= 1000
        ? `$${num.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
        : `$${num.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
    return [pretty, n];
  }}
/>

                </PieChart>
              </ResponsiveContainer>

              {/* Étiquette CENTRÉE */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "grid",
                  placeItems: "center",
                  pointerEvents: "none",
                  textAlign: "center",
                  lineHeight: 1.1,
                }}
              >
                <div>
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>Wallet</div>
                  <div style={{ fontSize: 12, fontWeight: 800 }}>
                    {formatCurrency(centerAmount)}
                  </div>
                </div>
              </div>
            </div>

            {/* LÉGENDE à droite avec barres */}
            <div className="side-legend">
              <div className="legend">
                {sorted.map((it, i) => {
                  const pct = ((Number(it.value) || 0) / (sum || 1)) * 100;
                  return (
                    <div
                      key={it.name + i}
                      className="legend-item"
                      style={{ ["--p" as any]: `${pct}%` }}   /* largeur de la barre */
                      onMouseEnter={() => setHoverIndex(i)}
                      onMouseLeave={() => setHoverIndex(null)}
                    >
                      <span
                        className="legend-dot"
                        style={{ background: COLORS[i % COLORS.length] }}
                      />
                      <div className="legend-name">{it.name}</div>
                      <div className="legend-val">{pct.toFixed(1)}%</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {totalWalletValue > 0 && (
        <p style={{ marginTop: 8 }}>Total Wallet Value: {formatCurrency(totalWalletValue)}</p>
      )}
    </>
  );
};

export default WalletBalances;
