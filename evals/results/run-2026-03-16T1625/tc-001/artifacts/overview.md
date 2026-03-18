# Project Overview: Model Collapse From Recursive Synthetic Data Training

This project investigates the technical validity and inevitability of "model collapse"—the degradation of generative model performance when trained on their own synthetic outputs. The research evaluates the specific mechanisms driving distribution shift and variance loss, testing whether collapse is an inherent mathematical law of recursive training or a manageable risk that can be bypassed through specific data curation and training architectures.

### 1. Research Question
Under what conditions does recursive training on synthetic data lead to model collapse in generative models?

### 2. Research Objective
To determine if model collapse is a fundamental mathematical certainty of recursive training or a technical hurdle that can be mitigated through data-mixing ratios, "fresh" data injection, and specific training methodologies. The project aims to synthesize findings on whether collapse is an inevitable consequence of synthetic-data loops and identify which mitigation strategies are empirically and theoretically credible.

### 3. Research Frame & Working Hypothesis
**Research Frame:** The "Managed Degradation" frame. This perspective posits that model collapse is a function of data-to-noise ratios and sampling bias, rather than an unavoidable terminal state. It suggests that stability can be maintained by preserving a critical threshold of real-world data or implementing high-precision filtering of synthetic outputs.

**Working Hypothesis:** Model collapse is a significant risk when synthetic data dominates the training distribution, but mixing fresh real data with synthetic data—or accumulating all previous data generations—can reduce, delay, or indefinitely prevent the effect.

### 4. Scope Boundaries
*   **Inclusions:** Machine learning literature (2023–2025) concerning recursive training, synthetic data reuse, distribution degradation, and mathematical proofs of variance reduction.
*   **Exclusions:** Non-technical blog posts, general product commentary, and speculative non-peer-reviewed articles.
*   **Focus Areas:** Distinction between theoretical proofs of collapse and empirical evidence of mitigation; comparison of model architectures (e.g., VAEs vs. LLMs); and the efficacy of data-mixing ratios.

### 5. Source Inventory

| Source ID | Source Name | Provenance |
| :--- | :--- | :--- |
| **Source 1** | *Is Model Collapse Inevitable? Breaking the Curse of Recursion by Accumulating Real and Synthetic Data* (Gerstgrasser et al.) | Discovered |
| **Source 2** | *Model Collapse Demystified: The Case of Regression* | Discovered |
| **Source 4** | *A Probabilistic Perspective on Model Collapse* | Discovered |
| **Source 6** | *AI models collapse when trained on recursively generated data* (Shumailov et al., Nature) | Discovered |
| **Source 8** | *Addressing Concerns of Model Collapse from Synthetic Data in AI* | Discovered |

### 6. Key Research Themes
*   **Mechanisms of Decay:** Identification of three primary drivers: statistical approximation errors, functional expressivity errors, and functional approximation errors leading to "tail-disappearance."
*   **Data Accumulation vs. Replacement:** Evidence suggesting that "data replacement" (discarding old data) leads to rapid collapse, while "data accumulation" (retaining all previous real data) provides a finite upper bound on test error.
*   **Mitigation Strategies:** Evaluation of adaptive regularization, superlinear growth schedules for training datasets, and the preservation of a "critical ratio" (e.g., 10%) of original real-world data.