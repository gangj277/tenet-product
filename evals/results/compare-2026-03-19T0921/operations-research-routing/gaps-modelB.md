## gaps.md — Learned Routing vs Classical OR (2016–2024)

### 1) Unresolved questions (what evidence does not settle)
1. **Multi-constraint feasibility vs. optimization**
   - **Unsettled:** How learned/RL approaches compare to classical OR when *feasibility* constraints (e.g., **time windows, capacity constraints, multiple vehicle types/fleets**) dominate the difficulty rather than pure objective minimization.
   - **Why unresolved:** The consolidated evidence emphasizes benchmark-style routing (e.g., Euclidean TSP) and general statements about scaling/generalization, but does not answer how performance changes when feasibility checking and constrained search are central.

2. **True end-to-end ROI including training + tuning costs**
   - **Unsettled:** The *net* competitiveness once you include:
     - learned solver **training cost** (often huge),
     - **retraining/maintenance cost** as distributions drift,
     - classical solver **tuning/configuration cost** (e.g., ParamILS/automatic configuration),
     - and real deployment constraints (latency budgets, hardware, reproducibility).
   - **Why unresolved:** Evidence supports the idea of inference speed and training overhead qualitatively, and separately shows algorithm configuration can yield dramatic gains for classical solvers, but does not provide a comparable apples-to-apples accounting across *the same benchmark distributions* and *target operational regimes*.

3. **Hybrid learned search vs. classical optimality guarantees**
   - **Unsettled:** Whether hybrid methods (e.g., learned branching policies inside **branch-and-bound**, or learned local-search neighborhoods) can retain **formal properties** (bounds, convergence criteria) that pure neural construction lacks.
   - **Why unresolved:** The consolidated findings mention hybrid and search strategies, but the specific question of **theoretical guarantees under learned components** is not answered with decisive evidence.

4. **Where ML value comes from: construction vs. search guidance**
   - **Unsettled:** In practice, does ML’s advantage primarily come from:
     - producing a good **initial solution** (amortized construction),
     - or providing a better **search policy** (guiding classical/active search)?
   - **Why unresolved:** The literature contains claims aligned with both views (construction-centric and search-centric), but the consolidated evidence does not resolve which mechanism drives performance across tasks and benchmarks.

5. **Robustness under structured distribution shift**
   - **Unsettled:** Beyond “generalization is hard,” which kinds of shifts most break learned solvers:
     - different spatial distributions (non-uniform, clustered, obstacle maps),
     - different objective noise/weights,
     - different constraint regimes (e.g., time-window tightness distributions),
     - and different scaling laws (e.g., node coordinates dimension changes, different correlation structure).
   - **Why unresolved:** The evidence points to generalization degradation and the potential of active search, but does not map robustness failure modes to specific shift types.

---

### 2) Contradictions (direct disagreements between sources)
1. **“Active Search is distribution independent” vs. generalization collapse risk**
   - **Source claim:** Active Search is described as **distribution independent** (NCO paper, section on search strategies).
   - **Other evidence claim:** Policy generalization to unseen problems is a **challenge**, and learning performance **degrades beyond training sizes** (methodological tour d’horizon; general RL scaling caveat).
   - **Actionable tension:** Determine whether Active Search meaningfully preserves performance under *real* distribution shifts or only under certain mild variations. This is a design-and-evaluation mismatch: “distribution independent” is a strong claim that requires broader experimental coverage.

2. **REINFORCE effectiveness disagreement**
   - **Unresolved disagreement:** Some discussions/platform baselines exclude REINFORCE as underperforming, while prominent NCO state-of-the-art work relies on it.
   - **Actionable tension:** The synthesis needs to standardize which RL optimizers/training procedures are used in comparisons (REINFORCE variants, baselines, variance reduction, rollout budgets). Otherwise performance differences may be attributed to “method class” rather than “training recipe.”

3. **Amortization speed benefit vs. classical competitiveness under compute accounting**
   - **Source tension:** Learned models are argued to have inference speed advantages via amortization, but classical solvers may remain competitive once you account for the increased cost of training/tuning and the time-to-solution curve.
   - **Actionable tension:** Existing evidence references increasing times for OR metaheuristics as more solutions are considered, but does not unify cost metrics (wall-clock, energy, and solution quality targets) across learned vs classical.

---

### 3) Weak evidence areas (thin/low-quality support)
1. **Claims of “near-optimal” performance may be benchmark-specific**
   - **Weakness:** High-confidence statements focus on **2D Euclidean TSP up to 100 nodes** and other standard benchmarks. This does not automatically extend to:
     - higher-dimensional variants,
     - non-Euclidean metrics,
     - constrained VRP variants,
     - or industrial routing distributions.
   - **Impact:** Risk of overgeneralizing “neural competitiveness” from clean benchmarks.

2. **Generalization evidence is largely methodological/aggregative rather than task-detailed**
   - **Weakness:** The methodological tour and RL survey provide strong general claims (“generalization is hard,” “scales poorly”), but the consolidated findings do not list task-by-task measured robustness across distribution shift types.
   - **Impact:** The synthesis may conclude “learned methods fail out-of-distribution” without knowing *how often*, *by how much*, and *under what shift types*.

3. **ROI comparisons are under-specified**
   - **Weakness:** The evidence set includes:
     - qualitative or conclusion-level claims about training overhead,
     - and strong results about classical parameter configuration,
     - but not a consistent framework that compares total cost including training vs tuning for the same problem class and target latency/quality requirements.
   - **Impact:** Deployment readiness conclusions remain uncertain.

4. **Theoretical guarantees for hybrid learned search are not substantiated**
   - **Weakness:** The open question about preserving optimality guarantees is not resolved in the consolidated findings. Without explicit proof/argument or experiments with provable properties, this remains speculative.
   - **Impact:** A key advantage touted for classical OR—guarantees and bounds—may not be accurately characterized for learned hybrids.

5. **Deployment readiness barriers are not concretely evidenced**
   - **Weakness:** The project intends to address integration barriers, but the consolidated findings do not include operational reports (engineering efforts, robustness testing, safety constraints, monitoring, retraining triggers).
   - **Impact:** “Readiness” is likely being inferred rather than demonstrated.

---

### 4) What would change confidence (specific evidence/studies that would materially affect the synthesis)
1. **Head-to-head, cost-calibrated comparisons with full lifecycle accounting**
   - **Would change confidence in competitiveness/ROI** if you collect studies that report, for the *same* problem distributions:
     - training cost (GPU hours),
     - inference latency,
     - number of retraining cycles under drift,
     - and total wall-clock/energy-to-target-quality.
   - **Concrete outcome:** A table comparing learned vs classical under a fixed “quality threshold” and “time budget,” with **comparable compute assumptions**.

2. **Constrained routing benchmarks beyond Euclidean TSP**
   - **Would change confidence in robustness for real routing.**
   - Target evidence:
     - learned/RL methods on **VRPTW/MDVRP with time windows**, capacity constraints, heterogeneous fleets,
     - explicit comparisons to strong baselines (Gurobi/CP-SAT/branch-and-bound solvers + LNS, LKH variants, and tuned metaheuristics).
   - **Concrete outcome:** Measured performance on feasibility rate (not just objective), constraint violation statistics, and solution quality conditional on feasibility.

3. **Robustness under defined shift families**
   - **Would change confidence on out-of-distribution behavior.**
   - Need experiments that systematically vary:
     - coordinate distributions (uniform vs clustered vs hub-and-spoke),
     - constraint tightness distributions (wide vs tight time windows),
     - metric changes (e.g., asymmetric costs),
     - scaling (train at n, test at k·n with k>1).
   - **Concrete outcome:** Curves of performance vs shift magnitude, plus identification of failure modes (e.g., infeasibility, tour structure collapse, search stagnation).

4. **Hybrid methods with explicit guarantees or formal integration results**
   - **Would change confidence in “neural-hybrid retains classical guarantees.”**
   - Required evidence:
     - proofs or formal arguments that learned components (e.g., learned branching) do not break correctness,
     - or empirical verification of bound improvement properties while preserving solver invariants.
   - **Concrete outcome:** Demonstrations that hybrid solvers can still provide valid bounds and/or correctness while benefiting from learned guidance.

5. **Standardized RL training recipes and controlled ablations (including REINFORCE variants)**
   - **Would change confidence on whether REINFORCE is truly suboptimal or just baseline-dependent.**
   - Needed:
     - ablations controlling for rollout count, baseline/critic quality, variance reduction, action masking, and sampling strategy,
     - comparisons across several RL optimizers with identical network/inputs.
   - **Concrete outcome:** A controlled study where “method class” is held constant and only RL optimizer/training details vary, showing whether REINFORCE (or specific variants) can match stronger alternatives.

---

### Suggested next-step checklist for the researcher (actionable)
- Collect papers that test **VRPTW/VRP with time windows** (not just TSP) and report **feasibility rates**.
- Search for studies reporting **total cost-to-solution** including **training and tuning** under the same quality/time targets.
- Gather robustness experiments with **structured shift families** (coordinate, metric, constraint tightness).
- Locate any work that embeds learned policies into **branch-and-bound** with explicit correctness/bound handling, or provides formal guarantees.
- Extract and normalize RL training details (rollouts, critic/baseline, REINFORCE variants) from NCO state-of-the-art to resolve the optimizer contradiction.

