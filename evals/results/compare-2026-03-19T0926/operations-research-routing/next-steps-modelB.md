## Next steps (directed plan)

### 1) Narrow the comparison to “apples-to-apples” regimes
**Goal:** Identify where learned methods *actually* beat classical OR under controlled evaluation, and where reported gains disappear due to compute/training differences.

**Do next (concrete tasks):**
- Build a comparison matrix with columns:
  - Problem type (TSP, CVRP, VRPTW, knapsack variants, assignment/SAP variants, or scheduling)
  - Constraints (single-constraint vs multi-constraint: capacity, time windows, heterogeneous fleets)
  - Learning paradigm (end-to-end RL / imitation / hybrid + search / learned branching)
  - Evaluation protocol (single instance vs distribution of instances; greedy vs sampling vs beam search)
  - Compute accounting (inference-only; training cost amortized over how many calls; hyperparameter tuning cost)
  - Competing OR baselines (exact solvers, metaheuristics like LKH, CP-SAT, MIP with cuts, OR-Tools, etc.)
  - Robustness tests (OOD distribution shifts, increased sizes beyond training)
- For **each** paper you cite as “learned is better,” also locate the paper’s *baseline section* and extract:
  - baseline solver configuration (default? tuned? same budget? same time limit?)
  - whether learned model uses multiple samples / rollout vs single greedy decoding
  - any “cheating” via easy synthetic distributions

**Deliverable:** a table that lets you answer: “Under equal wall-clock budget and equal compute budget including tuning/training, who wins and when?”

---

### 2) Quantify the “amortization vs robustness” break-even point
**Goal:** Convert the qualitative hypothesis into a measurable claim.

**Do next:**
- For each learned paper, extract (or estimate) three time components:
  1. **Training time** (or proxy, if not reported)
  2. **Model selection/tuning** (architecture, training steps, reward settings)
  3. **Inference time per instance** (including sampling/beam if used)
- For each classical baseline, extract:
  1. **Per-instance runtime** under the reported configuration
  2. **Tuning time** (e.g., ParamILS/SMAC usage where applicable) if the paper compares to tuned parameters
- Compute a **break-even number of instances**:
  - \(N \approx \frac{T_{train}+T_{tuning}}{T_{classical}-T_{learned}}\)
  - Where \(T_{classical}\) is either “best classical under budget” or “default classical” (do both as separate scenarios)
- Then evaluate robustness:
  - Use OOD tests reported in the literature (size shift, coordinate distribution shift, constraint shift such as time-window distributions)

**Deliverable:** a plot or table: “Learned wins in inference latency, but only after amortizing training over N calls, and only for certain shifts.”

---

### 3) Audit generalization claims with an explicit OOD checklist
**Goal:** Determine whether learned solvers fail due to scaling alone, or due to distribution shift in geometry/constraints.

**Do next:**
- For each domain (TSP, VRP, knapsack, etc.), classify shifts into:
  - **Scale shift:** unseen n, e.g., “trained on ≤100 nodes, evaluated on 200/500”
  - **Distribution shift:** different coordinate distributions, different demand generation, different knapsack weight/value regimes
  - **Constraint shift:** different capacities/time-window widths, different vehicle heterogeneity, different feasibility density
- Where papers do not report OOD, run a minimal “reconstruction” from descriptions:
  - Identify the data generator (e.g., uniform Euclidean in [0,1]^2, random demands from X)
  - Suggest additional experiments you would run (see §7) to directly test shift types

**Deliverable:** a “generalization failure taxonomy” tied to reported evaluation settings.

---

## 4) Hypothesis refinements (based on current evidence)

### Refinement A: Learned end-to-end “construction” wins mostly on *easier* single-structure problems
**Based on evidence:** strong claims for NCO/Attention on 2D Euclidean TSP up to n≈100; plus evidence that generalization and scaling are hard; vanilla seq2seq cannot generalize beyond training n.

**Refined hypothesis to test:**
- Learned end-to-end solvers are competitive primarily on:
  - problems with a stable inductive bias (e.g., Euclidean geometry for TSP)
  - single-constraint feasibility structure (or constraints that don’t fundamentally change combinatorics)
- They degrade sharply when constraints change feasibility structure (e.g., time windows) or when instance size/graph statistics shift.

### Refinement B: The competitive advantage shifts from “amortized inference” to “learned search policies”
**Based on evidence:** Active Search noted as more distribution independent; common suggestion that ML can guide decisions inside CO algorithms.

**Refined hypothesis to test:**
- Neural-hybrid methods that guide search (branching, local move proposals, cut selection, policy for exploration) will outperform pure end-to-end policies in OOD settings—*even if they remain heuristic*—because the search process can re-stabilize feasibility and exploit problem structure.

### Refinement C: Classical OR competitiveness often comes from *tuning + adaptive search budgets*
**Based on evidence:** ParamILS can yield extreme speedups (orders of magnitude) over defaults; NCO papers acknowledge training/compute expenses; OR tooling/metaheuristics scale with solution budget.

**Refined hypothesis to test:**
- Many “learned wins” comparisons are against untuned or weak baseline configurations; once classical solvers receive strong automated configuration (or longer search budgets), the performance gap often shrinks or flips except in narrow inference-latency regimes.

---

## 5) Questions worth exploring in the agent chat (use these as prompts)

1. **Baselines & compute accounting:**  
   “In the main NCO vs OR comparisons, what exactly was included in runtime budgets—model inference only, or also sampling/rollouts, or also training/tuning amortization?”

2. **Generalization failure modes:**  
   “Which OOD shift types cause the steepest performance drops—scale, geometry distribution, demand distributions, or constraint distributions?”

3. **Learned vs tuned classical:**  
   “Which papers compare against classical solvers using automatic parameter configuration (e.g., ParamILS/SMAC)? If not, what tuning budgets were assumed?”

4. **Hybrid search benefits:**  
   “How do Active Search / learned local improvement / learned branching affect out-of-distribution generalization compared to one-shot decoding?”

5. **Deployment realism:**  
   “For practical logistics constraints (VRPTW with realistic time-window distributions, fleet heterogeneity), what evidence exists that learned solvers produce feasible solutions reliably without expensive repair?”

6. **Robustness/guarantees:**  
   “Are there any learned approaches providing certificates, bounds, or convergence-style guarantees—or hybrids that provide worst-case performance envelopes?”

---

## 6) Specific papers / datasets / methods to investigate next

### Core NCO / RL routing (continue coverage, but focus on evaluation rigor)
- **Attention, Learn to Solve Routing Problems!** (Vinyals et al., 2018)  
  *Next extraction:* decoding strategy (greedy vs stochastic), scaling limits, any OOD evaluation beyond training sizes.
- **Neural Combinatorial Optimization with Reinforcement Learning** (Bello et al., 2017; plus related follow-ups)  
  *Next extraction:* Active Search section; any distribution-independent claims quantified; limits of “trained cannot generalize beyond n.”
- **Machine Learning for Combinatorial Optimization: a Methodological Tour d'Horizon** (survey)  
  *Next extraction:* the specific sections that categorize scaling/generalization failures; look for pointers to VRP-with-time-window and hybrid methods.

### Learned branching / learned guidance within classical solvers
- Search within the literature for:
  - “learned branching policy”
  - “neural branching in branch-and-bound”
  - “RL for MIP/CP search”
  - “cut selection with ML”
  - “policy for local search moves in VRP”
  
**Method note:** you already have the conceptual link—now locate at least 2–3 concrete learned-guidance papers with reported MIP/CP improvements and any robustness tests.

### Classical OR tuning and configuration baselines (critical for fair comparisons)
- **ParamILS: An Automatic Algorithm Configuration Framework** (H. H. / Hutter et al.)  
  *Next extraction:* which problems they tune, what “speedups” look like in wall-clock terms, and whether they discuss generalization across instance distributions.
- Also investigate closely related configuration frameworks for additional baseline strength:
  - **SMAC**
  - **irace**
  - **Hyperband/ASHA** (if used for solver configuration)
  
**Deliverable:** a short “tuning toolkit map” for replication-style baseline tuning.

### Datasets / benchmarks to prioritize for routing vs OOD
- **TSP/VRP benchmark generators** commonly used in learned routing papers (coordinate distributions; demand distributions).
- **VRPTW-style benchmarks** (time windows): even if learned papers don’t include them, locate at least one classical OR-heavy baseline study and one learned/hybrid study on VRPTW.
- Consider building an OOD evaluation suite by reusing:
  - the same problem encodings (e.g., node features)
  - but changing generators (scale, coordinate distribution, demand distribution, time-window distribution)

---

## 7) Concrete experiment ideas you can propose (if you run follow-up studies)

### Experiment 1: Controlled scale shift for end-to-end vs hybrid
- Train learned policy on size n∈{50,100}; evaluate on n∈{150,200,500}.
- Compare:
  - end-to-end one-shot decoding
  - stochastic sampling with K rollouts
  - learned local search / Active Search / hybrid guidance (if available in a paper or code)

**Success criterion:** characterize error growth slope vs n; identify whether hybrids exhibit slower degradation.

### Experiment 2: Constraint shift (VRP with time windows)
- Keep geometry fixed; change time-window distributions (narrow vs wide).
- Compare feasibility rate and objective quality at fixed time limit.

**Success criterion:** feasibility robustness (percentage feasible) and objective degradation relative to classical repair heuristics.

### Experiment 3: Compute-fairness re-evaluation
- Fix an overall wall-clock limit (e.g., 1s / 10s per instance).
- Include:
  - classical tuned parameters (run a small automated tuning budget per instance family)
  - learned training amortization over a simulated number of calls (N=10^3, 10^4, 10^5)

**Success criterion:** show whether learned wins only when amortized and with restricted distributions.

---

## 8) What to do in the synthesis write-up next (structure recommendation)

1. **Section: Claim audit**  
   List the top 3–5 “learned beats classical” claims; attach the exact baseline configuration and compute accounting.
2. **Section: Robustness + generalization taxonomy**  
   Use the OOD checklist (scale / distribution / constraint shift) and map failures to problem types.
3. **Section: Amortization break-even**  
   Convert training/inference/training amortization into N-call break-even estimates.
4. **Section: Hybrid vs end-to-end split**  
   Argue whether ML’s value is best seen as construction (end-to-end) or search guidance (hybrid).
5. **Section: Deployment readiness**  
   Tie remaining gaps to operational constraints: real-time feasibility, calibration, retraining cost, monitoring drift, and failure modes.

--- 

If you want, paste the list of candidate papers you’ve already collected (even just titles/links), and I’ll help you fill the “comparison matrix” fields and pick the 5–10 highest-leverage follow-up sources.