# Research Gaps: Model Collapse from Recursive Synthetic Data Training

This document identifies the critical uncertainties and actionable research gaps regarding the phenomenon of model collapse. It distinguishes between theoretical inevitability and empirical mitigation to guide future experimental design.

## 1. Unresolved Questions
The current evidence base leaves several operational questions unanswered for ML practitioners:

*   **The "Critical Ratio" Threshold:** While literature suggests that mixing real data (e.g., 10%) delays collapse, the exact ratio required to maintain distribution stability indefinitely remains unknown. Is there a universal "tipping point," or is this ratio dependent on the model’s parameter count and task complexity?
*   **Open-Loop vs. Closed-Loop Dynamics:** Most studies focus on "closed-loop" recursion (a model training on its own previous outputs). It is unclear if "open-loop" recursion (Model B training on Model A’s outputs) significantly alters the speed or nature of collapse, which is more representative of the current internet ecosystem.
*   **Filtering as a Substitute for Scale:** Can high-precision automated filtering (e.g., using reward models or classifiers to prune low-quality synthetic data) substitute for the theoretical requirement of "superlinear growth" in dataset size?
*   **Architecture-Specific Susceptibility:** There is an unresolved gap in how susceptibility varies across modalities. Do Diffusion models (continuous latent space) collapse differently or more slowly than LLMs (discrete token space)?

## 2. Contradictions
Direct disagreements between high-quality sources indicate areas where the "truth" depends on specific training assumptions:

*   **Inevitability vs. Manageability:** 
    *   *Position A (Shumailov et al.):* Model collapse is an inherent law driven by statistical resampling error; it leads to an "absorbing state" where the model eventually produces zero-variance output.
    *   *Position B (Gerstgrasser et al.):* Collapse is a methodological artifact of "data replacement." Under "data accumulation" (retaining all previous real data), test error remains bounded and collapse is avoided.
*   **Growth Requirements:**
    *   *Claim:* Mathematical stability requires a **superlinear growth schedule** of the training dataset at each generation to counteract information loss.
    *   *Counter-claim:* Data accumulation alone is sufficient to shrink the impact of synthetic noise (proportional to $1/i^2$), making fixed-ratio mixing potentially viable without exponential data growth.
*   **Regularization Effects:**
    *   Some evidence suggests adaptive regularization can mitigate collapse, while other studies show that standard regularization (optimal for real data) actually accelerates catastrophic failure in recursive settings.

## 3. Weak Evidence Areas
The following claims rely on limited empirical validation or narrow theoretical frameworks:

*   **Generalizability of VAE Findings to LLMs:** Much of the mathematical proof for "tail disappearance" is derived from Variational Autoencoders (VAEs) or simple regression models. Empirical evidence that these exact mathematical drivers (functional approximation error) scale identically to trillion-parameter LLMs is currently thin.
*   **Long-Horizon Stability:** Most empirical studies track 5–10 generations. Claims about "indefinite" stability or "inevitable" collapse at generation 100+ are largely extrapolated from short-term trends or simplified mathematical models.
*   **Efficacy of "Fresh" Data Influx:** While the hypothesis suggests that a continuous stream of new real-world data prevents collapse, there is little empirical data quantifying the *minimum volume* of fresh data needed per generation to offset the entropy loss of synthetic inputs.

## 4. What Would Change Confidence
Specific evidence or study results that would materially shift the current synthesis:

*   **A "Perpetual Motion" Study:** An empirical demonstration of a model trained on 90%+ synthetic data for 50+ generations that maintains its original tail distribution (diversity) and perplexity. This would effectively disprove the "inevitability" hypothesis.
*   **Cross-Model Contamination Analysis:** A study showing that Model B collapses faster when trained on Model A's synthetic data than Model A does on its own. This would shift the focus from "self-collapse" to "ecosystem-wide degradation."
*   **Scaling Law for Synthetic Data:** The discovery of a formal scaling law that relates the percentage of synthetic data to the required increase in model capacity or training compute to maintain parity with real-data models.
*   **Proof of "Synthetic Enrichment":** High-quality evidence showing that synthetic data from a superior "teacher" model can permanently improve a "student" model across multiple recursive generations without eventually hitting a performance ceiling.