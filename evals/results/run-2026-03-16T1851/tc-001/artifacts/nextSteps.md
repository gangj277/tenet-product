# Next Steps: Researching Model Collapse in Recursive Training

This document outlines the strategic path forward to reconcile the conflicting evidence regarding the inevitability of model collapse and to define actionable mitigation thresholds.

## 1. Concrete Follow-up Research Directions

*   **Comparative Analysis of "Accumulation" vs. "Replacement":** Focus on the architectural constraints of data accumulation. While accumulation prevents collapse, it introduces a "memory" problem (storage and compute costs). Investigate if *weighted* accumulation (where older synthetic data is down-weighted) provides the same stability as pure accumulation.
*   **Modality-Specific Sensitivity:** The current literature is heavily skewed toward text (LLMs). Research whether the "tail disappearance" phenomenon manifests differently in latent diffusion models (images) or audio generation, where the "tail" represents rare but high-quality aesthetic features rather than just low-frequency tokens.
*   **The "Teacher-Student" Curation Hypothesis:** Investigate if using a high-capacity "Teacher" model to filter synthetic data before it enters the training set of a "Student" model acts as a proxy for real-world data injection. Does this curation effectively "re-inject" the lost tail information?

## 2. Promising Hypothesis Refinements

*   **Refined Hypothesis 1 (The "Data-Mixing" Threshold):** Model collapse is not a binary state but a phase transition. The critical threshold of real-world data (currently cited as ~10%) is likely a function of the *diversity* of the synthetic data, not just the volume.
*   **Refined Hypothesis 2 (The "Entropy" Buffer):** Synthetic data generated with higher temperature (higher entropy) delays collapse by preventing the model from converging to the mode of its own distribution, effectively acting as a regularizer that mimics the "tail" of real-world data.

## 3. Questions for Agent Chat

*   "Compare the mathematical proofs in *The Curse of Recursion* (Shumailov et al.) with *Is Model Collapse Inevitable?* (Gerstgrasser et al.). What specific assumptions about the loss function or model capacity differ between these two papers?"
*   "Are there any studies that measure the 'effective diversity' of synthetic datasets using metrics like FID (Fréchet Inception Distance) or perplexity-based diversity scores over successive generations?"
*   "Does the literature suggest that using synthetic data for *fine-tuning* (rather than pre-training) fundamentally changes the collapse trajectory?"

## 4. Specific Papers and Methods to Investigate

*   **Papers:**
    *   *Gerstgrasser et al. (2024), "Is Model Collapse Inevitable? Breaking the Curse of Recursion by Accumulating Real and Synthetic Data"* — Focus on the mathematical proof of the upper bound on test error.
    *   *Shumailov et al. (2023), "The Curse of Recursion: Training on Generated Data Makes Models Forget"* — Analyze the "tail disappearance" mechanism.
    *   *Briesch et al. (2024), "Collapse or Thrive? Perils and Promises of Synthetic Data"* — Examine the findings on data-scarce regimes where synthetic data actually improves performance.
*   **Methods:**
    *   **Data-Mixing Experiments:** Design a controlled experiment using a small-scale Transformer (e.g., GPT-2 architecture) to test the 10% real-data injection hypothesis against varying levels of synthetic data noise (temperature settings).
    *   **Diversity Metrics:** Implement a pipeline to track the "tail" of the distribution (e.g., measuring the frequency of low-probability tokens/features) across 5+ generations of recursive training.
    *   **Curation Benchmarking:** Investigate "Synthetic Data Filtering" methods (e.g., using a reward model to score synthetic outputs before they are added to the training pool).