import { useState, useMemo } from "react";

const BASE_SCENARIOS = [
  {
    id: "petrol-used",
    label: "Used Petrol/Hybrid",
    sublabel: "e.g. Toyota RAV4 Hybrid 2021",
    type: "bv", fuel: "hybrid",
    carPrice: 28000, catalogueValue: 28000,
    isEV: false, resaleFraction: 0.52,
    annualFuelCost: 1800, annualMaintenance: 1200,
    color: "#c0392b", accent: "#e74c3c", tag: "Standard petrol",
  },
  {
    id: "petrol-private",
    label: "Used Petrol/Hybrid",
    sublabel: "Private purchase (no BV)",
    type: "private", fuel: "hybrid",
    carPrice: 28000, catalogueValue: 28000,
    isEV: false, resaleFraction: 0.52,
    annualFuelCost: 1800, annualMaintenance: 1200,
    color: "#7f8c8d", accent: "#95a5a6", tag: "Simplest",
  },
  {
    id: "ev-used-older",
    label: "Used EV (2022–23)",
    sublabel: "e.g. Tesla Model Y / Kia EV6",
    type: "bv", fuel: "ev",
    carPrice: 34000, catalogueValue: 34000,
    isEV: true, evRegYear: 2022, resaleFraction: 0.60,
    annualFuelCost: 600, annualMaintenance: 700,
    color: "#16a085", accent: "#1abc9c", tag: "Sweet spot \u2605",
  },
  {
    id: "ev-new-young",
    label: "Young/New EV (2025\u201326)",
    sublabel: "e.g. Tesla Model Y, Kia EV9",
    type: "bv", fuel: "ev",
    carPrice: 45000, catalogueValue: 45000,
    isEV: true, evRegYear: 2026, resaleFraction: 0.68,
    annualFuelCost: 650, annualMaintenance: 750,
    color: "#2980b9", accent: "#3498db", tag: "Best resale",
  },
];

function getBijtellingRate(scenario, catalogueValue) {
  if (!scenario.isEV) return 0.22;
  const yr = scenario.evRegYear || 2026;
  if (yr <= 2025) return 0.17;
  if (yr === 2026)
    return ((Math.min(catalogueValue, 30000) * 0.18) + (Math.max(0, catalogueValue - 30000) * 0.22)) / catalogueValue;
  return 0.22;
}

function getMRBMonthly(scenario) {
  if (scenario.type === "private") return 85;
  if (!scenario.isEV) return 85;
  return Math.round(85 * 0.70);
}

function calcMonthlyCosts(scenario, params) {
  const { grossSalary, use30Ruling, includePrivateFinancing, holdYears, pseudoEindheffing } = params;
  const cat = scenario.catalogueValue;
  const price = scenario.carPrice;
  const baseMarginalRate = grossSalary > 75000 ? 0.495 : 0.369;
  const effectiveMarginalRate = use30Ruling ? baseMarginalRate * 0.70 : baseMarginalRate;

  if (scenario.type === "bv") {
    const bijtellingRate = getBijtellingRate(scenario, cat);
    const annualBijtelling = cat * bijtellingRate;
    const monthlyBijtellingTax = (annualBijtelling * effectiveMarginalRate) / 12;
    const annualDepreciation = price / 5;
    const annualRunning = scenario.annualFuelCost + scenario.annualMaintenance;
    const annualMRB = getMRBMonthly(scenario) * 12;
    const totalAnnualBVCost = annualDepreciation + annualRunning + annualMRB;
    const vpbSaving = totalAnnualBVCost * 0.19;
    const monthlyOpportunityCost = (price * 0.04) / 12 * (1 - 0.19);
    const resaleValue = price * Math.pow(scenario.resaleFraction, holdYears / 4);
    const monthlyResaleBenefit = resaleValue / (holdYears * 12);
    const bvCostPersonalImpact = (totalAnnualBVCost - vpbSaving - annualMRB) / 12;
    const bvMRBPersonalImpact = (annualMRB * (1 - 0.19)) / 12;
    const monthlyPseudo = (!scenario.isEV && pseudoEindheffing) ? (cat * 0.12 * (1 - 0.19)) / 12 : 0;
    const totalMonthlyPersonal = monthlyBijtellingTax + bvCostPersonalImpact + bvMRBPersonalImpact + monthlyOpportunityCost - monthlyResaleBenefit + monthlyPseudo;
    return {
      monthlyBijtellingTax: Math.round(monthlyBijtellingTax),
      monthlyRunning: Math.round((annualRunning * (1 - 0.19)) / 12),
      monthlyMRB: Math.round(getMRBMonthly(scenario) * (1 - 0.19)),
      monthlyDepreciation: Math.round((annualDepreciation * (1 - 0.19)) / 12),
      monthlyResaleBenefit: Math.round(monthlyResaleBenefit),
      monthlyPseudo: Math.round(monthlyPseudo),
      totalMonthlyPersonal: Math.round(totalMonthlyPersonal),
      effectiveMarginalRate: Math.round(effectiveMarginalRate * 100),
      bijtellingRate: Math.round(bijtellingRate * 100 * 10) / 10,
      annualBijtelling: Math.round(annualBijtelling),
      vpbSaving: Math.round(vpbSaving),
      type: "bv",
    };
  } else {
    const annualFinancing = includePrivateFinancing ? price * 0.06 : price / holdYears;
    const monthlyFinancing = annualFinancing / 12;
    const monthlyRunning = (scenario.annualFuelCost + scenario.annualMaintenance) / 12;
    const monthlyMRB = getMRBMonthly(scenario);
    const resaleValue = price * Math.pow(scenario.resaleFraction, holdYears / 4);
    const monthlyResaleBenefit = resaleValue / (holdYears * 12);
    const totalMonthlyPersonal = monthlyFinancing + monthlyRunning + monthlyMRB - monthlyResaleBenefit;
    return {
      monthlyBijtellingTax: 0, monthlyRunning: Math.round(monthlyRunning),
      monthlyMRB: Math.round(monthlyMRB), monthlyDepreciation: Math.round(price / (holdYears * 12)),
      monthlyResaleBenefit: Math.round(monthlyResaleBenefit), monthlyPseudo: 0,
      totalMonthlyPersonal: Math.round(totalMonthlyPersonal),
      effectiveMarginalRate: Math.round(effectiveMarginalRate * 100),
      bijtellingRate: 0, annualBijtelling: 0, vpbSaving: 0, type: "private",
    };
  }
}

const BarRow = ({ label, value, max, color, negative }) => (
  <div style={{ marginBottom: 7 }}>
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#888", marginBottom: 2 }}>
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
      <div style={{ fontSize: 12, color: "#444" }}>{sub}</div>
    </div>
  </div>
);

export default function CarComparison() {
  const [use30Ruling, setUse30Ruling] = useState(true);
  const [grossSalary, setGrossSalary] = useState(80000);
  const [holdYears, setHoldYears] = useState(4);
  const [includePrivateFinancing, setIncludePrivateFinancing] = useState(true);
  const [pseudoEindheffing, setPseudoEindheffing] = useState(false);
  const [activeScenario, setActiveScenario] = useState("ev-used-older");
  const [cheapPetrolPrice, setCheapPetrolPrice] = useState(14000);

  const params = { grossSalary, use30Ruling, includePrivateFinancing, holdYears, pseudoEindheffing };

  const cheapPetrolScenario = useMemo(() => ({
    id: "petrol-cheap",
    label: "Cheap Used Petrol",
    sublabel: cheapPetrolPrice <= 10000 ? "~2009\u20132012 family car" : cheapPetrolPrice <= 16000 ? "~2014\u20132017 family car" : "~2017\u20132019 family car",
    type: "bv", fuel: "hybrid",
    carPrice: cheapPetrolPrice,
    catalogueValue: Math.round(cheapPetrolPrice * 1.6),
    isEV: false, resaleFraction: 0.48,
    annualFuelCost: 1800, annualMaintenance: cheapPetrolPrice < 10000 ? 1800 : 1400,
    color: "#f39c12", accent: "#f1c40f", tag: "Price explorer",
  }), [cheapPetrolPrice]);

  const allScenarios = useMemo(() => [...BASE_SCENARIOS, cheapPetrolScenario], [cheapPetrolScenario]);

  const results = useMemo(() =>
    allScenarios.map(s => ({ ...s, calc: calcMonthlyCosts(s, params) })),
    [allScenarios, grossSalary, use30Ruling, holdYears, includePrivateFinancing, pseudoEindheffing]
  );

  const evBenchmark = results.find(r => r.id === "ev-used-older");
  const cheapPetrolResult = results.find(r => r.id === "petrol-cheap");
  const gap = cheapPetrolResult.calc.totalMonthlyPersonal - evBenchmark.calc.totalMonthlyPersonal;
  const isCheaperThanEV = gap < 0;

  const maxMonthly = Math.max(...results.map(r => r.calc.totalMonthlyPersonal));
  const maxBarValue = Math.max(1, ...results.flatMap(r => [
    r.calc.monthlyBijtellingTax, r.calc.monthlyRunning,
    r.calc.monthlyMRB, r.calc.monthlyDepreciation, r.calc.monthlyPseudo
  ]));

  const active = results.find(r => r.id === activeScenario);

  return (
    <div style={{
      fontFamily: "'Courier New', monospace",
      background: "#0d0d1a", minHeight: "100vh",
      color: "#e0e0e0", padding: "24px 16px", fontSize: 16,
    }}>
      {/* Header */}
      <div style={{ marginBottom: 24, borderBottom: "1px solid #222", paddingBottom: 16 }}>
        <div style={{ fontSize: 12, letterSpacing: 4, color: "#555", textTransform: "uppercase", marginBottom: 6 }}>
          NANS B.V. · AUTO VERGELIJKING 2026
        </div>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: "#f0f0f0", letterSpacing: -0.5 }}>
          Monthly Car Cost Calculator
        </h1>
        <p style={{ margin: "6px 0 0", fontSize: 14, color: "#666" }}>True monthly cost as DGA / employee after tax</p>
      </div>

      {/* Controls */}
      <div style={{
        background: "#111122", border: "1px solid #222", borderRadius: 8,
        padding: 16, marginBottom: 16,
        display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14,
      }}>
        <div>
          <label style={{ fontSize: 12, color: "#555", letterSpacing: 2, textTransform: "uppercase", display: "block", marginBottom: 6 }}>DGA Gross Salary</label>
          <input type="range" min={56000} max={150000} step={2000} value={grossSalary}
            onChange={e => setGrossSalary(+e.target.value)} style={{ width: "100%", accentColor: "#3498db" }} />
          <div style={{ fontSize: 16, color: "#3498db", fontWeight: 700 }}>€{grossSalary.toLocaleString()}/yr</div>
        </div>
        <div>
          <label style={{ fontSize: 12, color: "#555", letterSpacing: 2, textTransform: "uppercase", display: "block", marginBottom: 6 }}>Hold Period</label>
          <input type="range" min={2} max={7} step={1} value={holdYears}
            onChange={e => setHoldYears(+e.target.value)} style={{ width: "100%", accentColor: "#e74c3c" }} />
          <div style={{ fontSize: 16, color: "#e74c3c", fontWeight: 700 }}>{holdYears} years</div>
        </div>
        <Toggle value={use30Ruling} onChange={setUse30Ruling} color="#3498db"
          label="30% Ruling active"
          sub={use30Ruling ? `Eff. rate: ~${Math.round(0.495 * 0.70 * 100)}%` : "Standard: ~49.5%"} />
        <Toggle value={includePrivateFinancing} onChange={setIncludePrivateFinancing} color="#e74c3c"
          label="Private: include financing"
          sub="6% annual on car value" />
        <div style={{ gridColumn: "1 / -1" }}>
          <Toggle value={pseudoEindheffing} onChange={setPseudoEindheffing} color="#e67e22"
            label="Include 2027 pseudo-eindheffing (+12%/yr, petrol BV only)"
            sub={pseudoEindheffing ? "Applied — EVs still exempt" : "Off — assumes transition rule (register before Dec 2026)"} />
        </div>
      </div>

      {/* Crossover Explorer */}
      <div style={{
        background: "#131000",
        border: `2px solid ${isCheaperThanEV ? "#f1c40f" : "#3a2800"}`,
        borderRadius: 10, padding: 16, marginBottom: 16,
        transition: "border-color 0.4s",
      }}>
        <div style={{ fontSize: 12, color: "#f39c12", letterSpacing: 3, textTransform: "uppercase", marginBottom: 12 }}>
          ★ Cheap Petrol Crossover Explorer
        </div>
        <label style={{ fontSize: 12, color: "#666", letterSpacing: 2, textTransform: "uppercase", display: "block", marginBottom: 6 }}>
          Drag to find the crossover vs. Used EV (2022–23)
        </label>
        <input type="range" min={4000} max={28000} step={500} value={cheapPetrolPrice}
          onChange={e => setCheapPetrolPrice(+e.target.value)}
          style={{ width: "100%", accentColor: "#f39c12" }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 12 }}>
          <div style={{ fontSize: 22, color: "#f39c12", fontWeight: 900 }}>€{cheapPetrolPrice.toLocaleString()}</div>
          <div style={{ fontSize: 12, color: "#555" }}>orig. catalogue ~€{Math.round(cheapPetrolPrice * 1.6).toLocaleString()}</div>
        </div>

        {/* Verdict bar */}
        <div style={{
          background: isCheaperThanEV ? "#0a1a00" : "#1a0d00",
          border: `1px solid ${isCheaperThanEV ? "#27ae60" : "#7f3900"}`,
          borderRadius: 8, padding: "12px 14px",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          transition: "all 0.4s", marginBottom: 10,
        }}>
          <div>
            <div style={{ fontSize: 14, color: isCheaperThanEV ? "#27ae60" : "#e67e22", fontWeight: 700, marginBottom: 3 }}>
              {isCheaperThanEV ? "✓ Beats the Used EV benchmark" : "✗ Still more expensive than Used EV"}
            </div>
            <div style={{ fontSize: 12, color: "#555" }}>
              {cheapPetrolScenario.sublabel} · {pseudoEindheffing ? "pseudo-eindheffing ON" : "transition rule assumed"}
            </div>
          </div>
          <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 16 }}>
            <div style={{ fontSize: 26, fontWeight: 900, color: isCheaperThanEV ? "#27ae60" : "#e67e22", lineHeight: 1 }}>
              {gap > 0 ? "+" : ""}{gap}/mo
            </div>
            <div style={{ fontSize: 11, color: "#444" }}>vs EV benchmark</div>
          </div>
        </div>

        {/* Mini side-by-side */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <div style={{ background: "#1a1500", borderRadius: 6, padding: 10, cursor: "pointer" }}
            onClick={() => setActiveScenario("petrol-cheap")}>
            <div style={{ fontSize: 11, color: "#f39c12", marginBottom: 2 }}>Cheap Petrol BV</div>
            <div style={{ fontSize: 28, fontWeight: 900, color: "#f39c12" }}>€{cheapPetrolResult.calc.totalMonthlyPersonal}</div>
            <div style={{ fontSize: 11, color: "#555" }}>/month · tap to inspect</div>
          </div>
          <div style={{ background: "#001a10", borderRadius: 6, padding: 10, cursor: "pointer" }}
            onClick={() => setActiveScenario("ev-used-older")}>
            <div style={{ fontSize: 11, color: "#1abc9c", marginBottom: 2 }}>Used EV (2022–23) BV</div>
            <div style={{ fontSize: 28, fontWeight: 900, color: "#1abc9c" }}>€{evBenchmark.calc.totalMonthlyPersonal}</div>
            <div style={{ fontSize: 11, color: "#555" }}>/month · tap to inspect</div>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
        {results.map(r => {
          const isActive = r.id === activeScenario;
          const isLowest = r.calc.totalMonthlyPersonal === Math.min(...results.map(x => x.calc.totalMonthlyPersonal));
          return (
            <div key={r.id} onClick={() => setActiveScenario(r.id)} style={{
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
                {r.tag} · {r.type === "bv" ? "BV" : "Private"}
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#e0e0e0", marginBottom: 1 }}>{r.label}</div>
              <div style={{ fontSize: 12, color: "#555", marginBottom: 8 }}>{r.sublabel}</div>
              <div style={{ fontSize: 28, fontWeight: 900, color: r.color, lineHeight: 1 }}>
                €{r.calc.totalMonthlyPersonal}
              </div>
              <div style={{ fontSize: 11, color: "#555", marginTop: 2 }}>/month to you</div>
              <div style={{ marginTop: 8, height: 3, background: "#1a1a2e", borderRadius: 2 }}>
                <div style={{
                  width: `${(r.calc.totalMonthlyPersonal / maxMonthly) * 100}%`,
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
            ▶ {active.label} · Breakdown
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 14 }}>
            {[
              { label: "Car Price", value: `€${active.carPrice.toLocaleString()}`, sub: "purchase" },
              { label: "Catalogue", value: `€${active.catalogueValue.toLocaleString()}`, sub: "bijtelling base" },
              { label: "Bijtelling", value: `${active.calc.bijtellingRate}%`, sub: active.type === "bv" ? "annual rate" : "n/a" },
              { label: "Annual bijtelling", value: active.type === "bv" ? `€${active.calc.annualBijtelling.toLocaleString()}` : "—", sub: "added to income" },
              { label: "Eff. tax rate", value: `${active.calc.effectiveMarginalRate}%`, sub: use30Ruling ? "with 30% ruling" : "no ruling" },
              { label: "VPB saving/yr", value: active.type === "bv" ? `€${active.calc.vpbSaving.toLocaleString()}` : "—", sub: "19% on BV costs" },
            ].map((item, i) => (
              <div key={i} style={{ background: "#0d0d1a", borderRadius: 6, padding: 10 }}>
                <div style={{ fontSize: 11, color: "#555", textTransform: "uppercase", letterSpacing: 1 }}>{item.label}</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#e0e0e0", marginTop: 2 }}>{item.value}</div>
                <div style={{ fontSize: 11, color: "#444" }}>{item.sub}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 12, color: "#555", letterSpacing: 2, textTransform: "uppercase", marginBottom: 10 }}>Monthly components</div>
          {active.calc.monthlyBijtellingTax > 0 && <BarRow label="Bijtelling income tax" value={active.calc.monthlyBijtellingTax} max={maxBarValue} color={active.color} />}
          {active.calc.monthlyPseudo > 0 && <BarRow label="Pseudo-eindheffing (BV)" value={active.calc.monthlyPseudo} max={maxBarValue} color="#e67e22" />}
          <BarRow label="Fuel / charging" value={Math.round(active.annualFuelCost / 12)} max={maxBarValue} color={active.color} />
          <BarRow label="Maintenance" value={Math.round(active.annualMaintenance / 12)} max={maxBarValue} color={active.color} />
          <BarRow label="Road tax (MRB)" value={active.calc.monthlyMRB} max={maxBarValue} color={active.color} />
          <BarRow label="Depreciation (net)" value={active.calc.monthlyDepreciation} max={maxBarValue} color={active.color} />
          <BarRow label="Resale benefit" value={active.calc.monthlyResaleBenefit} max={maxBarValue} color={active.color} negative />
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            borderTop: `1px solid ${active.color}30`, paddingTop: 10, marginTop: 8
          }}>
            <div style={{ fontSize: 13, color: "#666", textTransform: "uppercase", letterSpacing: 2 }}>Total monthly to you</div>
            <div style={{ fontSize: 32, fontWeight: 900, color: active.color }}>
              €{active.calc.totalMonthlyPersonal}<span style={{ fontSize: 14, color: "#555" }}>/mo</span>
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
          {results.filter(r => r.type === "bv").map(r => (
            <div key={r.id} style={{ fontSize: 13 }}>
              <span style={{ color: r.accent }}>{r.label.split(" ").slice(0, 2).join(" ")}</span>
              <span style={{ color: "#555" }}> → </span>
              <span style={{ color: "#e0e0e0", fontWeight: 700 }}>
                €{Math.round(r.carPrice * Math.pow(r.resaleFraction, holdYears / 4)).toLocaleString()}
              </span>
              <span style={{ color: "#444", fontSize: 11 }}> est.</span>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 8, fontSize: 12, color: "#444", lineHeight: 1.5 }}>
          EVs from 2022+ hold residual value better as EU 2035 combustion ban approaches. Older petrol ~48–52% after 4 yrs.
        </div>
      </div>

      {/* Warning */}
      <div style={{ background: "#1a0a00", border: "1px solid #7f3900", borderRadius: 8, padding: 14, marginBottom: 14 }}>
        <div style={{ fontSize: 12, color: "#e67e22", letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>
          ⚠ 2027 Pseudo-eindheffing
        </div>
        <div style={{ fontSize: 13, color: "#aaa", lineHeight: 1.6 }}>
          From Jan 2027, BV owes <strong style={{ color: "#e67e22" }}>+12% of catalogue value/yr</strong> on petrol/hybrid cars.{" "}
          <strong style={{ color: "#27ae60" }}>EVs are fully exempt.</strong> Toggle above to model it.
          Register before 31 Dec 2026 → transition rule defers to Sep 2030.
        </div>
      </div>

      <div style={{ fontSize: 11, color: "#333", textAlign: "center", lineHeight: 1.6 }}>
        Estimates only · Consult your accountant · MRB ~1,700kg NL avg · Catalogue = original reg year value · BV costs net 19% VPB
      </div>
    </div>
  );
}
