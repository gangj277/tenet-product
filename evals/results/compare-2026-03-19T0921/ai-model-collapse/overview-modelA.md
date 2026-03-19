# Project Overview: Model Collapse From Recursive Synthetic Data Training

### 1. Research Question
Under what conditions does recursive training on synthetic data lead to model collapse in generative models?

### 2. Research Objective
To synthesize current machine learning literature to determine if model collapse is an inevitable mathematical consequence of recursive synthetic-data training loops, and to identify validated architectural or data-curation interventions that maintain model stability.

### 3. Research Frame and Working Hypothesis
**Inferred Research Frame:** Model collapse is not an absolute law but a function of distribution shift and error accumulation. It is treated as a manageable engineering challenge rather than an insurmountable barrier, provided that strategic data mixing and high-fidelity filtering are employed.

**Working Hypothesis:** Model collapse is a high-probability risk when synthetic data dominates the training distribution; however, the effect can be mitigated or delayed by maintaining a sufficient ratio of fresh, human-generated (real) data and employing targeted regularization.

### 4. Scope Boundaries
*   **In-Scope:** Machine learning literature focusing on recursive training, synthetic data reuse, distribution degradation, and mathematical proofs of error accumulation in generative models.
*   **Out-of-Scope:** Product-level commentary, non-technical blog posts, and general discussions on AI ethics or copyright that do not address the technical mechanics of model collapse.
*   **Time Horizon:** 2023–2025.
*   **Geography:** Global literature.

### 5. Source Inventory

| Source Name | Provenance |
| :--- | :--- |
| How Bad is Training on Synthetic Data? A Statistical Analysis of Language Model Collapse | Discovered |
| The Curse of Recursion: Training on Generated Data Makes Models Forget | Discovered |
| AI models collapse when trained on recursively generated data | Discovered |
| A Tale of Tails: Model Collapse as a Change of Scaling Laws | Discovered |
| BiHMP-GAN: Bidirectional 3D Human Motion Prediction GAN | Discovered |
| Model Collapse Demystified: The Case of Regression | Discovered |