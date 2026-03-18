# Research Claims: Learned Routing vs. Classical Operations Research

This document catalogs the major claims regarding the performance, scalability, and practical utility of reinforcement learning (RL) and neural solvers compared to classical Operations Research (OR) methods in routing and combinatorial optimization.

---

### 1. Neural solvers exhibit a significant 'generalization gap' and performance degradation when scaled beyond training distributions.
*   **Claim Statement:** Neural solvers experience severe performance drops when applied to problem sizes (node counts) or structural distributions that differ from their training data.
*   **Supporting Sources:** 
    *   [Source: SOURCE 1] - High confidence: Notes severe degradation on different scales and distributions.
    *   [Source: 1, 5, 6] - High confidence: Confirms the gap is exacerbated by structural shifts, not just size.
*   **Contradicting Sources:** None.
*   **Confidence Assessment:** **High**. There is strong consensus across multiple studies that neural models are distribution-specific and struggle with out-of-distribution (OOD) generalization.

### 2. Classical heuristics consistently outperform pure neural solvers on large-scale and hard instances.
*   **Claim Statement:** Established algorithms (e.g., LKH-3, Gurobi) maintain a dominant lead in solution quality and efficiency, particularly as problem complexity and size increase.
*   **Supporting Sources:** 
    *   [Source: SOURCE 6] - High confidence: Classical algorithms outperform GNNs on hard constraint satisfaction problems.
    *   [Source: SOURCE 1] - High confidence: Neural solvers are often less efficient than classical heuristics even when both are configured for high-speed execution.
*   **Contradicting Sources:** None.
*   **Confidence Assessment:** **High**. Empirical evidence consistently shows that the "algorithmic threshold" of classical solvers is higher than that of current neural approaches for complex instances.

### 3. Hybridization is the most effective practical application of Machine Learning in combinatorial optimization.
*   **Claim Statement:** The most successful use of ML is not as an end-to-end solver, but as a neural module used to guide or accelerate classical search heuristics.
*   **Supporting Sources:** 
    *   [Source: 1, 2, 3, 6] - High confidence: Hybrid approaches outperform pure end-to-end neural generation.
    *   [Source: SOURCE 1] - Medium confidence: Suggests neural solvers are primarily effective when enhancing "weak" base heuristics.
*   **Contradicting Sources:** None.
*   **Confidence Assessment:** **High**. The literature suggests a paradigm shift toward "ML-for-OR" (augmentation) rather than "ML-as-OR" (replacement).

### 4. Neural solvers face critical hardware bottlenecks and scalability limits.
*   **Claim Statement:** High memory requirements, over-parameterization, and the need for iterative message-passing create significant hardware barriers for neural solvers at scale.
*   **Supporting Sources:** 
    *   [Source: SOURCE 1] - High confidence: Documents frequent out-of-memory (OOM) failures and high memory overhead.
    *   [Source: SOURCE 6] - Medium confidence: Notes that GNNs require increasing message-passing iterations to maintain performance as $N$ grows.
*   **Contradicting Sources:** None.
*   **Confidence Assessment:** **High**. The computational footprint of deep learning models often offsets the theoretical speed gains of amortized inference.

### 5. GNN-based solvers are fundamentally limited by a reliance on local/Euclidean structures.
*   **Claim Statement:** Graph Neural Networks (GNNs) struggle to capture global problem constraints and perform poorly on non-Euclidean optimization problems.
*   **Supporting Sources:** 
    *   [Source: SOURCE 1] - High confidence: GNNs implicitly rely on local structures and fail to capture global dependencies in non-Euclidean settings.
*   **Contradicting Sources:** None.
*   **Confidence Assessment:** **Medium**. While the evidence is strong, this claim is based on a more specific subset of architectural analysis compared to general performance benchmarks.

### 6. Unsupervised training paradigms outperform supervised learning for constraint satisfaction.
*   **Claim Statement:** Training neural solvers without labeled optima (unsupervised) yields better results for certain constraint satisfaction tasks than supervised learning.
*   **Supporting Sources:** 
    *   [Source: SOURCE 6] - Medium confidence: Reports superior performance for unsupervised paradigms in specific contexts.
*   **Contradicting Sources:** Implicitly contradicted by the general dominance of supervised/RL-based routing papers in the broader field.
*   **Confidence Assessment:** **Medium**. This is a specialized finding that may not apply universally across all routing and optimization domains.