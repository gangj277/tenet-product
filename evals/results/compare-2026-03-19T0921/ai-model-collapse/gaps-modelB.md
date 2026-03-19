# gaps.md — Uncertainty & Evidence Gaps for “Model Collapse From Recursive Synthetic Data Training”

## 1) Unresolved questions (evidence does not settle)

1. **Where is the quantitative “tipping point” for real-vs-synthetic mixing?**
   - Evidence suggests stability improves when real data is preserved (e.g., ~10% real retention), but:
     - The *exact* threshold (and whether it’s linear, exponential, or task-dependent) is not pinned down across settings.
   - **Actionable gap:** Determine the critical real-data fraction/rate as a function of:
     - generation model quality (or fidelity to target distribution),
     - corruption/noise level,
     - dataset size,
     - model capacity and training hyperparameters,
     - sampling strategy used to generate synthetic data.

2. **Which error source dominates: “functional approximation error” vs “statistical sampling error”?**
   - Consolidated findings flag an unresolved disagreement on the *primary driver* of collapse.
   - **Actionable gap:** Produce/collect experiments and/or theory that isolate:
     - approximation error (e.g., by controlling model class expressivity / capacity, training loss floors),
     - sampling error (e.g., by increasing synthetic sample counts per loop, reducing variance in generation),
     - and measuring how collapse speed scales with each knob.

3. **Does using intermediate generation data delay collapse in practice or merely shifts compute?**
   - One unresolved issue: intermediate synthetic data may help, but could also just trade more compute for a slower degradation.
   - **Actionable gap:** Compare these regimes with matched total compute:
     - direct recursion (train on newest synthetic outputs),
     - recursion with intermediate buffers,
     - recursion with periodic resets / refresh schedules,
     - evaluate time-to-tipping and long-horizon diversity metrics.

4. **How do collapse dynamics depend on decoding/sampling strategy?**
   - The working subquestion asks about top-p vs beam search (and by extension stochasticity/temperature).
   - **Actionable gap:** Map collapse trajectories under controlled sampling differences:
     - temperature/top-p schedules,
     - beam width,
     - stochastic decoding vs deterministic decoding,
     - and connect these to tail metrics and mode metrics.

5. **How modality-specific is susceptibility to collapse?**
   - Open question: text vs image vs tabular.
   - **Actionable gap:** Acquire matched-condition studies across modalities:
     - same recursive loop structure (generator→synthetic dataset→retrain),
     - compare collapse signatures (tail loss, mode dropping, calibration drift),
     - test whether the same mathematical mechanisms apply.

6. **Can synthetic-data filtering at web scale be made reliable (e.g., watermarking)?**
   - Watermarking is proposed as a potential lever but not settled.
   - **Actionable gap:** Evidence needs to show:
     - filtering precision/recall at realistic rates (including adversarial or distribution-shifted synthetic content),
     - robustness to spoofing / partial watermark removal,
     - effect on end-to-end downstream collapse metrics.

7. **Which metrics best predict early-stage collapse (and when)?**
   - Tail disappearance / tail cutting is supported, but it’s unclear what generalizes as an *early warning signal*.
   - **Actionable gap:** Systematically benchmark candidate metrics:
     - entropy / perplexity trends,
     - tail mass / quantile coverage,
     - calibration and representation drift,
     - downstream task robustness,
     - and identify whether any metric consistently forecasts future collapse.

---

## 2) Contradictions (sources directly disagree)

1. **Strength of collapse inevitability vs role of mixing**
   - **Support for inevitability:** “model collapse cannot be avoided when training solely on synthetic data” and Markov-chain-style convergence to degenerate states are reported with high confidence.
   - **Support for mitigation:** mixing real data can lead to “only minor degradation,” and mixing “ensures stability over generations.”
   - **Where the tension remains:** Even if full collapse is inevitable in the purely synthetic case, the contradiction is about:
     - *how quickly* collapse occurs under partial synthetic training,
     - and whether “minor degradation” can persist at long horizons and different scales.
   - **Actionable resolution:** Long-horizon experiments with consistent definitions of “collapse” (diversity loss thresholds, tail thresholds, and downstream degradation tolerances).

2. **Synthetic-data ratio requirement: “~10% real is enough” vs “synthetic must be exponentially smaller.”**
   - One source claims stability with about **10% preserved original data** (“only minor degradation”).
   - Another claims synthetic proportion should be **exponentially smaller** to keep the distribution close to the real baseline.
   - **Actionable resolution:** Reconcile by identifying which assumptions differ:
     - data generation fidelity,
     - loop length,
     - model architecture/capacity,
     - whether metrics are local (short horizon) vs asymptotic (long horizon),
     - and whether “close to baseline” is measured in KL/TV distance, or inferred from downstream performance.

3. **Effectiveness of regularization/non-repetition penalties**
   - One result suggests **adaptive regularization** may mitigate learning on AI-generated data (confidence medium-to-high depending on task).
   - Another ablation reports **non-repetition penalties worsen perplexity (~doubling)** and models remain susceptible (possibly worse).
   - **Actionable resolution:** Determine whether these interventions:
     - help under certain model families/tasks only,
     - increase bias in a way that accelerates degeneracy,
     - or fail because they don’t address the core distribution drift mechanism.
   - Compare interventions under controlled generation fidelity and keep total training objective budget constant.

4. **What mechanism causes collapse**
   - Contradiction is between:
     - **functional approximation error** dominating vs
     - **statistical sampling error** dominating.
   - **Actionable resolution:** Require ablation studies where variance is reduced without changing approximation capacity (and vice versa).

---

## 3) Weak evidence areas (claims relying on thin/low-quality evidence)

1. **Architectural interventions evidence may be task-specific**
   - GAN-related mitigation claims (e.g., enforcing one-to-one mapping) are likely tailored to a specific domain/task (e.g., human motion prediction).
   - **Weakness:** Limited external validity to LLM-like settings and to other generative families.
   - **Actionable improvement:** Replicate architecture-level mitigations in more than one modality or at least in an LLM-style recursion setting.

2. **Quantitative guidance on ratios may be sensitive to experimental design**
   - “10% real data” and “exponentially smaller synthetic” are both high-confidence within their own contexts.
   - **Weakness:** The consolidated evidence doesn’t show a unified scaling law or consistent metric definitions across papers.
   - **Actionable improvement:** Standardize the evaluation protocol:
     - same mixing schedule definition (fixed ratio vs decaying),
     - same number of recursive iterations,
     - same divergence/distance metrics,
     - same capacity regime.

3. **Metric generalization beyond tail loss is unclear**
   - Tail disappearance/tail narrowing is supported, but it’s not shown that these are always the earliest and most predictive signals.
   - **Weakness:** Risk that conclusions depend on metric choice and granularity.
   - **Actionable improvement:** Evaluate multiple metrics concurrently and compute lead-lag relationships (which metric rises first as collapse approaches).

4. **Open-web dynamics are underrepresented**
   - Evidence is described as heavily theoretical and simulation-based.
   - **Weakness:** Synthetic web data may be produced by mixtures of models, with evolving generators, filtering pipelines, and adversarial content.
   - **Actionable improvement:** Simulate more realistic data acquisition pipelines:
     - imperfect tagging/watermark detection,
     - mixed provenance,
     - evolving generation quality over time.

5. **Watermarking effectiveness is only an open suggestion**
   - No consolidated strong empirical support is provided for watermarking enabling robust automated filtering that prevents collapse.
   - **Actionable improvement:** Collect end-to-end evidence where watermark-based filtering is actually used in recursive training loops.

---

## 4) What would change confidence (specific evidence/studies needed)

1. **Long-horizon, compute-matched recursion benchmarks across real-vs-synthetic schedules**
   - Needed to resolve:
     - whether “minor degradation” persists asymptotically,
     - and the true dependence of collapse rate on real-data fraction.
   - **Key features to request/collect:**
     - fixed synthetic ratio vs scheduled refresh (e.g., periodic full real refresh),
     - controlled generation fidelity,
     - report time-to-tipping for diversity/tail metrics and downstream benchmarks.

2. **Experiments that isolate approximation vs sampling error**
   - **To increase confidence in the dominant mechanism**, run paired studies where:
     - sampling variance is reduced (more synthetic samples per batch, better stochasticity control),
     - while keeping model capacity constant (approximation error fixed),
     - and conversely, model capacity/architecture is varied while sampling variance is held constant.
   - Measure how collapse speed scales in each direction.

3. **Cross-modality replication of the same recursive loop protocol**
   - **To answer modality susceptibility**, replicate the recursion framework in:
     - text (decoder-only / encoder-decoder),
     - images (diffusion/GAN),
     - tabular (diffusion/boosted generative models),
   - using comparable “tail/mass/mode” proxies for each modality.

4. **Standardized metric suite + early-warning forecasting**
   - **To answer “which metrics are most sensitive early”**, require studies that:
     - track multiple diversity and distribution-shift metrics per iteration,
     - compute which metric best predicts future collapse (e.g., earliest significant change),
     - and validate across datasets/tasks.

5. **End-to-end evaluation of filtering mechanisms (including watermarking)**
   - **To test whether collapse can be prevented at web scale**, need evidence that:
     - automated provenance filtering reduces effective synthetic contamination,
     - filtering precision/recall is quantified,
     - and the end-to-end recursive training loop shows reduced tail loss and delayed collapse.

6. **Ablations on decoding/sampling strategy effects**
   - **To resolve the uncertainty about top-p/beam search**, need controlled experiments varying only decoding randomness while keeping the training/evaluation fixed.
   - Report how collapse metrics evolve as stochasticity is increased/decreased.

7. **General (not task-specific) architectural mitigations**
   - **To raise confidence beyond medium**, architectural/regularization ideas should be tested in:
     - both small/large model regimes,
     - and at least two tasks/domains,
     - with controlled compute budgets and consistent recursion depth.

--- 

## Summary of the most actionable “next data to collect”
- A single unified protocol that varies **real-data fraction/schedule**, **loop depth**, and **decoding strategy**—measuring **tail/diversity metrics and downstream task degradation** over time.
- Mechanism-separating experiments (approximation vs sampling) with explicit variance/capacity controls.
- Cross-modality replication using the same recursion framework.
- End-to-end studies of **filtering/provenance** approaches (especially watermark-based filtering) within recursive training, not just as a theoretical safeguard.