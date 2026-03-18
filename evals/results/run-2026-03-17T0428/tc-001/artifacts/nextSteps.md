# Next Steps: Researching Model Collapse in Recursive Training

This document outlines the next phase of research into the mechanics and mitigation of model collapse. The current synthesis confirms that while model collapse is a significant risk, it is highly sensitive to data management strategies (replacement vs. accumulation) and the preservation of distribution tails.

## 1. Concrete Follow-up Research Directions

*   **Investigate "Grokking" in Synthetic Loops:** Explore whether the "grokking" phenomenon—where models transition from memorization to generalization—can be triggered in recursive synthetic training by injecting specific ratios of high-quality real data.
*   **Multi-Model Ecosystem Dynamics:** Move beyond single-model recursion. Research how "model-to-model" feedback loops (e.g., Model A trains on Model B, which trains on Model C) affect the variance of the final distribution compared to a single-model loop.
*   **Architecture-Specific Sensitivity:** Conduct a comparative analysis of how different architectures (e.g., Transformer vs. State Space Models like Mamba) handle synthetic data degradation. Does the inductive bias of specific architectures inherently resist or accelerate the loss of tail-end tokens?

## 2. Hypothesis Refinements

*   **Refined Hypothesis on Accumulation:** "Data accumulation does not prevent collapse in absolute terms, but rather shifts the system into a 'meta-stable' state where the error rate plateaus. The 'collapse' is not an infinite divergence, but a convergence to a lower-entropy, less-diverse distribution that is functionally limited."
*   **Refined Hypothesis on Tail-End Loss:** "The primary driver of collapse is not the synthetic data itself, but the *sampling strategy* used to generate it (e.g., top-p/top-k). Replacing stochastic sampling with diversity-preserving sampling (e.g., nucleus sampling with high entropy) may significantly delay the onset of tail-end degradation."

## 3. Questions for Agent Chat

*   "Can you find empirical evidence or theoretical papers that compare the 'entropy' of synthetic datasets generated via temperature-based sampling versus beam search? Which approach preserves the original distribution's tail better?"
*   "Are there any studies that quantify the 'information loss' per generation in recursive training? Specifically, look for metrics like KL-divergence or Jensen-Shannon divergence between the original real-data distribution and the $N^{th}$ generation synthetic distribution."
*   "Summarize the current state of 'Truncated Cross Entropy' (TCE) and other loss-based mitigations. Are these techniques effective for non-text modalities (e.g., image generation/Diffusion models)?"

## 4. Recommended Papers, Datasets, and Methods

*   **Papers to Investigate:**
    *   *The Curse of Recursion: Training on Generated Data Makes Models Forget* (Shumailov et al., 2023) – Re-read specifically for the distinction between statistical and functional approximation errors.
    *   *Is Model Collapse Inevitable?* (Shumailov et al., 2024) – Focus on the Appendix to resolve the disagreement regarding whether accumulation "avoids" or "slows" collapse.
    *   *ForTIFAI: Fending Off Recursive Training Induced Failure for AI Models* – Analyze the methodology behind the 2.3x fidelity interval extension.
*   **Methods to Explore:**
    *   **Data Auditing:** Investigate "Data Provenance" tracking methods to see if tagging synthetic data allows for better weighting during training.
    *   **Synthetic Data Filtering:** Research "Quality-based Filtering" (e.g., using a smaller, high-precision model to score synthetic data before it enters the training set of the next generation).
*   **Datasets:**
    *   Look for benchmarks that specifically measure "tail-end" performance (e.g., rare word prediction or long-tail knowledge retrieval) rather than general perplexity, as general metrics often mask the collapse of rare tokens.