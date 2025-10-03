import React, { useMemo, useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

interface InvestmentBreakdownData {
  [token: string]: {
    amount: number;
    percentage: number;
  };
}

interface Props {
  investmentBreakdown: InvestmentBreakdownData;
  // pieChartData: value = pourcentage (0–100)
  pieChartData: { name: string; value: number }[];
  COLORS: string[];
}

const InvestmentBreakdown: React.FC<Props> = ({
  investmentBreakdown,
  pieChartData,
  COLORS,
}) => {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const totalPct = useMemo(
    () => Math.round(pieChartData.reduce((s, d) => s + (Number(d.value) || 0), 0)),
    [pieChartData]
  );

  const sorted = useMemo(
    () => [...pieChartData].sort((a, b) => (b.value || 0) - (a.value || 0)),
    [pieChartData]
  );

  return (
    <>
      <h4>Your Investment Breakdown</h4>

      <div className="two-col">
        {/* TABLE à gauche */}
        <div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Token</th>
                  <th>Amount ($)</th>
                  <th>Percentage (%)</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(investmentBreakdown).map(([token, data]) => (
                  <tr key={token}>
                    <td>{token}</td>
                    <td className="num">{Number(data.amount).toFixed(2)}</td>
                    <td className="num">{Number(data.percentage).toFixed(1)}</td>
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
                <div style={{ fontSize: 12, color: "var(--muted)" }}>Strategy</div>
                <div style={{ fontSize: 12, fontWeight: 800 }}>{totalPct}%</div>
                
              </div>
            </div>
          </div>

          {/* LÉGENDE à droite avec barres */}
          <div className="side-legend">
            <div className="legend">
              {sorted.map((it, i) => (
                <div
                  key={it.name + i}
                  className="legend-item"
                  style={{ ["--p" as any]: `${Number(it.value || 0).toFixed(1)}%` }}
                  onMouseEnter={() => setHoverIndex(i)}
                  onMouseLeave={() => setHoverIndex(null)}
                >
                  <span
                    className="legend-dot"
                    style={{ background: COLORS[i % COLORS.length] }}
                  />
                  <div className="legend-name">{it.name}</div>
                  <div className="legend-val">{Number(it.value || 0).toFixed(1)}%</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default InvestmentBreakdown;
