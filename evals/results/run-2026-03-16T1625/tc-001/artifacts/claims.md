# Claims Catalog: Model Collapse in Recursive Synthetic Training

This document catalogs the primary claims regarding the phenomenon of model collapse—the degradation of generative models when trained on their own synthetic outputs—based on research literature from 2023–2025.

---

### 1. Data accumulation prevents total model collapse by bounding test error.
*   **Claim Statement:** Retaining all previous real-world data alongside synthetic data (accumulation) prevents the model from diverging into total collapse by providing a finite upper bound on test error.
*   **Supporting Sources:**
    *   [Source: Is Model Collapse Inevitable? Breaking the Curse of Recursion by Accumulating Real and Synthetic Data] - Demonstrates that accumulation avoids collapse across various architectures and hyperparameters.
    *   [Source: Addressing Concerns of Model Collapse from Synthetic Data in AI] - Argues that experimental designs showing collapse often discard previous data, which diverges from actual AI development practices.
    *   [Source: Is Model Collapse Inevitable?] - Notes that in accumulation settings, the impact of synthetic noise shrinks over time (proportional to $1/i^2$).
*   **Contradicting Sources:**
    *   [Source: Is Model Collapse Inevitable?] - Admits that for certain models like VAEs, test error still increases over iterations, though much more slowly than in replacement settings.
*   **Confidence Assessment:** **High**. There is strong empirical and theoretical consensus that the "data replacement" setting (discarding old data) is the primary driver of rapid collapse, while accumulation acts as a robust stabilizer.

### 2. Model collapse is driven by compounding errors leading to "tail-disappearance."
*   **Claim Statement:** Collapse is a three-stage process involving statistical, functional expressivity, and functional approximation errors that cause the tails of the original distribution to vanish.
*   **Supporting Sources:**
    *   [Source: AI models collapse when trained on recursively generated data | Nature] - Identifies these three specific error sources and proves that statistical resampling error alone can cause collapse to zero variance.
*   **Contradicting Sources:**
    *   [Source: Addressing Concerns of Model Collapse from Synthetic Data in AI] - Suggests these findings may overestimate collapse by not accounting for the continuous influx of new, diverse real-world data.
*   **Confidence Assessment:** **High**. The mathematical mechanisms (variance reduction and loss of distribution tails) are well-documented in theoretical frameworks, even if their real-world impact is debated.

### 3. Preserving a small fraction of real data significantly delays degradation.
*   **Claim Statement:** Retaining even a minority portion (e.g., 10%) of the original real-world data in the training set significantly slows the onset of model collapse.
*   **Supporting Sources:**
    *   [Source: AI models collapse when trained on recursively generated data | Nature] - Empirical evidence shows that a 10% real-data buffer acts as a significant brake on distribution shift.
*   **Contradicting Sources:** None identified; most sources agree that real data acts as a "grounding" force.
*   **Confidence Assessment:** **High**. This is a consistent finding across both papers that predict collapse and those that propose mitigations.

### 4. Mathematical stability requires superlinear growth of the training dataset.
*   **Claim Statement:** To fully counteract information loss in recursive loops, the size of the training dataset must grow at a superlinear rate over generations.
*   **Supporting Sources:**
    *   [Source: A Probabilistic Perspective on Model Collapse] - Provides a probabilistic proof that progressively increasing sample size is necessary to prevent collapse.
*   **Contradicting Sources:**
    *   [Source: Is Model Collapse Inevitable?] - Suggests that simple accumulation (linear growth) may be sufficient to bound error, implying superlinear growth might be an over-requirement.
*   **Confidence Assessment:** **Medium**. While mathematically sound in a closed-loop probabilistic framework, it is unclear if this requirement holds in practical applications where data curation is applied.

### 5. Adaptive regularization and curation are necessary to manage synthetic data.
*   **Claim Statement:** Standard training hyperparameters are insufficient for synthetic data; technical interventions like adaptive regularization and high-precision filtering are required to maintain model fidelity.
*   **Supporting Sources:**
    *   [Source: Model Collapse Demystified: The Case of Regression] - Proposes adaptive regularization as a specific mitigation strategy.
    *   [Source: Addressing Concerns of Model Collapse from Synthetic Data in AI] - Emphasizes that thorough data curation and filtering are essential for success when using synthetic inputs.
*   **Contradicting Sources:**
    *   [Source: Model Collapse Demystified] - Notes that regularization optimal for real data can actually cause catastrophic failure (divergence) when applied to synthetic data.
*   **Confidence Assessment:** **Medium**. While there is agreement that "naive" training fails, the specific "optimal" curation or regularization strategies are still being refined and vary by model type.