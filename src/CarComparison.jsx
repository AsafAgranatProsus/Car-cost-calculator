import { useState, useMemo } from "react";

const VPB_RATE = 0.19;
const OPPORTUNITY_RATE = 0.04;
const LOAN_RATE = 0.06;

const FUEL_TYPES = {
  petrol: {
    label: "Petrol",
    short: "Petrol",
    isEV: false,
    annualFuelCost: 2000,
    annualMaintenance: 1100,
    resaleFraction: 0.50,
    color: "#c0392b", accent: "#e74c3c",
    note: "Pure ICE — cheapest to buy, most exposed to 2027 pseudo-eindheffing.",
  },
  hybrid: {
    label: "Self-charging Hybrid",
    short: "Hybrid",
    isEV: false,
    annualFuelCost: 1500,
    annualMaintenance: 1100,
    resaleFraction: 0.54,
    color: "#d35400", accent: "#e67e22",
    note: "No plug. Standard MRB rate, lower fuel than pure petrol.",
  },
  phev: {
    label: "Plug-in Hybrid (PHEV)",
    short: "PHEV",
    isEV: false, isPHEV: true,
    annualFuelCost: 1300,
    annualMaintenance: 1300,
    resaleFraction: 0.48,
    color: "#8e44ad", accent: "#9b59b6",
    note: "Heavier weight class → higher MRB from 2026, no discount. Same 22% bijtelling as petrol.",
  },
  evUsed: {
    label: "Used EV (2022–23)",
    short: "Used EV",
    isEV: true, evRegYear: 2022,
    annualFuelCost: 600,
    annualMaintenance: 700,
    resaleFraction: 0.60,
    color: "#16a085", accent: "#1abc9c",
    note: "17% bijtelling locked in (registered ≤2025). MRB 30% discount through 2026.",
  },
  evNew: {
    label: "New EV (2025–26)",
    short: "New EV",
    isEV: true, evRegYear: 2026,
    annualFuelCost: 650,
    annualMaintenance: 750,
    resaleFraction: 0.68,
    color: "#2980b9", accent: "#3498db",
    note: "Blended 18%/22% bijtelling at €30k cap. Best resale long-term, exempt from 2027 pseudo-eindheffing.",
  },
};

const FUEL_ORDER = ["petrol", "hybrid", "phev", "evUsed", "evNew"];

const PREBAKED_PRICES = {
  petrol: 22000,
  hybrid: 28000,
  phev: 38000,
  evUsed: 34000,
  evNew: 45000,
};

function buildScenario(s) {
  const fuel = FUEL_TYPES[s.fuelKey];
  return {
    ...fuel,
    ...s,
    catalogueValue: s.catalogueValue ?? s.carPrice,
  };
}

function getBijtellingRate(scenario, catalogueValue) {
  if (!scenario.isEV) return 0.22;
  const yr = scenario.evRegYear || 2026;
  if (yr <= 2025) return 0.17;
  if (yr === 2026)
    return ((Math.min(catalogueValue, 30000) * 0.18) + (Math.max(0, catalogueValue - 30000) * 0.22)) / catalogueValue;
  return 0.22;
}

function getMRBMonthly(scenario) {
  if (scenario.isEV) return Math.round(85 * 0.70);
  if (scenario.isPHEV) return 115;
  return 85;
}

function calcMonthlyCosts(scenario, params) {
  const { grossSalary, use30Ruling, financeMode, holdYears, pseudoEindheffing } = params;
  const cat = scenario.catalogueValue;
  const price = scenario.carPrice;
  const baseMarginalRate = grossSalary > 75000 ? 0.495 : 0.369;
  const effectiveMarginalRate = use30Ruling ? baseMarginalRate * 0.70 : baseMarginalRate;

  const resaleValue = price * Math.pow(scenario.resaleFraction, holdYears / 4);
  const monthlyDepreciationGross = (price - resaleValue) / (holdYears * 12);
  const avgCapital = (price + resaleValue) / 2;

  const annualRunning = scenario.annualFuelCost + scenario.annualMaintenance;
  const monthlyMRBGross = getMRBMonthly(scenario);

  if (scenario.type === "bv") {
    const bijtellingRate = getBijtellingRate(scenario, cat);
    const annualBijtelling = cat * bijtellingRate;
    const monthlyBijtellingTax = (annualBijtelling * effectiveMarginalRate) / 12;

    const monthlyDepreciation = monthlyDepreciationGross * (1 - VPB_RATE);
    const monthlyRunning = (annualRunning / 12) * (1 - VPB_RATE);
    const monthlyMRB = monthlyMRBGross * (1 - VPB_RATE);
    const monthlyOpportunity = (avgCapital * OPPORTUNITY_RATE / 12) * (1 - VPB_RATE);
    const monthlyPseudo = (!scenario.isEV && pseudoEindheffing) ? (cat * 0.12 / 12) * (1 - VPB_RATE) : 0;

    const annualVPBSaving = (monthlyDepreciationGross * 12 + annualRunning + monthlyMRBGross * 12) * VPB_RATE;

    const totalMonthlyPersonal = monthlyBijtellingTax + monthlyDepreciation + monthlyRunning + monthlyMRB + monthlyOpportunity + monthlyPseudo;

    return {
      monthlyBijtellingTax: Math.round(monthlyBijtellingTax),
      monthlyRunning: Math.round(monthlyRunning),
      monthlyMRB: Math.round(monthlyMRB),
      monthlyDepreciation: Math.round(monthlyDepreciation),
      monthlyCapitalCost: Math.round(monthlyOpportunity),
      monthlyPseudo: Math.round(monthlyPseudo),
      totalMonthlyPersonal: Math.round(totalMonthlyPersonal),
      effectiveMarginalRate: Math.round(effectiveMarginalRate * 100),
      bijtellingRate: Math.round(bijtellingRate * 100 * 10) / 10,
      annualBijtelling: Math.round(annualBijtelling),
      vpbSaving: Math.round(annualVPBSaving),
      resaleValue: Math.round(resaleValue),
      capitalCostKind: "opportunity (4% net VPB)",
      type: "bv",
    };
  } else {
    const monthlyDepreciation = monthlyDepreciationGross;
    const monthlyRunning = annualRunning / 12;
    const monthlyMRB = monthlyMRBGross;
    const capitalRate = financeMode === "loan" ? LOAN_RATE : OPPORTUNITY_RATE;
    const monthlyCapitalCost = avgCapital * capitalRate / 12;

    const totalMonthlyPersonal = monthlyDepreciation + monthlyRunning + monthlyMRB + monthlyCapitalCost;

    return {
      monthlyBijtellingTax: 0,
      monthlyRunning: Math.round(monthlyRunning),
      monthlyMRB: Math.round(monthlyMRB),
      monthlyDepreciation: Math.round(monthlyDepreciation),
      monthlyCapitalCost: Math.round(monthlyCapitalCost),
      monthlyPseudo: 0,
      totalMonthlyPersonal: Math.round(totalMonthlyPersonal),
      effectiveMarginalRate: Math.round(effectiveMarginalRate * 100),
      bijtellingRate: 0,
      annualBijtelling: 0,
      vpbSaving: 0,
      resaleValue: Math.round(resaleValue),
      capitalCostKind: financeMode === "loan" ? "loan interest 6% on avg capital" : "opportunity 4% on avg capital",
      type: "private",
    };
  }
}

function findCrossover(fuelKey, params) {
  const fuel = FUEL_TYPES[fuelKey];
  const test = (price) => {
    const bv = calcMonthlyCosts(buildScenario({ id: "x", type: "bv", fuelKey, carPrice: price }), params);
    const pv = calcMonthlyCosts(buildScenario({ id: "x", type: "private", fuelKey, carPrice: price }), params);
    return { bv: bv.totalMonthlyPersonal, pv: pv.totalMonthlyPersonal, diff: pv.totalMonthlyPersonal - bv.totalMonthlyPersonal };
  };
  let lo = 4000, hi = 80000;
  const sLo = test(lo).diff, sHi = test(hi).diff;
  if (Math.sign(sLo) === Math.sign(sHi)) {
    return { price: null, alwaysCheaper: sLo < 0 ? "private" : "bv", fuel };
  }
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    const sMid = test(mid).diff;
    if (Math.sign(sMid) === Math.sign(sLo)) lo = mid; else hi = mid;
  }
  return { price: Math.round((lo + hi) / 2 / 500) * 500, alwaysCheaper: null, fuel };
}

const BarRow = ({ label, value, max, color, negative }) => (
  <div style={{ marginBottom: 7 }}>
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#aaa", marginBottom: 2 }}>
      <span>{label}</span>
      <span style={{ color: negative ? "#27ae60" : "#ccc", fontWeight: 600 }}>
        {negative ? "-" : ""}€{Math.abs(value)}/mo
      </span>
    </div>
    <div style={{ background: "#1a1a2e", borderRadius: 3, height: 6, overflow: "hidden" }}>
      <div style={{
        width: `${Math.min(100, (Math.abs(value) / Math.max(max, 1)) * 100)}%`,
        height: "100%", background: negative ? "#27ae60" : color,
        borderRadius: 3, transition: "width 0.4s ease"
      }} />
    </div>
  </div>
);

const Toggle = ({ value, onChange, color, label, sub }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
    <div onClick={() => onChange(!value)} style={{
      width: 38, height: 22, borderRadius: 11, flexShrink: 0,
      background: value ? color : "#333",
      position: "relative", cursor: "pointer", transition: "background 0.3s"
    }}>
      <div style={{
        position: "absolute", top: 3, left: value ? 19 : 3,
        width: 16, height: 16, borderRadius: 8,
        background: "#fff", transition: "left 0.3s"
      }} />
    </div>
    <div>
      <div style={{ fontSize: 14, color: value ? color : "#666" }}>{label}</div>
      <div style={{ fontSize: 12, color: "#888" }}>{sub}</div>
    </div>
  </div>
);

const Segmented = ({ value, onChange, options, color = "#3498db" }) => (
  <div style={{ display: "inline-flex", background: "#0d0d1a", borderRadius: 6, padding: 3, border: "1px solid #1e1e3a" }}>
    {options.map(opt => (
      <button key={opt.value} onClick={() => onChange(opt.value)} style={{
        background: value === opt.value ? color : "transparent",
        color: value === opt.value ? "#fff" : "#aaa",
        border: "none", padding: "6px 12px", borderRadius: 4,
        fontSize: 13, fontWeight: 600, cursor: "pointer", transition: "all 0.15s",
      }}>{opt.label}</button>
    ))}
  </div>
);

export default function CarComparison() {
  const [use30Ruling, setUse30Ruling] = useState(true);
  const [grossSalary, setGrossSalary] = useState(80000);
  const [holdYears, setHoldYears] = useState(4);
  const [financeMode, setFinanceMode] = useState("cash");
  const [pseudoEindheffing, setPseudoEindheffing] = useState(false);
  const [explorerPrice, setExplorerPrice] = useState(28000);
  const [activeKey, setActiveKey] = useState("evUsed:bv");

  const params = { grossSalary, use30Ruling, financeMode, holdYears, pseudoEindheffing };

  // Matrix at a single explorer price: every fuel × {bv, private}
  const matrix = useMemo(() => {
    const rows = FUEL_ORDER.map(fuelKey => {
      const fuel = FUEL_TYPES[fuelKey];
      const bvBuilt = buildScenario({ id: `${fuelKey}:bv`, type: "bv", fuelKey, carPrice: explorerPrice });
      const pvBuilt = buildScenario({ id: `${fuelKey}:private`, type: "private", fuelKey, carPrice: explorerPrice });
      const bv = { ...bvBuilt, calc: calcMonthlyCosts(bvBuilt, params), pathLabel: "BV" };
      const pv = { ...pvBuilt, calc: calcMonthlyCosts(pvBuilt, params), pathLabel: "Private" };
      const cross = findCrossover(fuelKey, params);
      return { fuelKey, fuel, bv, pv, cross,
        winnerPath: bv.calc.totalMonthlyPersonal <= pv.calc.totalMonthlyPersonal ? "bv" : "private",
        diff: pv.calc.totalMonthlyPersonal - bv.calc.totalMonthlyPersonal };
    });
    return rows;
  }, [explorerPrice, grossSalary, use30Ruling, financeMode, holdYears, pseudoEindheffing]);

  // Cheapest combo overall at this price
  const allRows = useMemo(() => matrix.flatMap(r => [r.bv, r.pv]), [matrix]);
  const cheapest = useMemo(() =>
    allRows.reduce((best, r) => r.calc.totalMonthlyPersonal < best.calc.totalMonthlyPersonal ? r : best, allRows[0]),
    [allRows]
  );

  // Prebaked scenarios at each fuel's "typical" price
  const prebaked = useMemo(() =>
    FUEL_ORDER.flatMap(fuelKey => {
      const price = PREBAKED_PRICES[fuelKey];
      return ["bv", "private"].map(t => {
        const built = buildScenario({ id: `pb:${fuelKey}:${t}`, type: t, fuelKey, carPrice: price });
        return { ...built, calc: calcMonthlyCosts(built, params), pathLabel: t === "bv" ? "BV" : "Private" };
      });
    }),
    [grossSalary, use30Ruling, financeMode, holdYears, pseudoEindheffing]
  );

  const maxMonthly = Math.max(...allRows.map(r => r.calc.totalMonthlyPersonal));
  const maxBarValue = Math.max(1, ...allRows.flatMap(r => [
    r.calc.monthlyBijtellingTax, r.calc.monthlyRunning,
    r.calc.monthlyMRB, r.calc.monthlyDepreciation, r.calc.monthlyPseudo, r.calc.monthlyCapitalCost
  ]));

  const active = allRows.find(r => r.id === activeKey) || prebaked.find(r => r.id === activeKey) || cheapest;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=swap');
        * { font-family: 'Inter', 'Helvetica Neue', Arial, sans-serif !important; }
      `}</style>
    <div style={{
      fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
      background: "#0d0d1a", minHeight: "100vh",
      color: "#e0e0e0", padding: "24px 16px", fontSize: 16,
    }}>
      {/* Header */}
      <div style={{ marginBottom: 20, borderBottom: "1px solid #222", paddingBottom: 16 }}>
        <div style={{ fontSize: 12, letterSpacing: 4, color: "#999", textTransform: "uppercase", marginBottom: 6 }}>
          NANS B.V. · AUTO VERGELIJKING 2026
        </div>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: "#f0f0f0", letterSpacing: -0.5 }}>
          BV vs Private — which path wins?
        </h1>
        <p style={{ margin: "8px 0 0", fontSize: 14, color: "#aaa", lineHeight: 1.55 }}>
          For each car price + fuel type, this tool computes your true monthly cost net of tax along both paths
          (buy through the BV, or buy privately) and finds the <strong style={{ color: "#f1c40f" }}>crossover price</strong>
          {" "}where they meet — under your salary, 30% ruling, hold period, and the 2027 pseudo-eindheffing rules.
        </p>
      </div>

      {/* Controls */}
      <div style={{
        background: "#111122", border: "1px solid #222", borderRadius: 8,
        padding: 16, marginBottom: 16,
        display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14,
      }}>
        <div>
          <label style={{ fontSize: 12, color: "#999", letterSpacing: 2, textTransform: "uppercase", display: "block", marginBottom: 6 }}>DGA Gross Salary</label>
          <input type="range" min={56000} max={150000} step={2000} value={grossSalary}
            onChange={e => setGrossSalary(+e.target.value)} style={{ width: "100%", accentColor: "#3498db" }} />
          <div style={{ fontSize: 16, color: "#3498db", fontWeight: 700 }}>€{grossSalary.toLocaleString()}/yr</div>
        </div>
        <div>
          <label style={{ fontSize: 12, color: "#999", letterSpacing: 2, textTransform: "uppercase", display: "block", marginBottom: 6 }}>Hold Period</label>
          <input type="range" min={2} max={7} step={1} value={holdYears}
            onChange={e => setHoldYears(+e.target.value)} style={{ width: "100%", accentColor: "#e74c3c" }} />
          <div style={{ fontSize: 16, color: "#e74c3c", fontWeight: 700 }}>{holdYears} years</div>
        </div>
        <Toggle value={use30Ruling} onChange={setUse30Ruling} color="#3498db"
          label="30% Ruling active"
          sub={use30Ruling ? `Eff. marginal: ~${Math.round(0.495 * 0.70 * 100)}%` : "Standard: ~49.5%"} />
        <div>
          <div style={{ fontSize: 12, color: "#999", letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>
            Private capital cost
          </div>
          <Segmented value={financeMode} onChange={setFinanceMode} color="#e74c3c" options={[
            { value: "cash",  label: "Cash (4% opp.)" },
            { value: "loan",  label: "Loan (6%)" },
          ]}/>
          <div style={{ fontSize: 12, color: "#888", marginTop: 4 }}>
            {financeMode === "loan"
              ? "Pay 6%/yr interest on avg outstanding balance"
              : "Forego 4%/yr you'd otherwise earn investing the cash"}
          </div>
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <Toggle value={pseudoEindheffing} onChange={setPseudoEindheffing} color="#e67e22"
            label="Include 2027 pseudo-eindheffing (+12%/yr of catalogue, petrol/PHEV BV only)"
            sub={pseudoEindheffing ? "Applied — EVs still exempt" : "Off — assumes transition rule (register before Dec 2026)"} />
        </div>
      </div>

      {/* Powertrain × Path Matrix */}
      <div style={{
        background: "#0c1118",
        border: `2px solid ${cheapest.color}`,
        borderRadius: 10, padding: 16, marginBottom: 16,
        transition: "border-color 0.4s",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
          <div style={{ fontSize: 12, color: "#1abc9c", letterSpacing: 3, textTransform: "uppercase" }}>
            ★ Powertrain × Path Matrix
          </div>
          <div style={{ fontSize: 11, color: "#888" }}>
            All 5 powertrains × BV/Private at your chosen price
          </div>
        </div>

        <label style={{ fontSize: 12, color: "#aaa", letterSpacing: 2, textTransform: "uppercase", display: "block", marginBottom: 6 }}>
          Car price (purchase)
        </label>
        <input type="range" min={4000} max={80000} step={500} value={explorerPrice}
          onChange={e => setExplorerPrice(+e.target.value)}
          style={{ width: "100%", accentColor: "#1abc9c" }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 14 }}>
          <div style={{ fontSize: 24, color: "#1abc9c", fontWeight: 900 }}>€{explorerPrice.toLocaleString()}</div>
          <div style={{ fontSize: 12, color: "#999" }}>same price applied to every powertrain</div>
        </div>

        {/* Cheapest verdict */}
        <div style={{
          background: `${cheapest.color}15`,
          border: `1px solid ${cheapest.color}`,
          borderRadius: 8, padding: "12px 14px",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          transition: "all 0.4s", marginBottom: 14,
        }}>
          <div>
            <div style={{ fontSize: 11, color: "#999", letterSpacing: 2, textTransform: "uppercase", marginBottom: 4 }}>Cheapest combo at €{explorerPrice.toLocaleString()}</div>
            <div style={{ fontSize: 16, color: cheapest.color, fontWeight: 800 }}>
              {cheapest.label} · {cheapest.pathLabel}
            </div>
            <div style={{ fontSize: 12, color: "#999" }}>{cheapest.note}</div>
          </div>
          <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 16 }}>
            <div style={{ fontSize: 30, fontWeight: 900, color: cheapest.color, lineHeight: 1 }}>
              €{cheapest.calc.totalMonthlyPersonal}
            </div>
            <div style={{ fontSize: 11, color: "#888" }}>/mo net to you</div>
          </div>
        </div>

        {/* Matrix rows */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {matrix.map(row => {
            const isCheapestRow = cheapest.fuelKey === row.fuelKey;
            return (
              <div key={row.fuelKey} style={{
                background: "#0a0d18",
                border: `1px solid ${isCheapestRow ? row.fuel.color : "#1e1e3a"}`,
                borderRadius: 8, padding: 10,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
                  <div>
                    <span style={{ fontSize: 14, fontWeight: 800, color: row.fuel.color }}>{row.fuel.label}</span>
                    {isCheapestRow && <span style={{
                      marginLeft: 8, background: row.fuel.color, color: "#fff",
                      fontSize: 9, fontWeight: 800, padding: "2px 6px", borderRadius: 3,
                      letterSpacing: 1, textTransform: "uppercase",
                    }}>cheapest</span>}
                  </div>
                  <div style={{ fontSize: 11, color: "#888" }}>
                    {row.cross.price !== null
                      ? <>BV↔Private crossover @ <strong style={{ color: "#f1c40f" }}>€{row.cross.price.toLocaleString()}</strong></>
                      : <>Always {row.cross.alwaysCheaper === "bv" ? <strong style={{ color: "#1abc9c" }}>BV-cheaper</strong> : <strong style={{ color: "#e67e22" }}>Private-cheaper</strong>} at any price</>}
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {[row.bv, row.pv].map(opt => {
                    const isWinner = (row.winnerPath === "bv" && opt === row.bv) || (row.winnerPath === "private" && opt === row.pv);
                    const isActive = activeKey === opt.id;
                    const accent = opt.type === "bv" ? "#1abc9c" : "#e67e22";
                    return (
                      <div key={opt.id} onClick={() => setActiveKey(opt.id)} style={{
                        background: isActive ? `${accent}20` : (isWinner ? `${accent}10` : "#0d0d1a"),
                        border: `1px solid ${isActive ? accent : (isWinner ? `${accent}55` : "transparent")}`,
                        borderRadius: 6, padding: "8px 10px", cursor: "pointer",
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                        transition: "all 0.15s",
                      }}>
                        <div>
                          <div style={{ fontSize: 11, color: accent, letterSpacing: 1, textTransform: "uppercase", fontWeight: 700 }}>
                            {opt.pathLabel} {isWinner && "✓"}
                          </div>
                          <div style={{ fontSize: 11, color: "#888" }}>
                            {opt.type === "bv"
                              ? `bijtelling ${opt.calc.bijtellingRate}%`
                              : (financeMode === "loan" ? "loan 6%" : "cash 4% opp.")}
                          </div>
                        </div>
                        <div style={{ fontSize: 22, fontWeight: 900, color: accent, lineHeight: 1 }}>
                          €{opt.calc.totalMonthlyPersonal}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* 30% ruling insight note */}
        <div style={{
          marginTop: 12, padding: "10px 12px", borderRadius: 6,
          background: "#0a0a1a", border: "1px solid #3498db30",
          fontSize: 12, color: "#7fb3d3", lineHeight: 1.6,
        }}>
          <span style={{ color: "#3498db", fontWeight: 700 }}>💡 30% ruling effect: </span>
          {use30Ruling
            ? "Your ruling shrinks the marginal rate that hits BV bijtelling income, which makes the BV path more attractive — especially for high-catalogue EVs. Toggle the ruling off to see how the crossovers shift when it expires."
            : "Without your ruling, BV bijtelling is taxed at the full ~49.5%, pushing every crossover toward higher prices (private wins on more cars). This is the post-ruling reality."}
        </div>
      </div>

      {/* Prebaked at typical prices */}
      <div style={{ fontSize: 12, color: "#999", letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>
        Or at each powertrain's typical price
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
        {prebaked.map(r => {
          const isActive = r.id === activeKey;
          const isLowest = r.calc.totalMonthlyPersonal === Math.min(...prebaked.map(x => x.calc.totalMonthlyPersonal));
          return (
            <div key={r.id} onClick={() => setActiveKey(r.id)} style={{
              background: isActive ? `${r.color}15` : "#111122",
              border: `1px solid ${isActive ? r.color : "#1e1e3a"}`,
              borderRadius: 8, padding: "12px", cursor: "pointer",
              transition: "all 0.2s", position: "relative", overflow: "hidden",
            }}>
              {isLowest && (
                <div style={{
                  position: "absolute", top: 0, right: 0,
                  background: "#27ae60", color: "#fff",
                  fontSize: 10, fontWeight: 800, padding: "2px 7px",
                  letterSpacing: 1, textTransform: "uppercase"
                }}>CHEAPEST</div>
              )}
              <div style={{ fontSize: 11, color: r.accent, letterSpacing: 2, textTransform: "uppercase", marginBottom: 2 }}>
                {r.short || r.label} · {r.pathLabel}
              </div>
              <div style={{ fontSize: 13, color: "#999", marginBottom: 8 }}>€{r.carPrice.toLocaleString()} purchase</div>
              <div style={{ fontSize: 28, fontWeight: 900, color: r.color, lineHeight: 1 }}>
                €{r.calc.totalMonthlyPersonal}
              </div>
              <div style={{ fontSize: 11, color: "#999", marginTop: 2 }}>/month to you</div>
              <div style={{ marginTop: 8, height: 3, background: "#1a1a2e", borderRadius: 2 }}>
                <div style={{
                  width: `${(r.calc.totalMonthlyPersonal / Math.max(...prebaked.map(x => x.calc.totalMonthlyPersonal))) * 100}%`,
                  height: "100%", background: r.color, borderRadius: 2, transition: "width 0.5s"
                }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Detail Panel */}
      {active && (
        <div style={{
          background: "#111122", border: `1px solid ${active.color}40`,
          borderRadius: 8, padding: 16, marginBottom: 16,
        }}>
          <div style={{ fontSize: 13, color: active.accent, letterSpacing: 2, textTransform: "uppercase", marginBottom: 12 }}>
            ▶ {active.label} · {active.pathLabel || (active.type === "bv" ? "BV" : "Private")} · €{active.carPrice.toLocaleString()} · Breakdown
          </div>
          <div style={{ fontSize: 12, color: "#888", marginBottom: 10, lineHeight: 1.5 }}>{active.note}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 14 }}>
            {[
              { label: "Car Price", value: `€${active.carPrice.toLocaleString()}`, sub: "purchase" },
              { label: "Resale est.", value: `€${active.calc.resaleValue.toLocaleString()}`, sub: `after ${holdYears} yrs` },
              { label: "Catalogue", value: `€${active.catalogueValue.toLocaleString()}`, sub: "bijtelling base" },
              { label: "Bijtelling", value: active.type === "bv" ? `${active.calc.bijtellingRate}%` : "—", sub: active.type === "bv" ? "annual rate" : "n/a" },
              { label: "Annual bijtelling", value: active.type === "bv" ? `€${active.calc.annualBijtelling.toLocaleString()}` : "—", sub: "added to income" },
              { label: "Eff. tax rate", value: `${active.calc.effectiveMarginalRate}%`, sub: use30Ruling ? "with 30% ruling" : "no ruling" },
              { label: "VPB saving/yr", value: active.type === "bv" ? `€${active.calc.vpbSaving.toLocaleString()}` : "—", sub: "19% on BV costs" },
              { label: "Capital cost", value: `€${active.calc.monthlyCapitalCost}/mo`, sub: active.calc.capitalCostKind },
              { label: "MRB", value: `€${active.calc.monthlyMRB}/mo`, sub: active.isEV ? "30% EV discount" : active.isPHEV ? "PHEV weight class" : "petrol standard" },
            ].map((item, i) => (
              <div key={i} style={{ background: "#0d0d1a", borderRadius: 6, padding: 10 }}>
                <div style={{ fontSize: 11, color: "#999", textTransform: "uppercase", letterSpacing: 1 }}>{item.label}</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#e0e0e0", marginTop: 2 }}>{item.value}</div>
                <div style={{ fontSize: 11, color: "#888" }}>{item.sub}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 12, color: "#999", letterSpacing: 2, textTransform: "uppercase", marginBottom: 10 }}>Monthly components (net to you)</div>
          {active.calc.monthlyBijtellingTax > 0 && <BarRow label="Bijtelling income tax" value={active.calc.monthlyBijtellingTax} max={maxBarValue} color={active.color} />}
          {active.calc.monthlyPseudo > 0 && <BarRow label="Pseudo-eindheffing (BV)" value={active.calc.monthlyPseudo} max={maxBarValue} color="#e67e22" />}
          <BarRow label="Depreciation (price − resale)" value={active.calc.monthlyDepreciation} max={maxBarValue} color={active.color} />
          <BarRow label={active.type === "bv" ? "Capital cost (opp., net VPB)" : (financeMode === "loan" ? "Loan interest" : "Capital cost (opp.)")} value={active.calc.monthlyCapitalCost} max={maxBarValue} color={active.color} />
          <BarRow label="Fuel / charging" value={Math.round(active.annualFuelCost / 12 * (active.type === "bv" ? (1 - VPB_RATE) : 1))} max={maxBarValue} color={active.color} />
          <BarRow label="Maintenance" value={Math.round(active.annualMaintenance / 12 * (active.type === "bv" ? (1 - VPB_RATE) : 1))} max={maxBarValue} color={active.color} />
          <BarRow label="Road tax (MRB)" value={active.calc.monthlyMRB} max={maxBarValue} color={active.color} />
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            borderTop: `1px solid ${active.color}30`, paddingTop: 10, marginTop: 8
          }}>
            <div style={{ fontSize: 13, color: "#aaa", textTransform: "uppercase", letterSpacing: 2 }}>Total monthly to you</div>
            <div style={{ fontSize: 32, fontWeight: 900, color: active.color }}>
              €{active.calc.totalMonthlyPersonal}<span style={{ fontSize: 14, color: "#999" }}>/mo</span>
            </div>
          </div>
        </div>
      )}

      {/* Resale */}
      <div style={{ background: "#0d1117", border: "1px solid #1e2a1e", borderRadius: 8, padding: 14, marginBottom: 14 }}>
        <div style={{ fontSize: 12, color: "#27ae60", letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>
          Resale Outlook · {holdYears} year hold
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {matrix.map(row => (
            <div key={row.fuelKey} style={{ fontSize: 13 }}>
              <span style={{ color: row.fuel.accent }}>{row.fuel.short}</span>
              <span style={{ color: "#999" }}> @ €{explorerPrice.toLocaleString()} → </span>
              <span style={{ color: "#e0e0e0", fontWeight: 700 }}>
                €{row.bv.calc.resaleValue.toLocaleString()}
              </span>
              <span style={{ color: "#888", fontSize: 11 }}> ({Math.round(row.fuel.resaleFraction * 100)}% × time)</span>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 8, fontSize: 12, color: "#888", lineHeight: 1.5 }}>
          EVs from 2022+ hold residual value better as EU 2035 combustion ban approaches. Older petrol ~48–52% after 4 yrs.
        </div>
      </div>

      {/* Warning */}
      <div style={{ background: "#1a0a00", border: "1px solid #7f3900", borderRadius: 8, padding: 14, marginBottom: 14 }}>
        <div style={{ fontSize: 12, color: "#e67e22", letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>
          ⚠ 2027 Pseudo-eindheffing
        </div>
        <div style={{ fontSize: 13, color: "#aaa", lineHeight: 1.6 }}>
          From Jan 2027, BV owes <strong style={{ color: "#e67e22" }}>+12% of catalogue value/yr</strong> on petrol/hybrid/PHEV cars.{" "}
          <strong style={{ color: "#27ae60" }}>EVs are fully exempt.</strong> Toggle above to model it.
          Register before 31 Dec 2026 → transition rule defers to Sep 2030.
        </div>
      </div>

      <div style={{ fontSize: 11, color: "#777", textAlign: "center", lineHeight: 1.6 }}>
        Estimates only · Consult your accountant · Capital cost = avg outstanding balance × rate · MRB ~1,700kg NL avg · BV costs net 19% VPB
      </div>
    </div>
    </>
  );
}
