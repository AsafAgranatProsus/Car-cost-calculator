---
name: dga-car-tax-modeling
description: Model Dutch DGA car ownership cost — BV vs Private vs BV-buyout-extension — across fuel (Petrol/Hybrid/PHEV/EV) and age (Used/Young/New). Use when working on this Car-cost-calculator repo, when the user asks about NL company-car economics, bijtelling, pseudo-eindheffing, or 30% ruling impact on auto van de zaak choices, or when asked to extend the calculator with new tax rules.
---

# DGA Car-Tax Modeling — NL 2026

This skill captures the verified Dutch tax math, the modeling architecture, and the user's personal context for this calculator. Read it before editing `src/CarComparison.jsx` or before answering any Dutch DGA car-cost question against this codebase.

## User context (the person this calculator is for)

- **Role**: DGA (sole owner-director-employee) of a NL BV.
- **Salary**: ~€80,000/yr (sliderable in tool, but design defaults around this).
- **30% ruling**: active.
- **Family**: spouse + 2 children aged ~4.5.
- **Use case**: long EU holiday trips with full family load + city escapes. Daily mileage moderate.
- **Decision lens**: monthly cost-equivalent over a hold period, *with* the value of the car at end of hold accounted for honestly.
- **Stated preferences/concerns**: PHEV adds tax burden over self-charging hybrid; EV is appealing but worried about long-trip range with packed family car.

If extending the model, default assumptions should match this profile unless the user specifies otherwise.

## Two non-obvious modeling rules that drive the verdicts

These are the two corrections that flipped the recommendation in the previous iterations of this tool. Do NOT regress them.

### 1. 30% ruling marginal rate is computed correctly, not as `marginal × 0.7`

The 30% ruling makes 30% of *cash salary* tax-free (capped so that *taxable* salary never falls below the 2026 norm of €48,013). Bijtelling is then added on top of the post-ruling taxable income and taxed in whatever 2026 box 1 bracket it lands in.

```
taxableAfterRuling(salary, rulingOn) =
  rulingOn ? salary - min(salary × 0.30, salary - €48,013) : salary

bijtellingMarginalRate(salary, ruling, annualBijtelling) =
  ( box1Tax(taxable + bijtelling) - box1Tax(taxable) ) / annualBijtelling
```

Implications you must remember:
- At €60k salary the ruling barely affects bijtelling marginal (norm cap binds; both yield 37.56%).
- At €80k+ruling bijtelling sits in bracket 2 → **37.56%**, not 34.65% (= 49.5 × 0.7).
- At €120k+ruling bijtelling jumps to bracket 3 → 49.5%; the ruling no longer helps bijtelling at all.

### 2. BV cash → personal cash factor is `(1 − VPB) × (1 − box 2)`, not just `(1 − VPB)`

A €1 BV expense reduces VPB by €0.19, so net BV cash outflow is €0.81. But that €0.81 is BV equity that would *eventually* be extracted via dividend at box 2 (24.5% up to €68,843 of box-2 income, 31% above). So the personal-equivalent cost of €1 BV expense is:

```
bvFactor = (1 - VPB_RATE) × (1 - box2Rate)
         ≈ 0.81 × 0.755 ≈ 0.611  (at 24.5% box 2)
         ≈ 0.81 × 0.69  ≈ 0.559  (at 31% box 2)
```

A consequence that surprises people: **higher box 2 rate makes BV path cheaper in monthly-equivalent terms** (because it shrinks the factor at which BV cash counts against you). The residual value at end of period offsets this — see "Residuals" below.

## Verified 2026 NL tax parameters (source-of-truth for this repo)

Cite or update these only if the user provides a primary source.

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

### Bijtelling (BV-provided car private-use addition to box 1 income)
- Petrol / hybrid / PHEV: **22%** of catalogusprijs annually.
- EV: locked-in for **60 months from first registration**:
  - Reg 2022: 16% on first €35,000, 22% above.
  - Reg 2023–24: 16% on first €30,000, 22% above.
  - Reg 2025: 17% on first €30,000, 22% above.
  - Reg 2026: 18% on first €30,000, 22% above.
  - After 60 months: that-year standard rate.

### MRB (motorrijtuigenbelasting) 2026 changes
- EV: **70%** of normal rate (was ¼-rate before 2026).
- PHEV (1–50 g CO₂/km): **100%** of normal rate (lost the ¾-rate AND the 125 kg weight correction → effectively ~25% higher than petrol of the same model).
- Petrol / hybrid: 100% (base).
- This calculator uses a stylized base of €90/mo for ~1,700 kg petrol/hybrid; replace with provincial-accurate numbers if precision is critical.

### 2027 pseudo-eindheffing privégebruik auto
- From **1 Jan 2027**, **employer (= the BV here)** owes **+12% of catalogusprijs/yr** for any petrol/hybrid/PHEV passenger car made available to an employee.
- **Commute counts as private use** under this regime (different from pre-2027 rules).
- **EVs and hydrogen are exempt.**
- **Transition rule**: cars registered to the BV **before 1 Jan 2027** are exempt from this surcharge until **17 Sep 2030**. This is one of the highest-leverage planning levers in the calculator.
- Surcharge is paid by employer and may not be passed to the employee.

### Notably NOT modeled
- BPM (purchase tax). For consumer cars it's already inside the dealer asking price and the catalogusprijs — surfacing it as a separate line would double-count.
- MIA / KIA. Eligibility for BEVs has been heavily clipped post-2024 and depends on the year's Milieulijst with caps. Mention in methodology only.
- Insurance (~€700–1,500/yr depending on car/profile, near-wash across paths).
- Provincial MRB surcharges, weight-class precision, fuel-type surcharges for diesel, BPM rebate on BV-to-BV trades.
- Imputed cost of admin/accountant time for the BV path.

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
- `strategyPureBV(scenario, params, totalYears)` — single BV segment. `residualPersonal = endResale × (1 − box2)` (you have to dividend it out).
- `strategyPurePrivate(scenario, params, totalYears)` — single Private segment. `residualPersonal = endResale` (already personal).
- `strategyExtension(scenario, params, totalYears, switchYear)` — BV for `switchYear` years, then DGA buys at FMV (= `phase1.endResale`), then Private for the remainder. We assume BV book value matches FMV at switch (clean depreciation), so no taxable gain. `residualPersonal = phase2.endResale`. This dodges late-period bijtelling AND late-period pseudo-eindheffing AND the box 2 hit on residual.

`findBestSwitchYear` brute-force sweeps `switchYear ∈ [1, totalYears-1]` and returns the optimum.

### Why "buyout at year 1" often wins
The buyout sweep frequently chooses `switchYear=1` for high-bijtelling non-EV cars. That's economically equivalent to "buy private from the start". When you see this in output, surface it as a real signal: the BV path is just unattractive for that scenario. The exception is **Young Used EV (2022–23 reg)**: locked-in 16% bijtelling on a €30k–35k cap is genuinely attractive in BV for 1–2 years before extraction.

### Personal-equivalent vs gross numbers
- Bijtelling tax is paid by you personally → not multiplied by `bvFactor`.
- All other BV cash outflows (depreciation, fuel, maintenance, MRB, opportunity cost, pseudo-eindheffing) are multiplied by `bvFactor = (1−VPB)(1−box2)` to convert to personal-equivalent.
- Private path: no `bvFactor`, all costs are direct.
- Capital cost on Private: 4% (cash) opportunity OR 6% (loan) interest, charged on **average outstanding balance** `(price + resale)/2`. BV always uses 4% opportunity (as if cash had stayed in BV).

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

### Critical economic identities (the ones that broke things historically)

These deserve their own callout because they were the source of past bugs:

1. **Net wealth lost is path-dependent.** For Private and Extension, `netWealth = totalCost` (resale already netted by depreciation). For Pure BV, `netWealth = totalCost − residualPersonal` (BV residual is a recoverable asset). Do NOT use a single formula across paths.
2. **EV lock-in expires after 60 months.** A 2020-reg EV is on standard 22% in 2026, NOT 16%. The model uses `CURRENT_YEAR = 2026` and falls through to 22% when `regYear + 5 ≤ CURRENT_YEAR`.
3. **Wealth conservation for Private**: `totalCost = purchase + (running × years) + (MRB × years) + (opportunity × years) − resale`. If this drifts even by €1, depreciation is being mis-accounted.
4. **bvFactor**: `(1 − effectiveVPB) × (1 − effectiveBox2)` where `effectiveVPB = bvProfitable ? 0.19 : 0` and `effectiveBox2 = retainMode ? 0 : box2Rate`.

## Recommendation patterns to surface in chat answers

When the user asks "what should I buy?" against this calculator, structure the answer this way:

1. **Cheapest single combo** at default settings (banner number).
2. **Per-fuel verdict** for their use case (long EU trips + family of 4):
   - **Petrol**: viable as Used/Young if registered before 2027 (transition rule).
   - **Hybrid (self-charging)**: best mixed-use balance, Young Used sweet spot.
   - **PHEV**: actively bad for long-trip-heavy usage — heavier MRB class + full pseudo-eindheffing + carrying batteries that mostly hibernate on highway with full load.
   - **EV**: cheapest per km AND tax-favoured AND exempt from 2027 pseudo-eindheffing. Trade-off is real charging-stop planning on long trips with packed family car (~25–35% range loss).
3. **Path verdict**: if non-EV under default settings, the buyout-at-year-1 strategy is usually optimal — call out that this is economically equivalent to "buy Private from the start" and that the BV admin overhead probably isn't worth it. For Young EV (2022–23 reg), buyout-at-year-2 genuinely wins.
4. **Register-before-2027 lever**: quantify the savings if the user is leaning toward a non-EV BV car. This is often €5,000–€15,000 over a 5-year hold.
5. **The residual asset value matters** — don't compare strategies on monthly cost alone. Always show "net cost over period = total paid − residual personal".

## When extending the calculator

- New tax rule: add to the "Verified 2026 NL tax parameters" section above WITH its source citation, then add a check to `audit.mjs` for it BEFORE changing code.
- New fuel/state/strategy: extend `FUELS` / `STATES` / strategy functions; ensure `findBestSwitchYear` and the matrix view both pick it up.
- New parameter (e.g. insurance, BPM modelling): default it OFF for backward comparability, expose as a settings toggle, and add a methodology note.
- The site is deployed via GitHub Actions on every push to `main`. Vite `base` is `/Car-cost-calculator/`. If repo is renamed, update `vite.config.js`.

## Anti-patterns observed in earlier iterations of this calculator

These were real bugs — don't repeat them.

1. ❌ Computing 30% ruling as `marginal × 0.7`. It's a tax-free portion of cash salary, not a rate haircut.
2. ❌ Stopping BV cost at `(1 − VPB)`. You must also factor box 2 to get personal equivalent.
3. ❌ Using `price / 5` for BV depreciation while using `price / holdYears` + separate resale credit for Private. This double-counts resale on the Private side and was the bug that made Private look ~€100/mo cheaper than truth.
4. ❌ Charging capital cost on full price. It should be on average outstanding balance `(price + resale)/2`.
5. ❌ Treating "buyout extension" residual the same as pure-BV residual. Buyout escapes the box 2 hit because the car becomes personally owned at the switch.
6. ❌ Hiding catalogusprijs as a derived `1.6 × price`. It's the single biggest BV-path lever for used cars and must be a first-class slider in the UI.
7. ❌ Assuming PHEV MRB ≈ petrol MRB. From 2026 it's ~25% higher (lost ¾-rate + lost 125 kg correction).
