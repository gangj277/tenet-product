# Research Memo: Learned Routing vs. Classical Operations Research

## Research Question and Frame
This synthesis evaluates the competitive utility of reinforcement learning (RL) and neural combinatorial optimization (NCO) relative to classical operations research (OR) methods (e.g., LKH-3, Gurobi). The research tests the **Comparative Utility Framework**, weighing the "Amortized Efficiency" of learned solvers against the "Robust Optimality" of classical heuristics. The central hypothesis is that while RL solvers offer rapid inference for specific distributions, they are currently distribution-specific accelerators rather than robust general-purpose replacements for OR.

---

## 1. Evidence FOR the Frame: The Case for Amortized Efficiency
The primary advantage of learned methods lies in their ability to provide near-instantaneous inference once a model is trained, particularly for high-velocity environments.

*   **Inference Speed:** Neural solvers claim a significant advantage in "fast-mode" scenarios where decisions must be made in milliseconds. In these specific windows, RL-based approaches can outperform classical solvers that require iterative search time [Source: 1, Section: Performance Comparison].
*   **Handling Non-Linearity:** Learned models are noted for their potential to handle "black-box" or non-linear objective functions that are mathematically difficult to formulate for traditional Mixed-Integer Linear Programming (MILP) solvers [Source: 1, Section: Methodology].
*   **Unsupervised Potential:** There is emerging evidence that unsupervised training paradigms can outperform supervised learning for specific constraint satisfaction problems, potentially reducing the need for expensive labeled datasets of optimal solutions [Source: 6, Section: Training Paradigms].

---

## 2. Evidence AGAINST the Frame: The Dominance of Classical OR
The evidence strongly suggests that the perceived superiority of neural solvers is often an artifact of limited benchmarking or unfair time-budgeting.

*   **The Scalability Wall:** Neural solvers experience severe performance degradation when tested on problem sizes ($N$) larger than those used in training. This "generalization gap" persists up to 10M nodes, where classical heuristics maintain dominance [Source: 1, Section: Scalability; Source: 5, Section: Generalization].
*   **Superiority of Classical Heuristics:** State-of-the-art classical algorithms like **LKH-3** consistently outperform Graph Neural Networks (GNNs) in both solution quality and efficiency, even when the classical solvers are restricted to "fast" configurations [Source: 1, Section: Results].
*   **Hard Constraint Failure:** On hard phase-transition instances (e.g., 4-SAT, 5-coloring), classical algorithms maintain significantly higher algorithmic thresholds than neural approaches, which struggle to satisfy complex global constraints [Source: 6, Section: Constraint Satisfaction].
*   **Hardware and Memory Bottlenecks:** Neural solvers face critical scalability limits due to high memory requirements and frequent out-of-memory (OOM) failures on large-scale instances, whereas classical OR methods scale more gracefully with available RAM [Source: 1, Section: Hardware Constraints].

---

## 3. Unresolved Tensions and Disagreements
*   **Hybridization vs. End-to-End:** There is a strong consensus that **hybridization**—using neural modules to guide classical search (e.g., learning branching rules or neighborhood selection)—is more effective than pure end-to-end neural solution generation [Source: 1, 2, 3, 6]. However, it remains an open question whether neural modules can provide meaningful gains when enhancing *already strong* state-of-the-art heuristics versus merely improving weak base solvers [Source: 1, Section: Hybridization].
*   **LLM-Based Discovery:** Recent attempts to use Large Language Models (LLMs) to discover new routing heuristics show promise, but their high variance and lack of underlying reasoning make their reliability a point of contention among researchers [Source: Consolidated Findings, Unresolved Disagreements].

---

## 4. Methodological Cautions
*   **Unfair Benchmarking:** Many claims of ML superiority are based on "toy-scale" benchmarks or comparisons where classical solvers are not properly tuned or are given insufficient time budgets [Source: 1, Section: Evaluation Bias].
*   **Structural Distribution Shifts:** The "generalization gap" is not merely a function of node count; structural shifts in the problem distribution (e.g., moving from uniform to clustered nodes) significantly degrade neural performance [Source: 1, 5, 6].
*   **Local vs. Global Structure:** GNN-based solvers implicitly rely on local Euclidean structures. They frequently fail to capture the global constraints necessary for non-Euclidean or highly constrained routing problems [Source: 1, Section: GNN Limitations].

---

## 5. Bottom-Line Takeaway
The evidence suggests that **learned routing solvers are not currently competitive as general-purpose replacements for classical OR methods.** While they offer high-speed inference for specific, narrow distributions, they fail on robustness, scalability, and out-of-distribution performance. 

**Practical Deployment Readiness:** Neural methods are best suited for **hybrid architectures** where they accelerate specific components of a classical solver, or for **niche, high-frequency applications** where the problem distribution is static and the cost of training is amortized over millions of near-identical sub-problems. For general-purpose or large-scale industrial routing, classical meta-heuristics (LKH-3, LNS) remain the gold standard.