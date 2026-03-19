## Next steps: follow-up research directions (actionable)

### 1) Pin down the “tipping point” quantitatively (real:synth ratio / schedule)
- **Do a targeted literature sweep** specifically for experiments that vary the fraction of real data (e.g., 1%, 5%, 10%, 20%, 50%) during recursive synthetic fine-tuning.
- **Extract a comparable stopping condition** across papers:
  - “tail mass” loss (e.g., entropy drop, truncation of rare events)
  - or benchmark degradation (perplexity, FID, recall@k, diversity metrics).
- **Build a small meta-table**: dataset/modality, model class, generator sampling method, real fraction, training steps/generations, and the observed “collapse time” (number of generations until metric crosses threshold).
- **Goal:** estimate whether the mitigation threshold scales like:
  - linear in error rate,
  - logarithmic in generation depth,
  - or exponentially small synthetic dominance (as suggested by at least one theoretical result).

### 2) Separate “functional approximation error” vs “statistical sampling error”
- Identify papers that attribute collapse to:
  - inaccurate modeling of the target distribution (approximation),
  - versus stochastic finite-sample effects (sampling noise),
  - versus compounding of both.
- **Reproduce/extend the experiments with controlled knobs**:
  - Increase synthetic dataset size while keeping generator quality constant (tests sampling).
  - Increase generator model capacity while keeping synthetic size constant (tests approximation).
  - Vary batch size / number of synthetic samples per generation (tests sampling variance).
- **Deliverable:** a short set of conclusions like “sampling error dominates when X; approximation dominates when Y,” ideally with empirical evidence.

### 3) Test the role of the generation policy (top-p, temperature, beam, rejection sampling)
- **Collect any experiments** that keep architecture/training fixed but change decoding/sampling.
- **Run a controlled grid** (if you can run experiments later) with decoding strategies that change the support and tail behavior:
  - low temperature vs high temperature
  - nucleus sampling p ∈ {0.9, 0.95, 0.99}
  - beam vs sampling (beam often collapses support)
  - sampling with/without diversity-promoting penalties
- **Hypothesis to test directly:** collapse accelerates when the recursion pipeline systematically **narrows support** (tail cutting) more than it corrects it.

### 4) Evaluate whether “intermediate mixing” just slows collapse or truly changes fixed points
- The evidence likely includes claims that mixing real data helps, but there may be disagreement on whether intermediate generation data helps (trade compute for slower collapse).
- **Look specifically for “generation depth” analyses**:
  - collapse observed after generation k (k=1,2,5,10…)
  - and whether the limiting distribution converges to a non-trivial stationary distribution when real mixing continues.
- **Action:** extract whether any methods change the asymptotic behavior (stationary point) rather than only delaying it.

### 5) Investigate the “absorbing state” / Markov chain assumptions in practical ML training
- At least one theoretical result frames recursive training as a Markov chain with delta-function absorbing states.
- **Do a realism audit**:
  - Under what assumptions do real training dynamics violate the theory? (finite capacity, SGD noise, regularization, early stopping, optimizer states)
  - Does the theory apply to conditional generation, diffusion, or only discrete distributions / simplified transformers?
- **Deliverable:** a section classifying which assumptions are likely violated in modern LLM/image training, and how that might change collapse guarantees.

### 6) Extend beyond text to at least one other modality (where possible)
- Since tail behavior is modality-dependent, confirm if collapse signatures replicate:
  - **Images:** diversity reduction (e.g., FID increases, mode coverage decreases)
  - **Audio/tabular:** distributional drift + calibration degradation
- **Action:** search for recursive/synthetic reuse experiments in diffusion/GAN training loops.

---

## Promising hypothesis refinements (based on current evidence)

1) **Refined threshold hypothesis**
- Replace the binary “inevitable vs avoidable” with:
  - *Collapse occurs when synthetic training induces a contraction mapping over the distribution in the relevant metric (tail entropy / support coverage), unless real data maintains expansion of the distribution mass.*
- Operationalize: identify which metric in the papers behaves like a “distance” contraction under recursion.

2) **Support-narrowing is the proximal cause**
- Evidence on “tail cutting/tail narrowing” suggests a refined mechanism:
  - collapse is primarily driven by **loss of probability mass in rare events** due to sampling/training on a narrower support,
  - not just generic overfitting.
- Prediction: methods that explicitly preserve tail mass or rare-event coverage should slow collapse more reliably than generic regularization.

3) **Real-data mixing works because it re-injects “missing support,” not because it corrects gradients globally**
- Evidence indicates a small real-data fraction yields only minor degradation, suggesting that:
  - real examples serve as a “support anchor” preventing the recursion from drifting into a low-support fixed point.
- Prediction: mixing strategy that targets only the hardest/rarest regions (if identifiable) should be more efficient than uniform mixing.

4) **Some “mitigations” can backfire by worsening support contraction**
- Given the ablation where non-repetition penalties worsened perplexity and increased susceptibility, refine:
  - penalties that suppress diversity can unintentionally increase tail cutting, accelerating collapse.

---

## Questions worth exploring in the agent chat (use these verbatim)

1) “Which paper(s) provide the strongest *quantitative* relationship between synthetic fraction and collapse time, and what exact collapse metric do they use?”
2) “Can we map the ‘absorbing state’ theoretical proof assumptions to practical training details (SGD, finite capacity, regularization, early stopping) and identify what breaks the guarantee?”
3) “Across modalities, do collapse signatures align more with entropy/tail loss or with task performance degradation?”
4) “What is the best evidence for ‘functional approximation vs sampling noise’ being the dominant factor in recursive synthetic loops?”
5) “Are there methods that preserve rare events without requiring massive real-data fractions (e.g., stratified/importance mixing, uncertainty-based selection, calibration-based filtering)?”
6) “Which decoding strategies empirically maximize tail coverage in recursive generation pipelines (temperature/top-p schedules)?”
7) “Do any mitigation approaches change the asymptotic stationary distribution (true fixed-point shift), not just delay collapse?”

---

## Specific papers, datasets, and methods to investigate next

### Papers explicitly already supported (prioritize close reading + extraction)
1) **How Bad is Training on Synthetic Data? A Statistical Analysis of Language Model Collapse**  
   - Focus next on: the partially synthetic threshold claim (“exponentially smaller synthetic”) and the exact mechanism used to prove inevitability in fully synthetic settings.
   - Extract: their definition of collapse metrics and how they measure “stability over generations.”

2) **The Curse of Recursion: Training on Generated Data Makes Models Forget**  
   - Focus next on: the “absorbing state / delta function” argument and their tail/distribution-forgetting definitions.
   - Extract: mathematical conditions (e.g., discrete distributions with exact approximation) and what regimes might be most fragile.

3) **AI models collapse when trained on recursively generated data**  
   - Focus next on: the empirical “preserve ~10% real data” result, ablations on repetition penalties, and whether collapse is tied to tail narrowing vs general accuracy loss.

4) **A Tale of Tails: Model Collapse as a Change of Scaling Laws**  
   - Focus next on: their scaling-law evidence and how it ties to tail cutting/tail narrowing over generations.

### Likely-matching mitigations to mine (regularization/selection/filtering)
5) **Papers on data filtering / quality scoring for synthetic web-scale corpora**
   - Search targets (keywords): “synthetic data filtering,” “data contamination,” “quality estimation,” “reward-model filtering,” “deduplication effects on collapse,” “calibration/uncertainty filtering.”
   - Method to extract: selection criterion and how it affects tail mass preservation.

6) **Distillation/iterative self-training literature**
   - Keywords: “self-training collapse,” “pseudo-label confirmation bias,” “iterative distillation,” “teacher-student recursion,” “error amplification.”
   - Why: can provide alternate theory for recursion failure modes that may map cleanly to synthetic loops.

### Datasets / benchmarks worth using (for comparability)
- **Language:** Wikitext-103, C4-derived benchmarks (if used), domain-shift evals like **Hellaswag / ARC** for diversity-perf tradeoffs (only if papers use similar setups).
- **Images:** ImageNet subsets or datasets commonly used in diffusion/GAN recursion studies; track diversity/mode coverage with metrics used in ML image literature (FID/IS, precision/recall for generative models).
- **General:** any dataset where low-probability tails are measurable (or where sampling-based tail metrics are used in the synthetic-data papers you already found).

### Methods to add to your toolbox
- **Tail metrics replication:** entropy of next-token distributions, rare-event recall, support size approximations, distributional distance (e.g., JS divergence on binned events).
- **Mode/coverage metrics for generative models:** precision/recall for generative models, precision-recall curves, minibatch discrimination variants (depending on modality).
- **Ablation design templates:**
  - keep total compute fixed while varying real fraction
  - keep synthetic fraction fixed while varying decoding policy
  - vary synthetic generator quality independently from downstream training quality

---

## Concrete deliverables for the next work session
1) **Create a “collapse evidence matrix”** (one table) extracting: real fraction, generations/iterations, decoding policy, collapse metric(s), and whether results are theoretical or empirical.
2) **Write a 1–2 page “mechanism map”** aligning: (a) theory assumptions, (b) empirical tail-narrowing evidence, (c) practical training dynamics that likely violate assumptions.
3) **Select 2–3 high-priority replication experiments** (from sections 1–4) that can directly resolve the open disagreement: approximation vs sampling noise; and fixed-point change vs delayed collapse.