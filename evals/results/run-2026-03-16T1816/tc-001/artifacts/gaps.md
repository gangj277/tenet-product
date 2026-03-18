# Gaps in Research: Model Collapse from Recursive Synthetic Data

This document outlines the critical uncertainties and technical gaps in the current literature regarding recursive synthetic data training.

### 1. Unresolved Questions
*   **The "Temperature" Variable:** Does model collapse occur deterministically at temperature 0 in LLMs, or does the stochasticity of higher temperatures act as a sufficient regularizer to prevent the "tail-cutting" effect?
*   **Modal Sensitivity:** Are there fundamental differences in the "half-life" of data quality between modalities (e.g., code vs. natural language vs. image)? Current literature lacks a cross-modal benchmark for collapse thresholds.
*   **Symbolic vs. Statistical Limits:** Can symbolic verification or formal methods (e.g., code execution feedback loops) fundamentally bypass the statistical limits of recursive training, or do they simply introduce a new, different form of bias?
*   **The "Real-World" Gap:** Most research relies on the "Replace" paradigm (replacing 100% of data). We lack empirical data on the "Accumulate" paradigm at scale—specifically, what is the *minimum* ratio of fresh real-world data required to maintain performance indefinitely?

### 2. Contradictions
*   **The Efficacy of Mixing:** There is a direct conflict between studies suggesting that mixing real data with synthetic data enables "grokking" or recovery, and studies (e.g., *Strong Model Collapse*) arguing that mixing merely neutralizes the synthetic data without preventing long-term degradation.
*   **Scaling Laws and Vulnerability:** Literature is divided on whether larger models are more or less vulnerable. One perspective suggests larger models amplify collapse by overfitting to artifacts, while another suggests they may mitigate it by crossing an "interpolation threshold" that allows for better generalization.
*   **Utility of Synthetic Data:** There is no consensus on whether synthetic data is a net positive or negative. Some sources treat it as a tool for distribution expansion, while others view it as a zero-sum game that eventually degrades the model to a "mean" state.

### 3. Weak Evidence Areas
*   **Non-Linear Complexity:** The majority of theoretical proofs for model collapse rely on linear models or Gaussian Mixture Models (GMMs). There is a lack of rigorous mathematical grounding for why these findings hold (or fail) in high-dimensional, non-linear Transformer architectures.
*   **Definition Ambiguity:** The term "Model Collapse" is currently an umbrella for at least eight distinct phenomena (e.g., mode collapse vs. entropy decay vs. artifact amplification). Research is currently hindered by a lack of standardized metrics to distinguish between these failure modes.
*   **Long-Horizon Empirical Data:** Most studies simulate 5–20 generations. There is almost no evidence regarding the behavior of models at 100+ generations, which is the relevant horizon for long-term synthetic data pipelines.

### 4. What Would Change Confidence
To move from theoretical debate to actionable engineering, the following evidence is required:

*   **Standardized Benchmarking:** A unified metric (e.g., a specific KL-divergence threshold or entropy-decay rate) that defines "collapse" across different model architectures.
*   **Ablation on "Fresh" Data:** A controlled study varying the *source* of the "fresh" data (e.g., human-authored vs. high-quality synthetic vs. filtered web-crawl) to determine if the *type* of real data matters as much as the *ratio*.
*   **Scaling Experiments:** A systematic study of model size vs. collapse onset that explicitly tests the "interpolation threshold" hypothesis. If larger models show a plateau rather than a collapse, it would fundamentally change the strategy for synthetic data usage.
*   **Long-Term Longitudinal Studies:** Empirical results from 50+ generations of recursive training to determine if the "Accumulate" paradigm truly prevents collapse or merely pushes the "cliff" further into the future.