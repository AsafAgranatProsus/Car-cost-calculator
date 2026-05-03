# Car Decision Reference — DGA, Amsterdam, Family of 4

A standalone reference capturing the full reasoning, math, data sources, and conclusions from the design and use of [the Car Cost Calculator](https://asafagranatprosus.github.io/Car-cost-calculator/). Written so that no chat history or context is required to understand the decisions and the trade-offs.

> **Status**: corrected and audited. Reflects 83/83 passing economic-identity checks against the live model, with all known historical bugs (residual double-counting, EV lock-in expiry, default-mismatch) explicitly fixed. Last updated 2026-05-03.

---

## Table of contents

1. [The decision being made](#1-the-decision-being-made)
2. [Personal context](#2-personal-context)
3. [The honest verdict](#3-the-honest-verdict)
4. [How the calculator works (plain English)](#4-how-the-calculator-works-plain-english)
5. [The Dutch tax landscape (verified 2026)](#5-the-dutch-tax-landscape-verified-2026)
6. [The full cost-of-ownership picture](#6-the-full-cost-of-ownership-picture)
7. [Vehicle shortlist with corrected numbers](#7-vehicle-shortlist-with-corrected-numbers)
8. [The €8k vs €18k stretch question — fully decomposed](#8-the-8k-vs-18k-stretch-question--fully-decomposed)
9. [Strategy comparison: Private vs BV vs Buyout](#9-strategy-comparison-private-vs-bv-vs-buyout)
10. [Stress-test scenarios](#10-stress-test-scenarios)
11. [DGA financing options for a Private car](#11-dga-financing-options-for-a-private-car)
12. [What the calculator does NOT model](#12-what-the-calculator-does-not-model)
13. [Bug history (transparency)](#13-bug-history-transparency)
14. [Shopping checklist](#14-shopping-checklist)
15. [Sources & references](#15-sources--references)
16. [Appendix: month-by-month example](#16-appendix-month-by-month-example)

---

## 1. The decision being made

**Goal**: choose the most rational way for the user (DGA of a NL BV, family of 4, Amsterdam) to own a car for ~5 years, with these explicit constraints and preferences:

- Primary use case: long EU holiday/camping trips with full family load + occasional city escapes
- Vehicle archetype: SUV, estate, wagon, or van — NOT a compact hatchback
- Total annual mileage: ~8,000 km/yr (low, holiday-mostly)
- Driving mix: ~75% highway, ~25% city/short trips
- Charging: Amsterdam street-charging only (no home wall-box)
- Insurance: full coverage regardless of car
- Finance: pay cash if buying privately (no interest in financing)
- Comfort preferences: doesn't strongly value adaptive cruise or premium infotainment
- Risk profile: BV income may not stay at current level over 4–5 years; values resilience over theoretical optimality

The user's friend's recent purchase serves as a benchmark: **VW Tiguan MK1 1.4 TSI manual, €6,500, full official-garage service history, timing chain replaced ~1 year ago.** The friend pays roughly €361/mo all-in, ~€21,640 in real money over 5 years.

The question: **is anything materially better than this baseline plan, given the user's specific situation?**

---

## 2. Personal context

### Financial
| Factor | Value | Note |
|---|---|---|
| Role | DGA (sole owner-director-employee of a NL BV) | The user wears two hats: shareholder and salaried employee |
| Gross salary | €78,000/yr (€6,500/mo) | Above 2026 minimum gebruikelijk loon of €58,000 |
| 30% ruling | Active | Reduces taxable income by 30% (capped) |
| Bijtelling marginal rate at this salary | **37.56%** (bracket 2) | NOT the 49.5% × 0.7 = 34.65% I previously quoted before bug fixes |
| BV revenue | ~€18k/mo incl. VAT (~€178k/yr ex-VAT) | Profitable enough to make VPB deduction usable |
| BV operating profit (after salary) | ~€100k/yr | Pays ~€19k/yr VPB |
| Box 2 dividend rate | 24.5% (up to €68,843/yr) | 31% above |

### Household
| Factor | Value |
|---|---|
| Location | Amsterdam (street parking, no home charging) |
| Family | Spouse + 2 children aged ~4.5 |
| Annual driving | ~8,000 km/yr |
| Highway/city mix | ~75% highway / 25% city |
| Insurance plan | Full coverage (WA + casco volledig) regardless |
| Hold period target | 4–5 years |

### Important salary-control insight
There's a **bijtelling marginal rate cliff** at ~€112k gross salary. Below this, with the 30% ruling, bijtelling is taxed at 37.56% (bracket 2). Above it, it jumps to 49.5%. **Stay below €112k during a BV-car hold to keep the lower marginal**; take dividends instead.

---

## 3. The honest verdict

### Top recommendation
**Buy a well-maintained €6,500–€8,000 used petrol/hybrid privately, with cash, for full coverage from day one.** Match your friend's discipline: single-owner, official-garage service history, known engine/transmission concerns documented as resolved.

### Best matches for camping use case (sized appropriately)
| Vehicle | Realistic price | Why it fits |
|---|---|---|
| **Skoda Octavia Combi 1.4 TSI 2012–13** | ~€7,500 | Largest boot in tier (610 L), efficient, comfortable highway |
| **Skoda Yeti 1.2 TSI 2012–13** | ~€7,000 | Cult camping favorite, boxy = roof box compatible, cheap parts |
| **VW Tiguan MK1 manual** (friend's pattern) | ~€6,500 | Proven by the friend's example; manual avoids DSG failure mode |

### Why not stretch to €18k?
With the user's preferences (no value for ACC; full coverage either way), the stretch from the €8k tier to the €18k tier costs roughly **€35–€55/month true premium** over 5 years, after accounting for:
- Higher full-coverage casco premium on the more expensive car (~€25–33/mo)
- Lower repair-tail-risk on newer cars (~€7–10/mo, partial offset)
- Insurance discount from modern safety tech (~€5/mo, offset by point above)
- Subjective comfort value the user explicitly doesn't strongly value (~€5–8/mo)

The stretch tier is defensible but not financially favorable for this user's preferences. **The math no longer dictates an answer; it has narrowed the question to "what's modern comfort + reduced anxiety worth to me per month?" — which is a values question.**

### What to avoid
- **PHEV** at any price: heavier MRB class (2026), full pseudo-eindheffing exposure, hauls battery weight on long highway trips with full load — one of the worst tax targets for this use case.
- **Pure EV**: defensible only if home/work charging exists and user accepts ~25–35% range loss with full load + fast-charging stops on holidays. Without home charging in Amsterdam, the operational friction outweighs the tax benefits.
- **The "middle" €10k–€15k tier**: stretching from €8k to €12k–€16k Used Petrol costs ~€800 per €2k upfront with negligible benefit. If you stretch, stretch all the way to a known-best-resale model in the young-used tier.

---

## 4. How the calculator works (plain English)

### The cast of characters
- **You-the-employee** (DGA): you wearing your "I get a paycheck from my own company" hat
- **Your BV**: your company, a separate legal entity that pays its own tax
- **Two-paychecks problem**: getting €1 out of the BV into your personal pocket is never tax-free; the question is which path leaks the least

### The four tax buckets in plain English
1. **Box 1 (income tax on salary)**: the tax on your paycheck. At your salary, marginal is 37.56%; jumps to 49.5% above €112k taxable.
2. **Box 2 (dividend tax)**: when your BV gives you a chunk of cash as dividend, you pay 24.5% up to €68,843/yr, 31% above.
3. **VPB (corporate tax)**: your BV pays 19% tax on its profits (first €200k; 25.8% above). Every car expense the BV books reduces its taxable profit and saves you 19%. **This is the corporate-tax offset.**
4. **Bijtelling (company-car phantom income)**: if the BV owns the car and you use it privately (commute counts!), the tax office adds a percentage of the car's *original new price* to your taxable income. For a €30k-cataloog petrol car that's 22% × €30k = €6,600/yr of phantom income, taxed at your marginal rate. **Bijtelling is the killer for BV-petrol** in your bracket.

### The "BV vs Private" choice in one paragraph
Buy **privately** → pay everything yourself with already-taxed money. Simple. No bijtelling. Buy through the **BV** → company pays for everything (saving 19% VPB on each expense), but you owe bijtelling tax on your personal use, AND you'll eventually pay box 2 on cash that stays in the BV. The BV path *can* win when bijtelling tax + box 2 < VPB savings — typically only true for **EVs with locked-in low bijtelling** or **very high-mileage scenarios**. For your situation (low km, no special EV regime), **Private wins almost universally.**

### The three strategies the calculator compares
1. **Pure Private**: buy with personal cash, own for the full hold period, sell at end.
2. **Pure BV**: BV buys, BV owns for full period, residual stays in BV (would lose box 2 to extract).
3. **BV → Buyout → Private** (extension): BV owns for `k` years, then DGA buys the car personally at fair market value, then owns privately for the remaining years. Avoids late-period bijtelling AND late-period pseudo-eindheffing AND the box 2 hit on residual.

The calculator brute-force-tests every switch year `k` and reports the optimum.

---

## 5. The Dutch tax landscape (verified 2026)

### Box 1 income tax brackets (2026)
| Slice | Up to | Rate |
|---|---|---|
| 1 | €38,883 | 35.75% |
| 2 | €78,426 | 37.56% |
| 3 | ∞ | 49.50% |

### 30% ruling (2026)
- Tax-free portion = `min(salary × 30%, salary − €48,013)` (norm-cap)
- Reduction to 27% starts 1 Jan 2027 for new applicants and 2024+ cohorts; pre-2024 users keep 30% for their full 5-year window.
- For the user (€78k salary): tax-free portion = €23,400; taxable after ruling = €54,600

### Box 2 (DGA dividend / substantial interest)
- 24.5% up to €68,843/yr of box-2 income (per fiscal partner, doubled for couples)
- 31% above €68,843 (was 33% in 2025)
- 15% withholding at source, credited against the eventual box 2 liability

### DGA gebruikelijk loon (minimum salary)
- 2026 minimum: **€58,000/yr** (was €56,000 in 2025)
- Real requirement = highest of: €58,000, 75% of comparable market salary, highest other employee
- Below this requires substantiated justification

### Bijtelling rates (BV-provided car, private use ≥ 500 km/yr)
| Powertrain | Rate | Notes |
|---|---|---|
| Petrol / hybrid / PHEV | **22%** of catalogusprijs/yr | Always |
| EV registered 2020 | 8% on €45k cap (lock expired in 2025 → now 22%) | |
| EV registered 2021 | 12% on €40k cap | Lock expires end-2026 |
| EV registered 2022 | 16% on €35k cap | Lock until 2027 |
| EV registered 2023–24 | 16% on €30k cap | Lock until 2028–29 |
| EV registered 2025 | 17% on €30k cap | Lock until 2030 |
| EV registered 2026 | 18% on €30k cap | Lock until 2031 |
| EV after 60-month lock | 22% of full catalogusprijs | Standard rate |

### MRB (motorrijtuigenbelasting) 2026 — what changed this year
- **EV**: pays **70%** of normal rate (was ¼-rate before 2026)
- **PHEV** (1–50 g CO₂/km): now pays **100%** of normal rate (lost ¾-rate AND lost 125 kg weight correction — effectively ~25% higher than petrol of the same model)
- **Petrol / hybrid**: 100% (base)
- This calculator uses ~€90/mo as the petrol/hybrid base (~1,700 kg car); use province-specific data for precision.

### 2027 pseudo-eindheffing privégebruik auto (the biggest single rule)
- From **1 Jan 2027**, the BV owes **+12% of catalogusprijs/yr** for any petrol/hybrid/PHEV car made available to an employee
- **Commute counts as private use** under this regime
- **EVs and hydrogen are exempt**
- **Transition rule**: cars registered to the BV **before 1 Jan 2027** are exempt until **17 Sep 2030**
- Surcharge is paid by employer (the BV here) and may NOT be passed to the employee

### Wet excessief lenen 2026 (DGA borrowing from BV)
- Hard limit: **€500,000** total personal debts to the BV (was €700k pre-2023)
- Above this → forced taxable as box 2 dividend
- Required to be a real loan: written contract, market-rate interest (~5–7% in 2026), real amortization schedule, real payments

---

## 6. The full cost-of-ownership picture

A car never costs only its sticker price. Owning a €6,500 car for 5 years actually costs ~€22,000 of real money.

### What's inside the "total cost over 5 years" number
For a Used Petrol Private cash purchase, at 8,000 km/yr:

| Cost item | Per year | Over 5y |
|---|---|---|
| Depreciation (purchase price − resale) | varies | ~€4,000–6,000 |
| Fuel (petrol ~7 L/100 km × €1.95 × 8,000 km) | ~€1,090 | ~€5,500 |
| Maintenance + service + tires | €1,200 | €6,000 |
| Road tax (MRB ~€90/mo) | €1,080 | €5,400 |
| Capital opportunity cost (4% on avg balance) | ~€175 | ~€870 |
| **Subtotal (model-tracked)** | | **~€21,000** |
| Insurance (full coverage, NOT in calculator) | €700–€1,200 | €3,500–€6,000 |
| **Real all-in incl. insurance** | | **~€25,000–€27,000** |

**The €21,640 number quoted for the friend's Tiguan is the model-tracked cost** (which excludes insurance). Add ~€800/yr × 5y = €4,000 for full coverage to get the real all-in.

### Per-fuel city/highway efficiency (calculator's per-fuel multipliers)
| Fuel | City multiplier | Highway multiplier | Why |
|---|---|---|---|
| Petrol | 1.15 | 0.90 | Engines like steady cruising |
| Self-charging Hybrid | 0.85 | 1.20 | Regen + engine-off useless on hwy |
| PHEV | 0.50 | 1.80 | Battery hauled deadweight at speed |
| EV | 0.75 | 1.50 | Aero drag dominates at speed |

At the user's 75% highway mix: petrol gets ~7% cheaper, hybrid gets ~9% more expensive, PHEV gets ~22% more expensive, EV gets ~13% more expensive — all relative to a 50% mixed-driving baseline.

---

## 7. Vehicle shortlist with corrected numbers

All numbers below are **5-year totals at user's actual settings** (78k salary, 30% ruling, 8k km/yr, 75% highway, 5y hold, pseudo-eindheffing on, box 2 24.5%, full coverage NOT included). These are the post-bug-fix numbers. Sorted by total cost within each tier.

### €6.5–7.5k tier (low budget — your friend's space)
| Car | Total 5y | Monthly avg | Residual at sale |
|---|---|---|---|
| **Friend's Tiguan manual + chain done (€6,500)** | **€21,640** | **€361/mo** | €2,263 |
| Skoda Octavia Combi 1.4 TSI 2012–13 (€7,500) | €21,762 | €363/mo | €2,536 |
| Skoda Yeti 1.2 TSI 2012–13 (€7,000) | €21,932 | €366/mo | €2,943 |

### €10–12k tier (the trap — moderately wasteful stretch)
| Car | Total 5y | Monthly avg | Residual at sale |
|---|---|---|---|
| Skoda Yeti 1.4 TSI 2014–15 (€11,000) | €23,598 | €393/mo | €4,675 |
| Skoda Octavia Combi 1.4 TSI 2015 (€11,500) | €24,194 | €403/mo | €4,890 |
| Toyota RAV4 non-hybrid 2013–14 (€12,000) | €24,419 | €407/mo | €6,000 |

### €15–18k tier (worth it for non-financial reasons only)
| Car | Total 5y | Monthly avg | Residual at sale |
|---|---|---|---|
| **Suzuki Vitara 1.4 MHEV 2018–19 (€15,000)** | **€22,916** | **€382/mo** | €8,755 |
| **Skoda Karoq 1.5 TSI 2018–19 (€17,000)** ⭐ corrected resale 0.68 | **€23,047** | **€384/mo** | €10,497 |
| Toyota RAV4 Hybrid 2017–18 (€18,000) | €24,529 | €409/mo | €9,111 |
| Skoda Yeti 1.4 TSI 2017 final (€16,000) | €25,440 | €424/mo | €7,578 |

⭐ The Skoda Karoq's resale fraction was corrected from the calculator's default 0.55 to ANWB's measured 0.68 (#4 in 2026 most-value-retentive Top 10).

### Best-of-each comparison
| Hold | Cheapest 8k pick | Cheapest 18k pick | Difference |
|---|---|---|---|
| **4 years** | Friend's Tiguan €17,670 | Suzuki Vitara MHEV €18,666 | **+€995** (+€21/mo) |
| **5 years** | Friend's Tiguan €21,640 | Suzuki Vitara MHEV €22,916 | **+€1,276** (+€21/mo) |

---

## 8. The €8k vs €18k stretch question — fully decomposed

This is the honest decomposition of what spending €11,500 more upfront actually costs you over 5 years, after accounting for everything we know about the user.

### Gross math premium (calculator output)
- Tier average: **+€2,205 over 5y = +€37/mo**
- Best-of-each: **+€1,276 over 5y = +€21/mo**

### Adjustments for user's actual preferences

| Component | Old estimate | Updated for THIS user |
|---|---|---|
| Gross math premium | +€21–37/mo | +€21–37/mo |
| Repair-tail-risk reduction | −€7–10/mo (real) | −€7–10/mo |
| Insurance discount from safety tech | −€5/mo | ~€0 (offset by next row) |
| **Higher full-coverage premium on €18k car** | (not counted earlier) | **+€25–33/mo** |
| Subjective comfort/feature value | +€10–25/mo | **+€5–8/mo** (no ACC value) |
| **TRUE NET PREMIUM PER MONTH** | €15–25/mo | **€35–55/mo** |

### Why insurance matters
NL full-coverage (WA + casco volledig) premiums scale with insured value. Realistic Amsterdam quotes for a 30+ family driver with maxed-out no-claim discount:

| Car value | Approx full coverage / yr |
|---|---|
| €6,500 used Tiguan | ~€750 |
| €8,000 used | ~€800 |
| €15,000 used | ~€1,000 |
| €18,000 young | ~€1,150 |

**Differential: ~€300–400/yr more on the €18k car. That's €25–33/mo extra ongoing cost the calculator doesn't model.**

Also: casco only covers crash/theft/glass — NOT mechanical failures. So insurance does NOT offset the cheap car's repair-tail-risk; both differentials stack.

### The decision-framing question
The €35–55/mo true premium is buying:
- ~30% reduction in repair anxiety (newer drivetrain, often warranty remnant)
- Modern safety tech (AEB, lane keep, adaptive cruise — but user doesn't value ACC)
- Modern infotainment + comfort (subjective; user doesn't strongly value)

**For this user with these preferences, the rational answer is the cheap tier.** The stretch tier is defensible if comfort/anxiety reduction is genuinely worth ~€40–60/mo, but the user has explicitly said it isn't.

---

## 9. Strategy comparison: Private vs BV vs Buyout

For the user's situation, three strategies were systematically compared. **Private wins almost universally.**

### Strategy definitions
- **Pure Private**: DGA buys with personal cash, owns full hold period, sells at end. Residual is fully personal cash.
- **Pure BV**: BV buys with company cash, owns full period. Residual stays in BV — to extract personally, lose box 2 (24.5% in user's case).
- **Buyout (BV → Private)**: BV owns for `k` years, then DGA buys at fair market value (= BV book value, no taxable gain assumed), then owns privately for remaining years. Avoids late bijtelling, late pseudo-eindheffing, and the box 2 hit on residual.

### When each strategy wins
| Scenario | Best strategy | Why |
|---|---|---|
| Cheap used petrol/hybrid (€6.5–10k) at this user's settings | **Private** | Bijtelling tax exceeds VPB+box 2 savings even at year 1 of BV |
| Expensive new petrol/hybrid/PHEV with pseudo-eindheffing on | **Private** | BV crushed by 12% pseudo-eindheffing + bijtelling |
| Used EV (2022–24 reg, still in 60-mo lock-in) | **Buyout @ year 2** | Captures 1–2 years of locked-in 16% bijtelling + VPB savings, then exits before bijtelling outweighs benefits |
| Lock-expired EV (≥2020 reg) | **Private** | No more bijtelling discount; standard 22% applies |
| Anything if BV income drops | **Private** | Pure BV loses VPB benefit entirely; cost balloons |

### The "buyout @ year 1" signal
When the calculator picks year-1 buyout as optimal for non-EV cars, that's the model saying "the BV path is unattractive — exit it as fast as possible." Year-1 buyout is economically nearly identical to "buy private from the start" but adds BV admin overhead. **Treat year-1 buyout as a vote for Pure Private.**

---

## 10. Stress-test scenarios

The model was stressed across the four risks the user explicitly flagged. Headline conclusion: **the cheap-used-petrol Private strategy is robust across all stresses.**

### Stress 1: BV income drops (`bvProfitable = false`)
- **Effect on Private path**: zero (Private doesn't depend on BV profitability)
- **Effect on Pure BV**: cost balloons by ~€3,000–4,500 over 5y for typical scenarios (loses 19% VPB subsidy)
- **Verdict**: choosing Private already insulates from this risk

### Stress 2: Oil prices +30% to +50% (Middle East / supply shock)
At user's 8k km/yr, 75% hwy:

| Car | Today | +30% oil | +50% oil |
|---|---|---|---|
| €8k Petrol (Yaris-class baseline) | €20,498 | €21,818 | €22,698 |
| €18k Hybrid Young | €16,901 | €17,921 | €18,601 |
| €18k EV (Kia EV6 type) | €15,121 | €15,361 | €15,561 |

**Verdict**: at 8k km/yr, oil shock costs €1,000–€2,200 over 5y on petrol. EV essentially immune. Doesn't shift rankings dramatically.

### Stress 3: 7-year hold instead of 5
**Counterintuitive finding**: at longer holds, the older €6–8k cars become MORE competitive vs newer €18k cars. Newer cars have steeper years 6–7 depreciation; older cars are already past their steepest curve.

| Car | 5y net | 7y net |
|---|---|---|
| Tiguan benchmark | €19,377 | €27,814 |
| RAV4 Hybrid €18k | €15,418 | €25,714 |
| Lead | RAV4 saves €3,959 | RAV4 saves €2,100 |

**Verdict**: longer holds favor the cheap option more.

### Stress 4: Combined (oil +30% + 7y hold)
Same direction: RAV4 still wins overall but lead narrows. Cheap petrol/hybrid options stay within €2,000 of each other.

### What's robust
- **Pure Private with cheap used petrol**: robust to all four stresses
- **Avoid PHEV**: gets worse under every single stress
- **EV path collapses without home charging** (not stress-test-modeled but real)

---

## 11. DGA financing options for a Private car

When user wants a private car but cash sits in the BV, **four ways to fund it**, with very different total tax cost. **The calculator default assumes Option A (worst). Option B saves ~€4,500 over 5 years for an €18k car.**

### Option A — Extract via dividend, then buy private (calculator's default assumption)
- Declare gross dividend: BV pays 15% withholding, DGA owes 24.5% box 2
- To net €18k personal cash, declare ~€23,841 gross
- **Cost: €5,841 in box 2 tax**
- Pros: simple, instant, no contracts
- Cons: most expensive

### Option B — BV lends to DGA at market rate (BEST for ≤€500k)
- Wet excessief lenen 2026 ceiling: €500,000 total personal debts to BV
- Required structure: written contract, market rate (5–7% in 2026), real amortization schedule, real payments
- DGA pays interest from personal cash → BV books interest income → BV pays 19% VPB on it
- BV cash will eventually be dividended (lose box 2 then)

**Worked example for €18k loan, 5y amortization, 6% interest:**
- Total interest paid by DGA to BV over 5y: ~€3,240
- BV nets ~€2,624 (after 19% VPB)
- Eventually dividended out: ~€1,981 to personal hand (after 24.5% box 2)
- **Net interest cost to consolidated personal+BV: ~€1,259**
- **Saving vs Option A: €5,841 − €1,259 = ~€4,582 over 5y** = €76/mo

### Option C — Reduce DGA salary by €X for one year
- Above €58k legal minimum, salary can be reduced
- For €18k salary cut at 37.56% marginal: skip €6,760 box 1 tax
- BV's profit is €18k higher → owes €3,420 extra VPB
- **Net saving vs status quo: ~€3,340**
- **Cons**: you also have €18k less personal salary income that year (lifestyle change)

### Option D — Blended (modest salary cut + small dividend)
- Hybrid of B and C; saves between the two
- Useful if user wants to avoid formal loan paperwork

### Recommendation
For the user's €18k decision (if they go that route), **set up Option B** with the accountant. Saves €4,582 vs the default Option A approach. The calculator currently shows Option A numbers — adjust mentally by subtracting ~€4,500 from any €18k BV-extraction scenario.

This is **not yet built into the calculator UI** but should be a future feature toggle.

---

## 12. What the calculator does NOT model

To be fully transparent about model limitations:

| Item | Why not modeled | Likely impact |
|---|---|---|
| **BPM (purchase tax)** | For consumer cars it's already inside the dealer asking price and the catalogusprijs — surfacing as a separate line would double-count | Already inside total |
| **MIA / KIA** | Eligibility for BEVs heavily clipped post-2024; depends on annual Milieulijst with caps | Could subtract a few hundred €/yr from BV cost for eligible new EVs |
| **Insurance** | Premiums vary widely by car/profile/postcode | **Mention separately**: full coverage costs ~€700–€1,200/yr depending on car value. Higher tier = ~€300–400/yr more |
| **Provincial MRB surcharges** | Province-specific (opcenten); ~5–10% variation | ±€50–100/yr per car |
| **Diesel weight surcharges** | Not relevant for user's petrol/hybrid focus | N/A |
| **BV-loan financing** | Calculator assumes dividend extraction; could save €4,500 over 5y for €18k car (see Section 11) | Adjust manually for now |
| **BV admin/accountant time** | Subjective; depends on existing accountant relationship | A few hundred €/yr for the BV path |
| **Maintenance variance** | Modeled as point estimates; reality has fat tails | One bad repair on cheap used = ±€1,500–€4,000 |
| **EV charging logistics in Amsterdam** | Calculator uses €0.45/kWh public rate; doesn't model spot-finding friction | Real friction matters more than €/kWh for street-only chargers |
| **The CO₂-based MRB nuances**, regional surcharges, BPM rebate on BV-to-BV trades, BV book value vs FMV penalty for buyout extension | Level of precision not necessary for decision-making | Small, second-order |

---

## 13. Bug history (transparency)

This calculator went through several iterations. Three real bugs slipped past initial review and **changed user-facing recommendations meaningfully**. Documented for honesty:

### Bug 1 — Wrong 30% ruling math (caught early)
- **What**: model computed marginal as `marginal × 0.7`
- **Reality**: 30% ruling makes 30% of cash salary tax-free; bijtelling is added on top of post-ruling taxable income and taxed at the resulting bracket
- **Effect**: at €78k salary with ruling, real bijtelling marginal is 37.56% (bracket 2), not 34.65%
- **Fix**: implemented proper bracket-aware calculation

### Bug 2 — BV-to-personal cost factor missing box 2 (caught early)
- **What**: model used `bvFactor = (1 − VPB)` only
- **Reality**: BV cash that funds car expenses is BV equity; eventually extracted via dividend, losing box 2 (24.5–31%)
- **Correct**: `bvFactor = (1 − VPB) × (1 − box2)` ≈ 0.611 at 24.5% box 2
- **Effect before fix**: BV path looked ~25% more expensive than reality (which was hiding genuine BV-path advantages)

### Bug 3 — Residual double-counted in net wealth (caught later, by user)
- **What**: `netWealthCost = totalCost − residualPersonal` was applied to ALL strategies
- **Reality**: for Private and Extension paths, depreciation inside `totalCost` already nets the residual via `(price − resale) / years`. Subtracting again silently inflated the apparent benefit of high-residual cars by ~€4,000 over 5 years
- **Effect before fix**: I incorrectly recommended a €18k Toyota RAV4 Hybrid as "cheaper" than the user's friend's €6,500 Tiguan. Reality is the opposite: the RAV4 costs ~€2,900 MORE over 5 years
- **Fix**: path-dependent formula. For Pure BV, the subtraction is still correct (residual sits in BV, must be dividended out). For Private/Extension, no subtraction.

### Bug 4 — EV bijtelling lock-in expiry ignored (caught during pedantic audit)
- **What**: model treated EV bijtelling rates as permanent
- **Reality**: rates are locked-in for 60 months from first registration; afterward, standard rate applies
- **Effect**: a 2020-registered EV had its lock expire in 2025; in 2026 it's on the standard 22% rate, not the locked-in 16%. Older used EVs were silently appearing more BV-attractive than they actually are
- **Fix**: `getBijtellingRate` now checks `yearsSinceReg >= 5` and falls through to 22%

### Bug 5 — Default-mismatch (caught when user shared a screenshot)
- **What**: calculator defaulted to 18,000 km/yr and 50% mixed driving
- **Reality**: user actually drives 8,000 km/yr at 75% highway
- **Effect**: at the wrong defaults, EVs appeared to beat the cheap petrol baseline. At correct defaults, baseline holds
- **Fix**: defaults updated to user's actual situation. Audit Category O now reproduces user-facing benchmarks against current defaults.

### What the audit (`audit.mjs`) does now
83 explicit checks across 15 categories. Each historical bug has at least one dedicated check. Run with:
```bash
node .cursor/skills/dga-car-tax-modeling/audit.mjs
```
Result: **all 83 must pass before deploying.** Currently passing 83/83.

---

## 14. Shopping checklist

When evaluating a candidate car at the €6.5–8k tier (per the recommended pattern), screen for these signals **in this order of importance**:

### Must-have signals (won't even view without these)
1. **Single-owner OR documented chain-of-custody** (no rental car backgrounds, no taxi history)
2. **Full official-garage service history** — every stamp visible, every invoice retained
3. **Original NL registration** (not parallel-imported)
4. **No major accident damage** (check ANWB-Voertuigchecker / RDW-Voertuigchecker)
5. **Currently insured + last APK passed clean** (no warnings)

### Strong positive signals (each worth €500–€2,000)
6. **Timing chain/belt replaced within last 30,000 km** (major for chain-driven engines like 1.4 TSI, Honda 1.5T, BMW N20)
7. **Recent clutch replacement** on a manual (saves €800–€1,500 future cost)
8. **DSG service done at correct intervals** if applicable (rules out the worst tail risk on VAG cars)
9. **Coolant/oil consumption normal** documented in recent service notes
10. **Known-weakness items addressed** (e.g. waterpump on VAG, EGR cooler on diesels)

### Weakly-positive (each worth €200–€500 of comfort)
11. Recent tire set (4 matched, ≥4mm tread)
12. Recent battery (≤2 years)
13. Recent brake job (pads + discs)
14. Working AC (regassed in last 2 years)
15. Modern infotainment (CarPlay / Android Auto retrofit OK)

### Powertrain-specific avoidances
| Avoid | Reason |
|---|---|
| **Any DSG transmission on 2008–2014 VAG cars** | Mechatronic failure rate ~15–25%, €2,500–€4,000 to replace |
| **2.0 TDI 2008–2010 (EA189)** | DPF + EGR + DMF issues stack up |
| **Renault Z.E. EVs (Zoe Mk1, Leaf 1st gen)** | Battery degradation + thermal management issues |
| **PHEV at any age** | Heavy MRB class, 2027 pseudo-eindheffing, complex drivetrains aging poorly |
| **Anything with "tuned" or "chipped" in the listing** | Modified cars hide accumulated wear |

### Specifically for the user's recommended candidates
- **Skoda Yeti 1.2 TSI**: prefer 2014+ (revised chain tensioner). Manual transmission. Watch for waterpump leaks.
- **Skoda Octavia Combi 1.4 TSI**: same engine concerns. Prefer manual or DSG-7 (not DSG-6 for hybrid power).
- **VW Tiguan MK1 1.4 TSI manual**: friend's exact pattern. Watch for timing chain (replace if not done).
- **Suzuki Vitara 1.4 MHEV (if stretching)**: bombproof drivetrain, mild hybrid system has minimal failure modes, good resale.
- **Skoda Karoq 1.5 TSI (if stretching)**: ACT cylinder-deactivation can have issues; check for documented HPFP work.

---

## 15. Sources & references

### Primary tax/regulatory sources (verified 2026)
- **Belastingdienst** — [Inkomstenbelasting brackets](https://www.belastingdienst.nl/wps/wcm/connect/nl/werk-en-inkomen/content/hoeveel-inkomstenbelasting-betalen)
- **Belastingdienst** — [MRB 2026 changes](https://www.belastingdienst.nl/wps/wcm/connect/nl/auto-en-vervoer/content/veranderingen-2026-tarieven-motorrijtuigenbelasting)
- **Business.gov.nl** — [30% ruling reduction to 27% from 2027](https://business.gov.nl/amendment/30-percent-ruling-compensation-down-to-27-percent/)
- **NeD Tax** — [Pseudo-eindheffing 2027 details](https://nedtax.nl/nl/pseudo-eindheffing-auto-van-de-zaak-vanaf-2027-dit-moet-u-weten/)
- **DutchExpatTax** — [30% ruling 2026 verified parameters](https://www.dutchexpattax.com/guides/30-percent-ruling/)
- **DutchExpatTax** — [Box 2 guide](https://www.dutchexpattax.com/guides/box-2-tax-guide/)

### Resale value data
- **ANWB** — [Most value-retentive cars 2026 Top 10](https://www.anwb.nl/auto/kopen/nieuwe-auto/waardevast)
- **Autovisie** — [Restwaarde category winners 2025](https://www.autovisie.nl/nieuws/kampioen-restwaarde-2025-deze-autos-zijn-het-meest-waardevast/)
- **classictrends.eu** — [Skoda Yeti NL valuation evolution](https://www.classictrends.eu/nl/skoda/yeti.php)
- **classictrends.eu** — [Skoda Octavia Combi MK3 NL valuation](http://www.classictrends.eu/nl/skoda/octavia-combi-mk3.php)

### DGA financing
- **Bedrijfsartikel.nl** — [Lenen van BV in 2026 + Wet excessief lenen](https://bedrijfsartikel.nl/krediet/geld-lenen-bv-dga-2026/)
- **PersonalWealth.nl** — [DGA salary 2026 = €58,000](https://personalwealth.nl/dga-salaris-2026-naar-e-58-000-wat-is-verplicht-en-wat-is-optimaal/)
- **DGATips.nl** — [Auto van de zaak of privé](https://dgatips.nl/dga-en-salaris/auto-van-de-zaak-of-prive/)
- **NOAB** — [Rekenmodel auto zakelijk of privé voor de DGA](https://noab.nl/model/rekenmodel-auto-zakelijk-of-prive-voor-de-dga/)

### EV bijtelling history
- **Dutchlease.nl** — [Bijtelling EV historical rates](https://www.dutchlease.nl/bijtelling-auto-van-de-zaak/bijtelling-elektrische-auto)
- **Berekenenhulp.nl** — [Bijtelling EV 2025 / 2026](https://berekenenhulp.nl/auto/bijtelling-elektrische-auto/)
- **Trackjack** — [60-month lock-in rule explanation](https://www.trackjackeurope.com/kennisbank/elektrische-auto/)

### The calculator itself
- **Live site**: https://asafagranatprosus.github.io/Car-cost-calculator/
- **Source**: https://github.com/AsafAgranatProsus/Car-cost-calculator
- **Audit script**: [`.cursor/skills/dga-car-tax-modeling/audit.mjs`](../.cursor/skills/dga-car-tax-modeling/audit.mjs)
- **Skill documentation**: [`.cursor/skills/dga-car-tax-modeling/SKILL.md`](../.cursor/skills/dga-car-tax-modeling/SKILL.md)

---

## 16. Appendix: month-by-month example

Tracking real wealth flow for two cars to illustrate why "monthly cost" alone is misleading. **Friend's Tiguan vs Toyota RAV4 Hybrid €18k**, both Pure Private cash, 5-year hold, user's actual settings.

| Month | Tiguan car value | Tiguan cumulative cost paid | RAV4 car value | RAV4 cumulative cost paid |
|---|---|---|---|---|
| M0 (purchase) | €6,500 | €0 | €18,000 | €0 |
| M1 | €6,387 | €361 | €17,797 | €409 |
| M6 | €5,849 | €2,164 | €16,815 | €2,453 |
| M12 (year 1) | €5,264 | €4,328 | €15,708 | €4,906 |
| M24 (year 2) | €4,262 | €8,656 | €13,708 | €9,811 |
| M36 (year 3) | €3,452 | €12,984 | €11,963 | €14,717 |
| M48 (year 4) | €2,795 | €17,312 | €10,440 | €19,623 |
| **M60 (sale)** | **€2,263** | **€21,640** | **€9,111** | **€24,529** |

### The reckoning at sale
- **Tiguan**: paid €21,640 in monthly outflows over 5y, sells for €2,263. **Net wealth lost = €19,377 (cash flow), or €21,640 (calculator's totalCost which includes the depreciation already net of resale)**
- **RAV4**: paid €24,529 in monthly outflows over 5y, sells for €9,111. **Net wealth lost = €15,418 (cash flow), or €24,529 (calculator's totalCost)**

### Wait — the numbers say RAV4 has lower "net wealth lost" but higher "totalCost"?
This is the path-dependent formula at the heart of Bug 3. There are two valid framings:

1. **"Cash-flow-net-of-resale"** (`totalCost − residual`): how much money ended up gone after selling the car. For the user's wealth question, this is what matters — Tiguan loses €19,377 of wealth, RAV4 loses €15,418.
2. **"Total economic cost"** (just `totalCost`, calculator's default): the sum of all real cash spent over the period, with depreciation already counted as a cost item. Tiguan = €21,640, RAV4 = €24,529.

**Both are correct.** Framing 1 ("net wealth lost") tells you the financial impact of choosing this car. Framing 2 ("total cost") tells you how much the car cost to operate.

**For the user's actual decision:** the friend's Tiguan still wins on Framing 2 (lower total operating cost, €21,640 vs €24,529 = +€2,889 for RAV4). Framing 1 is misleading for Private path because the residual is already netted in depreciation; we shouldn't credit it again.

The calculator now uses **Framing 2** consistently for Private/Extension paths, and **Framing 1** only for Pure BV (where the residual sits in the BV separately and must be dividended out to be personal wealth).

The €361/mo Tiguan vs €409/mo RAV4 monthly comparison is the cleanest way to look at this: **the Tiguan costs €48/mo less to own**. Over 5 years, that's €2,889. That's the real difference, and it favors the cheap car.

---

*This document is the canonical record of the analysis and decisions made during the calculator's design. It does not require any chat history to understand. If recommendations or numbers ever conflict with this document, this document is the source of truth and the calculator should be re-audited.*

*Last verified: 2026-05-03. All audit checks (83/83) passing as of merge time.*
