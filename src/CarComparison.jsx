import { Fragment, useMemo, useState } from "react";

// ============================================================================
// Tax model — verified 2026 NL parameters
// ============================================================================
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
  let prev = 0, tax = 0;
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
  return (box1Tax(taxable + annualBijtelling) - box1Tax(taxable)) / annualBijtelling;
}

// ============================================================================
// Catalog of fuels and ages
// ============================================================================
// Each fuel has a base (mixed-use) cost and city/highway multipliers.
// At highwayPct=0.5 the multiplier is 1.0 (backward-compatible with old defaults).
const FUELS = {
  petrol: {
    label: "Petrol", short: "Petrol",
    color: "#c0392b", accent: "#e74c3c",
    isEV: false, isPHEV: false, fuelCostPer10k: 1100,
    cityMult: 1.15, highwayMult: 0.90,
    note: "Pure ICE — long range, simplest. Full pseudo-eindheffing exposure from 2027 (BV path).",
  },
  hybrid: {
    label: "Self-charging Hybrid", short: "Hybrid",
    color: "#d35400", accent: "#e67e22",
    isEV: false, isPHEV: false, fuelCostPer10k: 850,
    cityMult: 0.85, highwayMult: 1.20,
    note: "No plug. Excellent in city (regen + engine-off), but hybrid system gives little benefit on steady-state highway. 2027 pseudo-eindheffing applies (BV).",
  },
  phev: {
    label: "Plug-in Hybrid (PHEV)", short: "PHEV",
    color: "#8e44ad", accent: "#9b59b6",
    isEV: false, isPHEV: true, fuelCostPer10k: 750,
    cityMult: 0.50, highwayMult: 1.80,
    note: "Heavier weight class → MRB ~25% higher than petrol from 2026 (lost ¾-rate). Same 22% bijtelling. Long highway trips with full load = mostly running on petrol while carrying battery weight.",
  },
  ev: {
    label: "EV", short: "EV",
    color: "#16a085", accent: "#1abc9c",
    isEV: true, isPHEV: false, fuelCostPer10k: 350,
    cityMult: 0.75, highwayMult: 1.50,
    note: "Cheapest per km, MRB 30% discount, exempt from 2027 pseudo-eindheffing. Highway speed + full load = real charging-stop planning, 25–35% range loss; aero drag dominates so highway costs a lot more energy than city.",
  },
};
const FUEL_ORDER = ["petrol", "hybrid", "phev", "ev"];

const STATES = {
  used: {
    label: "Used", short: "Used", sublabel: "5+ years old",
    age: 6, catalogueMultiplier: 2.0, annualMaintenance: 1500,
    resaleFraction: 0.45, evRegYear: 2020,
    note: "Cheap entry, but BV path inherits the original (high) catalogue value for bijtelling — the killer for old petrol cars in a BV.",
  },
  young: {
    label: "Young Used", short: "Young", sublabel: "2–3 years old",
    age: 2.5, catalogueMultiplier: 1.30, annualMaintenance: 900,
    resaleFraction: 0.55, evRegYear: 2023,
    note: "Sweet spot: meaningful price drop vs new, catalogue close enough to purchase price that BV bijtelling isn't punitive. Modern features, often warranty active.",
  },
  newCar: {
    label: "New", short: "New", sublabel: "0–1 year old",
    age: 0.5, catalogueMultiplier: 1.0, annualMaintenance: 600,
    resaleFraction: 0.65, evRegYear: 2026,
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

function buildScenario(fuelKey, stateKey, carPrice, opts = {}) {
  const fuel = FUELS[fuelKey];
  const state = STATES[stateKey];
  return {
    fuelKey, stateKey, fuel, state,
    color: fuel.color, accent: fuel.accent,
    label: `${state.label} ${fuel.label}`,
    short: `${state.short} ${fuel.short}`,
    isEV: fuel.isEV, isPHEV: fuel.isPHEV,
    evRegYear: opts.evRegYear ?? state.evRegYear,
    carPrice,
    catalogueValue: opts.catalogueValue ?? Math.round(carPrice * state.catalogueMultiplier),
    annualMaintenance: state.annualMaintenance,
    annualKm: opts.annualKm ?? 18000,
    resaleFraction: state.resaleFraction,
  };
}

// EV bijtelling: locked-in for 60 months (5 years) from first registration,
// then transitions to whatever the standard rate is in that year.
// As of 2026, post-lock cars pay 22% (the standard rate).
// We assume "current year" = 2026 (the calculator's reference year).
const CURRENT_YEAR = 2026;

function getBijtellingRate(scenario, catalogueValue) {
  if (!scenario.isEV) return 0.22;
  const regYear = scenario.evRegYear || 2026;
  const yearsSinceReg = CURRENT_YEAR - regYear;
  // If 60-month lock has expired, fall back to standard 22%.
  if (yearsSinceReg >= 5) return 0.22;
  const split = (cap, rate) =>
    ((Math.min(catalogueValue, cap) * rate) + (Math.max(0, catalogueValue - cap) * 0.22)) / catalogueValue;
  // Historical EV bijtelling caps & rates (year of first registration):
  if (regYear <= 2019) return 0.22; // pre-2020 = old regime, treat as standard now
  if (regYear === 2020) return split(45000, 0.08);
  if (regYear === 2021) return split(40000, 0.12);
  if (regYear === 2022) return split(35000, 0.16);
  if (regYear === 2023 || regYear === 2024) return split(30000, 0.16);
  if (regYear === 2025) return split(30000, 0.17);
  if (regYear === 2026) return split(30000, 0.18);
  return 0.22;
}

function getMRBMonthly(scenario) {
  const base = 90;
  if (scenario.isEV) return Math.round(base * 0.70);
  if (scenario.isPHEV) return Math.round(base * 1.25);
  return base;
}

function resaleAtAge(price, resaleFraction, years) {
  return price * Math.pow(resaleFraction, years / 4);
}

// ============================================================================
// Cost engine — per-segment costs over `years` years
// ============================================================================
// Returns absolute personal-equivalent costs (€, total over the segment).
//   bvFactor = (1 − VPB) × (1 − box2) — the rate at which BV cash translates to personal cost
function calcSegment(scenario, type, params, startPrice, years) {
  const { grossSalary, use30Ruling, financeMode, pseudoEindheffing, box2Rate, cashRetentionMode,
    oilStress = 1.0, bvProfitable = true, highwayPct = 0.5 } = params;
  // If user plans to leave BV cash inside the BV (no dividend in foreseeable future),
  // box 2 doesn't apply to ongoing operating costs OR to residual extraction.
  // The "extract" mode is the default conservative assumption.
  const effectiveBox2 = cashRetentionMode === "retain" ? 0 : box2Rate;
  // If BV has no taxable profit to offset, VPB deduction is worth nothing.
  const effectiveVPB = bvProfitable ? VPB_RATE : 0;
  const cat = scenario.catalogueValue;
  const months = years * 12;
  // Oil-stress multiplier applies to ICE fuels; EV charging cost is much less sensitive.
  const fuelStressMult = scenario.isEV ? 1 + (oilStress - 1) * 0.15 : oilStress;
  // Usage-mix multiplier: linearly interpolates between each fuel's city and highway efficiency.
  // Rescaled so that highwayPct=0.5 yields exactly 1.0 (anchor to fuelCostPer10k defaults).
  const cityMult = scenario.fuel.cityMult ?? 1;
  const highwayMult = scenario.fuel.highwayMult ?? 1;
  const rawMix = cityMult * (1 - highwayPct) + highwayMult * highwayPct;
  const anchorAtHalf = (cityMult + highwayMult) / 2;
  const mixMult = anchorAtHalf > 0 ? rawMix / anchorAtHalf : 1;
  const annualFuel = (scenario.fuel.fuelCostPer10k * fuelStressMult * mixMult * scenario.annualKm) / 10000;
  const annualRunning = annualFuel + scenario.annualMaintenance;
  const annualMRB = getMRBMonthly(scenario) * 12;
  const endResale = resaleAtAge(startPrice, scenario.resaleFraction, years);
  const annualDepreciation = (startPrice - endResale) / years;
  const avgCapital = (startPrice + endResale) / 2;
  const annualOpportunity = avgCapital * OPPORTUNITY_RATE;

  if (type === "bv") {
    const bijtellingRate = getBijtellingRate(scenario, cat);
    const annualBijtelling = cat * bijtellingRate;
    const marginalRate = bijtellingMarginalRate(grossSalary, use30Ruling, annualBijtelling);
    const annualBijtellingTax = annualBijtelling * marginalRate;
    const annualPseudo = (!scenario.isEV && pseudoEindheffing) ? cat * 0.12 : 0;
    const bvFactor = (1 - effectiveVPB) * (1 - effectiveBox2);

    // Gross BV expenses (deductible against VPB if BV is profitable).
    const annualBVGrossCost = annualDepreciation + annualRunning + annualMRB + annualOpportunity + annualPseudo;
    const annualVPBSaving = annualBVGrossCost * effectiveVPB;
    const annualBVCashAfterVPB = annualBVGrossCost - annualVPBSaving;
    const annualBox2Drag = annualBVCashAfterVPB * effectiveBox2;

    const annualPersonal = annualBijtellingTax + bvFactor * annualBVGrossCost;

    return {
      type: "bv", years, months, startPrice, endResale,
      bijtellingRate, annualBijtelling, marginalRate, annualBijtellingTax,
      annualPseudo, bvFactor,
      annualDepreciation, annualRunning, annualMRB, annualOpportunity,
      annualVPBSaving, annualBVGrossCost, annualBVCashAfterVPB, annualBox2Drag,
      effectiveBox2,
      monthly: {
        bijtellingTax: annualBijtellingTax / 12,
        pseudo: bvFactor * annualPseudo / 12,
        depreciation: bvFactor * annualDepreciation / 12,
        fuel: bvFactor * annualFuel / 12,
        maintenance: bvFactor * scenario.annualMaintenance / 12,
        mrb: bvFactor * annualMRB / 12,
        capital: bvFactor * annualOpportunity / 12,
        vpbSaving: -annualVPBSaving * (1 - effectiveBox2) / 12, // shown as a negative (offset)
        total: annualPersonal / 12,
      },
      total: annualPersonal * years,
      walkAwayBVAsset: endResale,
      walkAwayPersonalIfExtracted: endResale * (1 - effectiveBox2),
    };
  } else {
    const capitalRate = financeMode === "loan" ? LOAN_RATE : OPPORTUNITY_RATE;
    const annualCapital = avgCapital * capitalRate;
    const annualPersonal = annualDepreciation + annualRunning + annualMRB + annualCapital;
    return {
      type: "private", years, months, startPrice, endResale,
      bijtellingRate: 0, annualBijtelling: 0, marginalRate: 0, annualBijtellingTax: 0,
      annualPseudo: 0, bvFactor: 1,
      annualDepreciation, annualRunning, annualMRB, annualOpportunity: annualCapital,
      monthly: {
        bijtellingTax: 0, pseudo: 0,
        depreciation: annualDepreciation / 12,
        fuel: annualFuel / 12,
        maintenance: scenario.annualMaintenance / 12,
        mrb: annualMRB / 12,
        capital: annualCapital / 12,
        total: annualPersonal / 12,
      },
      total: annualPersonal * years,
      walkAwayBVAsset: 0,
      walkAwayPersonalIfExtracted: endResale, // already personal
    };
  }
}

// ============================================================================
// Strategies — compose segments into a multi-year plan
// ============================================================================
function strategyPureBV(scenario, params, totalYears) {
  const seg = calcSegment(scenario, "bv", params, scenario.carPrice, totalYears);
  const effectiveBox2 = params.cashRetentionMode === "retain" ? 0 : params.box2Rate;
  const totalVPBSaving = seg.annualVPBSaving * totalYears;
  const totalGrossBVCost = seg.annualBVGrossCost * totalYears;
  const totalBijtellingTax = seg.annualBijtellingTax * totalYears;
  const totalBox2Drag = seg.annualBox2Drag * totalYears;
  return {
    key: "bv", label: "BV for the whole period",
    color: "#1abc9c",
    segments: [seg],
    totalYears,
    totalCost: seg.total,
    monthlyAvg: seg.total / (totalYears * 12),
    residualPersonal: seg.walkAwayPersonalIfExtracted,
    residualGross: seg.endResale,
    residualLocation: "in BV",
    residualNote: effectiveBox2 > 0
      ? `Car worth €${Math.round(seg.endResale).toLocaleString()} sits in the BV. To extract it personally, you'd dividend out → lose ${Math.round(effectiveBox2*100)}% box 2.`
      : `Car worth €${Math.round(seg.endResale).toLocaleString()} stays in the BV (cash-retain mode: no box 2 modeled until you actually dividend out).`,
    netEconomicCost: seg.total,
    totalGrossBVCost, totalVPBSaving, totalBijtellingTax, totalBox2Drag,
    effectiveBox2,
  };
}

function strategyPurePrivate(scenario, params, totalYears) {
  const seg = calcSegment(scenario, "private", params, scenario.carPrice, totalYears);
  return {
    key: "private", label: "Private for the whole period",
    color: "#e67e22",
    segments: [seg],
    totalYears,
    totalCost: seg.total,
    monthlyAvg: seg.total / (totalYears * 12),
    residualPersonal: seg.endResale,
    residualGross: seg.endResale,
    residualLocation: "personal",
    residualNote: `Car worth €${Math.round(seg.endResale).toLocaleString()}, already personally owned — you can sell or keep with no further tax friction.`,
    netEconomicCost: seg.total,
  };
}

function strategyExtension(scenario, params, totalYears, switchYear) {
  // Phase 1: BV for `switchYear` years
  const phase1 = calcSegment(scenario, "bv", params, scenario.carPrice, switchYear);
  // At end of phase 1, sell to self at FMV = phase1.endResale.
  // Assuming BV depreciated to FMV, gain = 0, no extra VPB. Wealth-neutral transaction.
  const phase2Years = totalYears - switchYear;
  const phase2 = calcSegment(scenario, "private", params, phase1.endResale, phase2Years);
  return {
    key: "extension", label: `BV ${switchYear}y → buy out → Private ${phase2Years}y`,
    color: "#f1c40f",
    segments: [phase1, phase2],
    totalYears,
    switchYear,
    totalCost: phase1.total + phase2.total,
    monthlyAvg: (phase1.total + phase2.total) / (totalYears * 12),
    residualPersonal: phase2.endResale, // personally owned at end
    residualGross: phase2.endResale,
    residualLocation: "personal",
    residualNote: `After year ${switchYear} the car is yours personally. End-of-period value €${Math.round(phase2.endResale).toLocaleString()} is direct personal cash equivalent.`,
    netEconomicCost: phase1.total + phase2.total,
    transactionAtSwitch: {
      transferPrice: phase1.endResale,
      gainOnSale: 0,
      vpbCostOnGain: 0,
    },
  };
}

function strategyExtensionWithPenalty(scenario, params, totalYears, switchYear) {
  // Variant where BV book value < FMV at switch (e.g. forced 5-year linear depreciation).
  // We model BV book = max(price × max(0, 1 - switchYear/5), price × 0.10)
  const bookValue = Math.max(scenario.carPrice * Math.max(0, 1 - switchYear / 5), scenario.carPrice * 0.10);
  const phase1 = calcSegment(scenario, "bv", params, scenario.carPrice, switchYear);
  const fmv = phase1.endResale;
  const gain = Math.max(0, fmv - bookValue);
  const vpbCostOnGain = gain * VPB_RATE; // BV pays VPB on the gain
  const phase2Years = totalYears - switchYear;
  const phase2 = calcSegment(scenario, "private", params, fmv, phase2Years);
  // Personal-equiv impact of VPB cost on gain (paid by BV, eventually box-2 hits dividend extraction)
  const effectiveBox2 = params.cashRetentionMode === "retain" ? 0 : params.box2Rate;
  const vpbCostPersonalEquiv = vpbCostOnGain * (1 - effectiveBox2);
  return {
    key: "extensionPenalty",
    totalCost: phase1.total + phase2.total + vpbCostPersonalEquiv,
    bookValue, fmv, gain, vpbCostOnGain, vpbCostPersonalEquiv,
    monthlyAvg: (phase1.total + phase2.total + vpbCostPersonalEquiv) / (totalYears * 12),
    residualPersonal: phase2.endResale,
  };
}

function findBestSwitchYear(scenario, params, totalYears) {
  let best = { switchYear: null, totalCost: Infinity };
  for (let s = 1; s <= totalYears - 1; s++) {
    const ext = strategyExtension(scenario, params, totalYears, s);
    if (ext.totalCost < best.totalCost) best = { switchYear: s, totalCost: ext.totalCost, strategy: ext };
  }
  return best;
}

// ============================================================================
// UI components
// ============================================================================
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
  <div style={{ display: "inline-flex", background: "#0d0d1a", borderRadius: 6, padding: 3, border: "1px solid #1e1e3a", flexWrap: "wrap" }}>
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

const fmt = n => `€${Math.round(n).toLocaleString()}`;

// ============================================================================
// Main component
// ============================================================================
export default function CarComparison() {
  const [grossSalary, setGrossSalary] = useState(80000);
  const [use30Ruling, setUse30Ruling] = useState(true);
  const [holdYears, setHoldYears] = useState(5);
  const [annualKm, setAnnualKm] = useState(18000);
  const [financeMode, setFinanceMode] = useState("cash");
  const [pseudoEindheffing, setPseudoEindheffing] = useState(true);
  const [registerBefore2027, setRegisterBefore2027] = useState(false);
  const [box2Rate, setBox2Rate] = useState(0.245);
  const [cashRetentionMode, setCashRetentionMode] = useState("extract");
  const [oilStress, setOilStress] = useState(1.0);
  const [bvProfitable, setBvProfitable] = useState(true);
  const [highwayPct, setHighwayPct] = useState(0.5);

  // Default ANCHOR = the user's baseline plan: Used Petrol Private @ €8k cash, 5y.
  const [activeFuel, setActiveFuel] = useState("petrol");
  const [activeState, setActiveState] = useState("used");
  const [customPrice, setCustomPrice] = useState(8000);
  const [customCatalogue, setCustomCatalogue] = useState(null);
  const [switchYear, setSwitchYear] = useState(2);

  // Anchor scenario — the baseline plan everything is compared against.
  // Defaults to "Used Petrol Private €8k cash", but any (fuel, state, price, strategy) can be pinned.
  const [anchor, setAnchor] = useState({
    fuelKey: "petrol", stateKey: "used", price: 8000, strategy: "private",
    catalogueValue: null,
  });

  const effectivePseudo = registerBefore2027 ? false : pseudoEindheffing;

  const params = useMemo(() => ({
    grossSalary, use30Ruling, financeMode,
    pseudoEindheffing: effectivePseudo, box2Rate, cashRetentionMode, oilStress, bvProfitable, highwayPct,
  }), [grossSalary, use30Ruling, financeMode, effectivePseudo, box2Rate, cashRetentionMode, oilStress, bvProfitable, highwayPct]);

  const taxableAfter = taxableAfterRuling(grossSalary, use30Ruling);

  // Active scenario
  const activeScenario = useMemo(() => buildScenario(activeFuel, activeState, customPrice, {
    annualKm, catalogueValue: customCatalogue ?? undefined,
  }), [activeFuel, activeState, customPrice, customCatalogue, annualKm]);

  // Three strategies on the active scenario
  const stratPureBV = useMemo(() => strategyPureBV(activeScenario, params, holdYears),
    [activeScenario, params, holdYears]);
  const stratPurePV = useMemo(() => strategyPurePrivate(activeScenario, params, holdYears),
    [activeScenario, params, holdYears]);
  const safeSwitch = Math.max(1, Math.min(switchYear, holdYears - 1));
  const stratExt = useMemo(() => strategyExtension(activeScenario, params, holdYears, safeSwitch),
    [activeScenario, params, holdYears, safeSwitch]);
  const bestSwitch = useMemo(() => findBestSwitchYear(activeScenario, params, holdYears),
    [activeScenario, params, holdYears]);

  // 2027-rule insight: same scenario but with pseudo on regardless
  const insight2027 = useMemo(() => {
    const paramsPseudoOn = { ...params, pseudoEindheffing: true };
    const paramsPseudoOff = { ...params, pseudoEindheffing: false };
    const bvOn = strategyPureBV(activeScenario, paramsPseudoOn, holdYears);
    const bvOff = strategyPureBV(activeScenario, paramsPseudoOff, holdYears);
    const extOn = bestSwitch.switchYear ? strategyExtension(activeScenario, paramsPseudoOn, holdYears, bestSwitch.switchYear) : null;
    const extOff = bestSwitch.switchYear ? strategyExtension(activeScenario, paramsPseudoOff, holdYears, bestSwitch.switchYear) : null;
    return {
      bvSavingsByRegistering: bvOn.totalCost - bvOff.totalCost,
      extSavingsByRegistering: extOn && extOff ? extOn.totalCost - extOff.totalCost : 0,
    };
  }, [activeScenario, params, holdYears, bestSwitch.switchYear]);

  const strategies = [stratPurePV, stratPureBV, stratExt];
  const cheapestStrategy = strategies.reduce((b, s) => s.totalCost < b.totalCost ? s : b, strategies[0]);

  // Matrix at typical prices: each cell shows the cheapest of {Private, BV, ExtensionAtBest}
  const matrix = useMemo(() => {
    const out = {};
    for (const fk of FUEL_ORDER) {
      out[fk] = {};
      for (const sk of STATE_ORDER) {
        const price = PREBAKED_PRICES[fk][sk];
        const sc = buildScenario(fk, sk, price, { annualKm });
        const pv = strategyPurePrivate(sc, params, holdYears);
        const bv = strategyPureBV(sc, params, holdYears);
        const best = findBestSwitchYear(sc, params, holdYears);
        const candidates = [pv, bv, best.strategy].filter(Boolean);
        const winner = candidates.reduce((b, s) => s.totalCost < b.totalCost ? s : b, candidates[0]);
        out[fk][sk] = { fuelKey: fk, stateKey: sk, price, pv, bv, ext: best.strategy, switchYear: best.switchYear, winner };
      }
    }
    return out;
  }, [params, holdYears, annualKm]);

  const matrixCells = FUEL_ORDER.flatMap(fk => STATE_ORDER.map(sk => matrix[fk][sk]));
  const cheapestCell = matrixCells.reduce((b, c) =>
    c.winner.monthlyAvg < b.winner.monthlyAvg ? c : b, matrixCells[0]);

  // ---------- Anchor & ranked alternatives ----------
  const anchorScenario = useMemo(() =>
    buildScenario(anchor.fuelKey, anchor.stateKey, anchor.price, {
      annualKm, catalogueValue: anchor.catalogueValue ?? undefined,
    }),
    [anchor, annualKm]
  );

  function strategyOf(scenario, kind, switchY) {
    if (kind === "private") return strategyPurePrivate(scenario, params, holdYears);
    if (kind === "bv") return strategyPureBV(scenario, params, holdYears);
    if (kind === "extension") return strategyExtension(scenario, params, holdYears, switchY ?? Math.ceil(holdYears / 2));
    if (kind === "best") return findBestSwitchYear(scenario, params, holdYears).strategy
      ?? strategyPurePrivate(scenario, params, holdYears);
    throw new Error("unknown strategy " + kind);
  }

  const anchorStrat = useMemo(() => {
    if (anchor.strategy === "best") {
      const best = findBestSwitchYear(anchorScenario, params, holdYears);
      const candidates = [
        strategyPurePrivate(anchorScenario, params, holdYears),
        strategyPureBV(anchorScenario, params, holdYears),
        best.strategy,
      ].filter(Boolean);
      return candidates.reduce((b, s) => s.totalCost < b.totalCost ? s : b, candidates[0]);
    }
    return strategyOf(anchorScenario, anchor.strategy);
  }, [anchorScenario, anchor.strategy, params, holdYears]);

  // True net wealth lost over the period — depends on path.
  //
  // Pure Private and Extension:
  //   Depreciation inside totalCost already = (price − resale) / years × years = price − resale.
  //   So totalCost = real cash out the door (purchase + running − resale).
  //   The residualPersonal asset is what you sold the car for at the end — already counted INSIDE
  //   totalCost via depreciation. Net wealth lost = totalCost.
  //
  // Pure BV:
  //   The car's residual belongs to the BV, not directly to you. The BV has (separately) accumulated
  //   the residual as an asset on its books. To get it personally, you'd dividend it out, losing
  //   box 2 (residualPersonal already accounts for this haircut).
  //   For apples-to-apples vs Private, we treat the BV residual as a recoverable asset that
  //   reduces the personal wealth impact: net = totalCost − residualPersonal.
  const netWealthCost = (s) => {
    if (s.key === "bv") return s.totalCost - s.residualPersonal;
    return s.totalCost;
  };
  const anchorNet = netWealthCost(anchorStrat);

  // Build the universe of alternatives at typical prices (best-of-3 strategies per cell).
  const alternatives = useMemo(() => {
    const out = [];
    for (const fk of FUEL_ORDER) for (const sk of STATE_ORDER) {
      const cell = matrix[fk][sk];
      // Skip the anchor itself.
      const isAnchor = fk === anchor.fuelKey && sk === anchor.stateKey
        && Math.abs(cell.price - anchor.price) < 1;
      out.push({
        fuelKey: fk, stateKey: sk, price: cell.price,
        winner: cell.winner, isAnchor,
        netWealthCost: netWealthCost(cell.winner),
        deltaMonthly: cell.winner.monthlyAvg - anchorStrat.monthlyAvg,
        deltaTotal: cell.winner.totalCost - anchorStrat.totalCost,
        deltaNet: netWealthCost(cell.winner) - anchorNet,
      });
    }
    return out.sort((a, b) => a.netWealthCost - b.netWealthCost);
  }, [matrix, anchorStrat, anchorNet, anchor.fuelKey, anchor.stateKey, anchor.price]);

  const anchorRank = alternatives.filter(a => !a.isAnchor)
    .findIndex(a => a.netWealthCost > anchorNet) + 1;
  const betterThanAnchor = alternatives.filter(a => !a.isAnchor && a.netWealthCost < anchorNet);
  const top3Better = betterThanAnchor.slice(0, 3);

  const setActiveCell = (fuelKey, stateKey, priceOverride) => {
    setActiveFuel(fuelKey);
    setActiveState(stateKey);
    setCustomPrice(priceOverride ?? PREBAKED_PRICES[fuelKey][stateKey]);
    setCustomCatalogue(null);
  };

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
            Is anything actually better than my baseline plan?
          </h1>
          <p style={{ margin: "8px 0 0", fontSize: 14, color: "#aaa", lineHeight: 1.55 }}>
            Pin a baseline (e.g. €8k Used Petrol Private cash) and the calculator ranks every other (fuel × age × strategy) combo by <strong style={{ color: "#f1c40f" }}>net wealth change over the hold period</strong> — total paid minus the residual asset value you keep. Strategies compared per scenario: <strong style={{ color: "#e67e22" }}>Pure Private</strong> · <strong style={{ color: "#1abc9c" }}>Pure BV</strong> · <strong style={{ color: "#f1c40f" }}>BV → buy out at FMV → continue Private</strong>.
          </p>
        </div>

        {/* === ANCHOR & RANKED ALTERNATIVES === */}
        <div style={{
          background: "#0a1014", border: "1px solid #1abc9c",
          borderRadius: 10, padding: 16, marginBottom: 16,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
            <div style={{ fontSize: 12, color: "#1abc9c", letterSpacing: 3, textTransform: "uppercase" }}>
              ★ Your baseline plan vs everything else
            </div>
            <button onClick={() => setAnchor({
              fuelKey: activeFuel, stateKey: activeState, price: customPrice,
              strategy: "best", catalogueValue: customCatalogue,
            })} style={{
              background: "transparent", color: "#1abc9c", border: "1px solid #1abc9c",
              borderRadius: 4, padding: "4px 10px", fontSize: 11, cursor: "pointer",
              fontWeight: 700, letterSpacing: 1, textTransform: "uppercase",
            }}>Pin current scenario as baseline</button>
          </div>

          {/* Anchor summary row */}
          <div style={{
            background: "#0d141a", border: "1px solid #16a085",
            borderRadius: 8, padding: 12, marginBottom: 12,
            display: "grid", gridTemplateColumns: "1fr auto auto auto", gap: 12, alignItems: "center",
          }}>
            <div>
              <div style={{ fontSize: 10, color: "#888", letterSpacing: 2, textTransform: "uppercase", marginBottom: 2 }}>Baseline</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#1abc9c" }}>
                {STATES[anchor.stateKey].label} {FUELS[anchor.fuelKey].label} · {anchor.strategy === "private" ? "Private" : anchor.strategy === "bv" ? "BV" : anchor.strategy === "extension" ? "BV→Pv ext." : "Best strategy"}
              </div>
              <div style={{ fontSize: 11, color: "#888" }}>
                {fmt(anchor.price)} · {holdYears}y hold · {annualKm.toLocaleString()} km/yr
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 10, color: "#888", letterSpacing: 1, textTransform: "uppercase" }}>Avg/mo</div>
              <div style={{ fontSize: 18, color: "#1abc9c", fontWeight: 800 }}>{fmt(anchorStrat.monthlyAvg)}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 10, color: "#888", letterSpacing: 1, textTransform: "uppercase" }}>Total {holdYears}y</div>
              <div style={{ fontSize: 18, color: "#1abc9c", fontWeight: 800 }}>{fmt(anchorStrat.totalCost)}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 10, color: "#888", letterSpacing: 1, textTransform: "uppercase" }}>Net wealth lost</div>
              <div style={{ fontSize: 18, color: "#1abc9c", fontWeight: 900 }}>{fmt(anchorNet)}</div>
              <div style={{ fontSize: 9, color: "#666" }}>residual {fmt(anchorStrat.residualPersonal)} returns to you on top</div>
            </div>
          </div>

          {/* Verdict + top alternatives */}
          {betterThanAnchor.length === 0 ? (
            <div style={{
              background: "#001a14", border: "1px solid #27ae60",
              borderRadius: 6, padding: "12px 14px",
              fontSize: 13, color: "#27ae60", lineHeight: 1.6,
            }}>
              ✓ <strong>Your baseline plan wins.</strong> No prebaked alternative has a lower net wealth cost over {holdYears} years. Stick with the plan, or try changing the inputs (km/yr, hold period, pseudo-eindheffing toggle) to stress-test it.
            </div>
          ) : (
            <>
              <div style={{
                background: "#1a1500", border: "1px solid #f1c40f",
                borderRadius: 6, padding: "12px 14px", marginBottom: 10,
                fontSize: 13, color: "#e0e0e0", lineHeight: 1.6,
              }}>
                <strong style={{ color: "#f1c40f" }}>{betterThanAnchor.length} alternative{betterThanAnchor.length > 1 ? "s" : ""} beat your baseline</strong> on net wealth over {holdYears}y. Top picks below — note the ones that need a bigger upfront budget.
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {top3Better.map((alt, i) => {
                  const sc = matrix[alt.fuelKey][alt.stateKey];
                  const w = sc.winner;
                  const upfrontDelta = alt.price - anchor.price;
                  return (
                    <div key={`${alt.fuelKey}-${alt.stateKey}`} onClick={() => setActiveCell(alt.fuelKey, alt.stateKey)} style={{
                      background: "#0d0d1a", border: `1px solid ${FUELS[alt.fuelKey].color}55`,
                      borderRadius: 6, padding: 10, cursor: "pointer",
                      display: "grid", gridTemplateColumns: "auto 1fr auto auto auto", gap: 12, alignItems: "center",
                    }}>
                      <div style={{
                        background: i === 0 ? "#27ae60" : "#444", color: "#fff",
                        borderRadius: 12, width: 24, height: 24, display: "flex",
                        alignItems: "center", justifyContent: "center",
                        fontSize: 11, fontWeight: 800,
                      }}>#{i + 1}</div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: FUELS[alt.fuelKey].color }}>
                          {STATES[alt.stateKey].label} {FUELS[alt.fuelKey].label} · {w.key === "extension" ? `BV→Pv@y${sc.switchYear}` : (w.key === "bv" ? "BV" : "Private")}
                        </div>
                        <div style={{ fontSize: 11, color: "#888" }}>
                          {fmt(alt.price)} purchase {upfrontDelta > 0 && <span style={{ color: "#f1c40f" }}>(+{fmt(upfrontDelta)} vs baseline)</span>}
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 10, color: "#666", textTransform: "uppercase", letterSpacing: 1 }}>Avg/mo</div>
                        <div style={{ fontSize: 14, color: "#e0e0e0", fontWeight: 700 }}>{fmt(w.monthlyAvg)}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 10, color: "#666", textTransform: "uppercase", letterSpacing: 1 }}>Net {holdYears}y</div>
                        <div style={{ fontSize: 14, color: "#e0e0e0", fontWeight: 700 }}>{fmt(alt.netWealthCost)}</div>
                      </div>
                      <div style={{ textAlign: "right", minWidth: 70 }}>
                        <div style={{ fontSize: 10, color: "#666", textTransform: "uppercase", letterSpacing: 1 }}>Δ vs base</div>
                        <div style={{ fontSize: 14, color: "#27ae60", fontWeight: 800 }}>−{fmt(Math.abs(alt.deltaNet))}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
          <div style={{ marginTop: 10, padding: "8px 10px", background: "#0a0a14", borderRadius: 6, fontSize: 11, color: "#888", lineHeight: 1.6 }}>
            <strong style={{ color: "#aaa" }}>Net wealth lost</strong> = total real-money cost over {holdYears} years (purchase + running costs − resale at end). Depreciation already nets the resale, so this is an honest "I've lost this much" number. The residual cash returns to you on top of this — it's a separate asset, not a discount. For BV path, that residual sits inside the BV and would lose box 2 ({Math.round((1-box2Rate)*100)}%) if you extracted it personally.
          </div>
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
            <label style={{ fontSize: 11, color: "#999", letterSpacing: 2, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Total hold period</label>
            <input type="range" min={3} max={10} step={1} value={holdYears}
              onChange={e => { setHoldYears(+e.target.value); if (switchYear >= +e.target.value) setSwitchYear(+e.target.value - 1); }}
              style={{ width: "100%", accentColor: "#e74c3c" }} />
            <div style={{ fontSize: 15, color: "#e74c3c", fontWeight: 700 }}>{holdYears} years</div>
          </div>
          <div>
            <label style={{ fontSize: 11, color: "#999", letterSpacing: 2, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Annual km</label>
            <input type="range" min={8000} max={40000} step={1000} value={annualKm}
              onChange={e => setAnnualKm(+e.target.value)} style={{ width: "100%", accentColor: "#9b59b6" }} />
            <div style={{ fontSize: 15, color: "#9b59b6", fontWeight: 700 }}>{annualKm.toLocaleString()} km/yr</div>
          </div>
          <div>
            <label style={{ fontSize: 11, color: "#999", letterSpacing: 2, textTransform: "uppercase", display: "block", marginBottom: 4 }}>BV cash plan</label>
            <Segmented value={cashRetentionMode} onChange={setCashRetentionMode} color="#27ae60" options={[
              { value: "extract", label: "Extract via dividend" },
              { value: "retain",  label: "Retain in BV" },
            ]}/>
            <div style={{ fontSize: 11, color: "#888", marginTop: 4 }}>
              {cashRetentionMode === "extract"
                ? `Box 2 ${Math.round(box2Rate*100)}% applied to BV cash & residual`
                : "No box 2 modeled — assumes you reinvest BV cash"}
            </div>
            {cashRetentionMode === "extract" && (
              <div style={{ marginTop: 6 }}>
                <Segmented value={box2Rate} onChange={setBox2Rate} color="#27ae60" small options={[
                  { value: 0.245, label: "24.5%" },
                  { value: 0.31,  label: "31%" },
                ]}/>
              </div>
            )}
          </div>
          <Toggle value={use30Ruling} onChange={setUse30Ruling} color="#3498db"
            label="30% Ruling active"
            sub={use30Ruling
              ? `Tax-free portion: ${fmt(grossSalary - taxableAfter)} (capped at €48,013 norm)`
              : "No ruling — full salary taxable"} />
          <div>
            <div style={{ fontSize: 11, color: "#999", letterSpacing: 2, textTransform: "uppercase", marginBottom: 4 }}>Private capital cost</div>
            <Segmented value={financeMode} onChange={setFinanceMode} color="#e74c3c" options={[
              { value: "cash", label: "Cash (4% opp.)" },
              { value: "loan", label: "Loan (6%)" },
            ]}/>
          </div>
          <div style={{ gridColumn: "1 / -1", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <Toggle value={pseudoEindheffing} onChange={setPseudoEindheffing} color="#e67e22"
              label="2027 pseudo-eindheffing exists"
              sub="12%/yr × cat., BV petrol/hybrid/PHEV; commute counts as private; EVs exempt"/>
            <Toggle value={registerBefore2027} onChange={setRegisterBefore2027} color="#f1c40f"
              label="I'll register the BV car before 1 Jan 2027"
              sub={registerBefore2027 ? "Transition rule defers pseudo-eindheffing to 17 Sep 2030" : "Toggle on to apply transition rule"}/>
          </div>

          {/* Oil-price stress + BV profit risk */}
          <div style={{ gridColumn: "1 / -1", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, paddingTop: 8, borderTop: "1px dashed #222" }}>
            <div>
              <label style={{ fontSize: 11, color: "#999", letterSpacing: 2, textTransform: "uppercase", display: "block", marginBottom: 4 }}>
                Oil/fuel price stress
              </label>
              <input type="range" min={0.7} max={2.0} step={0.05} value={oilStress}
                onChange={e => setOilStress(+e.target.value)} style={{ width: "100%", accentColor: "#e74c3c" }} />
              <div style={{ fontSize: 14, color: "#e74c3c", fontWeight: 700 }}>
                {(oilStress * 100).toFixed(0)}% of today's price
                {oilStress !== 1.0 && <span style={{ fontSize: 11, color: "#888", fontWeight: 400 }}> ({oilStress > 1 ? "+" : ""}{((oilStress - 1) * 100).toFixed(0)}%)</span>}
              </div>
              <div style={{ fontSize: 11, color: "#888" }}>EV charging assumed only ~15% as oil-sensitive as ICE fuel</div>
            </div>
            <Toggle value={bvProfitable} onChange={setBvProfitable} color="#27ae60"
              label="BV will be profitable enough to use VPB deduction"
              sub={bvProfitable
                ? "Default — €1 BV expense saves €0.19 corporate tax"
                : "Profit-risk mode — VPB benefit set to 0; BV path becomes much worse"} />
          </div>

          {/* Usage mix — city vs highway */}
          <div style={{ gridColumn: "1 / -1", paddingTop: 8, borderTop: "1px dashed #222" }}>
            <label style={{ fontSize: 11, color: "#999", letterSpacing: 2, textTransform: "uppercase", display: "block", marginBottom: 4 }}>
              Driving mix · city ↔ highway
            </label>
            <input type="range" min={0} max={1} step={0.05} value={highwayPct}
              onChange={e => setHighwayPct(+e.target.value)}
              style={{ width: "100%", accentColor: "#9b59b6" }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
              <div style={{ fontSize: 14, color: "#9b59b6", fontWeight: 700 }}>
                {Math.round((1 - highwayPct) * 100)}% city / {Math.round(highwayPct * 100)}% highway
              </div>
              <div style={{ fontSize: 11, color: "#888" }}>
                {highwayPct >= 0.7
                  ? "Holiday-trip / commuter pattern → hybrid advantage shrinks; EV range loss grows."
                  : highwayPct <= 0.3
                  ? "City-heavy → hybrid shines (regen + engine-off); EV most efficient."
                  : "Mixed use → calculator's anchored defaults apply."}
              </div>
            </div>
            {/* Live multiplier readout per fuel */}
            <div style={{ marginTop: 6, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
              {FUEL_ORDER.map(fk => {
                const fuel = FUELS[fk];
                const raw = fuel.cityMult * (1 - highwayPct) + fuel.highwayMult * highwayPct;
                const anchor = (fuel.cityMult + fuel.highwayMult) / 2;
                const mult = anchor > 0 ? raw / anchor : 1;
                const pct = Math.round((mult - 1) * 100);
                const tone = pct > 5 ? "#e74c3c" : pct < -5 ? "#27ae60" : "#888";
                return (
                  <div key={fk} style={{ background: "#0a0a14", borderRadius: 6, padding: "6px 8px" }}>
                    <div style={{ fontSize: 10, color: fuel.color, textTransform: "uppercase", letterSpacing: 1 }}>{fuel.short}</div>
                    <div style={{ fontSize: 13, color: tone, fontWeight: 700 }}>
                      {pct > 0 ? "+" : ""}{pct}% fuel
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Cheapest banner */}
        <div style={{
          background: `${cheapestCell.winner.color}15`,
          border: `1px solid ${cheapestCell.winner.color}`,
          borderRadius: 8, padding: "12px 14px", marginBottom: 16,
          display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8,
        }}>
          <div>
            <div style={{ fontSize: 11, color: "#999", letterSpacing: 2, textTransform: "uppercase", marginBottom: 4 }}>Cheapest of all 36 combos (4 fuels × 3 ages × 3 strategies)</div>
            <div style={{ fontSize: 16, color: cheapestCell.winner.color, fontWeight: 800 }}>
              {STATES[cheapestCell.stateKey].label} {FUELS[cheapestCell.fuelKey].label} · {cheapestCell.winner.label}
            </div>
            <div style={{ fontSize: 12, color: "#888" }}>at typical price {fmt(cheapestCell.price)}, {holdYears}-year hold</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 30, color: cheapestCell.winner.color, fontWeight: 900, lineHeight: 1 }}>
              {fmt(cheapestCell.winner.monthlyAvg)}<span style={{ fontSize: 14, color: "#666" }}>/mo</span>
            </div>
            <div style={{ fontSize: 11, color: "#888" }}>= {fmt(cheapestCell.winner.totalCost)} over {holdYears}y</div>
          </div>
        </div>

        {/* Matrix */}
        <div style={{ fontSize: 12, color: "#999", letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>
          Fuel × Age matrix · best of (Private, BV, BV→Private extension) at typical price
        </div>
        <div style={{
          background: "#0a0d18", border: "1px solid #1e1e3a", borderRadius: 8,
          padding: 8, marginBottom: 16, overflowX: "auto",
        }}>
          <div style={{ display: "grid", gridTemplateColumns: "100px repeat(3, 1fr)", gap: 6, minWidth: 600 }}>
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
                  const w = cell.winner;
                  const isActive = activeFuel === fk && activeState === sk;
                  const isCheapest = cell === cheapestCell;
                  const tagText = w.key === "extension" ? `BV→Pv@y${cell.switchYear}` : (w.key === "bv" ? "BV" : "Private");
                  return (
                    <div key={`${fk}-${sk}`} onClick={() => setActiveCell(fk, sk)} style={{
                      background: isActive ? `${FUELS[fk].color}20` : (isCheapest ? `${FUELS[fk].color}10` : "#0d0d1a"),
                      border: `1px solid ${isActive ? FUELS[fk].color : (isCheapest ? `${FUELS[fk].color}55` : "#1e1e3a")}`,
                      borderRadius: 6, padding: 8, cursor: "pointer",
                      transition: "all 0.15s",
                    }}>
                      <div style={{
                        fontSize: 9, color: w.color,
                        letterSpacing: 1, fontWeight: 800, textTransform: "uppercase",
                      }}>{tagText} ✓</div>
                      <div style={{ fontSize: 22, fontWeight: 900, color: FUELS[fk].color, lineHeight: 1.1 }}>
                        {fmt(w.monthlyAvg)}<span style={{ fontSize: 11, color: "#666" }}>/mo</span>
                      </div>
                      <div style={{ fontSize: 10, color: "#666", marginTop: 3 }}>
                        @ {fmt(cell.price)} · Pv {fmt(cell.pv.monthlyAvg)} BV {fmt(cell.bv.monthlyAvg)}
                      </div>
                    </div>
                  );
                })}
              </Fragment>
            ))}
          </div>
        </div>

        {/* Active scenario inputs */}
        <div style={{
          background: "#111122", border: `1px solid ${FUELS[activeFuel].color}40`,
          borderRadius: 8, padding: 16, marginBottom: 16,
        }}>
          <div style={{ fontSize: 11, color: FUELS[activeFuel].accent, letterSpacing: 2, textTransform: "uppercase", marginBottom: 4 }}>
            ▶ Custom: {STATES[activeState].label} {FUELS[activeFuel].label}
          </div>
          <div style={{ fontSize: 12, color: "#888", marginBottom: 12 }}>
            {FUELS[activeFuel].note} — {STATES[activeState].note}
          </div>
          {activeState === "used" && customPrice <= 10000 && (
            <div style={{
              background: "#1a0a00", border: "1px solid #c0392b55",
              borderRadius: 6, padding: "10px 12px", marginBottom: 12,
              fontSize: 12, color: "#e0c8b8", lineHeight: 1.55,
            }}>
              <strong style={{ color: "#e74c3c" }}>⚠ Maintenance variance on cheap used cars: </strong>
              At this price tier, one major repair (transmission, EV battery degradation, hybrid inverter) can swing total cost by <strong>€1,500–€4,000</strong>. The €{STATES.used.annualMaintenance}/yr maintenance assumed here is the <em>typical</em> case; budget a contingency or get a pre-purchase inspection. This applies symmetrically to BV and Private — it doesn't change which path wins, but the absolute numbers can move.
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ fontSize: 11, color: "#999", letterSpacing: 2, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Purchase price</label>
              <input type="range" min={4000} max={80000} step={500} value={customPrice}
                onChange={e => { setCustomPrice(+e.target.value); setCustomCatalogue(null); }}
                style={{ width: "100%", accentColor: FUELS[activeFuel].color }} />
              <div style={{ fontSize: 15, color: FUELS[activeFuel].color, fontWeight: 700 }}>{fmt(customPrice)}</div>
            </div>
            <div>
              <label style={{ fontSize: 11, color: "#999", letterSpacing: 2, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Catalogue value (bijtelling base)</label>
              <input type="range" min={Math.max(customPrice, 4000)} max={Math.max(customPrice * 3, 80000)} step={500}
                value={customCatalogue ?? Math.round(customPrice * STATES[activeState].catalogueMultiplier)}
                onChange={e => setCustomCatalogue(+e.target.value)}
                style={{ width: "100%", accentColor: "#f1c40f" }} />
              <div style={{ fontSize: 15, color: "#f1c40f", fontWeight: 700 }}>
                {fmt(customCatalogue ?? Math.round(customPrice * STATES[activeState].catalogueMultiplier))}
                {customCatalogue === null && <span style={{ fontSize: 11, color: "#888", fontWeight: 400 }}> ({STATES[activeState].catalogueMultiplier}× price)</span>}
              </div>
            </div>
            <div>
              <label style={{ fontSize: 11, color: "#999", letterSpacing: 2, textTransform: "uppercase", display: "block", marginBottom: 4 }}>BV→Private switch year</label>
              <input type="range" min={1} max={Math.max(1, holdYears - 1)} step={1} value={safeSwitch}
                onChange={e => setSwitchYear(+e.target.value)}
                style={{ width: "100%", accentColor: "#f1c40f" }} />
              <div style={{ fontSize: 15, color: "#f1c40f", fontWeight: 700 }}>
                Year {safeSwitch} ({safeSwitch}y BV + {holdYears - safeSwitch}y Private)
              </div>
              {bestSwitch.switchYear && bestSwitch.switchYear !== safeSwitch && (
                <div style={{ fontSize: 11, color: "#27ae60", marginTop: 2, cursor: "pointer" }}
                  onClick={() => setSwitchYear(bestSwitch.switchYear)}>
                  ✓ Optimal switch is year {bestSwitch.switchYear} → click to use
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Three-way strategy comparison */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
          {strategies.map(s => {
            const isWinner = s === cheapestStrategy;
            return (
              <div key={s.key} style={{
                background: isWinner ? `${s.color}15` : "#111122",
                border: `1px solid ${isWinner ? s.color : "#1e1e3a"}`,
                borderRadius: 8, padding: 12,
              }}>
                <div style={{ fontSize: 11, color: s.color, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>
                  {s.label} {isWinner && "✓"}
                </div>
                <div style={{ fontSize: 26, color: s.color, fontWeight: 900, lineHeight: 1 }}>
                  {fmt(s.monthlyAvg)}<span style={{ fontSize: 12, color: "#666" }}>/mo avg</span>
                </div>
                <div style={{ fontSize: 11, color: "#888", marginTop: 4 }}>{fmt(s.totalCost)} total over {holdYears}y</div>
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #1e1e3a", fontSize: 11, color: "#aaa", lineHeight: 1.5 }}>
                  <div>Residual: <strong style={{ color: "#e0e0e0" }}>{fmt(s.residualGross)}</strong> {s.residualLocation === "in BV" ? "(BV)" : "(personal)"}</div>
                  <div style={{ color: "#888" }}>Personal-equiv: {fmt(s.residualPersonal)}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Corporate-tax offset (VPB savings) panel — surfaces what BV ownership actually saves */}
        {stratPureBV.totalGrossBVCost > 0 && (
          <div style={{
            background: "#0d1018",
            border: `1px solid ${cashRetentionMode === "retain" ? "#27ae60" : "#16a08555"}`,
            borderRadius: 8, padding: 14, marginBottom: 16,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
              <div style={{ fontSize: 12, color: "#1abc9c", letterSpacing: 2, textTransform: "uppercase" }}>
                💰 BV path: corporate-tax offset over {holdYears}y
              </div>
              <div style={{ fontSize: 11, color: "#888" }}>
                Active scenario: {STATES[activeState].label} {FUELS[activeFuel].label} @ {fmt(customPrice)}
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 10 }}>
              <div style={{ background: "#0a0a14", borderRadius: 6, padding: 10 }}>
                <div style={{ fontSize: 10, color: "#888", textTransform: "uppercase", letterSpacing: 1 }}>Gross BV expenses</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#e0e0e0", marginTop: 2 }}>{fmt(stratPureBV.totalGrossBVCost)}</div>
                <div style={{ fontSize: 10, color: "#666" }}>depr. + fuel + maint. + MRB + cap. + pseudo</div>
              </div>
              <div style={{ background: "#0a1a14", borderRadius: 6, padding: 10, border: "1px solid #16a08555" }}>
                <div style={{ fontSize: 10, color: "#888", textTransform: "uppercase", letterSpacing: 1 }}>VPB saving (19%)</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#27ae60", marginTop: 2 }}>−{fmt(stratPureBV.totalVPBSaving)}</div>
                <div style={{ fontSize: 10, color: "#666" }}>that's your corporate-tax offset</div>
              </div>
              <div style={{ background: "#0a0a14", borderRadius: 6, padding: 10 }}>
                <div style={{ fontSize: 10, color: "#888", textTransform: "uppercase", letterSpacing: 1 }}>+ Bijtelling tax (you)</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#e74c3c", marginTop: 2 }}>+{fmt(stratPureBV.totalBijtellingTax)}</div>
                <div style={{ fontSize: 10, color: "#666" }}>{stratPureBV.segments[0].marginalRate * 100 | 0}% marginal × cat.</div>
              </div>
              <div style={{ background: "#0a0a14", borderRadius: 6, padding: 10 }}>
                <div style={{ fontSize: 10, color: "#888", textTransform: "uppercase", letterSpacing: 1 }}>{cashRetentionMode === "retain" ? "Box 2 deferred" : "+ Box 2 drag"}</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: cashRetentionMode === "retain" ? "#27ae60" : "#e67e22", marginTop: 2 }}>
                  {cashRetentionMode === "retain" ? "—" : "+" + fmt(stratPureBV.totalBox2Drag)}
                </div>
                <div style={{ fontSize: 10, color: "#666" }}>{cashRetentionMode === "retain" ? "if cash stays in BV" : `${Math.round(box2Rate*100)}% on extracted cash`}</div>
              </div>
            </div>
            <div style={{
              padding: "10px 12px", background: "#0a0a14", borderRadius: 6,
              fontSize: 12, color: "#aaa", lineHeight: 1.6,
            }}>
              Yes — BV expenses offset corporate income tax (VPB) at {Math.round(VPB_RATE * 100)}%, saving you{" "}
              <strong style={{ color: "#27ae60" }}>{fmt(stratPureBV.totalVPBSaving)}</strong> over {holdYears} years on this car.
              But that benefit is only ~half the picture. You also incur:
              <ul style={{ margin: "6px 0 0 18px", padding: 0 }}>
                <li><strong style={{ color: "#e74c3c" }}>Bijtelling income tax</strong> on you personally for the private-use benefit ({stratPureBV.segments[0].bijtellingRate}% × catalogue × your {stratPureBV.segments[0].marginalRate * 100 | 0}% marginal).</li>
                {cashRetentionMode === "extract" && <li><strong style={{ color: "#e67e22" }}>Box 2 dividend tax</strong> when you eventually extract the BV cash to your personal pocket — modeled at {Math.round(box2Rate*100)}%.</li>}
                {cashRetentionMode === "retain" && <li><strong style={{ color: "#27ae60" }}>Cash-retention mode is on</strong> — box 2 isn't applied. The model assumes BV cash stays in the BV (reinvested, used for future salary, etc.). When you do eventually pull it out, box 2 will apply then.</li>}
              </ul>
            </div>
          </div>
        )}

        {/* Detailed breakdown of the active scenario, all 3 strategies */}
        <div style={{
          background: "#111122", border: "1px solid #222",
          borderRadius: 8, padding: 16, marginBottom: 16,
        }}>
          <div style={{ fontSize: 12, color: "#999", letterSpacing: 2, textTransform: "uppercase", marginBottom: 12 }}>
            Year-by-year breakdown · {STATES[activeState].label} {FUELS[activeFuel].label} · {fmt(customPrice)} purchase
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 600 }}>
              <thead>
                <tr style={{ color: "#999", textAlign: "left" }}>
                  <th style={{ padding: "6px 8px", borderBottom: "1px solid #222" }}>Year</th>
                  <th style={{ padding: "6px 8px", borderBottom: "1px solid #222", textAlign: "right" }}>Pure Private</th>
                  <th style={{ padding: "6px 8px", borderBottom: "1px solid #222", textAlign: "right" }}>Pure BV</th>
                  <th style={{ padding: "6px 8px", borderBottom: "1px solid #222", textAlign: "right" }}>Buyout @ y{safeSwitch}</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: holdYears }, (_, i) => {
                  const y = i + 1;
                  const pvPerYear = stratPurePV.totalCost / holdYears;
                  const bvPerYear = stratPureBV.totalCost / holdYears;
                  const extPerYear = y <= safeSwitch
                    ? stratExt.segments[0].total / safeSwitch
                    : (stratExt.segments[1] ? stratExt.segments[1].total / (holdYears - safeSwitch) : 0);
                  const phaseLabel = y <= safeSwitch ? "BV" : "Private";
                  return (
                    <tr key={y} style={{ borderBottom: "1px solid #1a1a2e" }}>
                      <td style={{ padding: "6px 8px", color: "#aaa" }}>Year {y}</td>
                      <td style={{ padding: "6px 8px", color: "#e67e22", textAlign: "right" }}>{fmt(pvPerYear)}</td>
                      <td style={{ padding: "6px 8px", color: "#1abc9c", textAlign: "right" }}>{fmt(bvPerYear)}</td>
                      <td style={{ padding: "6px 8px", color: "#f1c40f", textAlign: "right" }}>
                        {fmt(extPerYear)} <span style={{ color: "#666", fontSize: 10 }}>({phaseLabel})</span>
                      </td>
                    </tr>
                  );
                })}
                <tr style={{ borderTop: "2px solid #222", fontWeight: 700 }}>
                  <td style={{ padding: "8px", color: "#e0e0e0" }}>Total</td>
                  <td style={{ padding: "8px", color: "#e67e22", textAlign: "right" }}>{fmt(stratPurePV.totalCost)}</td>
                  <td style={{ padding: "8px", color: "#1abc9c", textAlign: "right" }}>{fmt(stratPureBV.totalCost)}</td>
                  <td style={{ padding: "8px", color: "#f1c40f", textAlign: "right" }}>{fmt(stratExt.totalCost)}</td>
                </tr>
                <tr>
                  <td style={{ padding: "4px 8px", color: "#999", fontSize: 11 }}>End-of-period car value (yours)</td>
                  <td style={{ padding: "4px 8px", color: "#e67e22", textAlign: "right", fontSize: 11 }}>{fmt(stratPurePV.residualPersonal)}</td>
                  <td style={{ padding: "4px 8px", color: "#1abc9c", textAlign: "right", fontSize: 11 }}>{fmt(stratPureBV.residualPersonal)} <span style={{ color: "#666" }}>(after box 2)</span></td>
                  <td style={{ padding: "4px 8px", color: "#f1c40f", textAlign: "right", fontSize: 11 }}>{fmt(stratExt.residualPersonal)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: 10, padding: "8px 10px", background: "#0a0a14", borderRadius: 6, fontSize: 11, color: "#888", lineHeight: 1.6 }}>
            <strong style={{ color: "#aaa" }}>Total = real wealth lost over the period.</strong> Depreciation already nets the residual: <code>(price − resale) / years</code>. The "End-of-period car value" row above shows what you walk away with on top of that — it's not subtracted again from total. For Pure BV, the residual sits inside the BV; converting it to personal cash would cost a further box 2 hit ({Math.round((1-box2Rate)*100)}%).
          </div>
        </div>

        {/* 2027 register-before insight */}
        {(insight2027.bvSavingsByRegistering > 50 || insight2027.extSavingsByRegistering > 50) && !FUELS[activeFuel].isEV && (
          <div style={{
            background: "#1a1500", border: "1px solid #f1c40f",
            borderRadius: 8, padding: 14, marginBottom: 14,
          }}>
            <div style={{ fontSize: 12, color: "#f1c40f", letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>
              ★ Register-before-2027 insight
            </div>
            <div style={{ fontSize: 13, color: "#e0e0e0", lineHeight: 1.6 }}>
              For this {FUELS[activeFuel].label}, registering the BV car <strong>before 1 Jan 2027</strong> (transition rule) saves you about{" "}
              <strong style={{ color: "#f1c40f" }}>{fmt(insight2027.bvSavingsByRegistering)}</strong> on Pure BV
              {bestSwitch.switchYear && <> and <strong style={{ color: "#f1c40f" }}>{fmt(insight2027.extSavingsByRegistering)}</strong> on the buyout strategy</>}
              {" "}over {holdYears} years. EVs are unaffected by this rule.
            </div>
          </div>
        )}

        {/* Use-case guidance */}
        <div style={{ background: "#0d1117", border: "1px solid #1e2a1e", borderRadius: 8, padding: 14, marginBottom: 14 }}>
          <div style={{ fontSize: 12, color: "#27ae60", letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>
            Family of 4 · long EU trips + city escapes — qualitative read
          </div>
          <div style={{ fontSize: 13, color: "#bbb", lineHeight: 1.7 }}>
            <strong style={{ color: "#e74c3c" }}>Petrol:</strong> Long range, cheapest entry, no charging anxiety. In BV, only viable as Used or Young Used + register-before-2027. <br/>
            <strong style={{ color: "#e67e22" }}>Self-charging Hybrid:</strong> Best mixed-use balance. Quiet city, fuel-efficient, highway-capable, no charging logistics. <br/>
            <strong style={{ color: "#9b59b6" }}>PHEV:</strong> Worst-of-three for your usage. Heavier MRB class (2026), full pseudo-eindheffing, and on long highway trips with packed roof box and 4 people you mostly burn petrol while hauling battery weight. Only good if &lt;50 km/day daily use. <br/>
            <strong style={{ color: "#1abc9c" }}>EV:</strong> Cheapest per km and tax-favoured. For long EU trips: realistic to plan around fast chargers, expect 25–35% range loss with full load + AC + highway speed; younger kids tolerate 30-min charging stops well. Used EV (≥2022 reg) carries the locked-in 16% bijtelling — BV path very attractive there.
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
            EVs and hydrogen are exempt. Register the car to the BV before <strong>1 Jan 2027</strong> → transition rule defers this until <strong>17 Sep 2030</strong>.
          </div>
        </div>

        {/* Petrol Price Ladder */}
        <div style={{
          background: "#0a0d18", border: "1px solid #1e1e3a", borderRadius: 8,
          padding: 14, marginBottom: 14, overflowX: "auto",
        }}>
          <div style={{ fontSize: 12, color: "#e74c3c", letterSpacing: 2, textTransform: "uppercase", marginBottom: 4 }}>
            Petrol price ladder · Private cash, your current settings
          </div>
          <div style={{ fontSize: 11, color: "#888", marginBottom: 10, lineHeight: 1.5 }}>
            Same usage profile, just stretching upfront budget. Watch the cliff at ~€18k where you cross from "old used" (5+ yrs) to "young used" (2–3 yrs) and the residual curve flips. Click any row to load it as the active scenario.
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 560 }}>
            <thead>
              <tr style={{ color: "#999", textAlign: "left" }}>
                <th style={{ padding: "6px 8px", borderBottom: "1px solid #222" }}>Budget</th>
                <th style={{ padding: "6px 8px", borderBottom: "1px solid #222" }}>Realistic age</th>
                <th style={{ padding: "6px 8px", borderBottom: "1px solid #222", textAlign: "right" }}>Total 5y</th>
                <th style={{ padding: "6px 8px", borderBottom: "1px solid #222", textAlign: "right" }}>Residual</th>
                <th style={{ padding: "6px 8px", borderBottom: "1px solid #222", textAlign: "right" }}>Net wealth lost</th>
                <th style={{ padding: "6px 8px", borderBottom: "1px solid #222", textAlign: "right" }}>Δ vs cheapest</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const ladder = [
                  { price: 8000,  state: "used",   age: "~2014–2016 used" },
                  { price: 10000, state: "used",   age: "~2015–2017 used" },
                  { price: 12000, state: "used",   age: "~2016–2018 used" },
                  { price: 14000, state: "used",   age: "~2017–2019 used" },
                  { price: 16000, state: "used",   age: "~2018–2020 used" },
                  { price: 18000, state: "young",  age: "~2020–2022 young ★" },
                  { price: 22000, state: "young",  age: "~2021–2023 young" },
                  { price: 26000, state: "young",  age: "~2022–2024 young" },
                ];
                const rows = ladder.map(r => {
                  const sc = buildScenario("petrol", r.state, r.price, { annualKm });
                  const s = strategyPurePrivate(sc, params, holdYears);
                  return { ...r, total: s.totalCost, residual: s.residualPersonal,
                           net: s.totalCost };
                });
                const cheapest = Math.min(...rows.map(r => r.net));
                return rows.map(r => {
                  const isActive = activeFuel === "petrol" && activeState === r.state && customPrice === r.price;
                  const isCheapest = r.net === cheapest;
                  const delta = r.net - cheapest;
                  return (
                    <tr key={r.price} onClick={() => setActiveCell("petrol", r.state, r.price)}
                      style={{
                        borderBottom: "1px solid #1a1a2e",
                        background: isActive ? "#c0392b15" : isCheapest ? "#27ae6010" : "transparent",
                        cursor: "pointer", transition: "background 0.15s",
                      }}>
                      <td style={{ padding: "6px 8px", color: "#e0e0e0", fontWeight: 700 }}>€{r.price.toLocaleString()}</td>
                      <td style={{ padding: "6px 8px", color: "#888" }}>{r.age}</td>
                      <td style={{ padding: "6px 8px", textAlign: "right", color: "#aaa" }}>{fmt(r.total)}</td>
                      <td style={{ padding: "6px 8px", textAlign: "right", color: "#aaa" }}>{fmt(r.residual)}</td>
                      <td style={{ padding: "6px 8px", textAlign: "right", color: isCheapest ? "#27ae60" : "#e0e0e0", fontWeight: 700 }}>{fmt(r.net)}</td>
                      <td style={{ padding: "6px 8px", textAlign: "right", color: delta === 0 ? "#27ae60" : "#888" }}>
                        {delta === 0 ? "✓ best" : `+${fmt(delta)}`}
                      </td>
                    </tr>
                  );
                });
              })()}
            </tbody>
          </table>
          <div style={{ marginTop: 10, padding: "8px 10px", background: "#0a0a14", borderRadius: 6, fontSize: 11, color: "#888", lineHeight: 1.6 }}>
            ★ The €18k row is where the resale curve flips — a 4-year-old car holds value disproportionately better than an 8-year-old one. Within each age tier, every extra €2k costs ~€800 in net wealth; crossing the tier boundary saves more than it costs.
            <br/><br/>
            <strong style={{ color: "#aaa" }}>Caveat:</strong> the cliff is partly a modeling artifact — real used-car prices are continuous, not bucketed. The model uses different `resaleFraction` per age tier (0.45 used / 0.55 young / 0.65 new), which overstates the discontinuity. Direction is correct; magnitude is approximate.
          </div>
        </div>

        {/* Methodology */}
        <details style={{ background: "#0a0a14", border: "1px solid #1e1e3a", borderRadius: 8, padding: 14, marginBottom: 14 }}>
          <summary style={{ fontSize: 12, color: "#999", letterSpacing: 2, textTransform: "uppercase", cursor: "pointer" }}>
            Methodology · what's modeled, what isn't
          </summary>
          <div style={{ fontSize: 12, color: "#aaa", lineHeight: 1.7, marginTop: 10 }}>
            <strong style={{ color: "#e0e0e0" }}>Personal-equivalent cost factor for BV cash:</strong> <code>(1 − VPB)(1 − box 2)</code> ≈ {((1-VPB_RATE)*(1-box2Rate)).toFixed(3)} at current settings. €1 of BV cash → {((1-VPB_RATE)*(1-box2Rate)).toFixed(3)} of personal cash after dividending out.
            <br/><br/>
            <strong style={{ color: "#e0e0e0" }}>Bijtelling marginal rate:</strong> actual delta in 2026 box 1 tax when annual bijtelling is added on top of post-30%-ruling taxable salary. Brackets: 35.75 / 37.56 / 49.50 with breakpoints €38,883 and €78,426.
            <br/><br/>
            <strong style={{ color: "#e0e0e0" }}>EV bijtelling lock-in:</strong> 60-month period from first registration. 2022: 16% on €35k cap. 2023–24: 16% on €30k cap. 2025: 17%. 2026: 18%. Above cap: 22%. After 60 months → standard rate of that year.
            <br/><br/>
            <strong style={{ color: "#e0e0e0" }}>2026 MRB:</strong> EV pays 70% of normal rate, PHEV pays 100% (lost both the ¾-rate and the 125 kg correction), petrol/hybrid 100%.
            <br/><br/>
            <strong style={{ color: "#e0e0e0" }}>Buyout strategy assumption:</strong> at the switch year, BV sells the car to you (the DGA) at fair market value (= modeled resale value at that age). We assume BV's book value matches FMV (clean depreciation), so no taxable gain. In reality if BV used standard 5-year linear depreciation with a 10% residual floor, a small VPB cost on the gain may apply for short BV phases — typically &lt;€500 personal-equiv for normal cases.
            <br/><br/>
            <strong style={{ color: "#e0e0e0" }}>BPM:</strong> NL purchase tax. For consumer cars, BPM is already inside the dealer asking price and the catalogusprijs — no separate line. For BV imports it can be reclaimed in narrow cases; not modeled here.
            <br/><br/>
            <strong style={{ color: "#e0e0e0" }}>MIA / KIA:</strong> Investment deductions for company cars. In 2026 these no longer apply to passenger BEVs as they did pre-2024; specific eligibility depends on the Milieulijst and changes annually. Not modeled — could subtract a few hundred €/yr from BV cost for eligible new EVs.
            <br/><br/>
            <strong style={{ color: "#e0e0e0" }}>Not modeled:</strong> insurance (~€700–€1,500/yr, similar across paths so a near-wash), CO₂-based MRB nuances, regional MRB surcharges, BPM refunds for BV-to-BV trades, depreciation tax-asymmetries during the BV→Private buyout if BV used non-FMV depreciation.
            <br/><br/>
            <strong style={{ color: "#e0e0e0" }}>Capital cost:</strong> charged on average outstanding balance <code>(price + resale)/2</code>. BV path uses 4% opportunity (as if cash had been retained in BV). Private path uses 4% opp. (cash) or 6% interest (loan).
          </div>
        </details>

        <div style={{ fontSize: 11, color: "#666", textAlign: "center", lineHeight: 1.6 }}>
          Estimates only · Verify with your accountant · 2026 NL tax rates baked in · Open source: <a href="https://github.com/AsafAgranatProsus/Car-cost-calculator" style={{ color: "#3498db", textDecoration: "none" }}>github.com/AsafAgranatProsus/Car-cost-calculator</a>
        </div>
      </div>
    </>
  );
}
