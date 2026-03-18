# Next Steps: Model Collapse Research

This document outlines the immediate research priorities to resolve the tension between the "inevitability" of model collapse and the "manageability" of recursive training through data accumulation.

## 1. Concrete Follow-up Research Directions

*   **The "Critical Ratio" Sensitivity Analysis:** Conduct a systematic review of empirical studies to identify the minimum threshold of real data required to stabilize training. Focus on the transition point where test error shifts from diverging (collapse) to bounded (stability).
*   **Cross-Architecture Susceptibility:** Investigate if Autoregressive models (LLMs) are more resilient to "tail-disappearance" than Variational Autoencoders (VAEs) or Diffusion models. Current findings suggest VAEs show error growth even with data accumulation, while LLMs may not.
*   **Open-Loop vs. Closed-Loop Dynamics:** Research whether the "Model Collapse" effect is mitigated when Model B trains on Model A’s data (open-loop), as opposed to Model A training on its own previous outputs (closed-loop). This simulates the real-world internet ecosystem more accurately.
*   **Filtering as a Proxy for Real Data:** Evaluate whether high-precision filtering (e.g., using reward models or perplexity thresholds) can mathematically substitute for the "superlinear growth" requirement of training sets.

## 2. Promising Hypothesis Refinements

*   **Refinement A (The Accumulation Hypothesis):** Model collapse is not an inherent property of recursive training, but a specific failure mode of *data replacement* strategies. Under *data accumulation* (keeping all historical real data), the model converges to a stable, albeit slightly noisier, distribution.
*   **Refinement B (The Tail-Preservation Hypothesis):** Collapse is primarily a "tail-disappearance" phenomenon. Mitigation strategies that explicitly over-sample low-probability density regions of the synthetic distribution will prevent the variance loss typically seen in recursive loops.
*   **Refinement C (The Regularization Paradox):** Standard regularization techniques (weight decay, dropout) optimized for real data may actually accelerate collapse in synthetic loops by penalizing the very diversity needed to maintain the distribution.

## 3. Questions for the Project Agent Chat

*   "Can you compare the mathematical assumptions in Shumailov et al. (Nature 2024) regarding 'absorbing states' with the 'data accumulation' proofs in Gerstgrasser et al. (COLM 2024)?"
*   "What specific metrics beyond Perplexity and FID are being used to detect the *early* onset of model collapse before it becomes catastrophic?"
*   "Is there evidence that 'Self-Correction' or 'Chain-of-Thought' in synthetic data generation reduces the functional approximation error that leads to collapse?"
*   "How does the 'superlinear growth' requirement for dataset size scale with the number of parameters in the model?"

## 4. Specific Papers and Methods to Investigate

### Key Papers
*   **Gerstgrasser et al. (2024):** *Is Model Collapse Inevitable? Breaking the Curse of Recursion by Accumulating Real and Synthetic Data.* (Focus on the 1/i² noise shrinkage proof).
*   **Shumailov et al. (2024):** *AI models collapse when trained on recursively generated data.* (Analyze the three specific error sources: statistical, functional expressivity, and approximation).
*   **Alemohammad et al. (2023):** *Self-Consuming Generative Models Go Wild.* (Investigate the 'Self-Consuming Loop' framework for GANs and Diffusion models).
*   **Dohmatob et al. (2024):** *A Probabilistic Perspective on Model Collapse.* (Examine the superlinear growth schedule requirements).

### Methods & Datasets
*   **Method:** **Adaptive Regularization.** Investigate the specific regularization adjustments proposed in *Model Collapse Demystified* to see if they are applicable to Transformer architectures.
*   **Method:** **Nucleus Sampling vs. Greedy Decoding.** Compare how different decoding strategies affect the rate of "tail-disappearance" in recursive loops.
*   **Dataset Strategy:** Look for studies using the **RedPajama** or **Pile** datasets where synthetic "contaminants" were intentionally introduced to measure degradation thresholds.