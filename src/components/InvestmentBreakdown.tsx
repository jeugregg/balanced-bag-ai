import React, { useEffect, useMemo, useRef, useState } from "react";
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

function useChartKey() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [key, setKey] = useState(0);

  useEffect(() => {
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

/* -------- Légende (barres) -------- */
function SideLegend({
  data,
  colors,
  onHover,
  onLeave,
}: {
  data: { name: string; value: number }[];
  colors: string[];
  onHover: (i: number) => void;
  onLeave: () => void;
}) {
  const sorted = [...data].sort((a, b) => (b.value || 0) - (a.value || 0));
  return (
    <div className="side-legend">
      <div className="legend">
        {sorted.map((it, i) => (
          <div
            key={`${it.name}-${i}`}
            className="legend-item"
            style={{ ["--p" as any]: `${Number(it.value || 0)}%` }}
            onMouseEnter={() => onHover(i)}
            onMouseLeave={onLeave}
          >
            <span
              className="legend-dot"
              style={{ background: colors[i % colors.length] }}
            />
            <div className="legend-name">{it.name}</div>
            <div className="legend-val">
              {Number(it.value || 0).toFixed(1)}%
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const InvestmentBreakdown: React.FC<Props> = ({
  investmentBreakdown,
  pieChartData,
  COLORS,
}) => {
  const { containerRef, chartKey } = useChartKey();
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const sorted = useMemo(
    () => [...pieChartData].sort((a, b) => (b.value || 0) - (a.value || 0)),
    [pieChartData]
  );

  return (
    <>
      <h4>Your Investment Breakdown</h4>

      <div className="two-col">
        {/* TABLE */}
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
                        hoverIndex !== null && hoverIndex !== i ? "slice-dim" : ""
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
                  itemStyle={{ fontSize: 11, lineHeight: 1.1, color: "#111827" }}
                  labelStyle={{ fontSize: 10, color: "#6b7280", marginBottom: 2 }}
                  formatter={(v: any, n: any) => [
                    `${Number(v || 0).toFixed(1)}%`,
                    n,
                  ]}
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
                  Strategy
                </div>
                <div style={{ fontSize: 12, fontWeight: 800 }}>Mix</div>
              </div>
            </div>
          </div>

          <SideLegend
            data={pieChartData}
            colors={COLORS}
            onHover={(i) => setHoverIndex(i)}
            onLeave={() => setHoverIndex(null)}
          />
        </div>
      </div>
    </>
  );
};

export default InvestmentBreakdown;
