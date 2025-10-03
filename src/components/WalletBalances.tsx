import React, { useEffect, useMemo, useRef, useState } from "react";
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
  pieChartDataBalances: { name: string; value: number }[];
  COLORS: string[];
}

/** Hook: force ResponsiveContainer to recompute when container (re)appears or resizes */
function useChartKey() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [key, setKey] = useState(0);

  useEffect(() => {
    // micro “kick” au mount (corrige le cas démarrage très étroit)
    const t = setTimeout(() => setKey((k) => k + 1), 0);

    let ro: ResizeObserver | null = null;
    if (ref.current && "ResizeObserver" in window) {
      ro = new ResizeObserver(() => setKey((k) => k + 1));
      ro.observe(ref.current);
    } else {
      const onResize = () => setKey((k) => k + 1);
      window.addEventListener("resize", onResize);
      return () => window.removeEventListener("resize", onResize);
    }

    return () => {
      clearTimeout(t);
      if (ro && ref.current) ro.unobserve(ref.current);
    };
  }, []);

  return { containerRef: ref, chartKey: key };
}

/* -------- Légende (barres de progression) -------- */
function SideLegend({
  data,
  colors,
  total,
  onHover,
  onLeave,
}: {
  data: { name: string; value: number }[];
  colors: string[];
  total: number;
  onHover: (i: number) => void;
  onLeave: () => void;
}) {
  const sorted = [...data].sort((a, b) => (b.value || 0) - (a.value || 0));
  return (
    <div className="side-legend">
      <div className="legend">
        {sorted.map((it, i) => {
          const pct = ((Number(it.value) || 0) / (total || 1)) * 100;
          return (
            <div
              key={it.name + i}
              className="legend-item"
              style={{ ["--p" as any]: `${pct}%` }}
              onMouseEnter={() => onHover(i)}
              onMouseLeave={onLeave}
            >
              <span
                className="legend-dot"
                style={{ background: colors[i % colors.length] }}
              />
              <div className="legend-name">{it.name}</div>
              <div className="legend-val">{pct.toFixed(1)}%</div>
            </div>
          );
        })}
      </div>
    </div>
  );
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
  const { containerRef, chartKey } = useChartKey();

  const formatCurrency = (n: number) =>
    n.toLocaleString(undefined, {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 2,
    });

  const sum = useMemo(() => {
    const s = pieChartDataBalances.reduce(
      (acc, d) => acc + (Number(d.value) || 0),
      0
    );
    return s > 0 ? s : 1;
  }, [pieChartDataBalances]);

  const centerAmount = useMemo(() => {
    const s = pieChartDataBalances.reduce(
      (acc, d) => acc + (Number(d.value) || 0),
      0
    );
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
    () =>
      [...pieChartDataBalances].sort(
        (a, b) => (b.value || 0) - (a.value || 0)
      ),
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
                placeholder="Type an amount (e.g., 12.50)"
  aria-describedby="wallet-amount-hint"
  inputMode="decimal"
  title="You can type an amount (e.g., 12.50) or use the 25/50/100% shortcuts."
            />
            <small id="wallet-amount-hint" className="field-hint">
  You can type an amount or use the 25%, 50%, 100% buttons.
</small>
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
          {/* TABLE */}
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
            {/* <<< Ajout : total sous le tableau (seulement si > 0) >>> */}
  {totalWalletValue > 0 && (
    <p className="total-wallet-note">
      Total Wallet Value: {formatCurrency(totalWalletValue)}
    </p>
  )}
          </div>

          {/* DONUT + LÉGENDE */}
          <div className="chart-col" ref={containerRef}>
            <div className="chart-box">
              <ResponsiveContainer key={chartKey} width="100%" height="100%">
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
                        className={
                          hoverIndex !== null && hoverIndex !== i
                            ? "slice-dim"
                            : ""
                        }
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
                      color: "#111827",
                      boxShadow: "0 8px 24px rgba(0,0,0,.12)",
                    }}
                    itemStyle={{
                      fontSize: 11,
                      lineHeight: 1.1,
                      color: "#111827",
                    }}
                    labelStyle={{
                      fontSize: 10,
                      color: "#6b7280",
                      marginBottom: 2,
                    }}
                    formatter={(v: any, n: any) => {
                      const num = Number(v) || 0;
                      const pretty =
                        Math.abs(num) >= 1000
                          ? `$${num.toLocaleString(undefined, {
                              maximumFractionDigits: 0,
                            })}`
                          : `$${num.toLocaleString(undefined, {
                              maximumFractionDigits: 2,
                            })}`;
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
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>
                    Wallet
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 800 }}>
                    {formatCurrency(centerAmount)}
                  </div>
                </div>
              </div>
            </div>

            <SideLegend
              data={pieChartDataBalances}
              colors={COLORS}
              total={sum}
              onHover={(i) => setHoverIndex(i)}
              onLeave={() => setHoverIndex(null)}
            />
          </div>
        </div>
      )}


    </>
  );
};

export default WalletBalances;
