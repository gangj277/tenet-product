## Next steps for research: Model Collapse From Recursive Synthetic Data Training (2023–2025)

### 0) Set up a unifying framework (so the synthesis is coherent)
Before adding new sources, align the existing evidence under a single “causal stack.” Create a one-page taxonomy that maps each paper’s mechanism to one of:

1. **Distribution drift / error accumulation**: recursive sampling gradually moves the training distribution away from the original (tails and modes vanish).
2. **Markov-chain contraction**: recursion defines a stochastic process with absorbing/attractor states (e.g., delta-like collapse).
3. **Optimization-induced forgetting**: gradient updates on model-generated samples overwrite earlier representation of rare events.
4. **Sampling/decoding effects**: beam/top‑p/temperature change the support of generated data, affecting the drift speed.
5. **Data contamination & feedback loops**: early synthetic bias becomes self-reinforcing later.

Then tag each new result you find with: (i) mechanism type, (ii) modality (text/image/etc.), (iii) full vs partial synthetic %, (iv) metric for collapse, (v) whether mitigation is shown and how robust it is.

---

## 1) Concrete follow-up research directions (actionable)

### 1.1 Derive/validate a “critical synthetic ratio” scaling law across settings
**Goal:** Turn the existing “mix real data helps” and “exponentially smaller synthetic may be needed” claims into a comparative table + (if possible) a fitted relationship.

**Action items**
- Collect from each key paper the exact mixing schedule:
  - fixed proportion (e.g., 10% real)
  - curriculum proportion (real decreases over generations)
  - resampling scheme (refresh real every generation vs once)
- For each setting, extract:
  - collapse onset generation index (or time-to-threshold)
  - synthetic-to-real ratio schedule
  - collapse metric threshold (e.g., variance drop, tail probability, eval degradation)
- Try fitting simple models:
  - collapse time ∝ log(1/(1−r)) for fraction real = r
  - collapse time ∝ 1/(1−r) or 1/(r) depending on mechanism
- If the literature doesn’t report enough, run a small “micro-experiment” plan (see 1.4).

**Deliverable:** a cross-paper “stability phase diagram” for language and at least one other modality.

---

### 1.2 Disentangle “tail disappearance” from “perplexity degradation” using support/entropy diagnostics
**Goal:** Many papers use different metrics; unify what “collapse” means operationally.

**Action items**
- Build a metrics mapping:
  - **tail metrics**: tail probability mass, quantile gaps, effective entropy of low-prob events
  - **diversity metrics**: distinct n-grams, mode coverage, embedding dispersion
  - **quality metrics**: perplexity, FID/IS for images, task accuracy
- For a subset of papers, compute (or locate) whether collapse is:
  - primarily **support contraction** (support becomes narrower)
  - or **accuracy drift** (still diverse but wrong)
- Add diagnostic plots to your synthesis:
  - entropy vs generation
  - tail quantile ratio vs generation
  - calibration error vs generation (if available)

**Deliverable:** a “metric sensitivity” section answering: which metrics detect collapse earliest and most reliably.

---

### 1.3 Investigate decoding and generation pipeline as a control knob for recursion
**Goal:** Test whether “collapse inevitability” assumes a specific sampling regime (e.g., greedy, temperature sampling).

**Action items**
- For LLM recursive training/synthetic generation pipelines in papers, extract:
  - temperature/top‑p/top‑k
  - beam size / sampling vs deterministic decode
  - whether generation is conditioned on prompts or free-form
  - whether synthetic data is filtered by heuristics (e.g., confidence, classifier score)
- Search specifically for any paper that varies sampling/decoding across generations.
- If none exist: prioritize a controlled ablation in a small pilot (see 1.4).

**Deliverable:** a “decoding sensitivity” subsection showing whether you can slow collapse by expanding support without harming quality.

---

### 1.4 Run a small, targeted “pilot replication” plan (if allowed by project scope)
**Goal:** Because the current evidence is heavy on controlled simulations and language-only settings, add one or two minimal experiments to check generality.

**Pilot experiments (choose 2–3)**
1. **Real fraction sweep**: fix model, training steps, sampling scheme; vary real retention: 0%, 1%, 5%, 10%, 20%, 50%.
2. **Decoding sweep**: for a fixed real fraction (say 10%), vary temperature/top‑p and observe time-to-tail-cut.
3. **Schedule sweep**: same average real fraction but different schedule:
   - constant mix
   - real decays each generation
4. **Filter sweep**: compare “no filter” vs simple quality filter (e.g., classifier confidence) to see if tail shrink is reduced.

**Deliverable:** even a small pilot gives you grounding to judge theoretical vs empirical strength in the synthesis.

---

## 2) Promising hypothesis refinements (based on current evidence)

### 2.1 Refine hypothesis into a “feedback loop + support contraction” statement
Current evidence suggests:
- fully synthetic recursive loops can converge to degenerate states (mathematical certainty claims)
- early collapse loses information about tails (“tail cutting/narrowing”)
- mixing real data delays or mitigates

**Refined hypothesis (more specific):**
> Model collapse onset is governed by *support contraction* driven by recursive sampling: when synthetic training increasingly under-represents low-probability events, the next generation’s support shrinks further (positive feedback). Maintaining real data acts as an external “support injection,” preventing the contraction from reaching an absorbing/low-entropy regime.

---

### 2.2 Replace “real data helps” with “real data must prevent contracting the low-probability mass too fast”
Evidence includes claims like “synthetic must be exponentially smaller” (treat this as a lower bound on synthetic dominance tolerated).

**Refinement:**
> The critical condition is not simply the global synthetic fraction, but whether the *effective mass of the tails* (or rare modes) in the synthetic mixture stays above a threshold each generation. If tail mass drops below that threshold, contraction becomes self-reinforcing.

---

### 2.3 Hypothesize different failure modes depending on mechanism (theory vs practice)
Unresolved disagreement in the project:
- “functional approximation error” vs “statistical sampling error”
- whether intermediate generation data helps or just trades compute for slower collapse

**Refinement:**
> In controlled theory/Markov settings, collapse may be driven by contraction/absorbing states (sampling + recursion). In practice, optimization dynamics and limited model capacity can accelerate forgetting, making collapse appear earlier than theoretical support-contraction alone predicts.

---

## 3) Questions worth exploring in the project’s agent chat (copy/paste prompts)

1. **“For each mechanism (Markov absorption, tail contraction, optimization forgetting), what experimental signatures would clearly distinguish them?”**
2. **“Which papers actually measure tail behavior explicitly, and which rely mainly on perplexity or downstream task metrics?”**
3. **“Do any studies analyze collapse under different decoding strategies (temperature/top‑p/beam) or different prompt conditioning?”**
4. **“What is the best reported ‘tipping point’ ratio, and is it stated as a fixed fraction or derived from an error bound?”**
5. **“How do filtration methods (classifier/reward-model filtering, heuristic acceptance) change support contraction vs only improving quality?”**
6. **“Are intermediate generation buffers (e.g., using model snapshots or multi-step synthetic mixing) empirically shown to reduce collapse speed or just shift it?”**
7. **“Are there modality-specific results (images vs text) showing the same tail/narrowing phenomenon, and do they share a common diagnostic?”**

---

## 4) Specific papers, datasets, and methods worth investigating next

### 4.1 Priority papers to locate (directly relevant by theme)
Use these as “must-follow-up” anchors; search by title/keywords if citation IDs are not accessible.

1. **How Bad is Training on Synthetic Data? A Statistical Analysis of Language Model Collapse**
   - Extract: formal conditions, bounds on synthetic fraction, metric definitions, partially synthetic setting details.
2. **The Curse of Recursion: Training on Generated Data Makes Models Forget**
   - Extract: Markov-chain assumptions, discrete vs continuous approximation cases, characterization of absorbing states.
3. **A Tale of Tails: Model Collapse as a Change of Scaling Laws**
   - Extract: the exact tail-narrowing/scaling-law evidence; whether scaling exponents change predictably.
4. **AI models collapse when trained on recursively generated data**
   - Extract: the 10% real retention results, “repetitions” ablation outcome, any details on mixing schedule.
5. **Model Collapse Demystified: The Case of Regression**
   - Extract: regularization-level recommendations and whether the conclusions generalize beyond regression tasks.
6. **(If accessible) additional 2023–2025 follow-ups** on “synthetic data recursion,” “self-training degeneration,” “data reuse degradation,” “distributional shift feedback.”

**Method for expansion**
- From these anchor papers, do citation chaining:
  - “papers that cite these anchor papers” (forward citations)
  - “papers the anchor papers cite” (backward citations)
- Also search with queries:  
  **“recursive training synthetic data collapse tail”**, **“self-generated data degeneracy”**, **“feedback loop distribution shift language model”**, **“absorbing state collapse synthetic training”**, **“tail cutting synthetic data”**.

---

### 4.2 Datasets and evaluation benchmarks to standardize collapse measurement
Pick datasets that let you measure rare events/tails and diversity reliably.

**Text (common, scalable)**
- **Wikitext-103 / WikiText-2**: strong perplexity baselines; allows controlled rare-token analysis.
- **OpenWebText / C4 subsets**: closer to web distributions; better stress test for feedback loops.
- **The Pile subsets** (if compute allows): broader diversity.

**Long-tail / calibration-sensitive**
- Any dataset with strong class imbalance or rare-event evaluation (choose based on what the next paper uses).

**Images (to assess modality generality)**
- **CIFAR-10/100**: simple mode counting/diversity; easier to run iterative training loops.
- **ImageNet subsets** (if accessible): more realistic tails/modes but higher cost.

*(Use whatever the next empirical paper already uses to maximize comparability.)*

---

### 4.3 Methods/experiments to standardize across new work
To keep future studies comparable, define a common evaluation protocol:

1. **Support/tail diagnostics**
   - low-prob mass retention across generations
   - entropy of token distribution (or latent distribution for images)
2. **Diversity/mode coverage**
   - n-gram diversity + embedding clustering coverage (text)
   - k-means mode counts / coverage proxies (images)
3. **Quality**
   - perplexity (text), FID/IS or recall-precision (images) depending on what’s available
4. **Calibration/robustness**
   - calibration error, expected log-likelihood on rare subsets
5. **Ablations**
   - decoding strategy
   - synthetic filtering on/off
   - real retention schedule (constant vs decaying)

---

## 5) Suggested next reading order (to move fast)
1. Re-read anchors 1–4 with a spreadsheet focus on: assumptions, mixing schedule, metrics, tipping points, mitigation.
2. Pull 10–20 forward citations from those anchors and tag which ones:
   - measure tail/support explicitly
   - vary synthetic fraction schedules
   - vary decoding/generation settings
3. Choose one modality-extension target (images or another text dataset) and find at least one paper that does recursive synthetic reuse beyond LLM-only.

---

### End-state for this phase
By the end of this next steps cycle, you should have:
- a mechanism taxonomy linking theory claims to measurable signatures
- a cross-paper table of stability thresholds/schedules and collapse metrics
- a refined “critical condition” hypothesis framed as tail/support contraction vs global mixing fraction
- a short list of the most promising mitigation strategies **supported by evidence with clear diagnostics** (not just conjecture).