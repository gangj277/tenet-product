# Project Overview: Model Collapse From Recursive Synthetic Data Training

### 1. Original Research Question
Under what conditions does recursive training on synthetic data lead to model collapse in generative models?

### 2. Interpreted Research Objective
This project aims to define the technical boundary conditions under which recursive synthetic training transitions from a viable data-augmentation strategy to a catastrophic failure mode. The objective is to synthesize current literature to determine if model collapse is an inevitable mathematical outcome of recursive loops or a manageable engineering challenge, specifically evaluating the efficacy of data-mixing and accumulation strategies.

### 3. Inferred Research Frame
The working hypothesis is that model collapse is a function of statistical approximation errors and variance loss that can be mathematically modeled and empirically delayed through strategic data hygiene and hybrid training regimes. The research operates on the premise that synthetic data inherently gravitates toward high-probability regions, leading to a "vanishing tail" phenomenon where rare information is discarded.

### 4. Scope Boundaries
*   **In-Scope:** Machine learning literature focusing on recursive training, synthetic data reuse, distribution degradation, and mitigation strategies (e.g., data accumulation, filtering, and hybrid training).
*   **Out-of-Scope:** Product-level commentary, non-technical blog posts, and general discussions on AI ethics unrelated to the technical mechanism of model collapse.
*   **Time Horizon:** 2023–2025.
*   **Geography:** Global literature.

### 5. Source Inventory

| Source Name | Provenance |
| :--- | :--- |
| *Is Model Collapse Inevitable? Breaking the Curse of Recursion by Accumulating Real and Synthetic Data* | Discovered |
| *Collapse or Thrive? Perils and Promises of Synthetic Data in a Self-Generating World* | Discovered |
| *The Curse of Recursion: Training on Generated Data Makes Models Forget* | Discovered |
| *Countering Model Collapse in Iterative Self-Training via Dynamic...* | Discovered |
| *Knowledge Collapse in LLMs: When Fluency Survives but Facts Fail...* | Discovered |
| *Computer Science > Machine Learning (General Synthetic Data Study)* | Discovered |
| *Martínez et al., 2023a (Prior Literature)* | Discovered |
| *Alemohammad et al., 2023 (Prior Literature)* | Discovered |