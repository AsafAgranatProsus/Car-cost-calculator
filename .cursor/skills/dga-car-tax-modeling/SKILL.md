---
name: dga-car-tax-modeling
description: Model Dutch DGA car ownership cost — BV vs Private vs BV-buyout-extension — across fuel (Petrol/Hybrid/PHEV/EV) and age (Used/Young/New). Use when working on this Car-cost-calculator repo, when the user asks about NL company-car economics, bijtelling, pseudo-eindheffing, or 30% ruling impact on auto van de zaak choices, or when asked to extend the calculator with new tax rules.
---

# DGA Car-Tax Modeling — NL 2026

This skill captures the verified Dutch tax math, the modeling architecture, the user's personal context, AND the anti-patterns observed across many calculator iterations. Read it before editing `src/CarComparison.jsx` or before answering any Dutch DGA car-cost question against this codebase.

**Critical: run `node .cursor/skills/dga-car-tax-modeling/audit.mjs` after every change. All 83 checks must pass.**

---

## User context (the person this calculator is for)

### Personal & financial
- **Role**: DGA (sole owner-director-employee) of a NL BV.
- **Salary**: €78,000/yr gross (€6,500/mo gross). Above the 2026 minimum gebruikelijk loon of €58,000.
- **30% ruling**: active. With €78k salary → taxable after ruling is €54,600 → bijtelling marginal sits at 37.56% (bracket 2). Cliff at ~€112k where bijtelling jumps to 49.5%.
- **BV income**: ~€18k/mo incl. VAT (~€178k/yr ex-VAT). Operating profit after salary is ~€100k/yr → BV pays ~€19k/yr VPB. Profitable enough that the VPB deduction on car expenses is genuinely usable.
- **Profitability risk**: user explicitly flagged uncertainty over 4–5 years. Treat this as a first-class risk: the `bvProfitable` toggle exists for exactly this scenario and should be in the user's mind for any BV-path recommendation.
- **Salary control**: above the €58k legal minimum, salary level is the user's lever. Going lower → more cash retained in BV → defer box 2 to later.

### Use case
- **Location**: Amsterdam.
- **Family**: spouse + 2 children aged ~4.5.
- **Driving pattern**: ~8,000 km/yr. Mostly long EU holiday trips (Alps, camping) + occasional city escapes. **Daily driver use is minimal**.
- **Highway/city mix**: ~75% highway. Important for fuel models — hybrids underperform on highway.
- **Charging viability**: Amsterdam → **street charging only**. No home wall-box. Means EV ownership requires real charging logistics; public AC at ~€0.45/kWh, not the home-charging €0.28/kWh that EV defaults assume.

### Stated preferences (use these to weight recommendations)
- Wants to pay cash if buying private. **No interest in financing.**
- Will get **full coverage insurance regardless** — so insurance "discounts from safety tech" largely wash with "higher casco premium on more expensive car". Net effect: more expensive car costs MORE to insure, +€25–33/mo on €18k vs €8k tier.
- **Doesn't strongly value** adaptive cruise control, fancy infotainment, or other modern-comfort features. Will pay for safety, not luxury.
- **Skeptical buyer.** Has caught two real bugs in this codebase. Push back is gold; respond by checking, not by defending.
- Vehicle archetype: **SUV / wagon / estate / van** for camping with family. Yaris/Corolla-class hatches are NOT acceptable. Skoda Yeti, Octavia Combi, Tiguan, Karoq, RAV4, Vitara are the right shape.

### Friend's benchmark (use as anchor)
- **VW Tiguan MK1, 1.4 TSI, MANUAL, €6,500, official-garage service history, timing chain replaced ~1 year ago.** This is a known-good cheap-used-petrol example.
- Modeled values: fuel ~7L/100km, maintenance €1,200/yr (chain done = lower expected repair tail), resale fraction 0.43.
- Result at user's settings (5y, 8k km, 75% hwy): **€361/mo, €21,640 total cost over 5y.**
- This is the **rational baseline to beat** — calculator defaults open with the user's own equivalent (€8k Used Petrol Private cash) and rank everything else against it.

---

## Calibrated default settings (DO NOT REGRESS)

These are the calculator's at-load defaults — calibrated to the user. If you ever break these, the calculator silently computes for the wrong person:

```js
const [grossSalary,         setGrossSalary]        = useState(78000);   // €6,500/mo
const [use30Ruling,         setUse30Ruling]        = useState(true);
const [holdYears,           setHoldYears]          = useState(5);
const [annualKm,            setAnnualKm]           = useState(8000);    // Amsterdam holiday-mostly
const [financeMode,         setFinanceMode]        = useState("cash");
const [pseudoEindheffing,   setPseudoEindheffing]  = useState(true);
const [registerBefore2027,  setRegisterBefore2027] = useState(false);
const [box2Rate,            setBox2Rate]           = useState(0.245);
const [cashRetentionMode,   setCashRetentionMode]  = useState("extract");
const [oilStress,           setOilStress]          = useState(1.0);
const [bvProfitable,        setBvProfitable]       = useState(true);
const [highwayPct,          setHighwayPct]         = useState(0.75);    // long-trip-heavy
```

Anchor: `{ fuelKey: "petrol", stateKey: "used", price: 8000, strategy: "private" }`.

**Why this matters**: a generic 18,000 km/yr default with 50% mixed driving makes EVs look ~€10k better than they are for this user. The shipped defaults need to match the user, otherwise screen-displayed verdicts contradict your chat answers.

---

## Two non-obvious modeling rules that drive the verdicts

These are the corrections that flipped recommendations in earlier iterations. **Do NOT regress them.**

### 1. 30% ruling marginal rate is computed correctly, not as `marginal × 0.7`

The 30% ruling makes 30% of *cash salary* tax-free (capped so that *taxable* salary never falls below the 2026 norm of €48,013). Bijtelling is then added on top of the post-ruling taxable income and taxed in whatever 2026 box 1 bracket it lands in.

```
taxableAfterRuling(salary, rulingOn) =
  rulingOn ? salary - min(salary × 0.30, salary - €48,013) : salary

bijtellingMarginalRate(salary, ruling, annualBijtelling) =
  ( box1Tax(taxable + bijtelling) - box1Tax(taxable) ) / annualBijtelling
```

Implications:
- At €60k salary the ruling barely affects bijtelling marginal (norm cap binds; both yield 37.56%).
- At €78–80k+ruling bijtelling sits in bracket 2 → **37.56%**, not 34.65% (= 49.5 × 0.7).
- At €112k+ruling bijtelling jumps into bracket 3 → 49.5%; the ruling no longer helps bijtelling.
- **Salary lever**: stay below ~€110k during a BV-car hold to keep bijtelling at the lower marginal. Take dividends instead.

### 2. BV cash → personal cash factor is `(1 − VPB) × (1 − box 2)`, not just `(1 − VPB)`

A €1 BV expense reduces VPB by €0.19, so net BV cash outflow is €0.81. But that €0.81 is BV equity that would *eventually* be extracted via dividend at box 2 (24.5% up to €68,843 of box-2 income, 31% above). So the personal-equivalent cost of €1 BV expense is:

```
bvFactor = (1 - effectiveVPB) × (1 - effectiveBox2)
         ≈ 0.81 × 0.755 ≈ 0.611  (default: profitable BV, 24.5% box 2)
         ≈ 0.81 × 0.69  ≈ 0.559  (profitable BV, 31% box 2)
         ≈ 1.00 × 0.755 ≈ 0.755  (BV-not-profitable, 24.5% box 2)
         ≈ 0.81 × 1.00  ≈ 0.81   (retain mode = no box 2 modeled now)
```

Counterintuitive consequence: **higher box 2 makes BV path cheaper in monthly-equivalent terms** (smaller `bvFactor`). The residual value extraction at end of period offsets this. Higher box 2 also makes the residual harder to extract → cuts both ways.

---

## Path-dependent net wealth lost (the bug that bit twice)

Two strategies need DIFFERENT formulas for "net wealth lost over period". Single-formula is wrong both ways:

```js
function netWealthCost(s) {
  // Pure Private and Extension: depreciation in totalCost already nets resale.
  // For these, totalCost IS the real money out the door.
  if (s.key === "bv") {
    // Pure BV: residual is in BV. To get it personally, you'd lose box 2.
    // residualPersonal already accounts for that haircut.
    // So personal-equivalent net wealth = totalCost − residualPersonal.
    return s.totalCost - s.residualPersonal;
  }
  return s.totalCost;
}
```

**Historical bug 1**: subtracting residualPersonal from BOTH paths → silently doubled the credit for high-resale cars → made €18k Toyota RAV4 look €4k cheaper than it really is, when in reality it's ~€2.9k MORE expensive than the cheap Tiguan baseline at the user's actual settings.

**Historical bug 2**: removing the subtraction from ALL paths → undercounted Pure BV residual recovery → made BV path look slightly worse than it actually is.

The audit (`audit.mjs`) explicitly tests both paths separately. Categories D and E.

---

## EV bijtelling lock-in expiry (third bug source)

EV bijtelling rates are locked-in for **60 months from first registration**. After that, the car switches to the standard rate (currently 22%).

```js
const CURRENT_YEAR = 2026;
function getBijtellingRate(scenario, catalogueValue) {
  if (!scenario.isEV) return 0.22;
  const regYear = scenario.evRegYear || 2026;
  const yearsSinceReg = CURRENT_YEAR - regYear;
  if (yearsSinceReg >= 5) return 0.22;  // Lock expired → standard rate
  // ... else use the locked-in rate from regYear
}
```

**Historical bug**: the model treated 2020-reg EVs as still locked at 16% in 2026 — but their 5-year window expired in 2025. A €18k 2020 Tesla in 2026 actually has 22% bijtelling, not 16%. This bug had been quietly inflating the BV attractiveness of older used EVs.

If you ever shift `CURRENT_YEAR`, re-verify all EV scenarios.

---

## Verified 2026 NL tax parameters (source-of-truth for this repo)

Cite or update these only with primary sources.

### Box 1 income tax brackets (2026)
| Slice | Up to | Rate |
|---|---|---|
| 1 | €38,883 | 35.75% |
| 2 | €78,426 | 37.56% |
| 3 | ∞ | 49.50% |

### 30% ruling (2026)
- Tax-free portion = `min(salary × 30%, salary − €48,013)` (norm-cap).
- WNT cap on covered salary: €262,000.
- Reduction to 27% starts 1 Jan 2027 for new applicants and the 2024+ cohorts. Pre-2024 users keep 30% for their full 5-year window.

### Box 2 (DGA dividend / substantial interest)
- 24.5% up to €68,843 of box-2 income/yr (per fiscal partner, doubled).
- 31% above €68,843 (was 33% in 2025).

### DGA gebruikelijk loon (minimum salary)
- 2026 minimum: **€58,000**/yr (was €56,000 in 2025).
- Real requirement = highest of: €58,000, 75% of comparable market salary, highest other employee.
- Below this requires substantiated justification (loss-making BV, startup first 3 years, documented part-time).

### Bijtelling (BV-provided car private-use addition to box 1 income)
- Petrol / hybrid / PHEV: **22%** of catalogusprijs annually.
- EV: locked-in for **60 months from first registration**:
  - Reg 2020: 8% on first €45,000, 22% above (lock now expired in 2025 → 22%).
  - Reg 2021: 12% on first €40,000, 22% above (lock expires end-2026).
  - Reg 2022: 16% on first €35,000, 22% above (lock until 2027).
  - Reg 2023–24: 16% on first €30,000, 22% above (lock until 2028–29).
  - Reg 2025: 17% on first €30,000, 22% above (lock until 2030).
  - Reg 2026: 18% on first €30,000, 22% above (lock until 2031).
  - After 60 months → standard rate of that year (currently 22%).

### MRB (motorrijtuigenbelasting) 2026 changes
- EV: **70%** of normal rate (was ¼-rate before 2026).
- PHEV (1–50 g CO₂/km): **100%** of normal rate (lost the ¾-rate AND the 125 kg weight correction → effectively ~25% higher than petrol of the same model).
- Petrol / hybrid: 100% (base).
- This calculator uses a stylized base of €90/mo for ~1,700 kg petrol/hybrid; replace with provincial-accurate numbers if precision is critical.

### 2027 pseudo-eindheffing privégebruik auto
- From **1 Jan 2027**, **employer (= the BV here)** owes **+12% of catalogusprijs/yr** for any petrol/hybrid/PHEV passenger car made available to an employee.
- **Commute counts as private use** under this regime (different from pre-2027 rules).
- **EVs and hydrogen are exempt.**
- **Transition rule**: cars registered to the BV **before 1 Jan 2027** are exempt from this surcharge until **17 Sep 2030**. Highest-leverage planning lever in the calculator.
- Surcharge is paid by employer and may not be passed to the employee.

### Wet excessief lenen (2026) — DGA borrowing from BV
- Hard limit: **€500,000** total personal debts to the BV. Was €700k pre-2023.
- Above this → forced taxable as box 2 dividend.
- Required to be a real loan: written contract, market-rate interest (~5–7% in 2026), real amortization schedule, real payments.
- Interest paid by DGA → BV income → BV pays 19% VPB.
- **Use case for car**: if user wants €18k for a Private car but cash sits in BV, BV-loan-to-DGA at market rate saves ~€4,500 vs declaring a €23,841 dividend (net of all the tax leakages). See "DGA financing options" section below.

### Notably NOT modeled
- **BPM** (purchase tax). For consumer cars it's already inside the dealer asking price and the catalogusprijs — surfacing it as a separate line would double-count.
- **MIA / KIA**. Eligibility for BEVs has been heavily clipped post-2024 and depends on the year's Milieulijst with caps. Mention in methodology only.
- **Insurance** (~€700–1,500/yr depending on car/profile). NOT a wash across price tiers — full coverage premium scales with car value (~€300–400/yr more on €18k vs €8k car). User has flagged they want full coverage; mention this differential when comparing tiers.
- Provincial MRB surcharges, weight-class precision, fuel-type surcharges for diesel, BPM rebate on BV-to-BV trades.
- Imputed cost of admin/accountant time for the BV path.
- Imputed cost of admin time for setting up the BV-loan structure (small but non-zero).

---

## Verified 2026 NL resale data (multiple-source-corroborated)

When extending the SUV/estate/wagon shortlist, use these as anchors. Source: ANWB May 2026 Top 10 most value-retentive cars (5y / ~75k km).

| Rank | Car | 5y retention | Fits family-camping use? |
|---|---|---|---|
| 1 | Suzuki Vitara 1.4 MHEV | 73.1% | ✓ Compact SUV, mild hybrid |
| 2 | Toyota Yaris 1.5 VVTI | 73.0% | ✗ Too small |
| 3 | Suzuki Ignis 1.2 MHEV | 71.8% | ✗ Too small |
| 4 | **Skoda Karoq 1.5 TSI** | **68.2%** | ✓ Modern Yeti replacement |
| 5 | VW Up GTI | 67.1% | ✗ Too small |
| 6 | Dacia Sandero Stepway | 66.7% | ✗ Too small |
| 7 | Kia Picanto | 66.4% | ✗ Too small |
| 8 | Suzuki Swift MHEV | 64.7% | ✗ Too small |
| 9 | **VW T-Roc 1.5 TSI** | **64.6%** | ✓ Small SUV with cargo |
| 10 | Seat Ibiza | 64.2% | ✗ Too small |

Category-specific (Autovisie 2025): best C-segment SUV = Dacia Duster; best estate = Mercedes E-Class wagon (premium); best EV = Porsche Macan / Mini Countryman / Skoda Elroq.

**Important calibration note**: my model's `STATES.young.resaleFraction = 0.55` underestimates the Karoq (real value 0.68 per ANWB). When a specific car is referenced, the user should override the resale slider to match the brand reality.

---

## Modeling architecture

The cost engine is in `src/CarComparison.jsx`. It is structured around **strategies composed of segments**.

### Segment
A `segment` is one continuous time period in one ownership type (`bv` or `private`). `calcSegment(scenario, type, params, startPrice, years)` returns:
- `monthly.{bijtellingTax, depreciation, fuel, maintenance, mrb, capital, pseudo, total}` — all expressed as personal-equivalent EUR/month.
- `total` — total personal-equivalent cost over the segment.
- `endResale` — modeled fair market value at end of segment (`startPrice × resaleFraction^(years/4)`).
- `walkAwayBVAsset` / `walkAwayPersonalIfExtracted` — value at end of segment in BV book and after extraction.

### Strategy
A `strategy` chains 1+ segments and reports cumulative numbers + residual handling. Three are implemented:
- `strategyPureBV(scenario, params, totalYears)` — single BV segment. `residualPersonal = endResale × (1 − effectiveBox2)` (you have to dividend it out, or in retain mode the residual stays in BV at full value).
- `strategyPurePrivate(scenario, params, totalYears)` — single Private segment. `residualPersonal = endResale` (already personal).
- `strategyExtension(scenario, params, totalYears, switchYear)` — BV for `switchYear` years, then DGA buys at FMV (= `phase1.endResale`), then Private for the remainder. We assume BV book value matches FMV at switch (clean depreciation), so no taxable gain. `residualPersonal = phase2.endResale`. This dodges late-period bijtelling AND late-period pseudo-eindheffing AND the box 2 hit on residual.

`findBestSwitchYear` brute-force sweeps `switchYear ∈ [1, totalYears-1]` and returns the optimum.

### Why "buyout at year 1" often wins
The buyout sweep frequently chooses `switchYear=1` for high-bijtelling non-EV cars. That's economically equivalent to "buy private from the start". When you see this in output, surface it as a real signal: the BV path is just unattractive for that scenario. The exception is **Young Used EV (2022–24 reg, still in 60-mo lock-in)**: locked-in 16% bijtelling on a €30–35k cap is genuinely attractive in BV for 1–2 years before extraction — but only for cars actually still in their lock-in window.

### Personal-equivalent vs gross numbers
- Bijtelling tax is paid by you personally → **NOT** multiplied by `bvFactor`.
- All other BV cash outflows (depreciation, fuel, maintenance, MRB, opportunity cost, pseudo-eindheffing) are multiplied by `bvFactor` to convert to personal-equivalent.
- Private path: no `bvFactor`, all costs are direct.
- Capital cost on Private: 4% (cash) opportunity OR 6% (loan) interest, charged on **average outstanding balance** `(price + resale)/2`. BV always uses 4% opportunity (as if cash had stayed in BV).

### Feature toggles (added in later rounds)
- `cashRetentionMode = "retain"` → effectiveBox2 = 0 (defers the box 2 cost). Only correct if user genuinely will not extract this BV cash for many years.
- `bvProfitable = false` → effectiveVPB = 0 (BV has no taxable profit to offset). Hits BV path hard. Use when modeling the user's "BV income might drop" scenario.
- `oilStress` ∈ [0.7, 2.0] → multiplier on ICE fuel cost. EV charging gets only 15% of the multiplier (electricity less oil-sensitive).
- `highwayPct` ∈ [0, 1] → blends each fuel's `cityMult` and `highwayMult`. Anchored so 0.5 yields baseline costs. Per-fuel multipliers are real-world calibrated:
  - Petrol: city 1.15, hwy 0.90 (engines like steady cruise)
  - Hybrid: city 0.85, hwy 1.20 (regen useless on motorway)
  - PHEV: city 0.50, hwy 1.80 (battery hauled deadweight on hwy)
  - EV: city 0.75, hwy 1.50 (aero drag dominates at speed)

---

## DGA financing options for a Private car (the BV-loan route)

When a user wants a private car but cash sits in the BV, there are **four ways to fund it**, with very different total tax cost. Order from worst to best:

### A. Extract via dividend, then buy private (default assumption)
- To net €X personally, declare gross dividend = X / (1 − box 2).
- Cost: **box 2 × X / (1 − box 2)** in tax.
- Example: €18k personal car requires €23,841 gross dividend → **€5,841 box 2 cost**.

### B. BV-loan-to-DGA at market rate (best, if disciplined)
- Wet excessief lenen ceiling: €500k total personal debt to BV. Plenty of room.
- Set up real loan: written contract, market rate (5–7%), amortization schedule, real interest+principal payments.
- DGA pays interest from personal cash → BV books interest income → BV pays 19% VPB on it → net BV cash gain ≈ 81% of interest.
- BV cash will eventually be dividended (lose box 2 then).
- Example: €18k loan, 5y amortization, 6% interest:
  - Total interest paid: ~€3,240
  - BV nets: ~€2,624 (after 19% VPB)
  - Eventually dividended: ~€1,981 to personal (after 24.5% box 2)
  - Net interest cost to consolidated personal+BV system: ~€1,259
  - **Saving vs Option A: €5,841 − €1,259 = ~€4,582 over 5y**

### C. Reduce salary by €X for one year (no extra admin)
- DGA gross salary above legal minimum (€58k in 2026) can be reduced.
- For €18k salary cut at 37.56% marginal: skip €6,760 box 1.
- BV's profit is €18k higher → owes €3,420 extra VPB.
- Net saving vs status quo: ~€3,340.
- Costs you €18k of personal salary income for the year.
- **Saving vs Option A: ~€2,500 (worse than Option B)**.

### D. Blended (modest salary cut + small dividend)
- Hybrid of B and C. Useful for risk-aversion to setting up formal loan.
- Saves somewhere between Options B and C.

**This benefit is NOT in the calculator UI yet.** When user asks about funding, walk through Options A vs B verbally with these numbers. Could be added as a feature.

---

## Audit invariants (83 checks, must hold)

Encoded in [`audit.mjs`](./audit.mjs). Run with `node .cursor/skills/dga-car-tax-modeling/audit.mjs` before every deploy. **All 83 checks must pass.** If any fails, fix the model, not the test (unless a tax rule has primary-source-cited changed).

Categories covered:
- **A** Tax brackets & 30% ruling math (8 checks)
- **B** Scenario building consistency (6)
- **C** Bijtelling rates incl. EV reg-year regimes (6)
- **D** Cost engine identities — wealth conservation for Private (5)
- **E** BV-segment identities — bvFactor / VPB / box 2 (5)
- **F** Strategy results & monthly/total relationships (8)
- **G** Monotonicity — km / price / years / catalogue / pseudo / ruling / highway / oil (16)
- **H** Box 2 + cash retention modes (3)
- **I** BV profit-at-risk toggle (2)
- **J** Resale & depreciation identities, formula correctness (10)
- **K** Capital cost on average balance for cash & loan modes (4)
- **L** Edge cases: 1-year hold, EV reg-year transitions, lock expiry (6)
- **M** Cross-strategy invariants (1)
- **N** UI-state coherence (1, manual)
- **O** Reproducibility of user-facing benchmarks (Tiguan, RAV4) (4)

### Critical economic identities (the historical bug sources)

These deserve their own callout — they were each the source of a real bug that shipped:

1. **Net wealth lost is path-dependent.** For Private and Extension, `netWealth = totalCost`. For Pure BV, `netWealth = totalCost − residualPersonal`. Do NOT use a single formula.
2. **EV lock-in expires after 60 months.** A 2020-reg EV is on standard 22% in 2026, NOT 16%. The model uses `CURRENT_YEAR = 2026` and falls through to 22% when `regYear + 5 ≤ CURRENT_YEAR`.
3. **Wealth conservation for Private**: `totalCost = purchase + (running × years) + (MRB × years) + (opportunity × years) − resale`. If this drifts even by €1, depreciation is being mis-accounted.
4. **bvFactor**: `(1 − effectiveVPB) × (1 − effectiveBox2)` where `effectiveVPB = bvProfitable ? 0.19 : 0` and `effectiveBox2 = retainMode ? 0 : box2Rate`.
5. **UI defaults must match the user**. A correct model running on wrong defaults silently displays answers for someone else. Audit Category O reproduces user-facing benchmarks against current defaults.

---

## Recommendation patterns to surface in chat answers

When the user asks "what should I buy?" against this calculator, structure answers around these levers in order:

1. **Match user's actual settings before quoting numbers.** Default to user's profile (8k km, 75% hwy, €78k salary, full coverage assumed). Numbers quoted in chat must be reproducible by anyone opening the calculator with the same inputs.
2. **Cheapest single combo** at user's settings (banner number).
3. **Per-fuel verdict** for family + camping + Amsterdam street-charging:
   - **Petrol**: viable as Used at €6.5–8k (the user's friend's pattern). The default rational choice for this user.
   - **Hybrid (self-charging)**: Toyota/Lexus pattern. Premium over petrol roughly washes for highway-heavy usage. Marginally better for city.
   - **PHEV**: actively bad for long-trip-heavy usage — heavier MRB class + full pseudo-eindheffing + carrying batteries that mostly hibernate on highway with full load. Avoid.
   - **EV**: cheapest per km AND tax-favoured AND exempt from 2027 pseudo-eindheffing. **BUT** for Amsterdam street-charging only + holiday-mostly use + worried about EV resale risk: the case is much weaker than headline numbers suggest. EV makes sense only if user gets home charging and accepts holiday-trip charging logistics.
4. **Path verdict**: under user's settings, almost everything points to Private cash for cheap-used cars. The buyout strategy mostly wins at year 1, which is economically equivalent to "buy private" — call this out.
5. **Register-before-2027 lever**: only meaningful for non-EV BV cars at higher catalogue values. Quantify when relevant.
6. **The residual asset value matters** — never compare strategies on monthly cost alone. Always show "net cost over period" and which strategy uses which formula.
7. **Honest insurance differential**: when comparing tiers (e.g. €8k vs €18k), mention the +€25–33/mo full-coverage premium difference. The calculator doesn't model it.
8. **The "stretch premium" framing**: when user considers spending more, decompose the gross premium into (a) repair-tail-risk reduction, (b) insurance differential (negative — costs more), (c) subjective comfort/safety/feature value. For this user (no ACC value, full coverage either way), the "true premium" of stretching is HIGHER than the calculator's gross delta, not lower.

---

## How to behave in chat (anti-patterns from this codebase's history)

I (the agent) have made several conversational mistakes that shaped recommendations wrongly. Avoid:

1. ❌ **Quoting big numbers from the calculator without checking they match user's actual situation.** The €4k "RAV4 saves you" recommendation came from this. Always verify numbers against the user's settings BEFORE quoting them.
2. ❌ **Using a single formula across all strategies for "net wealth"**. Path-dependent. See identity #1.
3. ❌ **Defending a recommendation when user pushes back.** When user says "this doesn't add up" — they're right more often than not. Read the code, run the audit, find the bug. Don't justify.
4. ❌ **Adding "value" by upselling**. The user is risk-averse, knows what they want, has explicitly said "I'd just buy €8k petrol cash." When the math starts pointing to fancier alternatives, suspect a bug in the model rather than discovering a hidden insight. The user's gut is informed by 12+ years of cheap-used-car ownership; the calculator should serve that intuition with precision, not override it.
5. ❌ **Inventing precision the data doesn't support.** Resale fractions are estimates. Maintenance budgets are estimates. Per-fuel multipliers are calibrated guesses. When recommendations swing on €500 over 5 years, that's noise — say so.
6. ❌ **Skipping the audit before deploying**. Run `node .cursor/skills/dga-car-tax-modeling/audit.mjs` BEFORE pushing. Two of the worst bugs (residual double-count, EV lock-in expiry) would have been caught earlier with a pre-deploy audit habit.
7. ❌ **Confusing display numbers with model numbers**. The calculator can correctly compute the wrong answer if defaults are wrong (km, highway%, salary). Always re-check that the on-screen verdict matches the verbal answer.
8. ❌ **Asking the user for screenshots when you should read the code first**. When user shows you a screenshot that doesn't match your understanding, check the code before assuming user error.

---

## When extending the calculator

- New tax rule: add to the "Verified 2026 NL tax parameters" section above WITH its source citation, then add a check to `audit.mjs` for it BEFORE changing code.
- New fuel/state/strategy: extend `FUELS` / `STATES` / strategy functions; ensure `findBestSwitchYear` and the matrix view both pick it up.
- New parameter (e.g. insurance, BPM modelling, BV-loan financing): default it OFF/neutral for backward-comparability, expose as a toggle/slider, and add a methodology note.
- The site is deployed via GitHub Actions on every push to `main`. Vite `base` is `/Car-cost-calculator/`. If repo is renamed, update `vite.config.js`.
- When user provides personal context (salary, km, location, family), update the calibrated defaults in `useState(...)` calls AND add a category-O reproducibility check to the audit so the new defaults can never silently regress.

---

## Anti-patterns observed in earlier iterations of this calculator

These were real bugs — don't repeat them.

1. ❌ Computing 30% ruling as `marginal × 0.7`. It's a tax-free portion of cash salary, not a rate haircut.
2. ❌ Stopping BV cost at `(1 − VPB)`. You must also factor box 2 to get personal equivalent.
3. ❌ Using `price / 5` for BV depreciation while using `price / holdYears` + separate resale credit for Private. This double-counts resale on the Private side.
4. ❌ Charging capital cost on full price. It should be on average outstanding balance `(price + resale)/2`.
5. ❌ Treating "buyout extension" residual the same as pure-BV residual. Buyout escapes the box 2 hit because the car becomes personally owned at the switch.
6. ❌ Hiding catalogusprijs as a derived `1.6 × price`. It's the single biggest BV-path lever for used cars and must be a first-class slider in the UI.
7. ❌ Assuming PHEV MRB ≈ petrol MRB. From 2026 it's ~25% higher (lost ¾-rate + lost 125 kg correction).
8. ❌ Subtracting `residualPersonal` from `totalCost` for ALL strategies. Path-dependent — only Pure BV gets that subtraction. For Private/Extension, totalCost already nets the residual via depreciation.
9. ❌ Treating EV bijtelling rates as permanent. They're locked-in for 60 months from registration; after that, standard rate (22%) applies.
10. ❌ Shipping a calculator with generic defaults (18k km/yr, 50% highway) when the user has explicitly stated their actual usage (8k km/yr, 75% highway). Default-mismatch silently makes the on-screen verdict different from the chat-answer verdict.
11. ❌ Ignoring the insurance-cost differential between car tiers. Full coverage on a €18k car costs ~€300–400/yr more than on an €8k car. This is real money, not modeled in the engine but should be mentioned in any tier-stretching discussion.
12. ❌ Crediting the "modern car comfort" side of the stretch premium without checking whether the user values those features. Adaptive cruise, fancy infotainment, etc. are high-variance subjective value — verify with the user before counting them.
