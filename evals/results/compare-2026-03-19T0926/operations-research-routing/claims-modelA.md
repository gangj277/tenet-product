# Claims: Learned Routing vs. Classical OR

This document synthesizes the comparative efficacy of Neural Combinatorial Optimization (NCO) and classical Operations Research (OR) methods based on literature from 2016–2024.

---

### 1. Hybrid Approaches and Automated Configuration
**Claim:** Automated parameter configuration (e.g., ParamILS) and ML-guided heuristics significantly enhance the performance of classical OR solvers, often outperforming default settings by orders of magnitude.

*   **Supporting Sources:** [Source: ParamILS: An Automatic Algorithm Configuration Framework], [Source: Machine Learning for Combinatorial Optimization: a Methodological Tour d'Horizon]
*   **Contradicting Sources:** None.
*   **Confidence:** **High.** Empirical evidence consistently shows that using ML to tune classical solvers (ParamILS) or approximate complex decision-making within existing algorithms provides a clear, measurable performance boost.

---

### 2. NCO Performance on Small-Scale Benchmarks
**Claim:** Neural Combinatorial Optimization (NCO) achieves near-optimal performance on standard, small-scale benchmarks (e.g., 2D Euclidean TSP with up to 100 nodes).

*   **Supporting Sources:** [Source: Neural Combinatorial Optimization with Reinforcement Learning], [Source: Attention, Learn to Solve Routing Problems!]
*   **Contradicting Sources:** [Source: Neural Combinatorial Optimization with Reinforcement Learning] (Note: Supervised learning for pointer networks is identified as suboptimal compared to RL-based approaches).
*   **Confidence:** **High.** Multiple state-of-the-art architectures (Attention Models, Pointer Networks) have validated this performance level on synthetic, uniform Euclidean distributions.

---

### 3. Inference Speed vs. Total Computational Cost
**Claim:** Neural solvers offer a distinct speed advantage at inference time due to amortized computation, but this is often offset by the high computational cost of the initial training phase.

*   **Supporting Sources:** [Source: Machine Learning for Combinatorial Optimization: a Methodological Tour d'Horizon]
*   **Contradicting Sources:** [Source: Neural Combinatorial Optimization with Reinforcement Learning] (Highlights that classical metaheuristics remain highly competitive when the total cost—including training—is considered).
*   **Confidence:** **Medium.** While the "amortized inference" benefit is theoretically sound, the literature lacks a standardized "total cost of ownership" metric that accounts for both training energy/time and the tuning time required for classical metaheuristics.

---

### 4. Generalization and Scaling Limitations
**Claim:** Learned solvers face significant challenges in generalizing to out-of-distribution instances and larger problem scales, often suffering from "generalization collapse" when moving beyond training parameters.

*   **Supporting Sources:** [Source: Machine Learning for Combinatorial Optimization: a Methodological Tour d'Horizon], [Source: Reinforcement Learning: A Survey], [Source: Neural Combinatorial Optimization with Reinforcement Learning]
*   **Contradicting Sources:** [Source: Neural Combinatorial Optimization with Reinforcement Learning] (Active Search is cited as a distribution-independent method that mitigates some generalization issues).
*   **Confidence:** **Medium.** While architectural innovations like Active Search provide some relief, the consensus remains that end-to-end neural models struggle to maintain performance when the problem distribution or scale shifts significantly from the training set.

---

### Summary of Evidence
| Claim | Confidence | Primary Driver |
| :--- | :--- | :--- |
| Hybrid/Automated Tuning | High | Proven ROI in industrial settings. |
| Small-Scale NCO Success | High | Consistent results on standard benchmarks. |
| Inference vs. Training Cost | Medium | Disagreement on total cost accounting. |
| Generalization/Scaling | Medium | Persistent "generalization collapse" issues. |