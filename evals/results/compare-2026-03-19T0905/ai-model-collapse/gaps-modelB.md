## Gaps & Uncertainty (Model Collapse From Recursive Synthetic Data Training)

This document makes the current evidence gaps actionable: what remains unknown, where sources conflict, which claims lean on weak/limited evidence, and what specific new evidence would materially change the synthesis.

---

## 1) Unresolved questions — what the evidence does not settle

### A. The “tipping point” (critical real:synthetic ratio) is not characterized across settings
- **Evidence status:** One source indicates that mixing real data prevents/limits collapse and suggests a threshold-like condition (“exponentially smaller” synthetic relative to real) for stability in a specific theoretical setting.
- **What’s missing:** A **practical, modality- and architecture-parameterized** estimate of the critical ratio (or a curve of collapse onset time vs. ratio) for:
  - Text LMs vs. image diffusion/GANs vs. tabular
  - Different generation backends (sampling temperature, top-p, beam, etc.)
  - Different training objectives (MLE vs. adversarial vs. RLHF-like)
- **Actionable gap:** We need experiments that vary **real:synth mixing ratios** systematically and report **collapse onset time**, not just final performance.

### B. Mechanism: which error accumulates to cause collapse (and under what assumptions)?
- **Open question:** Whether the dominant driver is:
  - **Functional approximation error** (model class can’t represent the evolving synthetic distribution), or
  - **Statistical sampling error** (finite sampling leads to drift, tail loss, and reinforcement of bias), or
  - Both, with different regimes.
- **Why it matters:** Different mechanisms imply different mitigation:
  - If approximation error dominates → capacity/regularization/architecture matters more.
  - If sampling error dominates → data mixing/filtering/variance reduction matters more.
- **Actionable gap:** We need ablations and/or controlled studies that hold model capacity constant while changing sampling noise, and vice versa.

### C. Recursion depth/time-to-collapse: what matters besides “exclusive vs mixed”?
- **Open question:** Does collapse occur after a fixed number of generations/iterations, or does it depend on:
  - Learning rate schedules
  - Re-fitting frequency
  - Whether training uses synthetic inputs conditioned on real prompts or unconditional generation
  - The synthetic generation policy (and whether it changes over time)
- **Actionable gap:** Standardize evaluation so “generation step” corresponds to comparable compute and policy changes across papers.

### D. Interventions beyond mixing: are they generally helpful or mostly case-specific?
Evidence hints at mitigations (filtering, regularization), but the generality is unclear.
- **Open question:** Which mitigations reliably prevent **tail disappearance** rather than merely improving some average metric?
- **Actionable gap:** Evaluate mitigations with **distribution-shape metrics** (entropy/tails) and not only downstream benchmark scores.

### E. Automated synthetic-data provenance signals (e.g., watermarking) are unvalidated for collapse prevention
- **Open question:** Whether watermarking (or provenance metadata) can support robust, scalable filtering that actually changes collapse outcomes under realistic pipeline constraints.
- **Actionable gap:** End-to-end pipeline studies (generation → dataset construction → filtering → recursive training) that quantify collapse differences.

---

## 2) Contradictions — where sources directly disagree

### Contradiction 1: “Regularization/non-repetition penalties prevent collapse” vs. “they may worsen collapse”
- **Claim A (mitigation framing):** Regularization can mitigate negative effects from learning on synthetic data.
  - Supported by: “Model Collapse Demystified: The Case of Regression” (regularization at appropriate level).
- **Claim B (counterevidence):** Enforcing non-repetition penalties caused worse performance and did **not** reduce susceptibility; models remained susceptible “if not more.”
  - Supported by: “AI models collapse when trained on recursively generated data” (ablation on repetitions).
- **Why unresolved:** The contradiction likely reflects:
  - Different kinds of “regularization” (targeted vs generic)
  - Different penalty implementations
  - Different tasks/models
  - Whether the intervention actually addresses distribution drift/tail loss vs superficial behavior constraints.
- **Actionable resolution needed:** A controlled comparison of:
  - Regularization type (weight decay/dropout vs functional penalties)
  - Whether it preserves tail statistics
  - Whether it changes the collapse rate (not just one metric)

### Contradiction 2: “Collapse is inevitable” vs. “mixing real data ensures stability over generations”
These are not fully contradictory in a strict logical sense, but **they conflict on what is required** for practical stability:
- **In inevitability framing:** collapse cannot be avoided with **fully synthetic** training.
- **In mitigation framing:** mixing real data yields stability over generations.
- **But:** another statement suggests synthetic must be **exponentially smaller** than real for stability, which is potentially incompatible with “practical stability” unless ratios are extremely favorable.
- **Actionable resolution needed:** Convert theory’s “exponentially smaller” condition into empirically grounded thresholds (or show it’s an artifact of simplifying assumptions).

---

## 3) Weak evidence areas — claims that rely on thin or low-quality evidence

### A. “Architectural interventions” evidence is task-specific and not generalizable
- The GAN/HMP-GAN reference about regressing an extrinsic vector to enforce one-to-one mapping is **not directly a recursive synthetic-data collapse benchmark** for generative models trained on their own outputs.
- Risk: the mitigation may be about **mode collapse in GANs** rather than **distribution drift/forgetting in recursive synthetic training**.
- **Gap:** Need direct evidence linking the architecture change to recursive-loop stability under synthetic-dominant training.

### B. “Metrics of collapse” sensitivity is not settled
- Tail disappearance is supported, but which **measurement suite** best predicts early collapse is unclear:
  - V-measure/entropy vs FID/perplexity vs tail-based statistics
- **Gap:** Few studies likely calibrate “early warning” metrics across modalities and datasets.

### C. Extrapolating from controlled simulations to open-web pipeline dynamics
- The “statistical analysis” and Markov-chain style proofs demonstrate inevitability under model assumptions.
- Weakness: open pipelines include:
  - deduplication
  - filtering
  - mixture-of-policies generation changes
  - data provenance enforcement
  - nonstationary training corpora
- **Gap:** more empirical work that intentionally imitates real pipelines is needed to validate whether theoretical “inevitability” manifests at realistic scales.

### D. The “intermediate generation data helps” vs “just slows collapse”
- The consolidated findings indicate an unresolved disagreement: intermediate generation may help or merely trade compute for delay.
- **Weakness:** Without standardized evaluation of collapse rate and not just endpoint quality, the evidence is likely underdetermined.

---

## 4) What would change confidence — specific evidence/studies that would materially affect the synthesis

### A. High-priority study: phase diagram of collapse vs real:synth ratio (and generation policy)
**What to do**
- Run controlled recursive training loops with systematic sweeps over:
  - real:synth mixing ratio (e.g., 100/0, 90/10, 80/20, 50/50, 10/90…)
  - generation sampling settings (temperature/top-p/beam)
  - training objective variants (MLE-only vs RL-style)
- Measure:
  - **time-to-collapse** (iterations/generations until tail metrics degrade)
  - tail metrics (entropy over bins, tail mass beyond thresholds)
  - diversity metrics beyond single scores (e.g., calibration curves)
**Why it changes confidence**
- It converts “exponentially smaller” or “10% is enough” into an empirically supported boundary and resolves whether stability is practical.

### B. Mechanism-resolving ablations: separate approximation vs sampling error
**What to do**
- Hold architecture/capacity fixed while varying:
  - synthetic sample size per batch (reduce sampling variance)
  - generation noise level
- Conversely vary capacity while holding sampling settings constant.
- Track whether collapse correlates more strongly with:
  - representational mismatch to the evolving distribution (approximation)
  - variance/drift from finite sampling (sampling)
**Why it changes confidence**
- It determines what mitigation strategies should prioritize (capacity/filtering vs variance reduction/mixing).

### C. End-to-end synthetic provenance + filtering experiments (including watermarking or classifier filtering)
**What to do**
- Implement a pipeline with:
  - synthetic generation policy
  - automatic filtering based on provenance signals
  - recursive training for multiple generations
- Report whether filtering:
  - prevents tail narrowing
  - maintains downstream diversity metrics
  - delays/avoids collapse at web-scale-like settings
**Why it changes confidence**
- It tests whether proposed mitigations work under realistic constraints, not just idealized filtering.

### D. Counterfactual evaluation of “regularization/non-repetition” interventions
**What to do**
- Use the same recursive setup and compare:
  - baseline training
  - generic regularization (weight decay/dropout)
  - targeted “non-repetition” penalties
- Evaluate both:
  - average performance (perplexity/FID)
  - tail/diversity metrics
**Why it changes confidence**
- It resolves the contradiction about whether regularization is helpful in general or only in specific forms.

### E. Modality transfer tests
**What to do**
- Replicate the recursive collapse experiments across at least:
  - one text model
  - one image generative model
  - one non-image modality (if feasible)
- Apply consistent metrics and ratio schedules.
**Why it changes confidence**
- It determines whether the critical conditions are universal or modality-dependent.

---

## Summary: Most important gaps to close next
1. **Empirical collapse phase diagram** vs real:synth ratio, generation policy, and modality.
2. **Mechanism clarification** (approximation vs sampling error) via targeted ablations.
3. **Generalizability tests** for mitigations (regularization type, architecture changes, filtering/provenance).
4. **Early-warning metrics** calibration to predict collapse before downstream benchmarks fully degrade.

If you want, I can convert these into a prioritized reading/execution checklist (what to extract from each paper: ratios used, loop definition, sampling settings, tail metrics, and intervention details).