# Next Steps: Learned Routing vs. Classical OR

This document outlines the immediate research trajectory to move from a high-level synthesis to a rigorous technical evaluation of the "Amortization vs. Robustness" trade-off.

## 1. Concrete Research Directions
*   **Benchmark Stress-Testing:** Move beyond 2D Euclidean TSP. Focus on identifying papers that evaluate performance on **CVRP (Capacitated Vehicle Routing Problem)** and **VRPTW (Vehicle Routing Problem with Time Windows)**. These problems introduce hard constraints that often break pure neural architectures.
*   **The "Training Cost" Audit:** Quantify the "Total Cost of Ownership" for a solver. Compare the wall-clock time of training a Transformer-based RL model versus the time required for a classical metaheuristic (e.g., LKH3 or OR-Tools) to reach a comparable gap on a specific distribution.
*   **Hybridization Taxonomy:** Categorize existing literature into:
    *   *End-to-End:* Neural network outputs the solution directly.
    *   *Neural-Guided:* Neural network predicts branching variables or heuristic parameters (e.g., learned branching rules in SCIP).
    *   *Neural-Enhanced:* Neural network acts as a local search operator (e.g., learned neighborhood selection).

## 2. Hypothesis Refinements
*   **Refinement 1 (The "Constraint" Barrier):** Learned models are currently competitive only on "unconstrained" or "soft-constrained" problems. As the number of hard constraints (time windows, capacity) increases, the neural model's inability to guarantee feasibility becomes a fatal flaw, shifting the value proposition toward *Neural-Guided* rather than *End-to-End* approaches.
*   **Refinement 2 (Amortization ROI):** The "amortization" advantage of RL is only realized in high-frequency, low-variance environments (e.g., daily last-mile delivery in the same city). In low-frequency or high-variance environments, the "tuning time" of classical metaheuristics is actually lower than the "training time" of a robust neural model.

## 3. Agent Chat Exploration
*   **Query 1:** "Compare the performance of the 'Attention Model' (Kool et al.) against LKH3 on the CVRPLIB benchmark. Where does the gap widen, and what specific constraints cause the neural model to fail?"
*   **Query 2:** "What are the current state-of-the-art methods for integrating neural branching policies into branch-and-bound solvers? Do these methods maintain the optimality guarantees of the underlying solver?"
*   **Query 3:** "Search for literature on 'Generalization Collapse' in NCO. Are there specific architectural features (e.g., permutation invariance, graph neural networks) that have been proven to mitigate this?"

## 4. Recommended Resources
*   **Key Papers to Investigate:**
    *   *Kool et al. (2019):* "Attention, Learn to Solve Routing Problems!" (Baseline for current NCO).
    *   *Gasse et al. (2019):* "Exact Combinatorial Optimization with Graph Convolutional Neural Networks" (Focus on the hybrid approach).
    *   *Bengio et al. (2021):* "Machine Learning for Combinatorial Optimization: a Methodological Tour d'Horizon" (Use this as your primary framing guide).
*   **Datasets:**
    *   **TSPLIB / CVRPLIB:** The gold standard for benchmarking. If a paper doesn't report results here, treat its claims with skepticism.
    *   **OR-Tools Examples:** Use the Google OR-Tools routing library as your "Classical Baseline" for all comparisons.
*   **Methods:**
    *   **Active Search:** Investigate if this is a viable middle ground for "one-off" problems where training a full model is overkill.
    *   **Automated Algorithm Configuration (ParamILS/SMAC):** Use these as the benchmark for "learning" in the classical OR space to see if they outperform neural approaches in terms of development time.