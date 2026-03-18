# Next Steps: Researching Model Collapse in Recursive Training

This document outlines the next phase of research into the dynamics of model collapse. Given the conflict between the "Replace" vs. "Accumulate" paradigms and the ambiguity surrounding model scale, the following steps prioritize empirical validation and theoretical reconciliation.

## 1. Concrete Research Directions

*   **Define the "Collapse Metric" Taxonomy:** Since the literature uses "model collapse" to describe at least four distinct phenomena, create a formal taxonomy for your synthesis. Categorize findings based on:
    *   *Unbounded Test Error:* Divergence in loss.
    *   *Mode Collapse:* Loss of diversity in output distribution.
    *   *Artifact Amplification:* The "inbreeding" effect where specific generation artifacts are reinforced.
    *   *Tail-End Erasure:* The loss of low-probability, high-value information.
*   **Ablation of the "Accumulation" Threshold:** Investigate the specific ratio of *Real:Synthetic* data required to maintain stability. Is there a "critical mass" of real data that, once reached, allows for infinite synthetic scaling?
*   **Modality-Specific Sensitivity Analysis:** Compare the collapse timelines of LLMs (text) vs. Diffusion Models (images). Hypothesize whether the discrete nature of tokens vs. the continuous nature of pixel space changes the rate of entropy decay.

## 2. Hypothesis Refinements

*   **The "Accumulation" Hypothesis:** Refine the working hypothesis to: *"Model collapse is not an inevitable outcome of synthetic data, but a consequence of information entropy loss. Accumulation strategies succeed because they preserve the original entropy of the data distribution, whereas replacement strategies act as a low-pass filter that systematically discards tail-end information."*
*   **The "Scaling" Paradox:** Test the hypothesis that larger models are *more* susceptible to collapse because their increased capacity allows them to "overfit" to the artifacts of the synthetic generator faster than smaller models, which might act as a natural regularizer.

## 3. Agent Chat Exploration Questions

Use these questions to probe the current state of the research:
*   "Can you find evidence of 'Grokking' in recursive synthetic training? Is there a phase transition where a model suddenly stops collapsing and begins to generalize better due to synthetic data?"
*   "Compare the mathematical proofs in *'Is Model Collapse Inevitable?'* against the empirical findings in *'Strong Model Collapse'*. What specific assumptions in the linear model proofs are violated in the empirical transformer experiments?"
*   "What is the current consensus on 'Data Curation' as a mitigation? Does filtering synthetic data for high-entropy samples actually prevent collapse, or does it just delay the inevitable by removing the 'noise' that triggers the feedback loop?"

## 4. Recommended Investigations

### Papers to Analyze
*   **Alemohammad et al. (2023):** *Self-Consuming Generative Models.* (Focus on the "Curse of Recursion" and the specific degradation metrics used).
*   **Shumailov et al. (2024):** *The Curse of Recursion: Training on Generated Data Makes Models Forget.* (Focus on the distinction between "Early" and "Late" model collapse).
*   **Bhartiya et al. (2024):** *The Impact of Synthetic Data on Model Generalization.* (Look for evidence of synthetic data *improving* performance).

### Methods to Investigate
*   **Entropy-Based Data Selection:** Research methods that measure the "information density" of synthetic samples before adding them to the training pool.
*   **Symbolic/Formal Verification:** Investigate if "Chain-of-Thought" synthetic data (where the reasoning path is included) mitigates collapse compared to raw output generation.
*   **KL-Divergence Tracking:** Propose a methodology for tracking the KL-divergence between the base model distribution and the $N^{th}$ generation model distribution as a standard "Collapse Health Check."

### Datasets/Benchmarks
*   **WikiText-103 / ImageNet:** Look for studies that have performed recursive training on these standard benchmarks to see if the "collapse" is consistent across different data domains.