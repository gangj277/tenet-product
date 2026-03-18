# Project Overview: Model Collapse From Recursive Synthetic Data Training

### 1. Research Question
Under what conditions does recursive training on synthetic data lead to model collapse in generative models?

### 2. Research Objective
This synthesis evaluates the technical validity and inevitability of "model collapse"—the degradation of generative model performance when trained on recursively generated synthetic data. The objective is to determine the boundary conditions under which recursive synthetic training becomes unsustainable and to identify specific architectural or data-curation interventions that effectively prevent the loss of tail-end distribution diversity.

### 3. Research Frame and Working Hypothesis
The research operates under the hypothesis that model collapse is not an absolute law but a function of data-to-noise ratios and training hygiene. The project tests the premise that the strategic integration of "fresh" real-world data and specific sampling techniques can maintain model stability, distinguishing between theoretical worst-case scenarios and empirical realities observed in large-scale training loops.

### 4. Scope Boundaries
*   **In-Scope:** Machine learning literature concerning recursive training, synthetic data reuse, distribution degradation, and mathematical proofs of error accumulation.
*   **Out-of-Scope:** Product-level commentary, non-technical blog posts, and speculative industry opinion pieces.
*   **Temporal Focus:** 2023–2025.
*   **Geographic Focus:** Global academic and industrial research output.

### 5. Source Inventory
The following sources have been synthesized to address the research question. *Note: Provenance is categorized as "Discovered" (retrieved via literature search) or "Uploaded" (provided by the user).*

| Source ID | Provenance | Description |
| :--- | :--- | :--- |
| SOURCE 1 | Discovered | Study on the limits of data accumulation and error bounds in recursive training. |
| SOURCE 2 | Discovered | Analysis of "knowledge collapse" and the "valley of dangerous competence." |
| SOURCE 3 | Discovered | Empirical investigation into VAE performance degradation over generations. |
| SOURCE 4 | Discovered | Foundational theoretical proof regarding tail-end distribution loss. |
| SOURCE 5 | Discovered | Mathematical modeling of functional approximation errors in recursive loops. |
| SOURCE 6 | Discovered | Taxonomy of compounding errors (statistical, functional, expressivity). |
| SOURCE 8 | Discovered | Evidence for "data accumulation" as a mitigation strategy. |
| SOURCE 10 | Discovered | Analysis of performance plateaus in synthetic-heavy training regimes. |
| SOURCE 14 | Discovered | Study on the shift from generalization to memorization in diffusion models. |
| SOURCE 16 | Discovered | Research on the required ratios of real-to-synthetic data for stability. |
| SOURCE 18 | Discovered | Investigation into "grokking" and the recovery of scaling laws. |