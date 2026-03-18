# Research Overview: Learned Routing vs. Classical Operations Research

## Research Question
How competitive are learned reinforcement-learning (RL) approaches for routing and combinatorial optimization relative to classical operations research (OR) methods?

## Research Objective
This synthesis evaluates the practical utility and performance boundaries of neural combinatorial optimization. The objective is to identify the specific problem characteristics—such as scale, distribution, and real-time constraints—where learned solvers provide a justifiable advantage over classical heuristics, accounting for training overhead and the absence of formal optimality guarantees.

## Research Frame and Working Hypothesis
This project utilizes a **Comparative Utility Framework**, weighing **Amortized Efficiency** (learned approaches) against **Robust Optimality** (classical approaches). 

**Working Hypothesis:** 
Learning-based approaches are effective for high-frequency, distribution-specific routing tasks where inference speed is critical. However, classical OR methods remain superior in terms of robustness, solution guarantees, and performance on out-of-distribution (OOD) instances. RL solvers act primarily as distribution-specific accelerators rather than general-purpose replacements for established OR solvers.

## Scope Boundaries
*   **Inclusions:** Peer-reviewed literature (2016–2024) comparing neural/RL approaches with classical heuristics (e.g., LKH-3, Gurobi) in the context of routing (TSP, VRP) and combinatorial optimization (SAT, Max-Cut).
*   **Exclusions:** General deep learning applications in logistics, supply chain management, or broad predictive analytics that do not involve direct combinatorial solver competition.

## Source Inventory
The following sources form the basis of this synthesis, categorized by their provenance:

### Discovered Literature (Research Database)
*   **Source 1:** Comparative analysis of neural solvers vs. LKH-3 on large-scale instances (up to 10M nodes). Focuses on the "generalization gap" and hardware bottlenecks.
*   **Source 2:** Evaluation of hybrid ML-OR frameworks, specifically neural-guided search in routing.
*   **Source 3:** Study on the integration of neural modules within meta-heuristic frameworks (e.g., Large Neighborhood Search).
*   **Source 4:** Analysis of LLM-based agent performance in algorithmic discovery for optimization.
*   **Source 5:** Investigation into structural distribution shifts and their impact on neural solver accuracy.
*   **Source 6:** Empirical study of Graph Neural Networks (GNNs) vs. classical algorithms on hard constraint satisfaction problems (4-SAT, 5-coloring).

## Key Research Themes
1.  **The Scalability Wall:** Evidence indicates a significant performance degradation in neural solvers when problem sizes exceed training distributions.
2.  **Hybridization Superiority:** The most effective deployment of machine learning currently appears to be the enhancement of classical search methods rather than end-to-end neural generation.
3.  **Efficiency Paradox:** While neural solvers claim speed advantages, classical heuristics often maintain superior solution quality even when restricted to similar "fast-mode" time budgets.
4.  **Hardware and Memory Constraints:** Neural approaches face significant deployment hurdles due to high GPU memory requirements and over-parameterization compared to the lightweight nature of classical C++ based heuristics.