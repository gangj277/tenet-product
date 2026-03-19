# Project Overview: Model Collapse From Recursive Synthetic Data Training

### 1. Original Research Question
Under what conditions does recursive training on synthetic data lead to model collapse in generative models?

### 2. Interpreted Research Objective
To determine the technical boundary conditions under which recursive synthetic training becomes catastrophic versus sustainable, and to identify validated architectural or data-curation interventions that prevent distribution drift and information loss.

### 3. Research Frame and Working Hypothesis
**Research Frame:** Model collapse is not an absolute law of machine learning but a function of distribution shift and error accumulation. It is treated as a stochastic process where the model's output distribution converges toward a degenerate state (a delta function) when the feedback loop is closed.

**Working Hypothesis:** Model collapse is a high-probability risk when synthetic data dominates the training distribution. However, the effect can be mitigated or delayed through the strategic integration of fresh, human-generated data and high-fidelity filtering, though the required ratio of real-to-synthetic data may be prohibitively high for some applications.

### 4. Scope Boundaries
*   **In-Scope:** Machine learning literature focusing on recursive training, synthetic data reuse, distribution degradation, and mathematical proofs of error accumulation in generative models.
*   **Out-of-Scope:** Product-level commentary, non-technical industry blog posts, and general discussions on AI ethics or copyright that do not address the technical mechanics of model collapse.
*   **Time Horizon:** 2023–2025.
*   **Geography:** Global literature.

### 5. Source Inventory

| Source Name | Provenance |
| :--- | :--- |
| *How Bad is Training on Synthetic Data? A Statistical Analysis of Language Model Collapse* | Discovered |
| *The Curse of Recursion: Training on Generated Data Makes Models Forget* | Discovered |
| *AI models collapse when trained on recursively generated data* | Discovered |
| *A Tale of Tails: Model Collapse as a Change of Scaling Laws* | Discovered |
| *BiHMP-GAN: Bidirectional 3D Human Motion Prediction GAN* | Discovered |
| *Model Collapse Demystified: The Case of Regression* | Discovered |