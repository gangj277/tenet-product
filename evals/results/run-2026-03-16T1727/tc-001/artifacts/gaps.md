# Gaps in Research: Model Collapse from Recursive Synthetic Data Training

This document identifies the critical uncertainties, contradictions, and evidence gaps in the current understanding of model collapse. These gaps represent the primary risks to synthesizing a definitive "rulebook" for recursive training.

## 1. Unresolved Questions
*   **The "Frontier Generalization" Gap:** Current theoretical proofs for error bounding (e.g., the 1/i² shrinkage in accumulation) are largely derived from linear models or low-dimensional proxies. It remains unproven if the high-dimensional, non-linear manifolds of frontier-class LLMs (GPT-4, Claude 3) behave with the same mathematical "summability" of error.
*   **The Critical Ratio Threshold:** While mixing real data is a known stabilizer, the specific "tipping point" (e.g., 5% vs. 20% real data) is unknown. This ratio likely varies by modality (text vs. image) and task complexity, but no cross-modal benchmark exists.
*   **RLHF as a Stabilizer:** It is unclear if Reinforcement Learning from Human Feedback (RLHF) or Constitutional AI acts as a form of "self-verification" that can indefinitely delay collapse by re-injecting human-centric tail distributions.
*   **The "Absorbing State" Paradox:** In discrete distributions (like tokenized text), does the existence of "absorbing states" (where the model converges on a single high-probability sequence) make collapse mathematically inevitable regardless of data accumulation?

## 2. Contradictions
*   **Prevention vs. Delay:** Sources disagree on whether the "Accumulate" strategy (mixing all previous data) *prevents* collapse entirely by reaching a finite error bound (Source 4) or merely *slows it down* to a sub-linear rate that eventually degrades (Source 12).
*   **Scaling Law Validity:** There is a direct conflict regarding compute. Some evidence suggests scaling laws hold if synthetic data is filtered (Source 3), while other empirical studies suggest scaling laws fundamentally break down once synthetic data dominates, regardless of compute (Source 15).
*   **Regularization Efficacy:** Standard "optimal" regularization techniques used for real-world data are reported to cause catastrophic failure when applied to synthetic mixtures (Source 14), contradicting the assumption that better engineering can treat synthetic data like real data.

## 3. Weak Evidence Areas
*   **Long-Horizon Recursion:** Most empirical studies only track 5–10 generations. Claims about "infinite stability" or "inevitable collapse" at 50+ generations are largely speculative or based on simplified mathematical extrapolations.
*   **Small-Scale Proxies:** Much of the "Tail Truncation" evidence comes from smaller models (e.g., OPT-125m or small Diffusion models). There is thin evidence confirming that the massive parameter redundancy in 1T+ parameter models provides a "buffer" against this truncation.
*   **Non-Linear Utility:** The claim that synthetic data is only beneficial when real data is scarce (<1024 samples) relies on limited studies (Source 2) and lacks broad validation across different model architectures.

## 4. What Would Change Confidence
*   **Evidence of "Self-Correction" in LLMs:** A study demonstrating that an LLM can improve its own performance over 20+ generations *without* new real data (via reasoning or self-verification) would invalidate the "inevitable collapse" hypothesis.
*   **Cross-Modal Comparison:** A controlled experiment applying the same recursive parameters to both a Transformer (text) and a U-Net (images) to see if "Tail Truncation" occurs at the same rate.
*   **Validation of "Accumulate-Subsample":** Empirical proof that a fixed-size training buffer (mixing old real data with new synthetic data) maintains the same error bounds as "Full Accumulation" would provide a practical engineering path for sustainable training.
*   **Mathematical Proof for Non-Linear Manifolds:** A theoretical framework that extends current linear error-bounding proofs to the non-linear dynamics of deep neural networks.