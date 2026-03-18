# Project Overview: Model Collapse From Recursive Synthetic Data Training

### 1. Research Question
Under what conditions does recursive training on synthetic data lead to model collapse in generative models?

### 2. Research Objective
This research synthesizes current literature to determine if model collapse is an inevitable consequence of synthetic-data training loops. The objective is to identify the technical thresholds of collapse and evaluate the efficacy of mitigation strategies, specifically focusing on the interplay between real-world data injection and recursive training dynamics.

### 3. Research Frame and Working Hypothesis
The research is framed by the hypothesis that **model collapse is not an inherent law of recursive training, but a manageable risk dependent on data hygiene, the ratio of real-to-synthetic data, and the preservation of distribution tails.** 

The investigation distinguishes between:
*   **Statistical approximation error:** The primary driver of collapse, resulting from finite sample sizes and the narrowing of distributional tails.
*   **Functional approximation error:** The secondary driver, which may dominate in early generations but is often secondary to the cumulative effects of statistical noise.

### 4. Scope Boundaries
*   **Inclusion:** Peer-reviewed machine learning literature (2023–2025) concerning recursive training, synthetic data reuse, and distribution degradation.
*   **Exclusion:** Product-level commentary, non-technical blog posts, and anecdotal industry reports.
*   **Focus:** The distinction between "data replacement" (where synthetic data replaces real data) and "data accumulation" (where synthetic data is added to a growing pool of real data).

### 5. Source Inventory

| Source Name | Provenance |
| :--- | :--- |
| [2404.01413] Is Model Collapse Inevitable? Breaking the Curse of Recursion | Discovered |
| The Curse of Recursion: Training on Generated Data Makes Models Forget | Discovered |
| A Tale of Tails: Model Collapse as a Change of Scaling Laws | Discovered |
| How Bad is Training on Synthetic Data? A Statistical Analysis of Language Model Collapse | Discovered |
| Escaping Model Collapse via Synthetic Data Verification | Discovered |

*Note: All sources listed were identified via systematic literature review within the specified 2023–2025 timeframe.*