# Gaps in Research: Model Collapse from Recursive Synthetic Data

This document outlines the critical uncertainties regarding the recursive training of generative models on synthetic data. While the phenomenon of "model collapse" is mathematically established in closed-loop systems, the transition from theoretical models to production-scale stability remains poorly defined.

### 1. Unresolved Questions
*   **Modality-Specific Thresholds:** While we know collapse occurs, we lack a defined "tipping point" ratio of real-to-synthetic data for different modalities. Does the high-dimensional nature of image generation provide more resilience than the discrete token-based nature of LLMs?
*   **Scalability of Filtering:** Can watermarking or classifier-based filtering effectively identify and prune synthetic data at web-scale without introducing selection bias that itself causes distribution drift?
*   **Primary Driver of Collapse:** There is no consensus on whether collapse is driven primarily by **functional approximation error** (the model's inability to represent the true distribution) or **statistical sampling error** (the accumulation of variance in the synthetic training set). Identifying the driver is essential for selecting the correct mitigation (e.g., architectural change vs. data augmentation).

### 2. Contradictions
*   **The "Exponentially Smaller" Requirement:** Some literature suggests that to maintain stability, synthetic data must be kept "exponentially smaller" than real data. This contradicts the industry push toward synthetic-heavy training sets, suggesting a fundamental conflict between current scaling trends and long-term model health.
*   **Regularization Efficacy:** While some studies suggest adaptive regularization mitigates synthetic noise, others report that specific penalties (e.g., non-repetition) actually accelerate collapse or degrade perplexity. This suggests that "off-the-shelf" regularization techniques may be counterproductive in recursive loops.

### 3. Weak Evidence Areas
*   **Architectural Resilience:** Most evidence is derived from standard Transformer architectures. There is thin evidence regarding whether alternative architectures (e.g., State Space Models, non-autoregressive models) exhibit different collapse trajectories.
*   **Open-Web Dynamics:** Current research relies heavily on controlled, closed-loop simulations. These environments lack the "noise" of the open web (e.g., diverse human-generated updates, multi-modal cross-pollination), which may either accelerate collapse or provide a stabilizing buffer that current models fail to capture.

### 4. What Would Change Confidence
To move from theoretical caution to actionable engineering, the following evidence is required:

*   **Empirical "Phase Transition" Mapping:** A study that systematically varies the real-to-synthetic ratio across multiple generations to identify the exact point where performance metrics (e.g., FID, Perplexity) deviate from the baseline.
*   **Comparative Architectural Benchmarking:** A controlled study comparing the collapse rate of Transformers against non-autoregressive or hybrid architectures under identical synthetic-heavy training regimes.
*   **Filtering Efficacy Trials:** A longitudinal study measuring the "effective life" of a model trained on filtered synthetic data versus unfiltered data. We need to know if filtering merely *delays* the inevitable or if it can *sustain* a distribution indefinitely.
*   **Cross-Modal Transfer Analysis:** Evidence on whether synthetic data from one modality (e.g., synthetic text) accelerates collapse in another (e.g., multi-modal vision-language models), which would clarify if collapse is a localized or systemic risk.