# gaps.md — Learned Routing vs Classical OR (2016–2024)

## 1) Unresolved questions (what the evidence does *not* settle)

### A. Multi-constraint routing (feasibility + optimization together)
**Open question:** *How do learned methods perform on routing problems where feasibility is difficult—e.g., TSP with Time Windows (TSP-TW), capacitated VRP with heterogeneous fleets, precedence constraints, or mixed constraints?*  
**Why it’s unresolved:** The consolidated evidence strongly reflects benchmark-style settings (e.g., 2D Euclidean TSP, single-structure instances). But the open questions explicitly point to “identifying feasible branches” being as hard as optimizing. The current synthesis inputs don’t include concrete, head-to-head results on these multi-constraint variants that compare:
- end-to-end neural/RL policies,
- constructive heuristics + learned guidance,
- classical solver baselines with comparable compute budgets.

**What to collect to resolve it:**
- Papers/benchmarks comparing learned approaches vs (i) exact/optimal solvers (CP-SAT, MIP, B&B) and (ii) strong metaheuristics (LKH variants, large neighborhood search, hybrid tabu/local search) on **TSP-TW / VRP-TW / CVRP with realistic constraints**.
- Evaluation splits that include both **in-distribution** and **distribution-shifted** constraint patterns (e.g., different time-window tightness distributions, capacity regimes).

---

### B. End-to-end ROI after accounting for training cost and tuning cost
**Open question:** *What is the true amortized ROI when including training compute/energy/time for learned models vs the one-time (or per-instance-type) tuning cost of classical metaheuristics and MIP solvers?*  
**Why it’s unresolved:** Evidence supports that (i) learned policies can be fast at inference (amortization), and (ii) classical methods can be heavily improved with automation (e.g., ParamILS speedups). But the consolidated findings do not quantify a unified ROI across papers where training budgets are reported and comparable to classical tuning budgets.

**What to collect to resolve it:**
- Studies reporting **wall-clock training time**, hardware type, and energy proxies (or at least GPU-hours) for learned solvers, alongside **inference latency**.
- Studies that also report **algorithm configuration budgets** (e.g., number of runs/evaluations for ParamILS-like tuning, runtime cost of feature extraction).
- A “break-even analysis” across different deployment frequencies (how many instances must be solved before training amortizes).

---

### C. Learned guidance inside provably-sound search (optimality guarantees)
**Open question:** *Can neural components (e.g., learned branching rules, node selection, cut selection) be integrated into classical branch-and-bound / branch-and-cut while retaining theoretical guarantees?*  
**Why it’s unresolved:** The provided evidence hints at an amortization-vs-robustness frame, but there’s no settled result about:
- whether learned branching can preserve B&B correctness (it often does if it only reorders decisions),
- whether learned branching improves practical time enough to matter,
- whether learned policies introduce failure modes that break guarantees indirectly (e.g., by affecting pruning correctness or relaxation validity).

**What to collect to resolve it:**
- Empirical comparisons of **learned branching** (or learned branching + classical pruning) vs classical default branching on:
  - exact MIP/CP formulations of routing variants,
  - benchmark families with measurable solve-time distributions.
- Any theoretical or empirical proof obligations around correctness/pruning validity.

---

### D. “Construction” vs “search” as the main source of gains
**Open question:** *Are learned models competitive primarily because they learn better *construction policies*, or because they learn to guide *search* (active search / rollouts / beam / neighborhood refinement)?*  
**Why it’s unresolved:** The consolidated findings include an explicit “Amortization vs. Search” disagreement, but do not resolve it with comparative ablations that isolate:
- pure constructive policy vs constructive+search,
- active search vs single-shot greedy/beam,
- learned improvement steps vs learned full policies.

**What to collect to resolve it:**
- Papers with **ablation studies** that quantify performance changes when removing search components.
- Comparisons where compute budgets are equalized: e.g., “one forward pass only” vs “K rollouts/active search steps.”

---

### E. Distribution shift type: what “OOD” means operationally
**Open question:** *Which distribution shift regimes most harm learned methods (and which interventions mitigate it)?*  
**Why it’s unresolved:** The evidence notes “generalization is difficult” and mentions “Active Search is distribution independent,” but it does not pin down:
- what exact OOD shifts were used (geometric perturbations? node-count changes? cost-matrix type changes? constraint tightness changes?),
- whether OOD is measured in terms of feasibility rate, optimality gap, or just tour cost.

**What to collect to resolve it:**
- OOD protocol details for routing benchmarks:
  - different city distributions (uniform vs clustered),
  - different cost models (Euclidean vs random metric vs learned cost surrogates),
  - different scale (n beyond training),
  - different constraint distributions (time windows/capacities).
- Consistent metrics across papers (optimality gap, feasibility, solve-time CDFs).

---

## 2) Contradictions (where sources directly disagree)

### A. Effectiveness of REINFORCE / policy-gradient variants
**Contradiction noted:** “Some platforms exclude [REINFORCE] as underperforming, while state-of-the-art NCO papers rely on it heavily.”  
**Why it matters:** If the performance hinges on a specific training objective (e.g., REINFORCE-style gradients + baselines), then the comparative advantage over classical methods may not generalize to alternative training regimes or to production constraints.

**What to resolve it:**
- Direct comparisons within the same model family:
  - REINFORCE vs alternatives (e.g., actor-critic with learned value baselines, PPO-style objectives, advantage normalization differences),
  - sensitivity to baseline choice and rollout count.
- Benchmarking compute-matched training and inference for each objective.

---

### B. Primary value source: construction vs amortized search
**Contradiction noted:** “Amortization vs. Search: Disagreement on whether the primary value of ML is in the construction of the solution or in the search routine guiding the construction.”  
**Why it matters:** It changes the ROI story:
- If construction is key, inference amortization dominates.
- If search/active refinement is key, inference can become expensive and resemble classical heuristic compute.

**What to resolve it:**
- Controlled experiments with identical total inference compute (forward passes / sampling steps) and varied components (single-shot vs active search).

---

### C. Distribution dependence claims (Active Search vs generalization collapse risk)
**Tension:** The findings include:
- “Learning policies generalize to unseen problems is a challenge.” (high confidence)
- “Active Search is distribution independent.” (stated as contrast)
- plus the explicit “generalization collapse” risk as a repeated warning.

**Why it’s unresolved:** The contradiction may be more apparent than real if “distribution independent” refers to a limited sense (e.g., search policy mechanics generalize, but learned priors still matter). The consolidated inputs don’t include consistent experimental definitions of “distribution independent.”

**What to resolve it:**
- Papers that test Active Search under clearly defined OOD shifts and report:
  - performance degradation curves,
  - failure modes (feasibility/optimality gap),
  - whether active search quality depends on the initial policy’s distribution alignment.

---

## 3) Weak evidence areas (claims that rely on thin or low-quality evidence)

### A. “Near-optimal” claims on small Euclidean benchmarks do not imply practical competitiveness
**Weak area:** The high-confidence claims about NCO achieving close-to-optimal performance on 2D Euclidean TSP up to **n=100** are promising, but they may be *benchmark-specific*.  
**Why weak for deployment inference:**
- Euclidean TSP is structurally “friendly” compared to real logistics (time windows, capacities, heterogeneous fleets, stochastic demand, network constraints).
- Near-optimality on n=100 doesn’t establish performance distribution (solve-time CDF) vs classical solvers with the same budget.

**Actionable next step:** Expand evidence base beyond Euclidean synthetic instances and include:
- realistic routing variants,
- larger n and varied graph/cost generators,
- equal-budget comparisons (or explicit accounting of compute).

---

### B. Scaling/generalization evidence is described, but the operational boundary is not quantified
**Weak area:** Generalization collapse and scale-poor behavior are stated at a methodological level (“degrades as instance size increases beyond training sizes”), but we lack:
- quantitative thresholds (e.g., how much larger than training n can be tolerated),
- which architectures mitigate it (AM/Transformer, GNN encoders, attention variants),
- which training strategies (curriculum learning, augmentation, active search) improve robustness.

**Actionable next step:** Collect scaling curves across:
- multiple training sizes,
- multiple OOD perturbations,
- multiple model variants with comparable parameter counts.

---

### C. Training-vs-tuning comparisons are mostly implied rather than measured end-to-end
**Weak area:** The synthesis asserts amortization/training overhead, but the consolidated findings do not show a unified methodology for comparing:
- learned training compute + inference,
vs
- classical tuning compute + solve time.

**Actionable next step:** Identify at least a few papers where both training cost and comparable classical tuning cost are documented.

---

### D. Hybrid approaches exist, but “how close to OR robustness” remains under-evidenced
**Weak area:** There is evidence that ML can improve classical algorithms (and that classical OR can be boosted by configuration like ParamILS), but:
- we don’t have enough consolidated results comparing *neural-hybrid* solvers to state-of-the-art classical hybrids under robust evaluation protocols.
- “keeping optimality guarantees” is not established experimentally or analytically.

**Actionable next step:** Prioritize hybrid-branching and hybrid-local-search papers with rigorous baselines (strong classical solvers configured fairly).

---

## 4) What would change confidence (specific evidence/studies that would materially affect the synthesis)

### A. Multi-constraint routing head-to-head studies with equal compute budgets
**Would increase confidence** in the “learned is competitive only in limited domains” conclusion (or overturn it).  
**Need:** Experiments comparing learned/RL and classical OR on:
- VRP-TW / CVRP with capacities + heterogeneous constraints,
- realistic instance distributions (not only uniform Euclidean points),
with:
- solve-time distributions,
- optimality gaps (where feasible),
- feasibility rate / constraint violation metrics,
- explicit compute budgets.

---

### B. Break-even ROI papers with reported training and tuning budgets
**Would increase confidence** in the amortization-vs-robustness framing.  
**Need:**
- Papers that report GPU-hours (or energy/time proxies) for training learned models,
- papers that report tuning cost for classical methods (e.g., number of evaluations in ParamILS),
- a deployment-frequency analysis (how many solves required for learned amortization to beat tuned classical).

---

### C. Quantitative scaling/generalization benchmarks with defined OOD shifts
**Would increase confidence** on robustness boundaries.  
**Need:**
- Standardized OOD protocols: node-count extrapolation, cost-matrix model shift, constraint distribution shift,
- scaling curves and failure modes,
- consistent baseline comparisons (LKH variants, OR-Tools, and/or MIP/CP solvers where appropriate).

---

### D. Ablation studies isolating “construction vs search”
**Would resolve** the explicit “Amortization vs Search” disagreement.  
**Need:**
- Same learned model with:
  1) greedy/sampling-only,
  2) beam search,
  3) active search / rollouts,
  4) learned local improvement,
- all under matched compute budgets,
- reporting which component contributes most to gains and robustness.

---

### E. Learned branching/search-integration experiments demonstrating correctness-preserving improvements
**Would materially affect** claims about guarantees and deployment readiness.  
**Need:**
- Evidence from branch-and-cut style integration:
  - learned variable/branch selection,
  - learned cut selection (if applicable),
- comparisons to strong classical default strategies,
- reporting correctness (optimal solutions found when classical finds them) and improved solve times.

---

### F. Direct optimizer/objective comparisons (REINFORCE vs alternatives)
**Would resolve** the REINFORCE contradiction.  
**Need:**
- Controlled replications showing whether REINFORCE-like training is essential for the reported performance or if other objectives achieve similar results.

--- 

## Summary of highest-priority gaps (if you only fix a few things)
1. **Multi-constraint routing robustness:** Collect OOD + feasibility/constraint-aware benchmarks beyond Euclidean TSP/knapsack.
2. **Compute-budget ROI:** Add reported training cost/tuning cost and break-even analyses.
3. **Construction vs search disentanglement:** Demand ablations with matched inference/search compute.
4. **Hybrid integration with guarantees:** Find branch-and-cut / B&B integration studies with correctness-preserving demonstrations.