# Gaps in Learned Routing vs. Classical OR

This document outlines the current limitations in the literature regarding the efficacy of Neural Combinatorial Optimization (NCO) versus classical Operations Research (OR) methods.

## 1. Unresolved Questions
These areas represent fundamental gaps where the literature lacks consensus or empirical depth:

*   **Multi-Constraint Feasibility:** While NCO performs well on unconstrained TSP/Knapsack, there is a lack of evidence regarding performance on problems with complex, hard constraints (e.g., VRP with Time Windows, heterogeneous fleets, or backhauls). It is unclear if neural architectures can learn to navigate the feasible region as effectively as classical constraint programming.
*   **Total Cost of Ownership (TCO) Metrics:** Current literature often isolates "inference time" to claim superiority. There is no standardized framework for comparing the *total* computational budget (training time + hyperparameter tuning + inference) against the *tuning time* required for classical metaheuristics (e.g., LKH3 or Gurobi).
*   **Integration with Exact Methods:** The extent to which neural-hybrid solvers can retain the theoretical optimality guarantees of branch-and-bound while using learned branching policies remains an open research question.

## 2. Contradictions
These represent direct disagreements in the literature that require further investigation:

*   **Generalization vs. Distribution Independence:** Some sources claim that "Active Search" strategies render solvers distribution-independent, while others report a consistent "generalization collapse" when models are applied to instances outside the training distribution.
*   **The Role of REINFORCE:** There is a significant divide in the literature: some benchmarks exclude REINFORCE-based approaches due to poor performance, while foundational NCO papers (e.g., Bello et al., Kool et al.) rely on it as a core component of their state-of-the-art results.
*   **Amortization vs. Search:** There is no consensus on whether the primary value of ML in routing lies in the *construction* of the solution (end-to-end inference) or in the *search* routine (guiding classical local search).

## 3. Weak Evidence Areas
Claims in these areas rely on narrow experimental setups that may not reflect real-world utility:

*   **Synthetic Benchmarking:** A vast majority of high-confidence claims are based on 2D Euclidean TSP instances. These synthetic distributions likely mask the weaknesses of learned solvers, which may struggle with the non-Euclidean, high-variance cost matrices found in real-world logistics.
*   **Scaling Limits:** Evidence for NCO performance is heavily concentrated on $n \le 100$ nodes. Claims regarding the scalability of these models to enterprise-scale routing (e.g., $n > 500$) are currently unsupported by robust empirical data.

## 4. What Would Change Confidence
To move from experimental prototypes to production-grade readiness, the following evidence is required:

*   **Standardized "Real-World" Benchmarks:** A shift from synthetic 2D Euclidean datasets to public, industry-standard datasets (e.g., CVRPLIB) that include realistic constraints and non-Euclidean distance metrics.
*   **Comparative TCO Studies:** Studies that report the "Energy-to-Solution" or "Total Time-to-Solution" (including training/tuning) for both NCO and classical solvers.
*   **Robustness Testing:** Systematic evaluation of "generalization gap" metrics, specifically measuring performance decay when moving from uniform distributions to clustered or real-world geographic distributions.
*   **Hybrid Benchmarking:** Direct comparisons between "End-to-End" neural solvers and "Neural-Guided" classical solvers (e.g., using GNNs to select branching variables in Gurobi) to determine which paradigm offers the most practical ROI.