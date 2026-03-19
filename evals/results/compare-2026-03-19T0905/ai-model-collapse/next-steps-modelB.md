## Next steps for research: “Model Collapse From Recursive Synthetic Data Training” (2023–2025)

### 1) Concrete follow-up research directions (actionable)

#### A. Pin down the “tipping point” real:synth ratio across settings
1. Build a small benchmark suite (same model family, same tokenizer/architecture) where you can vary only the **real-to-synthetic mixing ratio** (e.g., 0%, 1%, 5%, 10%, 25% real; remainder synthetic).
2. For each ratio, run **N recursive generations** (e.g., 5/10/20 steps) and measure:
   - Tail metrics (variance of log-prob / entropy mass in extreme quantiles)
   - Diversity metrics (distinct n-grams / embedding diversity / mode coverage)
   - Downstream task performance (e.g., held-out likelihood + 1–2 simple evaluations)
3. Fit an empirical “collapse speed” curve (e.g., linear vs. exponential drop in a chosen metric over recursion steps) and extract a critical region.
4. Repeat across **modality-like proxies** (text-only is likely present in most papers; emulate “image-like” heavy-tailed behavior using different corpora or token distributions) to test whether the tipping point scales with tail heaviness.

**Deliverable:** a table mapping {modality proxy, model size (small/med/large), training objective, decoding method} → {estimated collapse threshold range}.

---

#### B. Separate “functional approximation” vs “sampling error” as the dominant mechanism
1. Identify in existing work what is attributed to:
   - approximation error (model can’t represent the synthetic distribution accurately),
   - stochastic sampling error (generated samples are noisy, creating drift),
   - optimization dynamics (catastrophic forgetting / gradient bias).
2. Design ablations in one controlled setup:
   - **Oracle generation:** instead of sampling from the current model, sample from a fixed known synthetic distribution (keeps sampling noise constant).
   - **Deterministic decoding:** replace sampling with deterministic generation to reduce variance.
   - **Perfect student:** train a model with capacity matching the “teacher” synthetic distribution (reduces approximation error).
3. Compare collapse curves. If collapse persists under reduced sampling noise, approximation/optimization likely dominates; if collapse slows dramatically, sampling noise is key.

**Deliverable:** mechanistic diagnosis based on which ablation changes the collapse rate most.

---

#### C. Test whether “intermediate generation data” merely delays collapse (not prevents it)
1. Create schedules for how synthetic data is produced and used:
   - use current-model generations only,
   - mix in generations from earlier checkpoints,
   - use a rolling buffer of K prior synthetic datasets.
2. Keep total synthetic token count fixed while varying the buffer strategy.
3. Measure whether intermediate buffers:
   - increase the **time-to-collapse** (delay),
   - or change the **asymptotic quality** (avoid collapse).

**Deliverable:** a plot of metric vs recursion step for each buffer strategy, plus a statement like “buffering changes only slope” vs “buffering changes limiting distribution.”

---

#### D. Evaluate mitigation strategies with the same “collapse lens”
Many mitigation papers evaluate downstream performance but not tail/mode behavior over recursion. To standardize:
1. Choose a small set of collapse-sensitive metrics (tail mass loss + diversity collapse + calibration).
2. Re-run mitigation methods with these metrics:
   - real-data mixing schedules (including curriculum),
   - filtering (classifier/reward model acceptance),
   - regularization levels (and non-repetition penalties, which prior work suggests can backfire),
   - architecture changes (where available).
3. Use the same recursion depth to ensure fairness.

**Deliverable:** a reproducible evaluation protocol section you can reuse for future comparisons.

---

### 2) Promising hypothesis refinements (based on evidence)

#### Hypothesis 1: Collapse is driven by “distribution contraction” (tail cutting) that compounds with recursion
Evidence already suggests tail narrowing (“tail cutting”) and that fully synthetic loops converge to degenerate/constant outcomes. Refine:
- **Refinement:** Collapse begins as **tail mass under-representation**, then compounding recursion makes the model increasingly “confident but wrong,” producing an effectively thinner support.  
- **Prediction to test:** the earliest detectable change should be **loss of extreme-quantile probability mass**, before large changes in average loss/likelihood.

#### Hypothesis 2: Maintaining real data prevents collapse by anchoring rare events / reference support
Evidence supports “stability with some percentage real.” Refine:
- **Refinement:** It’s not just “more real data,” but **coverage of rare events** (tail anchoring).  
- **Prediction to test:** stratify real mixing by importance (oversample tail-like real examples) and see if a smaller real subset achieves the same stability.

#### Hypothesis 3: Some mitigations (regularization/non-repetition) may accelerate collapse by distorting the model’s support dynamics
Evidence indicates repetition penalties can worsen perplexity and remain susceptible. Refine:
- **Refinement:** penalties that reduce support variance may unintentionally increase distribution contraction, speeding up tail loss.  
- **Prediction to test:** compare regularization types by their effect on output diversity and extreme-quantile probability mass (not only overall loss).

---

### 3) Questions worth exploring in the agent chat (for targeted literature hunting)

1. **Mechanism clarity:** In “How Bad is Training on Synthetic Data?”—what is the formal definition of collapse used (absorbing states / delta functions / statistical contraction)? Which assumptions are critical (discrete approximation? exactness vs approximation)?
2. **Empirics vs theory:** Which parts are proven only for synthetic-only training, and which parts extend to partially synthetic mixing?
3. **Ratio scaling:** Does the “exponentially smaller” synthetic requirement depend on model class, generation temperature, or how recursion is implemented?
4. **Metric alignment:** Across papers, which metrics best correlate with tail disappearance? Are they using entropy, quantile plots, extreme perplexity buckets, or coverage metrics?
5. **Decoding strategy:** Do any papers vary sampling vs beam search and report different collapse rates?
6. **Contamination effects:** Is there evidence that contaminated initial pretraining speeds collapse disproportionately (e.g., higher mutual information between initial errors and subsequent synthetic generations)?
7. **Modality transfer:** Are there any studies beyond text showing similar recursive degradation (e.g., diffusion models trained on self-generated images)?
8. **Filtering limits:** What failure modes appear when filtering synthetic samples (e.g., over-filtering leading to mode dropping)?
9. **Watermarking angle:** Are there papers (or datasets) that evaluate watermark-based filtering quantitatively in recursive training loops?

---

### 4) Specific papers, datasets, and methods worth investigating next

#### Papers to locate and re-read specifically for “what breaks collapse / what definitions are used”
1. **How Bad is Training on Synthetic Data? A Statistical Analysis of Language Model Collapse** (the one citing “cannot be avoided when training solely on synthetic data” and the partially synthetic “exponentially smaller” constraint).  
   - Extract: exact assumptions, formal definitions, and what mixing schedules keep stability.
2. **The Curse of Recursion: Training on Generated Data Makes Models Forget**  
   - Extract: their “Markov chain / absorbing state” framing and how they measure tail loss.
3. **A Tale of Tails: Model Collapse as a Change of Scaling Laws**  
   - Extract: their empirical tail-metric definitions, what scaling-law fits imply about tail contraction.
4. **AI models collapse when trained on recursively generated data**  
   - Extract: their real-preservation %, ablations for repetitions, and any ratio sensitivity plots.
5. **Model Collapse Demystified: The Case of Regression**  
   - Extract: the role of regularization level and whether their “regression framing” translates to LMs/diffusion.

*(If you already have some of these, next step is to build a one-page extraction sheet per paper: definitions, metrics, ratio schedules, collapse curves, and assumptions.)*

---

#### Datasets to consider (depending on modality)
- **Text (core):**
  - Wikitext-103 / OpenWebText-style corpora (if used for controlled recursion).
  - Common evaluation suites (for held-out likelihood and diversity proxy tasks).
- **Long-tail stress tests:**
  - Any datasets with skewed distributions or rare-event emphasis (to amplify “tail cutting” detectability).
- **If image recursion exists in 2023–2025:**
  - Look for datasets and benchmarks used in self-training / synthetic loop contexts (e.g., high-level subsets where mode coverage can be measured).
  
*(Actionable step: in your next literature pass, tag every paper by modality and by whether it reports tail metrics, not just benchmark scores.)*

---

#### Methods / experimental tools worth adding to your toolbox
1. **Tail-mass instrumentation**
   - Implement quantile bucketing of token probabilities / entropy over vocabulary (or log-likelihood on held-out rare slices).
   - Track “extreme bucket retention” over recursion steps.
2. **Mode coverage / diversity tracking**
   - Embedding-based diversity + nearest-neighbor novelty against the real training set.
3. **Recursion control experiments**
   - Fixed generator distribution (reduce sampling noise) vs live sampling.
   - Deterministic decoding variants.
4. **Filtering and selection**
   - Classifier/reward model acceptance filtering with controlled acceptance rates (sweeps).
   - Evaluate whether acceptance rate increases or decreases tail retention.

---

### Suggested ordering for the next work sprint (1–2 weeks)
1. Create the extraction sheets for the 4–5 core collapse papers above (definitions + metrics + ratio schedules).
2. Pick one text benchmark + one model family and implement the core recursion + mixing sweep (real:synthetic ratio).
3. Add two ablations immediately: deterministic vs sampling (sampling error hypothesis) and live vs oracle generation (mechanism diagnosis).
4. Only after you see a collapse threshold region, test 1–2 mitigations (e.g., real-data curriculum and one filtering method) using the same tail metrics.

---

If you share what models/datasets you already used (or plan to use), I can propose a concrete experimental matrix (grid of ratios × recursion steps × ablations) sized to your compute budget.