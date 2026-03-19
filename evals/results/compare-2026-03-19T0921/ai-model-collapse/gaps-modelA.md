# Gaps in Research: Model Collapse from Recursive Synthetic Data

This document outlines the current limitations in our understanding of model collapse. While the phenomenon is mathematically established in closed-loop systems, the transition from theoretical models to production-scale stability remains poorly defined.

### 1. Unresolved Questions
*   **Modality-Specific Thresholds:** We have high-level confirmation that collapse occurs, but we lack a "critical ratio" for different modalities. Does the exponential requirement for real data hold for high-dimensional image generation as it does for text?
*   **Filtering Efficacy:** Can watermarking or high-fidelity classifiers effectively identify and filter synthetic data at web-scale without introducing new biases that trigger their own form of distribution drift?
*   **Architectural Resilience:** Is the Transformer architecture uniquely susceptible to recursive degradation, or are there alternative architectures (e.g., State Space Models, diffusion-based architectures) that exhibit higher robustness to synthetic noise?
*   **Primary Driver Identification:** It remains unclear whether collapse is primarily driven by *functional approximation error* (the model failing to learn the true distribution) or *statistical sampling error* (the model over-representing its own biases).

### 2. Contradictions
*   **The "Exponential" Requirement:** There is a significant tension between the theoretical requirement that synthetic data must be "exponentially smaller" than real data to maintain stability and the practical goal of using synthetic data to scale training. If the ratio must be near-zero, synthetic data loses its utility as a scaling lever.
*   **Mitigation vs. Acceleration:** While some studies suggest regularization and non-repetition penalties can mitigate mode collapse, others indicate these interventions may actually increase perplexity and leave the model equally vulnerable to long-term collapse.

### 3. Weak Evidence Areas
*   **Open-Web Dynamics:** Most current evidence relies on controlled, small-scale simulations. There is a lack of empirical data on how these effects manifest in "noisy" environments where synthetic data is mixed with heterogeneous, non-curated real-world data.
*   **Architectural Interventions:** Claims regarding GAN-based or regularization-based mitigations are largely task-specific (e.g., human motion prediction). There is thin evidence that these techniques generalize to large-scale generative language or multimodal models.
*   **Long-Term Stability:** Most studies focus on early-to-mid-stage collapse. We lack longitudinal data on whether "slower" collapse (achieved via partial real-data mixing) eventually reaches the same terminal state or if it can be stabilized indefinitely.

### 4. What Would Change Confidence
To move from theoretical caution to an actionable engineering roadmap, the following evidence is required:

*   **Empirical "Tipping Point" Benchmarks:** A study mapping the relationship between the percentage of synthetic data (0% to 100%) and the rate of perplexity degradation across multiple modalities (Text, Image, Code).
*   **Comparative Architecture Analysis:** A head-to-head study comparing the collapse resistance of standard Transformers against newer architectures (e.g., Mamba, Jamba) under identical recursive training conditions.
*   **Filtering Impact Studies:** A rigorous evaluation of whether automated filtering (e.g., using reward models to prune synthetic content) actually delays collapse or simply masks it until the model reaches a catastrophic "cliff."
*   **Validation of "Real-Data" Quality:** Evidence determining if the *quality* of the real-data mix matters more than the *quantity*. Does a small amount of "high-diversity" real data prevent collapse better than a larger amount of "low-diversity" real data?