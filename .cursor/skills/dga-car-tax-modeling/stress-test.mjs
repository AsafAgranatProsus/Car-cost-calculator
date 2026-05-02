// Run with: node .cursor/skills/dga-car-tax-modeling/stress-test.mjs
// Imports the production tax model directly from src/CarComparison.jsx by slicing
// the helper region and re-evaluating it as an ES module data URL. This avoids
// having to re-export from the React component (which would pull in JSX).
//
// Update the slice markers below if the source file region shifts.
//
// All checks must pass. If any fails, the model has regressed — fix the model,
// not this test (unless the user explicitly approves a parameter change with a
// cited primary source).

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(__dirname, "../../../src/CarComparison.jsx");
const src = readFileSync(SRC, "utf8");

const start = src.indexOf("// Tax model");
const end = src.indexOf("// UI components");
if (start === -1 || end === -1) {
  console.error("Could not locate '// Tax model' .. '// UI components' markers in src/CarComparison.jsx");
  process.exit(2);
}
const helpers = src.slice(start, end);

const code = helpers + `
export {
  box1Tax, taxableAfterRuling, bijtellingMarginalRate,
  buildScenario, calcSegment, getBijtellingRate, getMRBMonthly,
  strategyPureBV, strategyPurePrivate, strategyExtension, findBestSwitchYear,
  resaleAtAge,
  FUELS, FUEL_ORDER, STATES, STATE_ORDER, PREBAKED_PRICES,
  VPB_RATE,
};
`;
const mod = await import("data:text/javascript;base64," + Buffer.from(code).toString("base64"));

let tests = 0, failed = 0;
function check(name, cond, info = "") {
  tests++;
  if (!cond) {
    failed++;
    console.log("  ✗ " + name + (info ? "  " + info : ""));
  }
}

const baseParams = {
  grossSalary: 80000, use30Ruling: true, financeMode: "cash",
  pseudoEindheffing: false, box2Rate: 0.245,
};

console.log("\n== 1. Box 1 tax brackets ==");
check("€0 → €0 tax", mod.box1Tax(0) === 0);
check("€10k → 10000*0.3575", Math.abs(mod.box1Tax(10000) - 3575) < 0.5);
check("€38883 → exactly bracket 1 cap", Math.abs(mod.box1Tax(38883) - 38883*0.3575) < 0.5);
check("€78426 → bracket 1+2", Math.abs(mod.box1Tax(78426) - (38883*0.3575 + (78426-38883)*0.3756)) < 0.5);
check("€100k → bracket 1+2+3", Math.abs(mod.box1Tax(100000) - (38883*0.3575 + (78426-38883)*0.3756 + (100000-78426)*0.495)) < 0.5);

console.log("\n== 2. 30% ruling math ==");
check("€60k ruling on → taxable = €48,013 (norm-capped)", Math.abs(mod.taxableAfterRuling(60000, true) - 48013) < 1);
check("€80k ruling on → taxable = €56,000 (30% off)", Math.abs(mod.taxableAfterRuling(80000, true) - 56000) < 1);
check("€120k ruling on → taxable = €84,000 (30% off)", Math.abs(mod.taxableAfterRuling(120000, true) - 84000) < 1);
check("€60k ruling off = €60k (norm cap binds)", mod.taxableAfterRuling(60000, false) === 60000);
check("€50k ruling on → can't push below norm", mod.taxableAfterRuling(50000, true) === 48013);

console.log("\n== 3. EV bijtelling ==");
const evCheap = mod.buildScenario("ev", "young", 25000, { catalogueValue: 25000 });
check("EV 2022 reg @ €35k cat → 16% blended (cap=35k)",
  Math.abs(mod.getBijtellingRate({ ...evCheap, evRegYear: 2022 }, 35000) - 0.16) < 0.001);
check("EV 2023 reg @ €25k cat → 16%",
  Math.abs(mod.getBijtellingRate({ ...evCheap, evRegYear: 2023 }, 25000) - 0.16) < 0.001);
check("EV 2025 reg @ €30k cat → 17%",
  Math.abs(mod.getBijtellingRate({ ...evCheap, evRegYear: 2025 }, 30000) - 0.17) < 0.001);
check("EV 2026 reg @ €30k cat → 18%",
  Math.abs(mod.getBijtellingRate({ ...evCheap, evRegYear: 2026 }, 30000) - 0.18) < 0.001);
const expected2026blend = (30000*0.18 + 20000*0.22) / 50000;
check("EV 2026 reg @ €50k cat → blended 18/22 above €30k cap",
  Math.abs(mod.getBijtellingRate({ ...evCheap, evRegYear: 2026 }, 50000) - expected2026blend) < 0.001);
check("Petrol always 22%",
  mod.getBijtellingRate(mod.buildScenario("petrol","used",10000), 20000) === 0.22);

console.log("\n== 4. MRB ratios ==");
check("EV ×0.70 of base",  mod.getMRBMonthly(mod.buildScenario("ev","young",30000)) === Math.round(90*0.70));
check("PHEV ×1.25 of base", mod.getMRBMonthly(mod.buildScenario("phev","young",30000)) === Math.round(90*1.25));
check("Petrol = base 90", mod.getMRBMonthly(mod.buildScenario("petrol","young",30000)) === 90);
check("Hybrid = base 90", mod.getMRBMonthly(mod.buildScenario("hybrid","young",30000)) === 90);

console.log("\n== 5. Resale monotonicity ==");
const sc = mod.buildScenario("hybrid", "young", 22000);
let prev = sc.carPrice;
for (let y = 1; y <= 8; y++) {
  const r = mod.resaleAtAge(sc.carPrice, sc.resaleFraction, y);
  check(`resale year ${y} < year ${y-1}`, r < prev);
  prev = r;
}

console.log("\n== 6. Strategy ordering ==");
const sc1 = mod.buildScenario("hybrid", "young", 22000, { annualKm: 18000 });
const bv = mod.strategyPureBV(sc1, baseParams, 5);
const pv = mod.strategyPurePrivate(sc1, baseParams, 5);
const best = mod.findBestSwitchYear(sc1, baseParams, 5);
check("Best buyout ≤ min(PureBV, PurePrivate) + 1", best.totalCost <= Math.min(bv.totalCost, pv.totalCost) + 1);

console.log("\n== 7. Pseudo-eindheffing scope ==");
const pseudoOff = baseParams;
const pseudoOn = { ...baseParams, pseudoEindheffing: true };
const evSc = mod.buildScenario("ev", "young", 30000);
check("EV BV: pseudo on/off identical",
  mod.strategyPureBV(evSc, pseudoOff, 5).totalCost === mod.strategyPureBV(evSc, pseudoOn, 5).totalCost);
const petrolSc = mod.buildScenario("petrol", "young", 18000);
check("Petrol BV: pseudo on > off",
  mod.strategyPureBV(petrolSc, pseudoOn, 5).totalCost > mod.strategyPureBV(petrolSc, pseudoOff, 5).totalCost);
check("Petrol Private: pseudo on/off identical",
  mod.strategyPurePrivate(petrolSc, pseudoOn, 5).totalCost === mod.strategyPurePrivate(petrolSc, pseudoOff, 5).totalCost);

console.log("\n== 8. Box 2 monotonicity ==");
const p245 = { ...baseParams, box2Rate: 0.245 };
const p31  = { ...baseParams, box2Rate: 0.31 };
check("Higher box 2 → cheaper BV",
  mod.strategyPureBV(sc1, p31, 5).totalCost < mod.strategyPureBV(sc1, p245, 5).totalCost);
check("Box 2 doesn't affect Private",
  mod.strategyPurePrivate(sc1, p245, 5).totalCost === mod.strategyPurePrivate(sc1, p31, 5).totalCost);

console.log("\n== 9. Walk-away identities ==");
check("Private residualPersonal = endResale",
  Math.abs(pv.residualPersonal - mod.resaleAtAge(sc1.carPrice, sc1.resaleFraction, 5)) < 1);
check("BV residualPersonal = endResale × (1 − box2)",
  Math.abs(bv.residualPersonal - mod.resaleAtAge(sc1.carPrice, sc1.resaleFraction, 5) * (1 - 0.245)) < 1);

console.log("\n== 10. Cost monotonicity ==");
const lowKm = mod.strategyPurePrivate(mod.buildScenario("hybrid","young",22000,{annualKm:8000}), baseParams, 5).totalCost;
const highKm = mod.strategyPurePrivate(mod.buildScenario("hybrid","young",22000,{annualKm:30000}), baseParams, 5).totalCost;
check("More km → more cost (private)", highKm > lowKm);
const cheapCar = mod.strategyPurePrivate(mod.buildScenario("petrol","used",6000), baseParams, 5).totalCost;
const expensiveCar = mod.strategyPurePrivate(mod.buildScenario("petrol","used",20000), baseParams, 5).totalCost;
check("More expensive car → more cost", expensiveCar > cheapCar);
const lowCat = mod.strategyPureBV(mod.buildScenario("hybrid","young",18000,{catalogueValue:18000}), baseParams, 5).totalCost;
const highCat = mod.strategyPureBV(mod.buildScenario("hybrid","young",18000,{catalogueValue:40000}), baseParams, 5).totalCost;
check("Higher catalogue → more BV cost", highCat > lowCat);
check("Catalogue irrelevant to Private",
  mod.strategyPurePrivate(mod.buildScenario("hybrid","young",18000,{catalogueValue:18000}), baseParams, 5).totalCost ===
  mod.strategyPurePrivate(mod.buildScenario("hybrid","young",18000,{catalogueValue:40000}), baseParams, 5).totalCost);
const rulingOn = mod.strategyPureBV(sc1, {...baseParams, use30Ruling: true}, 5).totalCost;
const rulingOff = mod.strategyPureBV(sc1, {...baseParams, use30Ruling: false}, 5).totalCost;
check("Ruling on ≤ ruling off (BV)", rulingOn <= rulingOff + 1);

console.log("\n== Summary ==");
console.log((failed === 0 ? "✅" : "❌") + " " + (tests - failed) + "/" + tests + " checks passed" + (failed > 0 ? `, ${failed} FAILED` : ""));
process.exit(failed === 0 ? 0 : 1);
