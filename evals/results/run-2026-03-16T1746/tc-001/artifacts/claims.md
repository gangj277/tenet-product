# Claims: Model Collapse From Recursive Synthetic Data Training

This document catalogs the major claims regarding the recursive training of generative models on synthetic data. Claims are ordered by the strength of evidence and consensus within the current research literature.

---

### 1. Model collapse is a degenerative process characterized by the loss of information in the tails of the original distribution.
*   **Claim Statement:** Indiscriminate recursive training causes irreversible defects where the model loses the ability to represent low-probability (tail) events, leading to a degradation of the original distribution.
*   **Supporting Sources:** [Source: SOURCE 4], [Source: SOURCE 6]
*   **Contradicting Sources:** None.
*   **Confidence Assessment:** **High.** There is strong consensus that statistical approximation errors, functional expressivity limits, and functional approximation errors compound to erode distributional diversity.

### 2. Standard neural scaling laws are invalidated by synthetic data, leading to performance plateaus.
*   **Claim Statement:** Once the proportion of synthetic data in a training set exceeds a specific threshold, it ceases to be a scalable resource, causing models to hit performance plateaus regardless of additional data volume.
*   **Supporting Sources:** [Source: SOURCE 10], [Source: SOURCE 18]
*   **Contradicting Sources:** None.
*   **Confidence Assessment:** **High.** Empirical evidence consistently shows that synthetic data does not scale linearly like real-world data, with clear "breaking points" in performance.

### 3. Recursive training induces a transition from generalization to memorization.
*   **Claim Statement:** As entropy declines through recursive generations, models shift from learning underlying patterns (generalization) to replicating training samples (memorization), particularly in diffusion-based architectures.
*   **Supporting Sources:** [Source: SOURCE 14]
*   **Contradicting Sources:** None.
*   **Confidence Assessment:** **High.** This shift is a well-documented phenomenon in generative model behavior as the training distribution becomes increasingly homogeneous.

### 4. Knowledge collapse is a multi-stage phenomenon where surface fluency masks underlying failure.
*   **Claim Statement:** Models undergo a "valley of dangerous competence" (Stage B) where they maintain high linguistic or structural fluency while suffering from significant factual inaccuracy and reasoning failures that evade traditional metrics.
*   **Supporting Sources:** [Source: SOURCE 2]
*   **Contradicting Sources:** None.
*   **Confidence Assessment:** **High.** This highlights the danger of using standard quality metrics, which may fail to detect the degradation of reasoning capabilities.

### 5. Data accumulation (mixing real and synthetic data) can bound or delay model collapse.
*   **Claim Statement:** Retaining original real-world data alongside synthetic generations can prevent total collapse and keep test error bounded. Some evidence suggests a "grokking" phenomenon where models may recover original scaling laws if real data is maintained.
*   **Supporting Sources:** [Source: SOURCE 8], [Source: SOURCE 18]
*   **Contradicting Sources:** [Source: SOURCE 1] (argues this only delays, rather than prevents, degradation); [Source: SOURCE 3] (notes that in VAEs, test error increases even with accumulation).
*   **Confidence Assessment:** **Medium.** While data mixing is the most credible mitigation strategy, there is active disagreement on whether it provides a permanent solution or merely a temporary delay of inevitable degradation.

---

### Summary of Unresolved Disagreements
The primary tension in the literature exists between the **"Inevitability vs. Manageability"** perspectives:
*   **Theoretical View:** Sources such as [Source: SOURCE 4] argue that model collapse is a mathematical certainty due to the nature of recursive approximation.
*   **Engineering View:** Sources such as [Source: SOURCE 8] and [Source: SOURCE 18] suggest that through strategic data hygiene, accumulation, and filtering, the effects can be bounded, making the process sustainable for practical applications.