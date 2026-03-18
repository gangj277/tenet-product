# Gaps in Research: Model Collapse from Recursive Synthetic Data

This document outlines the current state of uncertainty regarding recursive synthetic data training. It is intended to guide further experimental design and literature review.

## 1. Unresolved Questions
These questions represent the primary "known unknowns" that prevent a definitive consensus on the sustainability of synthetic-data-heavy training pipelines.

*   **The Critical Ratio Threshold:** While it is established that mixing real data helps, there is no consensus on the *mathematical lower bound* of real-to-synthetic data required to maintain stability. Is this ratio constant across model scales, or does it shift as models become more capable?
*   **Curated vs. Raw Synthetic Data:** Does filtering synthetic data through a "stronger" model (e.g., using a frontier model to distill data for a smaller model) fundamentally alter the entropy decay rate, or does it merely delay the onset of collapse?
*   **Cross-Modal Decay Rates:** We lack a comparative framework for how different modalities (e.g., text vs. video vs. code) experience entropy decay. It is unclear if the "tail-loss" mechanism is universal or if specific data structures (like the rigid syntax of code) provide inherent resistance to collapse.

## 2. Contradictions
The literature is currently split between theoretical pessimism and empirical optimism.

*   **Inevitability vs. Manageability:** Theoretical proofs (e.g., Source 4) suggest that model collapse is a mathematical certainty due to the compounding of approximation errors. Conversely, empirical studies (e.g., Source 8, 18) suggest that "grokking" or strategic data accumulation can bound test error. 
    *   *Actionable Gap:* We need to determine if the "grokking" observed in empirical studies is a permanent state or a transient phenomenon that eventually gives way to collapse at higher generations.
*   **The Efficacy of Data Accumulation:** There is a direct disagreement regarding whether adding real data to the training loop *prevents* collapse or merely *delays* it. 
    *   *Actionable Gap:* Longitudinal studies exceeding current generation counts (e.g., >10 generations) are required to see if the "bounded error" eventually trends toward divergence.

## 3. Weak Evidence Areas
Claims in these areas currently rely on thin or narrow experimental setups:

*   **The "Valley of Dangerous Competence":** While the existence of Stage B (high fluency, low accuracy) is supported (Source 2), we lack a robust, automated metric to detect this state before it manifests as catastrophic failure. Current evaluation benchmarks are likely contaminated by the very synthetic data we are testing.
*   **Scaling Law Stability:** The claim that synthetic data hits a performance plateau (Source 10, 18) is largely based on specific, smaller-scale architectures. It is unclear if this plateau is a property of the data or a limitation of current model capacity/architecture.
*   **Long-term Dynamics:** Most empirical evidence is derived from short-horizon recursive loops. We have almost no data on the behavior of models trained on synthetic data for 50+ generations.

## 4. What Would Change Confidence
To move from "medium" to "high" confidence in our mitigation strategies, the following evidence is required:

*   **Standardized "Collapse Benchmarks":** A set of synthetic-data-specific stress tests that measure the loss of tail-end distribution diversity (e.g., measuring the KL-divergence of rare token distributions over generations).
*   **Comparative Scaling Studies:** Experiments that hold the model architecture constant while varying the real-to-synthetic ratio across at least 20 generations to observe if the "plateau" is fixed or shifts with increased model parameters.
*   **Intervention Efficacy Data:** Controlled experiments comparing "curated" synthetic data (filtered by high-confidence thresholds) against "raw" synthetic data to quantify the exact gain in "generations until collapse."
*   **Formalization of "Grokking" in Synthetic Loops:** A theoretical model that explains why some models recover performance (grok) while others collapse, specifically identifying the role of model capacity in this transition.