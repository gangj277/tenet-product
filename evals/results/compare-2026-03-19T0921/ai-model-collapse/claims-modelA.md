# Claims: Model Collapse From Recursive Synthetic Data Training

This document synthesizes current research on the phenomenon of "model collapse"—the degradation of generative model performance due to recursive training on synthetic data.

---

### 1. Model collapse is a mathematical certainty in fully synthetic recursive loops.
*   **Claim Statement:** When models are trained exclusively on recursively generated synthetic data, they inevitably converge to a constant state (a delta function), resulting in the total loss of the original distribution's information.
*   **Supporting Sources:** 
    *   [Source: How Bad is Training on Synthetic Data? A Statistical Analysis of Language Model Collapse]
    *   [Source: The Curse of Recursion: Training on Generated Data Makes Models Forget]
*   **Contradicting Sources:** None.
*   **Confidence Assessment:** **High.** The consensus across theoretical and empirical literature is that closed-loop synthetic training creates a Markov Chain where the only stable absorbing state is a degenerate distribution.

---

### 2. Maintaining a ratio of real human-generated data is the primary mitigation strategy.
*   **Claim Statement:** The integration of fresh, real-world data into the training loop can stabilize the model and prevent or delay collapse.
*   **Supporting Sources:** 
    *   [Source: AI models collapse when trained on recursively generated data]
    *   [Source: How Bad is Training on Synthetic Data? A Statistical Analysis of Language Model Collapse]
*   **Contradicting Sources:** 
    *   [Source: How Bad is Training on Synthetic Data? A Statistical Analysis of Language Model Collapse] (Note: Contradicts the *feasibility* of this strategy by suggesting the required ratio of real data must be exponentially larger than synthetic data to maintain stability).
*   **Confidence Assessment:** **High.** While the strategy is empirically validated, the "cost" of this strategy (the required volume of real data) remains a point of contention.

---

### 3. Model collapse is characterized by the loss of distribution "tails."
*   **Claim Statement:** The earliest observable stage of model collapse is "tail disappearance," where low-probability events and rare features from the original training distribution are systematically pruned over successive generations.
*   **Supporting Sources:** 
    *   [Source: The Curse of Recursion: Training on Generated Data Makes Models Forget]
    *   [Source: A Tale of Tails: Model Collapse as a Change of Scaling Laws]
*   **Contradicting Sources:** None.
*   **Confidence Assessment:** **High.** This is a consistent finding across both language and image generation research.

---

### 4. Architectural and regularization interventions have mixed effectiveness.
*   **Claim Statement:** Specific interventions, such as GAN-based discriminators or adaptive regularization, can mitigate mode-collapse in specific tasks, though standard non-repetition penalties often fail to prevent, or even accelerate, degradation.
*   **Supporting Sources:** 
    *   [Source: BiHMP-GAN: Bidirectional 3D Human Motion Prediction GAN]
    *   [Source: Model Collapse Demystified: The Case of Regression]
*   **Contradicting Sources:** 
    *   [Source: AI models collapse when trained on recursively generated data] (Evidence suggests that enforcing non-repetition penalties can cause perplexity to double and leave models just as susceptible to collapse).
*   **Confidence Assessment:** **Medium.** While some architectural adjustments show promise in niche domains (like 3D motion prediction), they are not yet proven as general-purpose solutions for large-scale generative models.

---

### Summary of Confidence and Research Status
*   **High Confidence:** The existence of model collapse in closed-loop systems and the necessity of real-data injection for stability.
*   **Medium Confidence:** The efficacy of architectural interventions, which currently appear highly task-specific.
*   **Unresolved Disagreements:** There is no consensus on whether the primary driver of collapse is functional approximation error or statistical sampling error, nor is there agreement on whether intermediate data filtering can truly stop collapse or merely slow its rate.