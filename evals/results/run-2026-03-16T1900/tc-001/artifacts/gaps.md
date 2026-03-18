# Gaps in Research: Model Collapse from Recursive Synthetic Data Training

This document outlines the current state of uncertainty regarding model collapse. While the phenomenon is empirically observed, the transition from theoretical models to production-scale mitigation remains poorly defined.

---

### 1. Unresolved Questions
These questions represent the "known unknowns" that prevent a definitive engineering framework for synthetic data usage:

*   **The Critical Threshold Problem:** While "mixing" is a known mitigation, there is no consensus on the minimum ratio of real-to-synthetic data required to maintain distributional stability. Does this threshold scale linearly with model parameter count, or is it dependent on the entropy of the training distribution?
*   **Sampling Strategy Impact:** Current literature focuses heavily on the *content* of synthetic data. There is insufficient evidence on how inference-time sampling (e.g., temperature scaling, top-p, top-k) during the generation of synthetic training sets accelerates or delays the onset of collapse.
*   **Architectural Sensitivity:** It is unclear if specific architectures (e.g., Mixture of Experts vs. Dense Transformers) are inherently more resilient to the "statistical washing" of tail-end data.

### 2. Contradictions
These areas of disagreement indicate that "model collapse" may be a multi-faceted problem rather than a single phenomenon:

*   **Avoidance vs. Delay:** There is a fundamental disagreement on whether data accumulation *prevents* collapse or merely *decelerates* it. Some studies suggest that even with accumulation, diversity metrics (e.g., variance in VAE latent spaces) continue to degrade, suggesting that "stability" may be a temporary state rather than a permanent fix.
*   **The Role of Expressivity:** Some models suggest that higher model expressivity helps capture complex distributions, while others argue that increased expressivity allows the model to "overfit" to the noise of the previous generation more aggressively, thereby accelerating collapse.

### 3. Weak Evidence Areas
Claims in these areas currently rely on simplified assumptions that may not hold in production environments:

*   **Gaussian/Linear Simplifications:** Much of the mathematical proof for collapse relies on Gaussian or simple linear regression models. There is a lack of empirical validation confirming that these theoretical decay rates translate to high-dimensional, non-linear LLM training runs.
*   **Regularization Efficacy:** While it is known that standard regularization (optimal for real data) can cause divergence in synthetic loops, there is a lack of research on "synthetic-aware" regularization techniques. Current evidence is limited to identifying the failure mode rather than providing a robust alternative.

### 4. What Would Change Confidence
To move from theoretical observation to actionable engineering, the following evidence is required:

*   **Scaling Laws for Synthetic Data:** A study mapping the "real-data-to-synthetic-data ratio" against model performance across multiple generations (G1–G10) for models >7B parameters. This would define the "stability frontier."
*   **Comparative Analysis of Sampling:** A controlled experiment comparing the collapse rates of models trained on synthetic data generated via greedy decoding (temp=0) vs. high-entropy sampling (temp=1.0). This would clarify if stochasticity acts as a buffer against collapse.
*   **Standardized Metrics:** The field currently conflates "mode collapse" (GAN-style) with "model collapse" (recursive degradation). Establishing a standardized metric for "distributional drift" (e.g., KL-divergence of output distributions against a held-out real-world benchmark) would allow for cross-study comparability.
*   **Empirical Validation of Mitigation:** Evidence that architectural interventions (e.g., Truncated Cross Entropy or specific weight-decay schedules) can maintain performance parity with a "real-data-only" baseline over 5+ generations.