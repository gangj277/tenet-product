# Next Steps: Learned Routing vs Classical OR

## 1) Concrete follow-up research directions (actionable)
1. **Build a “comparative ROI” table that accounts for training/tuning overhead**
   - For each learned method: record training compute cost (GPU-hours if available), training dataset size, retraining frequency, and inference latency.
   - For each classical baseline: record solver runtime under default settings *and* under tuned settings (e.g., per-instance, per-distribution, or per-class parameter schedules).
   - Compute an ROI-style metric: *time-to-first-solution* and *time-to-median-quality* including amortization horizon (e.g., number of instances needed before training cost is recovered).

2. **Run a structured robustness audit across perturbations**
   - Identify evaluation protocols in NCO papers: size shifts (n>train_max), distribution shifts (coordinate distributions for TSP, capacity perturbations for VRP), and constraint shifts (adding/removing time windows, changing penalty weights).
   - Extract from papers: which perturbations were tested, how performance degraded, and whether improvements were due to “active search”/rollouts or pure feed-forward policies.
   - Output: a taxonomy of robustness failure modes (scale, topology, constraint-activation, noise, and cost-matrix regime).

3. **Separate “construction” vs “search” contributions**
   - Create categories: (a) end-to-end policy construction, (b) policy + local search, (c) policy guiding beam search / sampling, (d) policy as branching heuristic inside B&B, (e) active search / rollouts.
   - For each paper: identify which component drives the performance gain and whether the gain persists when the learned component is replaced by a generic heuristic.
   - Goal: quantify the fraction of improvement attributable to learned guidance rather than learned capacity alone.

4. **Add multi-constraint routing coverage deliberately (beyond TSP)**
   - Extend the synthesis beyond TSP/Knapsack to include: VRP with capacity constraints, time windows (VRPTW), heterogeneous fleets, stochastic travel times (if present).
   - Specifically track feasibility-rate metrics and not just objective gap (because learned policies can produce infeasible or weakly-feasible solutions that look “good” under relaxed metrics).
   - If a paper doesn’t report feasibility metrics, flag it as a “caveat” item for deployment readiness.

5. **Map learned methods onto classical OR components**
   - For each learned approach, identify the corresponding classical mechanism it resembles:
     - policy ≈ construction heuristic,
     - pointer/attention model ≈ candidate selection,
     - active search ≈ stochastic local improvement,
     - RL for branching ≈ B&B node ordering.
   - Then compare against known classical counterparts (e.g., LKH3, state-of-the-art VRP heuristics, MIP solvers with branching rules) in the *same* experimental regime.

6. **Standardize a “generalization test harness” using published datasets**
   - Rather than inventing datasets, use common benchmark suites where feasible (e.g., TSP/VRP benchmark distributions).
   - For your write-up, define a minimal set of distribution shifts that must be reported in future papers and compare whether each paper meets that standard.

---

## 2) Promising hypothesis refinements (guided by evidence)
1. **Refine the “Amortization vs Robustness” hypothesis into a 3-factor model**
   - Learned advantage is most likely when:
     1) the instance distribution is stable,
     2) the problem structure aligns with the model inductive bias (e.g., Euclidean 2D regularities),
     3) the learned method includes a mechanism that reduces sensitivity (e.g., sampling/active search or learned+OR hybrid).
   - Learned failure is most likely when any of these breaks: strong constraint heterogeneity, scale shifts beyond training max, or cost-matrix regimes not seen.

2. **Hypothesis: learned methods win primarily by reducing *search depth*, not by replacing optimization**
   - Evidence hint: NCO papers emphasize construction quality (and sometimes active search), while classical OR maintains performance via systematic search/branching.
   - Refine: the best learned methods are those that emulate “good branching / candidate ranking” to reduce how much classical search must explore.

3. **Hypothesis: feasibility-rate and constraint handling explain much of the “deployment gap”**
   - Evidence hint: multi-constraint routing is called out as a struggle area; additionally, many NCO benchmarks focus on objective gaps.
   - Refine: performance metrics that ignore feasibility can overstate competitiveness. When feasibility and constraint penalties are correctly included, the learned-vs-classical gap may widen.

4. **Hypothesis: amortization advantage may be overstated in papers that exclude tuning cost for classical baselines**
   - Evidence hint: ParamILS shows classical tuning can produce large speedups.
   - Refine: whenever classical baselines are not tuned (or tuned differently), learned methods may look more competitive than they truly are.

---

## 3) Questions worth exploring in the project’s agent chat
1. **Benchmark realism**
   - “Which NCO papers evaluate on distribution shifts that resemble real logistics (time window variability, capacity changes, mixed vehicle types), not just synthetic coordinate perturbations?”

2. **Fairness of comparison**
   - “Do the papers compare to classical solvers with comparable compute budgets and comparable tuning regimes (including algorithm configuration frameworks like ParamILS)?”

3. **Scaling behavior**
   - “For each learned method, what is the reported scaling law (gap vs n, inference time vs n), and does degradation start immediately after leaving the training size regime or only after a larger threshold?”

4. **Metric alignment**
   - “Which learned papers report feasibility rate, constraint violation, and runtime-to-feasibility (not just objective value)?”

5. **Hybridization**
   - “Which hybrid neural+OR approaches are closest to a principled mapping to classical methods (e.g., learned branching in B&B), and what are their failure modes?”

6. **Generalization mechanism**
   - “When generalization improves (e.g., ‘Active Search is distribution independent’), what specific mechanism drives it: more rollouts, sampling diversity, or a search operator that covers constraint-relevant structure?”

7. **Energy/time cost framing**
   - “How should we compute energy cost for training/inference in a way consistent across papers that don’t report training compute?”

---

## 4) Specific papers, datasets, and methods to investigate next
> Use these as a targeted “next reading list” to plug the gaps your current evidence implies.

### Papers to prioritize (learned routing / NCO comparisons and robustness)
1. **Kool et al., “Attention, Learn to Solve Routing Problems!” (2019)**  
   - Focus: attention model baselines, scaling to n=100, evaluation setup.  
   - Next extraction: what exact test distributions were used vs training, and whether the model includes active search.

2. **Bello et al., “Neural Combinatorial Optimization with Reinforcement Learning” (2016/2017 era)**  
   - Focus: RL training, “active search” vs distribution independence, and claims about limitation/generalization.  
   - Next extraction: the failure cases when moving beyond n cities seen in training (concrete numbers/plots if available).

3. **Survey/Tour d’Horizon: “Machine Learning for Combinatorial Optimization: a Methodological Tour d’Horizon”**  
   - Focus: methodological caveats, generalization/scaling summaries, and where papers claim guarantees vs none.  
   - Next extraction: which sections discuss evaluation pitfalls and which cite robustness/generalization experiments.

4. **“Reinforcement Learning: A Survey”** (or the specific RL scaling survey you’re using)  
   - Focus: scaling comments (small problems vs large), to support your synthesis on scale failure.

### OR baseline improvement to include explicitly (to ensure fairness)
5. **ParamILS: Automatic Algorithm Configuration Framework** (Hutter et al.)  
   - Focus: parameter configuration gains, what baselines need tuning, and how to structure comparisons.  
   - Next extraction: experimental methodology and how speedups were measured relative to defaults.

### Methods to implement in your synthesis framework (not necessarily “new papers”)
6. **Algorithm configuration as a methodological requirement**
   - Use ParamILS/related configurators as the standard lens: “If classical baselines are not tuned, classify the comparison as potentially biased.”

7. **Unified evaluation budget rubric**
   - Define: equal wall-clock time, equal number of solver iterations, and equal number of model samples/rollouts.
   - Then check which papers violate the rubric.

### Datasets / benchmark suites to explicitly map to claims
8. **TSP benchmark generators used in NCO papers**
   - Track whether they use: uniform random 2D points, clustered points, grid/structured distributions.
   - Compare: in-distribution sampling vs extrapolation beyond training n.

9. **VRP/VRPTW benchmark distributions (where available in the literature)**
   - Identify which suites are used for time windows and capacity changes, and whether they match real logistics constraints.

---

## Output structure suggestion (so the synthesis answers your must-answer questions)
- **Section A: Claimed advantages (with evidence types)**
  - Include: amortized inference speed, near-optimality on benchmark scales, hybrid/active search benefits.
- **Section B: Repeated limitations & caveats**
  - Generalization collapse, scale sensitivity, infeasibility/constraint handling gaps, missing tuning/compute fairness, lack of guarantees.
- **Section C: Deployment readiness**
  - A “requirements checklist” (robustness, feasibility metrics, retraining policy, compute/energy constraints, monitoring and fallback to classical OR).
- **Section D: Where learned methods are genuinely competitive**
  - Conclude with problem classes and evaluation regimes where they likely outperform (distribution-stable, constraint-simple, or hybridizable settings).

If you want, paste the list of candidate learned-routing papers you already collected (or your reading list), and I’ll turn the above into a paper-by-paper extraction checklist.