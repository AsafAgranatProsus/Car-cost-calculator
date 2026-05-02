import { Fragment, useMemo, useState } from "react";

const VPB_RATE = 0.19;
const OPPORTUNITY_RATE = 0.04;
const LOAN_RATE = 0.06;

const RULING_NORM_2026 = 48013;

const BOX1_BRACKETS_2026 = [
  { upTo: 38883, rate: 0.3575 },
  { upTo: 78426, rate: 0.3756 },
  { upTo: Infinity, rate: 0.4950 },
];

function box1Tax(taxable) {
  let remaining = Math.max(0, taxable);
  let prev = 0;
  let tax = 0;
  for (const b of BOX1_BRACKETS_2026) {
    const slice = Math.max(0, Math.min(remaining, b.upTo - prev));
    tax += slice * b.rate;
    remaining -= slice;
    prev = b.upTo;
    if (remaining <= 0) break;
  }
  return tax;
}

function taxableAfterRuling(salary, use30Ruling) {
  if (!use30Ruling) return salary;
  const maxTaxFree = salary * 0.30;
  const allowedTaxFree = Math.max(0, Math.min(maxTaxFree, salary - RULING_NORM_2026));
  return salary - allowedTaxFree;
}

function bijtellingMarginalRate(salary, use30Ruling, annualBijtelling) {
  if (annualBijtelling <= 0) return 0;
  const taxable = taxableAfterRuling(salary, use30Ruling);
  const before = box1Tax(taxable);
  const after = box1Tax(taxable + annualBijtelling);
  return (after - before) / annualBijtelling;
}

const FUELS = {
  petrol: {
    label: "Petrol",
    short: "Petrol",
    color: "#c0392b", accent: "#e74c3c",
    isEV: false, isPHEV: false,
    fuelCostPer10k: 1100,
    note: "Pure ICE — long range, simplest, but full pseudo-eindheffing exposure from 2027 (BV path).",
  },
  hybrid: {
    label: "Self-charging Hybrid",
    short: "Hybrid",
    color: "#d35400", accent: "#e67e22",
    isEV: false, isPHEV: false,
    fuelCostPer10k: 850,
    note: "No plug. Best mixed-use balance: quiet city, fuel-efficient, highway-capable. 2027 pseudo-eindheffing applies (BV).",
  },
  phev: {
    label: "Plug-in Hybrid (PHEV)",
    short: "PHEV",
    color: "#8e44ad", accent: "#9b59b6",
    isEV: false, isPHEV: true,
    fuelCostPer10k: 750,
    note: "Heavier weight class → MRB ~25% higher than petrol from 2026 (lost ¾-rate). Same 22% bijtelling. On long highway trips you mostly run on petrol — paying for batteries you barely use.",
  },
  ev: {
    label: "EV",
    short: "EV",
    color: "#16a085", accent: "#1abc9c",
    isEV: true, isPHEV: false,
    fuelCostPer10k: 350,
    note: "Cheapest per km, MRB 30% discount, exempt from 2027 pseudo-eindheffing. Long highway trips with full load = real charging-stop planning + reduced range.",
  },
};

const FUEL_ORDER = ["petrol", "hybrid", "phev", "ev"];

const STATES = {
  used: {
    label: "Used",
    short: "Used",
    sublabel: "5+ years old",
    age: 6,
    catalogueMultiplier: 2.0,
    annualMaintenance: 1500,
    resaleFraction: 0.45,
    evRegYear: 2020,
    note: "Cheap entry, but BV path inherits the original (high) catalogue value for bijtelling — the killer for old petrol cars in a BV.",
  },
  young: {
    label: "Young Used",
    short: "Young",
    sublabel: "2–3 years old",
    age: 2.5,
    catalogueMultiplier: 1.30,
    annualMaintenance: 900,
    resaleFraction: 0.55,
    evRegYear: 2023,
    note: "Sweet spot for many setups: meaningful price drop vs new, but catalogue still close enough to purchase price that BV bijtelling isn't punitive. Modern features, full warranty often still active.",
  },
  newCar: {
    label: "New",
    short: "New",
    sublabel: "0–1 year old",
    age: 0.5,
    catalogueMultiplier: 1.0,
    annualMaintenance: 600,
    resaleFraction: 0.65,
    evRegYear: 2026,
    note: "Highest purchase price, but catalogue ≈ price (no hidden bijtelling premium), best resale, longest warranty, latest tech.",
  },
};

const STATE_ORDER = ["used", "young", "newCar"];

const PREBAKED_PRICES = {
  petrol: { used: 8000,  young: 18000, newCar: 30000 },
  hybrid: { used: 12000, young: 22000, newCar: 36000 },
  phev:   { used: 16000, young: 26000, newCar: 42000 },
  ev:     { used: 18000, young: 30000, newCar: 45000 },
};

function buildScenario(fuelKey, stateKey, type, carPrice, opts = {}) {
  const fuel = FUELS[fuelKey];
  const state = STATES[stateKey];
  const catalogueValue = opts.catalogueValue ?? Math.round(carPrice * state.catalogueMultiplier);
  const evRegYear = opts.evRegYear ?? state.evRegYear;
  return {
    id: `${fuelKey}:${stateKey}:${type}`,
    fuelKey, stateKey, type,
    fuel, state,
    label: `${state.label} ${fuel.label}`,
    short: `${state.short} ${fuel.short}`,
    color: fuel.color, accent: fuel.accent,
    isEV: fuel.isEV, isPHEV: fuel.isPHEV, evRegYear,
    carPrice, catalogueValue,
    annualMaintenance: state.annualMaintenance,
    annualKm: opts.annualKm ?? 18000,
    resaleFraction: state.resaleFraction,
  };
}

function getBijtellingRate(scenario, catalogueValue) {
  if (!scenario.isEV) return 0.22;
  const yr = scenario.evRegYear || 2026;
  const split = (cap, rate) =>
    ((Math.min(catalogueValue, cap) * rate) + (Math.max(0, catalogueValue - cap) * 0.22)) / catalogueValue;
  if (yr <= 2022) return split(35000, 0.16);
  if (yr <= 2024) return split(30000, 0.16);
  if (yr === 2025) return split(30000, 0.17);
  if (yr === 2026) return split(30000, 0.18);
  return 0.22;
}

function getMRBMonthly(scenario) {
  const base = 90;
  if (scenario.isEV) return Math.round(base * 0.70);
  if (scenario.isPHEV) return Math.round(base * 1.25);
  return base;
}

function calcMonthlyCosts(scenario, params) {
  const { grossSalary, use30Ruling, financeMode, holdYears, pseudoEindheffing, box2Rate } = params;
  const cat = scenario.catalogueValue;
  const price = scenario.carPrice;
  const annualFuelCost = (scenario.fuel.fuelCostPer10k * scenario.annualKm) / 10000;
  const annualRunning = annualFuelCost + scenario.annualMaintenance;

  const resaleValue = price * Math.pow(scenario.resaleFraction, holdYears / 4);
  const annualDepreciation = (price - resaleValue) / holdYears;
  const avgCapital = (price + resaleValue) / 2;
  const monthlyMRBGross = getMRBMonthly(scenario);
  const annualMRB = monthlyMRBGross * 12;

  if (scenario.type === "bv") {
    const bijtellingRate = getBijtellingRate(scenario, cat);
    const annualBijtelling = cat * bijtellingRate;
    const marginalRate = bijtellingMarginalRate(grossSalary, use30Ruling, annualBijtelling);
    const monthlyBijtellingTax = (annualBijtelling * marginalRate) / 12;

    const annualOpportunity = avgCapital * OPPORTUNITY_RATE;
    const annualPseudo = (!scenario.isEV && pseudoEindheffing) ? cat * 0.12 : 0;

    const grossBVCost = annualDepreciation + annualRunning + annualMRB + annualOpportunity + annualPseudo;
    const vpbSaving = grossBVCost * VPB_RATE;
    const netBVCash = grossBVCost - vpbSaving;
    const personalEquivalent = netBVCash * (1 - box2Rate);

    const totalAnnualPersonal = personalEquivalent + annualBijtelling * marginalRate;
    const totalMonthlyPersonal = totalAnnualPersonal / 12;

    const f = (1 - VPB_RATE) * (1 - box2Rate);
    return {
      type: "bv",
      monthlyBijtellingTax: Math.round(monthlyBijtellingTax),
      monthlyDepreciation: Math.round((annualDepreciation / 12) * f),
      monthlyFuel: Math.round((annualFuelCost / 12) * f),
      monthlyMaintenance: Math.round((scenario.annualMaintenance / 12) * f),
      monthlyMRB: Math.round((monthlyMRBGross) * f),
      monthlyCapitalCost: Math.round((annualOpportunity / 12) * f),
      monthlyPseudo: Math.round((annualPseudo / 12) * f),
      totalMonthlyPersonal: Math.round(totalMonthlyPersonal),
      effectiveMarginalRate: Math.round(marginalRate * 1000) / 10,
      bijtellingRate: Math.round(bijtellingRate * 1000) / 10,
      annualBijtelling: Math.round(annualBijtelling),
      vpbSaving: Math.round(vpbSaving),
      annualPseudo: Math.round(annualPseudo),
      resaleValue: Math.round(resaleValue),
      capitalCostKind: `4% opp. on avg capital, net VPB & box 2`,
      bvFactor: f,
    };
  } else {
    const monthlyDepreciation = annualDepreciation / 12;
    const monthlyFuel = annualFuelCost / 12;
    const monthlyMaintenance = scenario.annualMaintenance / 12;
    const monthlyMRB = monthlyMRBGross;
    const capitalRate = financeMode === "loan" ? LOAN_RATE : OPPORTUNITY_RATE;
    const monthlyCapitalCost = avgCapital * capitalRate / 12;
    const totalMonthlyPersonal =
      monthlyDepreciation + monthlyFuel + monthlyMaintenance + monthlyMRB + monthlyCapitalCost;

    return {
      type: "private",
      monthlyBijtellingTax: 0,
      monthlyDepreciation: Math.round(monthlyDepreciation),
      monthlyFuel: Math.round(monthlyFuel),
      monthlyMaintenance: Math.round(monthlyMaintenance),
      monthlyMRB: Math.round(monthlyMRB),
      monthlyCapitalCost: Math.round(monthlyCapitalCost),
      monthlyPseudo: 0,
      totalMonthlyPersonal: Math.round(totalMonthlyPersonal),
      effectiveMarginalRate: 0,
      bijtellingRate: 0, annualBijtelling: 0, vpbSaving: 0, annualPseudo: 0,
      resaleValue: Math.round(resaleValue),
      capitalCostKind: financeMode === "loan" ? "loan interest 6% on avg capital" : "opportunity 4% on avg capital",
      bvFactor: 1,
    };
  }
}

function findCrossover(fuelKey, stateKey, params, opts = {}) {
  const test = (price) => {
    const bv = calcMonthlyCosts(buildScenario(fuelKey, stateKey, "bv", price, opts), params);
    const pv = calcMonthlyCosts(buildScenario(fuelKey, stateKey, "private", price, opts), params);
    return pv.totalMonthlyPersonal - bv.totalMonthlyPersonal;
  };
  let lo = 4000, hi = 80000;
  const sLo = test(lo), sHi = test(hi);
  if (Math.sign(sLo) === Math.sign(sHi)) {
    return { price: null, alwaysCheaper: sLo < 0 ? "private" : "bv" };
  }
  for (let i = 0; i < 22; i++) {
    const mid = (lo + hi) / 2;
    const sMid = test(mid);
    if (Math.sign(sMid) === Math.sign(sLo)) lo = mid; else hi = mid;
  }
  return { price: Math.round((lo + hi) / 2 / 500) * 500, alwaysCheaper: null };
}

const Toggle = ({ value, onChange, color, label, sub }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
    <div onClick={() => onChange(!value)} style={{
      width: 38, height: 22, borderRadius: 11, flexShrink: 0,
      background: value ? color : "#333", position: "relative",
      cursor: "pointer", transition: "background 0.3s",
    }}>
      <div style={{
        position: "absolute", top: 3, left: value ? 19 : 3,
        width: 16, height: 16, borderRadius: 8, background: "#fff",
        transition: "left 0.3s",
      }} />
    </div>
    <div>
      <div style={{ fontSize: 14, color: value ? color : "#666" }}>{label}</div>
      <div style={{ fontSize: 12, color: "#888" }}>{sub}</div>
    </div>
  </div>
);

const Segmented = ({ value, onChange, options, color = "#3498db", small }) => (
  <div style={{ display: "inline-flex", background: "#0d0d1a", borderRadius: 6, padding: 3, border: "1px solid #1e1e3a" }}>
    {options.map(opt => (
      <button key={opt.value} onClick={() => onChange(opt.value)} style={{
        background: value === opt.value ? color : "transparent",
        color: value === opt.value ? "#fff" : "#aaa",
        border: "none", padding: small ? "4px 8px" : "6px 12px",
        borderRadius: 4, fontSize: small ? 11 : 13, fontWeight: 600,
        cursor: "pointer", transition: "all 0.15s",
      }}>{opt.label}</button>
    ))}
  </div>
);

const BarRow = ({ label, value, max, color }) => (
  <div style={{ marginBottom: 7 }}>
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#aaa", marginBottom: 2 }}>
      <span>{label}</span>
      <span style={{ color: "#ccc", fontWeight: 600 }}>€{value}/mo</span>
    </div>
    <div style={{ background: "#1a1a2e", borderRadius: 3, height: 6, overflow: "hidden" }}>
      <div style={{
        width: `${Math.min(100, (Math.abs(value) / Math.max(max, 1)) * 100)}%`,
        height: "100%", background: color, borderRadius: 3, transition: "width 0.4s ease",
      }} />
    </div>
  </div>
);

export default function CarComparison() {
  const [grossSalary, setGrossSalary] = useState(80000);
  const [use30Ruling, setUse30Ruling] = useState(true);
  const [holdYears, setHoldYears] = useState(4);
  const [annualKm, setAnnualKm] = useState(18000);
  const [financeMode, setFinanceMode] = useState("cash");
  const [pseudoEindheffing, setPseudoEindheffing] = useState(true);
  const [box2Rate, setBox2Rate] = useState(0.245);

  const [activeFuel, setActiveFuel] = useState("hybrid");
  const [activeState, setActiveState] = useState("young");
  const [customPrice, setCustomPrice] = useState(22000);
  const [customCatalogue, setCustomCatalogue] = useState(null);

  const params = { grossSalary, use30Ruling, financeMode, holdYears, pseudoEindheffing, box2Rate };

  const taxableAfter = taxableAfterRuling(grossSalary, use30Ruling);

  // Full matrix at prebaked prices, both paths
  const matrix = useMemo(() => {
    const out = {};
    for (const fk of FUEL_ORDER) {
      out[fk] = {};
      for (const sk of STATE_ORDER) {
        const price = PREBAKED_PRICES[fk][sk];
        const bvSc = buildScenario(fk, sk, "bv", price, { annualKm });
        const pvSc = buildScenario(fk, sk, "private", price, { annualKm });
        const bv = { ...bvSc, calc: calcMonthlyCosts(bvSc, params) };
        const pv = { ...pvSc, calc: calcMonthlyCosts(pvSc, params) };
        const cross = findCrossover(fk, sk, params, { annualKm });
        out[fk][sk] = { fuelKey: fk, stateKey: sk, price, bv, pv, cross };
      }
    }
    return out;
  }, [grossSalary, use30Ruling, financeMode, holdYears, pseudoEindheffing, box2Rate, annualKm]);

  // Active cell
  const activePrice = customPrice;
  const activeCatalogue = customCatalogue;
  const activeBV = useMemo(() => {
    const sc = buildScenario(activeFuel, activeState, "bv", activePrice,
      { annualKm, catalogueValue: activeCatalogue ?? undefined });
    return { ...sc, calc: calcMonthlyCosts(sc, params) };
  }, [activeFuel, activeState, activePrice, activeCatalogue, params, annualKm]);
  const activePV = useMemo(() => {
    const sc = buildScenario(activeFuel, activeState, "private", activePrice,
      { annualKm, catalogueValue: activeCatalogue ?? undefined });
    return { ...sc, calc: calcMonthlyCosts(sc, params) };
  }, [activeFuel, activeState, activePrice, activeCatalogue, params, annualKm]);
  const activeCross = useMemo(() => findCrossover(activeFuel, activeState, params, {
    annualKm, catalogueValue: activeCatalogue ?? undefined,
  }), [activeFuel, activeState, activeCatalogue, params, annualKm]);

  const activeWinner = activeBV.calc.totalMonthlyPersonal <= activePV.calc.totalMonthlyPersonal ? "bv" : "private";
  const activeDiff = Math.abs(activeBV.calc.totalMonthlyPersonal - activePV.calc.totalMonthlyPersonal);

  // Cheapest cell across the whole prebaked matrix
  const matrixCells = FUEL_ORDER.flatMap(fk => STATE_ORDER.map(sk => matrix[fk][sk]));
  const cheapestOption = matrixCells.reduce((best, cell) => {
    const bv = cell.bv.calc.totalMonthlyPersonal;
    const pv = cell.pv.calc.totalMonthlyPersonal;
    const cellMin = Math.min(bv, pv);
    if (cellMin < best.value) {
      return { value: cellMin, cell, path: bv <= pv ? "bv" : "private" };
    }
    return best;
  }, { value: Infinity, cell: null, path: null });

  const f = activeWinner === "bv" ? activeBV : activePV;
  const maxBar = Math.max(1, ...["monthlyBijtellingTax", "monthlyDepreciation", "monthlyFuel",
    "monthlyMaintenance", "monthlyMRB", "monthlyCapitalCost", "monthlyPseudo"]
    .map(k => Math.max(activeBV.calc[k] || 0, activePV.calc[k] || 0)));

  // Auto-update customPrice when fuel/state changes (use prebaked default)
  const setActiveCell = (fuelKey, stateKey) => {
    setActiveFuel(fuelKey);
    setActiveState(stateKey);
    setCustomPrice(PREBAKED_PRICES[fuelKey][stateKey]);
    setCustomCatalogue(null);
  };

  const fmt = n => `€${Math.round(n).toLocaleString()}`;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=swap');
        * { font-family: 'Inter', 'Helvetica Neue', Arial, sans-serif !important; }
        input[type=range] { height: 24px; }
      `}</style>
      <div style={{
        background: "#0d0d1a", minHeight: "100vh", color: "#e0e0e0",
        padding: "24px 16px", fontSize: 16, maxWidth: 1100, margin: "0 auto",
      }}>
        {/* Header */}
        <div style={{ marginBottom: 20, borderBottom: "1px solid #222", paddingBottom: 16 }}>
          <div style={{ fontSize: 11, letterSpacing: 4, color: "#999", textTransform: "uppercase", marginBottom: 6 }}>
            DGA Auto Vergelijking · NL 2026 rules
          </div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 900, color: "#f0f0f0", letterSpacing: -0.5 }}>
            What's the cheapest way to own this car?
          </h1>
          <p style={{ margin: "8px 0 0", fontSize: 14, color: "#aaa", lineHeight: 1.55 }}>
            Compare <strong style={{ color: "#f1c40f" }}>4 fuel types × 3 ages × 2 paths (BV vs Private)</strong> as a true monthly cost
            net of tax. Bijtelling marginal rate is computed against your salary + 30% ruling and 2026 brackets;
            BV expenses net 19% VPB and the box 2 rate you'd pay to extract that money.
          </p>
        </div>

        {/* Settings */}
        <div style={{
          background: "#111122", border: "1px solid #222", borderRadius: 8,
          padding: 16, marginBottom: 16,
          display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14,
        }}>
          <div>
            <label style={{ fontSize: 11, color: "#999", letterSpacing: 2, textTransform: "uppercase", display: "block", marginBottom: 4 }}>DGA Gross Salary</label>
            <input type="range" min={56000} max={200000} step={2000} value={grossSalary}
              onChange={e => setGrossSalary(+e.target.value)} style={{ width: "100%", accentColor: "#3498db" }} />
            <div style={{ fontSize: 15, color: "#3498db", fontWeight: 700 }}>{fmt(grossSalary)}/yr</div>
            <div style={{ fontSize: 11, color: "#888" }}>Taxable after ruling: {fmt(taxableAfter)}</div>
          </div>
          <div>
            <label style={{ fontSize: 11, color: "#999", letterSpacing: 2, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Hold Period</label>
            <input type="range" min={2} max={8} step={1} value={holdYears}
              onChange={e => setHoldYears(+e.target.value)} style={{ width: "100%", accentColor: "#e74c3c" }} />
            <div style={{ fontSize: 15, color: "#e74c3c", fontWeight: 700 }}>{holdYears} years</div>
          </div>
          <div>
            <label style={{ fontSize: 11, color: "#999", letterSpacing: 2, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Annual km</label>
            <input type="range" min={8000} max={40000} step={1000} value={annualKm}
              onChange={e => setAnnualKm(+e.target.value)} style={{ width: "100%", accentColor: "#9b59b6" }} />
            <div style={{ fontSize: 15, color: "#9b59b6", fontWeight: 700 }}>{annualKm.toLocaleString()} km/yr</div>
          </div>
          <div>
            <label style={{ fontSize: 11, color: "#999", letterSpacing: 2, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Box 2 (DGA dividend)</label>
            <Segmented value={box2Rate} onChange={setBox2Rate} color="#27ae60" options={[
              { value: 0.245, label: "24.5% (≤€68.8k)" },
              { value: 0.31,  label: "31% (above)" },
            ]}/>
            <div style={{ fontSize: 11, color: "#888", marginTop: 4 }}>Rate you'd pay to extract BV cash as dividend</div>
          </div>
          <Toggle value={use30Ruling} onChange={setUse30Ruling} color="#3498db"
            label="30% Ruling active"
            sub={use30Ruling
              ? `Tax-free portion: ${fmt(grossSalary - taxableAfter)} (norm-capped at €48,013 taxable)`
              : "No ruling — full salary taxable"} />
          <div>
            <div style={{ fontSize: 11, color: "#999", letterSpacing: 2, textTransform: "uppercase", marginBottom: 4 }}>Private capital cost</div>
            <Segmented value={financeMode} onChange={setFinanceMode} color="#e74c3c" options={[
              { value: "cash", label: "Cash (4% opp.)" },
              { value: "loan", label: "Loan (6%)" },
            ]}/>
            <div style={{ fontSize: 11, color: "#888", marginTop: 4 }}>
              {financeMode === "loan" ? "6%/yr interest on avg balance" : "4%/yr foregone on cash"}
            </div>
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <Toggle value={pseudoEindheffing} onChange={setPseudoEindheffing} color="#e67e22"
              label="2027 pseudo-eindheffing applies (12%/yr cat. value, BV petrol/hybrid/PHEV)"
              sub={pseudoEindheffing
                ? "On — commute counts as private use; EVs exempt"
                : "Off — applies if registered before 1 Jan 2027 (transition to 17 Sep 2030)"} />
          </div>
        </div>

        {/* Cheapest banner */}
        {cheapestOption.cell && (
          <div style={{
            background: `${cheapestOption.cell[cheapestOption.path].color}15`,
            border: `1px solid ${cheapestOption.cell[cheapestOption.path].color}`,
            borderRadius: 8, padding: "12px 14px", marginBottom: 16,
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <div>
              <div style={{ fontSize: 11, color: "#999", letterSpacing: 2, textTransform: "uppercase", marginBottom: 4 }}>Cheapest option overall</div>
              <div style={{ fontSize: 16, color: cheapestOption.cell[cheapestOption.path].color, fontWeight: 800 }}>
                {cheapestOption.cell[cheapestOption.path].label} · {cheapestOption.path === "bv" ? "BV" : "Private"}
              </div>
              <div style={{ fontSize: 12, color: "#888" }}>at typical price {fmt(cheapestOption.cell.price)}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 30, color: cheapestOption.cell[cheapestOption.path].color, fontWeight: 900, lineHeight: 1 }}>
                {fmt(cheapestOption.value)}
              </div>
              <div style={{ fontSize: 11, color: "#888" }}>/mo net to you</div>
            </div>
          </div>
        )}

        {/* The Matrix */}
        <div style={{ fontSize: 12, color: "#999", letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>
          Fuel × Age matrix · cheaper of (BV, Private) at typical price
        </div>
        <div style={{
          background: "#0a0d18", border: "1px solid #1e1e3a", borderRadius: 8,
          padding: 8, marginBottom: 16, overflowX: "auto",
        }}>
          <div style={{ display: "grid", gridTemplateColumns: "100px repeat(3, 1fr)", gap: 6, minWidth: 560 }}>
            <div></div>
            {STATE_ORDER.map(sk => (
              <div key={sk} style={{ textAlign: "center", padding: "8px 4px" }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: "#e0e0e0" }}>{STATES[sk].label}</div>
                <div style={{ fontSize: 11, color: "#888" }}>{STATES[sk].sublabel}</div>
              </div>
            ))}
            {FUEL_ORDER.map(fk => (
              <Fragment key={fk}>
                <div style={{
                  display: "flex", alignItems: "center", padding: "8px 6px",
                  fontSize: 13, fontWeight: 800, color: FUELS[fk].color,
                }}>{FUELS[fk].short}</div>
                {STATE_ORDER.map(sk => {
                  const cell = matrix[fk][sk];
                  const bv = cell.bv.calc.totalMonthlyPersonal;
                  const pv = cell.pv.calc.totalMonthlyPersonal;
                  const winnerIsBV = bv <= pv;
                  const winnerVal = Math.min(bv, pv);
                  const isActive = activeFuel === fk && activeState === sk;
                  const isCheapest = cell === cheapestOption.cell;
                  return (
                    <div key={`${fk}-${sk}`} onClick={() => setActiveCell(fk, sk)} style={{
                      background: isActive ? `${FUELS[fk].color}20` : (isCheapest ? `${FUELS[fk].color}10` : "#0d0d1a"),
                      border: `1px solid ${isActive ? FUELS[fk].color : (isCheapest ? `${FUELS[fk].color}55` : "#1e1e3a")}`,
                      borderRadius: 6, padding: 8, cursor: "pointer",
                      transition: "all 0.15s", position: "relative",
                    }}>
                      <div style={{
                        fontSize: 9, color: winnerIsBV ? "#1abc9c" : "#e67e22",
                        letterSpacing: 1, fontWeight: 800, textTransform: "uppercase",
                      }}>
                        {winnerIsBV ? "BV ✓" : "Private ✓"}
                      </div>
                      <div style={{ fontSize: 22, fontWeight: 900, color: FUELS[fk].color, lineHeight: 1.1 }}>
                        {fmt(winnerVal)}<span style={{ fontSize: 11, color: "#666" }}>/mo</span>
                      </div>
                      <div style={{ fontSize: 10, color: "#666", marginTop: 3 }}>
                        @ {fmt(cell.price)} · vs {winnerIsBV ? "Priv" : "BV"} {fmt(Math.max(bv, pv))}
                      </div>
                    </div>
                  );
                })}
              </Fragment>
            ))}
          </div>
        </div>

        {/* Active cell deep-dive */}
        <div style={{
          background: "#111122", border: `1px solid ${FUELS[activeFuel].color}40`,
          borderRadius: 8, padding: 16, marginBottom: 16,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
            <div>
              <div style={{ fontSize: 11, color: FUELS[activeFuel].accent, letterSpacing: 2, textTransform: "uppercase", marginBottom: 2 }}>
                ▶ {STATES[activeState].label} {FUELS[activeFuel].label} — Deep dive
              </div>
              <div style={{ fontSize: 12, color: "#888", maxWidth: 700 }}>
                {FUELS[activeFuel].note} {STATES[activeState].note}
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: 11, color: "#999", letterSpacing: 2, textTransform: "uppercase", display: "block", marginBottom: 4 }}>
                Purchase price
              </label>
              <input type="range" min={4000} max={80000} step={500} value={customPrice}
                onChange={e => { setCustomPrice(+e.target.value); setCustomCatalogue(null); }}
                style={{ width: "100%", accentColor: FUELS[activeFuel].color }} />
              <div style={{ fontSize: 16, color: FUELS[activeFuel].color, fontWeight: 700 }}>{fmt(customPrice)}</div>
            </div>
            <div>
              <label style={{ fontSize: 11, color: "#999", letterSpacing: 2, textTransform: "uppercase", display: "block", marginBottom: 4 }}>
                Catalogue value (bijtelling base)
              </label>
              <input type="range" min={Math.max(customPrice, 4000)} max={Math.max(customPrice * 3, 80000)} step={500}
                value={customCatalogue ?? Math.round(customPrice * STATES[activeState].catalogueMultiplier)}
                onChange={e => setCustomCatalogue(+e.target.value)}
                style={{ width: "100%", accentColor: "#f1c40f" }} />
              <div style={{ fontSize: 16, color: "#f1c40f", fontWeight: 700 }}>
                {fmt(customCatalogue ?? Math.round(customPrice * STATES[activeState].catalogueMultiplier))}
                {customCatalogue === null && <span style={{ fontSize: 11, color: "#888", fontWeight: 400 }}> · default {STATES[activeState].catalogueMultiplier}× price</span>}
              </div>
            </div>
          </div>

          {/* Side-by-side BV vs Private */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
            {[
              { side: activeBV, label: "BV path", color: "#1abc9c", winner: activeWinner === "bv",
                sub: `bijtelling ${activeBV.calc.bijtellingRate}% · ${activeBV.calc.effectiveMarginalRate}% marginal` },
              { side: activePV, label: "Private path", color: "#e67e22", winner: activeWinner === "private",
                sub: financeMode === "loan" ? "loan 6%" : "cash 4% opp." },
            ].map(c => (
              <div key={c.label} style={{
                background: c.winner ? `${c.color}15` : "#0d0d1a",
                border: `1px solid ${c.winner ? c.color : "transparent"}`,
                borderRadius: 6, padding: 12,
              }}>
                <div style={{ fontSize: 11, color: c.color, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>
                  {c.label} {c.winner && "✓"}
                </div>
                <div style={{ fontSize: 28, fontWeight: 900, color: c.color, lineHeight: 1 }}>
                  {fmt(c.side.calc.totalMonthlyPersonal)}
                </div>
                <div style={{ fontSize: 11, color: "#888", marginTop: 4 }}>{c.sub}</div>
              </div>
            ))}
          </div>

          <div style={{ fontSize: 11, color: "#aaa", marginBottom: 12, padding: "8px 10px",
            background: "#0a0a14", border: "1px solid #1e1e3a", borderRadius: 6 }}>
            {activeCross.price !== null
              ? <>BV ↔ Private crossover for this fuel/age @ <strong style={{ color: "#f1c40f" }}>{fmt(activeCross.price)}</strong> purchase price.
                  Below it, {activePrice < activeCross.price ? "Private wins" : "BV wins"}; above it the other way around.</>
              : <>At any reasonable price for this fuel/age, <strong style={{ color: activeCross.alwaysCheaper === "bv" ? "#1abc9c" : "#e67e22" }}>
                  {activeCross.alwaysCheaper === "bv" ? "BV is always cheaper" : "Private is always cheaper"}</strong> under these settings.</>}
          </div>

          {/* Component bars (winner) */}
          <div style={{ fontSize: 12, color: "#999", letterSpacing: 2, textTransform: "uppercase", marginBottom: 10 }}>
            Monthly components (winner: {activeWinner === "bv" ? "BV" : "Private"}, net to you)
          </div>
          {f.calc.monthlyBijtellingTax > 0 && <BarRow label="Bijtelling income tax" value={f.calc.monthlyBijtellingTax} max={maxBar} color={FUELS[activeFuel].color} />}
          {f.calc.monthlyPseudo > 0 && <BarRow label="Pseudo-eindheffing (BV)" value={f.calc.monthlyPseudo} max={maxBar} color="#e67e22" />}
          <BarRow label="Depreciation (price − resale)" value={f.calc.monthlyDepreciation} max={maxBar} color={FUELS[activeFuel].color} />
          <BarRow label={f.type === "bv" ? "Capital cost (opp., net VPB & box 2)" : (financeMode === "loan" ? "Loan interest" : "Capital cost (opp.)")}
            value={f.calc.monthlyCapitalCost} max={maxBar} color={FUELS[activeFuel].color} />
          <BarRow label="Fuel / charging" value={f.calc.monthlyFuel} max={maxBar} color={FUELS[activeFuel].color} />
          <BarRow label="Maintenance" value={f.calc.monthlyMaintenance} max={maxBar} color={FUELS[activeFuel].color} />
          <BarRow label="Road tax (MRB)" value={f.calc.monthlyMRB} max={maxBar} color={FUELS[activeFuel].color} />

          {/* Key facts */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginTop: 14 }}>
            {[
              { label: "Resale est.", value: fmt(f.calc.resaleValue), sub: `after ${holdYears}y (${Math.round(f.resaleFraction*100)}%/4y)` },
              { label: "Annual bijtelling", value: f.type === "bv" ? fmt(f.calc.annualBijtelling) : "—", sub: f.type === "bv" ? `${f.calc.bijtellingRate}% × cat.` : "private path" },
              { label: "Marginal on bijtelling", value: f.type === "bv" ? `${f.calc.effectiveMarginalRate}%` : "—", sub: use30Ruling ? "with 30% ruling" : "no ruling" },
              { label: "VPB saving/yr", value: f.type === "bv" ? fmt(f.calc.vpbSaving) : "—", sub: "19% on BV costs" },
              { label: "Pseudo/yr", value: f.type === "bv" && f.calc.annualPseudo > 0 ? fmt(f.calc.annualPseudo) : "—", sub: "12% × cat. (2027+)" },
              { label: "BV→personal factor", value: f.type === "bv" ? `×${f.calc.bvFactor.toFixed(2)}` : "—", sub: "(1−VPB)(1−box 2)" },
            ].map((it, i) => (
              <div key={i} style={{ background: "#0d0d1a", borderRadius: 6, padding: 10 }}>
                <div style={{ fontSize: 10, color: "#999", textTransform: "uppercase", letterSpacing: 1 }}>{it.label}</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: "#e0e0e0", marginTop: 2 }}>{it.value}</div>
                <div style={{ fontSize: 10, color: "#888" }}>{it.sub}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Use-case guidance */}
        <div style={{ background: "#0d1117", border: "1px solid #1e2a1e", borderRadius: 8, padding: 14, marginBottom: 14 }}>
          <div style={{ fontSize: 12, color: "#27ae60", letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>
            For long EU trips + city escapes + family of four
          </div>
          <div style={{ fontSize: 13, color: "#bbb", lineHeight: 1.6 }}>
            <strong style={{ color: "#e74c3c" }}>Petrol/Hybrid:</strong> No range or charging worry on motorway holidays. Hybrid wins city use too. <br />
            <strong style={{ color: "#9b59b6" }}>PHEV:</strong> On long highway trips with full load, the battery does little — you carry expensive batteries that mostly hibernate, plus pay the heavier MRB class. Best only if your weekly use is &lt;50 km/day so you're truly mostly on electric. <br />
            <strong style={{ color: "#1abc9c" }}>EV:</strong> Cheapest per km and tax-favoured. Long EU trips with a packed family car = real route planning around chargers, slower stops, and ~25–35% effective range loss with full load + AC + highway speed. Used Used EVs (≥2022) come with the locked-in 16% bijtelling — strongest BV case in the matrix.
          </div>
        </div>

        {/* 2027 Pseudo warning */}
        <div style={{ background: "#1a0a00", border: "1px solid #7f3900", borderRadius: 8, padding: 14, marginBottom: 14 }}>
          <div style={{ fontSize: 12, color: "#e67e22", letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>
            ⚠ 2027 Pseudo-eindheffing — biggest single rule
          </div>
          <div style={{ fontSize: 13, color: "#bbb", lineHeight: 1.6 }}>
            From <strong>1 Jan 2027</strong>, the BV (employer) pays <strong style={{ color: "#e67e22" }}>+12% of catalogue value/yr</strong> for any
            petrol/hybrid/PHEV car made available to an employee — and <strong>commute counts as private use</strong>.
            EVs (and hydrogen) are exempt. If the car is registered to the BV before <strong>1 Jan 2027</strong>, a transition rule defers this until <strong>17 Sep 2030</strong>.
            Toggle above to model with/without it.
          </div>
        </div>

        {/* Methodology */}
        <details style={{ background: "#0a0a14", border: "1px solid #1e1e3a", borderRadius: 8, padding: 14, marginBottom: 14 }}>
          <summary style={{ fontSize: 12, color: "#999", letterSpacing: 2, textTransform: "uppercase", cursor: "pointer" }}>
            Methodology — what's modeled, what isn't
          </summary>
          <div style={{ fontSize: 12, color: "#aaa", lineHeight: 1.7, marginTop: 10 }}>
            <strong style={{ color: "#e0e0e0" }}>BV path personal cost</strong> = <code>(annual BV cash outflow − 19% VPB) × (1 − box 2 rate) + bijtelling × marginal income tax</code>.
            Bijtelling marginal rate is the actual delta in box 1 tax when bijtelling is added on top of taxable salary (post-30% ruling cap).
            <br /><br />
            <strong style={{ color: "#e0e0e0" }}>Private path personal cost</strong> = depreciation + fuel + maintenance + MRB + capital cost. Capital cost is either 4% opportunity (cash) or 6% interest (loan), both on average outstanding balance <code>(price + resale)/2</code>.
            <br /><br />
            <strong style={{ color: "#e0e0e0" }}>Bijtelling rates used</strong>: 22% petrol/hybrid/PHEV always. EV: locked-in 60-month rate based on registration year (2022: 16% on first €35k cap; 2023–24: 16% on €30k cap; 2025: 17%; 2026: 18%; spillover above cap: 22%).
            <br /><br />
            <strong style={{ color: "#e0e0e0" }}>MRB 2026</strong>: petrol/hybrid base; PHEV +25% (lost ¾-rate, lost 125-kg correction); EV ×0.70.
            <br /><br />
            <strong style={{ color: "#e0e0e0" }}>Not modeled</strong>: BPM (one-off registration tax), MIA/KIA, BTW recovery on BV purchase, end-of-cycle BV-to-private sale at fair value, CO2-based MRB nuances, region-based MRB surcharges, insurance.
          </div>
        </details>

        <div style={{ fontSize: 11, color: "#666", textAlign: "center", lineHeight: 1.6 }}>
          Estimates only · Verify with your accountant · 2026 NL tax rates baked in · Source-of-truth: this open code
        </div>
      </div>
    </>
  );
}
