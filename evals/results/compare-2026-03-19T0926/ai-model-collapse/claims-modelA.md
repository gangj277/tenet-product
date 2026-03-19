# Claims: Model Collapse From Recursive Synthetic Data Training

This document synthesizes current research findings regarding the phenomenon of "model collapse"—the degradation of generative models when trained on recursively generated synthetic data.

---

### 1. Model collapse is a mathematical certainty in fully synthetic recursive loops
*   **Claim Statement:** When models are trained exclusively on their own output, they inevitably converge to a constant state (delta function), losing all information from the original distribution.
*   **Supporting Sources:** 
    *   [Source: How Bad is Training on Synthetic Data? A Statistical Analysis of Language Model Collapse]
    *   [Source: The Curse of Recursion: Training on Generated Data Makes Models Forget]
*   **Contradicting Sources:** None.
*   **Confidence Assessment:** **High**. The literature consistently frames this as a mathematical consequence of Markov chain absorption in closed-loop synthetic training.

---

### 2. Maintaining a ratio of real human-generated data is the primary mitigation strategy
*   **Claim Statement:** Model collapse can be delayed or avoided by mixing fresh, real-world data into the training distribution.
*   **Supporting Sources:** 
    *   [Source: AI models collapse when trained on recursively generated data]
    *   [Source: How Bad is Training on Synthetic Data? A Statistical Analysis of Language Model Collapse]
*   **Contradicting Sources:** 
    *   [Source: How Bad is Training on Synthetic Data? A Statistical Analysis of Language Model Collapse] (Note: Contradicts the *feasibility* of this strategy, arguing that the required ratio of real data must be exponentially larger than synthetic data to ensure stability).
*   **Confidence Assessment:** **High**. While the efficacy of mixing is widely accepted, the "tipping point" ratio remains a subject of debate regarding its practical scalability.

---

### 3. Model collapse is characterized by "tail disappearance"
*   **Claim Statement:** The initial stage of collapse involves the loss of information regarding low-probability events (the "tails" of the distribution), leading to a narrowing of output diversity.
*   **Supporting Sources:** 
    *   [Source: The Curse of Recursion: Training on Generated Data Makes Models Forget]
    *   [Source: A Tale of Tails: Model Collapse as a Change of Scaling Laws]
*   **Contradicting Sources:** None.
*   **Confidence Assessment:** **High**. Empirical observations of distribution shift consistently point to the loss of tail information as the primary indicator of early-stage collapse.

---

### 4. Architectural and regularization interventions have mixed efficacy
*   **Claim Statement:** Specific interventions, such as GAN-based discriminators or adaptive regularization, can help maintain one-to-one mappings and mitigate mode-collapse.
*   **Supporting Sources:** 
    *   [Source: BiHMP-GAN: Bidirectional 3D Human Motion Prediction GAN]
    *   [Source: Model Collapse Demystified: The Case of Regression]
*   **Contradicting Sources:** 
    *   [Source: AI models collapse when trained on recursively generated data] (Note: Found that enforcing non-repetition penalties actually caused models to perform worse and remain susceptible to collapse).
*   **Confidence Assessment:** **Medium**. While some architectural adjustments show promise in specific domains (e.g., motion prediction), general-purpose LLM interventions like repetition penalties have proven counterproductive in broader testing.