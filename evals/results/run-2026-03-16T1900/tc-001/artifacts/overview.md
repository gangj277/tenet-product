# Project Overview: Model Collapse From Recursive Synthetic Data Training

### 1. Research Question
Under what conditions does recursive training on synthetic data lead to model collapse in generative models?

### 2. Research Objective
To determine the technical boundary conditions and mitigation efficacy for model collapse in recursive training loops, distinguishing between theoretical inevitability and empirical manageability. The synthesis aims to clarify whether collapse is a mathematical certainty or a challenge that can be mitigated through specific data-mixing strategies and architectural adjustments.

### 3. Research Frame and Working Hypothesis
**Inferred Research Frame:** Model collapse is framed as a function of "distributional drift," where the cumulative loss of statistical information—specifically regarding tail-end distribution data—leads to a convergence toward a low-variance mean. 

**Working Hypothesis:** Model collapse is a significant risk when synthetic data dominates the training distribution; however, the effect can be arrested or indefinitely delayed by maintaining a consistent ratio of high-quality "anchor" (real) data.

### 4. Scope Boundaries
*   **Inclusion:** Machine learning literature focusing on recursive training, synthetic data reuse, and distribution degradation (e.g., Gaussian/Bernoulli models, LLMs, VAEs, and diffusion models).
*   **Exclusion:** Product-level commentary, non-technical blog posts, and general AI ethics discussions unrelated to the technical mechanism of recursive training.
*   **Time Horizon:** 2023–2025.

### 5. Source Inventory

| Source Name | Provenance |
| :--- | :--- |
| The Curse of Recursion: Training on Generated Data Makes Models Forget | Discovered |
| [2412.17646] Rate of Model Collapse in Recursive Training - arXiv | Discovered |
| Computer Science > Machine Learning (General Repository) | Discovered |
| Recursive Collapse: Theory and Mitigation | Discovered |
| Is Model Collapse Inevitable? Breaking the Curse of Recursion by... | Discovered |
| [2402.07712] Model Collapse Demystified: The Case of Regression | Discovered |