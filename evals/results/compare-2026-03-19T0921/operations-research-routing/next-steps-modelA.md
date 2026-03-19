# Next Steps: Learned Routing vs. Classical OR

This document outlines the immediate research trajectory to synthesize the trade-offs between Neural Combinatorial Optimization (NCO) and classical Operations Research (OR).

## 1. Concrete Follow-up Research Directions

*   **Quantify the "Amortization Break-even Point":** Conduct a comparative analysis of the total computational budget (Training Time + Inference Time) vs. Classical Heuristic Runtime (Tuning Time + Execution Time). Focus on the number of instances required to reach the "break-even" point where the NCO model's inference speed compensates for its training cost.
*   **Stress-Test Generalization Boundaries:** Move beyond uniform 2D Euclidean distributions. Investigate performance on "real-world" graph structures (e.g., clustered nodes, road-network-based distance matrices, or non-Euclidean cost functions) to see if the reported "generalization collapse" is a property of the model architecture or the training data distribution.
*   **Hybrid Solver Benchmarking:** Shift focus from "End-to-End" RL to "Neural-Guided" search. Specifically, investigate how learned branching heuristics in Branch-and-Bound (B&B) compare to traditional variable selection rules (e.g., strong branching) in terms of both node count reduction and total wall-clock time.

## 2. Promising Hypothesis Refinements

*   **The "Constraint Complexity" Hypothesis:** Learned models are currently competitive only for "unconstrained" or "simple-constraint" problems (e.g., TSP). As constraints increase (e.g., VRP with Time Windows, Capacity, and Heterogeneous Fleets), the feasibility space becomes too sparse for current neural architectures to learn effectively, making classical constraint programming (CP) or hybrid metaheuristics strictly superior.
*   **The "Search vs. Construction" Hypothesis:** The most promising path for NCO is not as an end-to-end solver, but as a "policy-based search operator" (e.g., learning to select the next neighborhood in Large Neighborhood Search) rather than a direct solution constructor.

## 3. Questions for Agent Chat

*   "Can you identify papers that specifically compare the performance of GNN-based branching rules against traditional strong branching in MILP solvers like SCIP or Gurobi?"
*   "What are the most common 'failure modes' for Attention-based routing models when applied to instances with 500+ nodes?"
*   "Are there existing benchmarks that measure the performance of solvers on 'distributionally robust' routing—where the model is trained on one distribution but tested on another?"
*   "What is the current state of 'Neural-Hybrid' solvers that maintain formal optimality guarantees (e.g., using neural networks only to prune the search space without discarding optimal solutions)?"

## 4. Recommended Resources & Methods

*   **Papers to Investigate:**
    *   *Gasse et al. (2019), "Exact Combinatorial Optimization with Graph Convolutional Neural Networks":* Essential for understanding the hybrid approach to branching.
    *   *Cappart et al. (2021), "Combinatorial Optimization and Reasoning with Machine Learning":* A comprehensive survey to help map the landscape of hybrid methods.
    *   *Kool et al. (2019), "Attention, Learn to Solve Routing Problems!":* The baseline for current state-of-the-art in NCO.
*   **Datasets:**
    *   **TSPLIB:** The gold standard for testing generalization beyond synthetic uniform distributions.
    *   **VRPLIB:** For testing multi-constraint routing performance.
*   **Methods:**
    *   **Active Search:** Investigate this as a method to mitigate the "generalization collapse" identified in the findings.
    *   **Automated Algorithm Configuration (ParamILS/SMAC):** Use these as the "control group" to determine if the performance gains of NCO are actually just better hyperparameter tuning of classical methods.