# Next Steps: Learned Routing vs. Classical OR

Based on the synthesis of current literature (2016–2024), the research has established a clear "scalability wall" for pure neural solvers and a consensus that hybridization is the most viable path forward. The following steps are designed to move the project from broad synthesis to a targeted investigation of the "Generalization Limit" and the efficacy of "Neural-Classical Hybrids."

---

### 1. Concrete Follow-up Research Directions

*   **Quantifying the "Generalization Limit":** Conduct a meta-analysis of performance decay rates. Specifically, map the percentage drop in optimality gap as a function of the ratio between *Test N* and *Train N*. Identify if there is a "phase transition" point where neural solvers become worse than a simple Greedy Randomized Adaptive Search Procedure (GRASP).
*   **The "Strong Heuristic" Challenge:** Investigate whether neural modules provide marginal utility when integrated into state-of-the-art (SOTA) meta-heuristics like **LKH-3** or **HGS-CVRP**. Most papers show gains over weak baselines; the real test is whether ML can improve a solver that is already 99.9% optimal.
*   **Non-Euclidean Robustness Analysis:** Compare GNN performance on standard Euclidean TSP/VRP against "Real-World Road Network" graphs (which have higher diameters and different degree distributions). Test the hypothesis that GNNs fail as the graph moves further from a planar embedding.
*   **Hardware-Aware Benchmarking:** Develop a "Total Cost of Inference" metric that includes GPU memory overhead and power consumption, comparing it to CPU-only classical heuristics to challenge the "amortized efficiency" claim.

---

### 2. Promising Hypothesis Refinements

*   **Refinement A (The Hybridization Hypothesis):** "Neural networks are ineffective as end-to-end solvers for NP-hard routing but are superior to hand-tuned heuristics for **Large Neighborhood Search (LNS) operator selection** and **variable ordering** in branch-and-bound."
*   **Refinement B (The Distributional Niche):** "Learned solvers only justify their training overhead in 'high-velocity, low-variance' environments—where the problem distribution is static and decision latency must be <100ms—rendering them unsuitable for strategic or daily planning."
*   **Refinement C (The Structural Limit):** "The failure of GNNs on large-scale instances is not a capacity issue but a structural limitation of message-passing, which cannot capture the global topological constraints required for long-cycle Hamiltonian paths."

---

### 3. Questions for Agent Chat Exploration

*   "Can you find recent (2023-2024) papers where RL was used specifically to tune the parameters of **LKH-3** or **Gurobi** in real-time?"
*   "What are the specific failure modes reported when Transformer-based routing solvers (like POMO or Sym-NCO) are applied to asymmetric TSP (ATSP)?"
*   "Identify any studies that compare the energy consumption (Joules per solution) of a GPU-based neural solver versus a single-threaded C++ implementation of a Savings Heuristic."
*   "Are there any documented cases of 'Neural-Classical' hybrids being used in production by major logistics firms (e.g., UPS, DHL, Amazon)?"

---

### 4. Specific Papers, Datasets, and Methods to Investigate

#### **Key Papers**
*   **"Neural Combinatorial Optimization with Reinforcement Learning" (Bello et al.):** Re-examine the original benchmarks to see how they hold up against modern classical implementations.
*   **"Deep Reinforcement Learning for Solving the Vehicle Routing Problem" (Nazari et al.):** Focus on their handling of dynamic constraints.
*   **"The Traveling Salesman Problem: A Case Study in Graph Convolutional Networks" (Joshi et al.):** Specifically for the discussion on the limitations of fixed-graph embeddings.

#### **Datasets & Benchmarks**
*   **TSPLIB & CVRPLIB:** The gold standard. Any claim of RL superiority must be verified against these specific instances.
*   **Logistics800:** A dataset of real-world industrial routing problems to test out-of-distribution (OOD) performance.
*   **DIMACS Implementation Challenges:** Use these to find the most rigorous classical baselines.

#### **Methods to Explore**
*   **NeuroLNS:** A framework for using neural networks to learn the "destroy" and "repair" operators in Large Neighborhood Search.
*   **Differentiable Programming for OR:** Investigating solvers that allow gradients to flow through classical optimization layers (e.g., CvxpyLayers).
*   **Pointer Networks vs. Attention Mechanisms:** Determine which architecture handles the "permutation invariance" of routing tasks with the least memory overhead.