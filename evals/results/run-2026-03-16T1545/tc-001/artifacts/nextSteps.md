# Next Steps: Model Collapse Research

This document outlines the immediate research priorities to resolve the tension between "inevitable collapse" and "manageable engineering" identified in the initial synthesis.

## 1. Concrete Follow-up Research Directions

*   **The "Accumulate vs. Replace" Boundary Analysis:** Investigate the specific memory and compute trade-offs of the "accumulate" strategy. While it prevents collapse, it leads to an ever-growing dataset. Research whether there is a "forgetting" or "pruning" mechanism that can maintain stability without keeping 100% of historical data.
*   **Cross-Modality Susceptibility:** Compare the rate of "tail-cutting" in Diffusion models (images) versus Transformers (text). Preliminary evidence suggests image models may collapse faster due to the continuous nature of the latent space compared to the discrete token space of LLMs.
*   **Grokking Dynamics in Synthetic Loops:** Validate the "grokking" claim from Source 14. Determine if this is a general property of SGD on mixed-quality data or an artifact of specific learning rates and weight decay settings.
*   **The "Confidently Wrong" Stage B Transition:** Conduct a longitudinal study on the transition from Stage A (fluency) to Stage B (epistemic failure). Identify specific metrics (e.g., entropy of logit distributions, semantic drift) that act as early warning signals before accuracy drops.

## 2. Promising Hypothesis Refinements

*   **Refined Hypothesis 1:** Model collapse is not a failure of the *data*, but a failure of the *objective function*. Standard Maximum Likelihood Estimation (MLE) inherently penalizes the "tails" of the distribution; alternative objectives (e.g., contrastive learning or diversity-weighted loss) may neutralize the recursive decay.
*   **Refined Hypothesis 2:** The "Critical Real-Data Ratio" is not a constant but is inversely proportional to the model's parameter count. Larger models may require less real-world grounding to maintain distributional stability due to higher representational capacity.
*   **Refined Hypothesis 3:** Synthetic data is only "poisonous" when it lacks a verification signal. Synthetic data generated via "Chain-of-Thought" or "Self-Correction" loops behaves more like real data than raw model outputs.

## 3. Questions for Agent Chat Exploration

*   "Can you find specific studies that compare the 'accumulate' vs 'replace' training strategies in the context of LLM fine-tuning?"
*   "What are the mathematical proofs in Shumailov et al. (2023) regarding the 'inevitability' of collapse, and how do they account for data filtering?"
*   "Are there empirical results showing that RLHF (Reinforcement Learning from Human Feedback) accelerates or decelerates model collapse compared to SFT (Supervised Fine-Tuning)?"
*   "Search for 'Self-Rewarding Language Models' (e.g., Yuan et al. 2024) and analyze if their iterative training avoids the collapse mechanisms identified in earlier recursive studies."

## 4. Specific Papers & Methods to Investigate

### Key Papers
*   **Shumailov et al. (2023):** *"The Curse of Recursion: Training on Generated Data Makes Models Forget."* (The foundational "inevitability" argument).
*   **Alemohammad et al. (2023):** *"Self-Sustaining Error: The Limited Capacity of Recursive Training."* (Focus on image generation and the "Self-Consuming Loop").
*   **Gerstgrasser et al. (2024):** *"Is Model Collapse Inevitable? Breaking the Curse of Recursion by Accumulating Real Data."* (The primary counter-argument to Shumailov).
*   **Yuan et al. (2024):** *"Self-Rewarding Language Models."* (Investigate if the reward model provides the "external verifier" needed to prevent decay).

### Methods & Datasets
*   **Method:** **Top-p (Nucleus) Sampling vs. Greedy Decoding:** Investigate how the inference strategy used to generate synthetic data affects the speed of collapse (Greedy decoding is hypothesized to accelerate tail-cutting).
*   **Method:** **Metadata Tagging:** Explore the effectiveness of "Synthetic Data Watermarking" as a way for future models to down-weight recursive inputs during training.
*   **Dataset:** **TinyStories:** Use this synthetic-heavy dataset as a sandbox to test recursive training loops quickly and at low cost.