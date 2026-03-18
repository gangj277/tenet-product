# Claims Catalog: Model Collapse in Recursive Synthetic Training

This document catalogs the primary claims regarding the phenomenon of model collapse—the degradation of generative models when trained on recursively generated synthetic data.

---

### 1. Model collapse is a function of data management strategy (Replace vs. Accumulate) rather than an absolute mathematical law.

*   **Claim Statement:** The inevitability of model collapse depends primarily on whether synthetic data replaces or augments the existing training set. Data accumulation (mixing real and synthetic data) can bound errors, whereas data replacement leads to catastrophic failure.
*   **Supporting Sources:** 
    *   [Source: SOURCE 1]: Empirical evidence that mixing real and synthetic data prevents collapse.
    *   [Source: SOURCE 4]: Mathematical proof that accumulation leads to a finite upper bound on test error, shrinking by a factor of $1/i^2$ over iterations.
*   **Contradicting Sources:** 
    *   [Source: SOURCE 4]: Notes that even with accumulation, error may still increase over iterations in specific modalities.
    *   [Source: SOURCE 12]: Theoretical argument that discrete distributions possess "absorbing states" which guarantee information loss over time regardless of strategy.
*   **Confidence Assessment:** **High.** There is a strong consensus and mathematical backing for the distinction between "Replace" and "Accumulate" paradigms, though the long-term stability in discrete domains remains debated.

---

### 2. Recursive training causes "Tail Truncation," where rare events and low-probability tokens are progressively lost.

*   **Claim Statement:** Model collapse is fundamentally driven by the disappearance of the original distribution's tails. As models train on their own outputs, they favor probable outcomes, leading to a narrowing of diversity and the "forgetting" of rare tokens or features.
*   **Supporting Sources:** 
    *   [Source: SOURCE 15]: Demonstrates that regenerating heavy-tailed data "cuts off" or narrows the distribution tails.
    *   [Source: SOURCE 12, 13, 15, 6]: Multiple studies identifying the loss of tail-end diversity as the primary mechanism of collapse.
*   **Contradicting Sources:** None.
*   **Confidence Assessment:** **High.** This is a consensus finding across both theoretical and empirical literature, identified as a core mechanism of distribution drift.

---

### 3. Engineering interventions like self-verification and adaptive regularization can neutralize recursive degradation.

*   **Claim Statement:** Model collapse is not an inevitable outcome if specific architectural or algorithmic safeguards are used. Filtering synthetic data by confidence (self-verification) or using noise-aware regularization can stabilize training loops.
*   **Supporting Sources:** 
    *   [Source: SOURCE 3]: Provably demonstrates that self-verification prevents collapse even in fully synthetic regimes.
    *   [Source: SOURCE 5, 14]: Shows that adaptive regularization can correct for synthetic noise.
*   **Contradicting Sources:** 
    *   [Source: SOURCE 14]: Highlights that standard "clean data" regularization techniques actually cause catastrophic failure when applied to synthetic mixtures.
*   **Confidence Assessment:** **High.** While the *implementation* is an engineering challenge, the theoretical and empirical evidence for these "circuit breakers" is robust.

---

### 4. The utility of synthetic data is non-linear and depends on the existing volume of real data.

*   **Claim Statement:** Synthetic data provides diminishing returns and eventual harm based on the baseline of real data. It is highly beneficial when real data is scarce but becomes a pollutant when real data is already plentiful.
*   **Supporting Sources:** 
    *   [Source: SOURCE 2]: Empirical findings showing benefits at low sample sizes (<1024) and degradation at higher volumes.
*   **Contradicting Sources:** None.
*   **Confidence Assessment:** **Medium.** While the trend is observed, the specific "inflection point" where synthetic data becomes harmful likely varies significantly by model architecture and task complexity.

---

### 5. Scaling laws break down in the presence of recursive synthetic data.

*   **Claim Statement:** The traditional relationship between increased data/compute and improved performance does not hold for synthetic loops; increasing the volume of synthetic data fails to improve performance once a quality threshold is reached.
*   **Supporting Sources:** 
    *   [Source: SOURCE 15]: Reports a fundamental breakdown in scaling laws during recursive training.
*   **Contradicting Sources:** 
    *   [Source: SOURCE 2]: Suggests that while performance plateaus, it does so at different levels depending on the "Accumulate-Subsample" strategy, suggesting scaling is modified rather than entirely broken.
*   **Confidence Assessment:** **Medium.** There is strong evidence of a plateau, but the exact nature of the "new" scaling laws for synthetic data is still being characterized.