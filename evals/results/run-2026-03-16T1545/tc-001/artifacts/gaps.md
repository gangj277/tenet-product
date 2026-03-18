# Gaps & Uncertainties: Model Collapse in Recursive Training

This document identifies the actionable gaps in the current research regarding model collapse. It distinguishes between theoretical inevitability and engineering workarounds to guide future experimental design.

## 1. Unresolved Questions
These areas represent "known unknowns" where the literature identifies a phenomenon but lacks a precise or generalized rule.

*   **The Modality-Specific Threshold:** What is the exact mathematical ratio of real-to-synthetic data required to maintain stability across different modalities? Current evidence suggests stability is possible, but the "safe" ratio for high-dimensional image data versus structured text remains unquantified.
*   **Scaling Law Compensation:** To what extent can increasing model parameters (capacity) offset the noise introduced by synthetic data? It is unclear if larger models are more resilient to recursive noise or if they simply overfit to synthetic artifacts more efficiently.
*   **Long-term Verifier Bias:** While external verifiers (humans or "teacher" models) mitigate collapse, it is unknown if this merely shifts the failure mode from "distributional collapse" to "verifier homogenization," where the model loses all diversity not explicitly favored by the verifier.
*   **The "Grokking" Trigger:** What are the specific hyperparameter conditions required to trigger the "grokking" effect observed when mixing data? It is unclear if this is a universal property of recursive training or an artifact of specific optimizer settings.

## 2. Contradictions
Direct disagreements in current literature that require reconciliation through controlled ablation studies.

*   **Inevitability vs. Management:**
    *   *Position A:* Model collapse is a mathematical certainty in the limit of infinite generations, regardless of data quality (Source 11).
    *   *Position B:* Model collapse is a choice of data management; the "accumulate" workflow (keeping all previous data) creates a finite upper bound on error, preventing divergence (Source 2, 10).
*   **Synthetic Data as Poison vs. Neutral Supplement:**
    *   *Position A:* Synthetic data is inherently "poisonous" and increases test loss whenever real data is already abundant (>1024 points) (Source 6).
    *   *Position B:* Synthetic data can be neutralized or even beneficial if it provides higher-quality reasoning chains than available real data (Source 1, 14).
*   **The Role of Real Data Injection:**
    *   *Position A:* Small percentages of real data (e.g., 10%) indefinitely delay or prevent collapse (Source 12, 14).
    *   *Position B:* Real data injection is insufficient to defend against "adversarially curated" or highly biased synthetic datasets (Source 3).

## 3. Weak Evidence Areas
Claims that currently rely on limited empirical support or narrow contexts.

*   **Domain-Specific Resilience:** The claim that domain-specific training (e.g., medical or legal) delays collapse by 15x is based on limited studies and may not generalize to broader, multi-task foundational models.
*   **Architectural Variance:** Most research focuses on standard Transformers. There is thin evidence regarding how alternative architectures (e.g., State Space Models or Diffusion Models) differ in their susceptibility to "tail-cutting" and variance loss.
*   **Few-Shot vs. Zero-Shot Collapse:** The observation that instruction formatting (few-shot vs. short-answer) mediates collapse speed is highly promising but lacks large-scale verification across multiple model families.

## 4. What Would Change Confidence
Specific evidence or study results that would materially shift the current synthesis.

*   **A "Limit Study" on Accumulation:** A study demonstrating whether the "accumulate" workflow eventually diverges after 100+ generations would settle the debate on whether accumulation *prevents* or merely *delays* collapse.
*   **Cross-Architecture Benchmarking:** Empirical data showing that a specific architecture (e.g., a Mamba-based model) maintains distributional variance longer than a Transformer under identical recursive conditions.
*   **Verification of the "Grokking" Threshold:** A phase-transition study that identifies the exact percentage of real data needed to trigger the recovery from a synthetic plateau across different dataset sizes.
*   **Impact of Deduplication:** Rigorous evidence showing that aggressive deduplication of synthetic data acts as a primary defense against the "tail-cutting" mechanism.