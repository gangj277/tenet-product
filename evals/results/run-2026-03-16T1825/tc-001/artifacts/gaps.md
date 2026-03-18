# Gaps in Research: Model Collapse from Recursive Synthetic Data

This document outlines the current limitations in our understanding of model collapse. While the literature establishes that recursive training on purely synthetic data leads to degradation, the conditions for stability remain contested.

### 1. Unresolved Questions
These areas represent fundamental unknowns that prevent the formulation of a "safe" synthetic training protocol:
*   **The "Avoidance vs. Delay" Threshold:** It is unclear if data accumulation (mixing real and synthetic data) truly prevents collapse or merely shifts the degradation to a slower, logarithmic trajectory. We lack a definitive proof of long-term stability for large-scale models.
*   **Sampling Strategy Impact:** There is no consensus on how generation parameters (e.g., temperature, top-p, top-k) influence the rate of collapse. We do not know if deterministic generation (temp=0) accelerates the "narrowing" of the distribution compared to stochastic sampling.
*   **Cross-Modality Generalization:** Most theoretical proofs rely on linear models or simple language tasks. It is unknown if the "curse of recursion" manifests identically in high-dimensional modalities like diffusion-based image generation or multi-modal latent spaces.
*   **Capacity vs. Noise:** It is currently unknown if increasing model capacity (width/depth) can effectively "absorb" the noise introduced by synthetic data, or if capacity increases simply delay the inevitable loss of tail-end distributional information.

### 2. Contradictions
The following points of disagreement in the literature suggest that "model collapse" is highly sensitive to experimental setup:
*   **Accumulation Efficacy:** Some studies (e.g., *Is Model Collapse Inevitable?*) argue that accumulating data provides a finite upper bound on test error, while others (e.g., Alemohammad et al.) suggest this only slows the process.
*   **Architecture Sensitivity:** There is a conflict between findings in language models (where accumulation shows high stability) and VAEs/smaller architectures (where test error increases despite accumulation). This suggests that the "collapse" phenomenon may be architecture-dependent rather than a universal property of recursive training.

### 3. Weak Evidence Areas
Claims in these areas should be treated as high-risk for production pipelines:
*   **The 2–10% "Magic Number":** While several papers suggest that mixing 2–10% real data mitigates collapse, this evidence is largely empirical and task-specific. There is no theoretical framework explaining why this specific ratio is effective or if it scales with model size.
*   **Functional Approximation Error:** The role of functional approximation error is poorly characterized. Current literature focuses heavily on statistical error (finite samples), leaving the impact of model-specific architectural biases on recursive loops under-researched.

### 4. What Would Change Confidence
To move from a state of "mitigation by trial-and-error" to a robust engineering standard, the following evidence is required:
*   **Long-Horizon Benchmarks:** Empirical studies extending beyond 5–10 generations of synthetic training. Current research often stops before the "long-tail" degradation becomes fully apparent.
*   **Comparative Modality Studies:** A controlled study applying the same synthetic-to-real ratios across text, image, and tabular data to determine if the "curse of recursion" is modality-agnostic.
*   **Formalization of "Grokking" in Synthetic Loops:** If the 2% real-data threshold triggers a "grokking" recovery, we need a mechanistic explanation of the loss landscape to confirm this is a reliable phenomenon rather than an artifact of specific datasets.
*   **Standardized Metrics for "Tail" Health:** We lack a standardized metric to quantify the "narrowing" of a distribution. Developing a metric to measure the preservation of rare tokens or low-probability modes over generations would allow for objective comparisons between mitigation strategies.