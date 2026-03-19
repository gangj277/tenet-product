# Overview: Learned Routing vs Classical OR (2016–2024)

## 1) Original research question
**How competitive are learned reinforcement-learning approaches for routing and combinatorial optimization relative to classical operations research methods?**

## 2) Interpreted research objective
To synthesize evidence on **where learned (neural/RL) routing solvers produce a clear, measurable advantage over classical OR approaches**, and where they **fail to meet expectations** in terms of:

- **Robustness** (sensitivity to instance variation, noise, constraint complexity)
- **Generalization/out-of-distribution (OOD) performance**
- **Scalability and effective runtime trade-offs** (amortized inference vs training/setup cost)
- **The strength (or absence) of guarantees**, including reliability and optimality bounds

## 3) Inferred research frame / working hypothesis
**“Amortization vs. Robustness” trade-off.**

- **Learned solvers** are hypothesized to be strongest when the task allows **fast repeated inference** on a **fixed or narrow distribution** (e.g., repeated routing instances with similar structure), potentially reducing solution time via amortized computation.
- **Classical OR methods** are hypothesized to remain stronger when the problem requires:
  - **robust handling of distribution shift**
  - **formal optimality / convergence guarantees** (or at least predictable behavior)
  - **reliable performance on harder, multi-constraint variants**
- **Hybridization** (using learned components to guide classical search or parameterization) is treated as a key mechanism that may shift the balance in learned approaches’ favor—without necessarily inheriting end-to-end neural systems’ generalization weaknesses.

## 4) Scope boundaries
This project is intentionally constrained to:

- **Problem classes:** routing and combinatorial optimization, particularly those represented in neural/RL NCO literature (e.g., TSP/variants, knapsack-style problems; routing contexts aligned with these benchmark families).
- **Method classes:** reinforcement learning and neural combinatorial optimization approaches, including learned guidance and learned/hybrid search strategies.
- **Comparators:** classical OR solvers, metaheuristics, exact methods, and automatic configuration frameworks that improve classical solvers.

It excludes:

- Broad “logistics deep learning” not grounded in **optimization/routing/combinatorial optimization** evaluation.
- General-purpose deep learning for operations without a direct optimization-performance comparison.
- Non-routing combinatorial optimization unrelated to the RL/NCO routing tradition, unless explicitly used as a comparator or methodological reference.

**Time window:** 2016–2024  
**Geography:** global literature  
**Output language:** English

### Must-answer sub-questions
1. **Where do learned methods claim advantages over classical solvers?**
2. **What limitations or evaluation caveats appear repeatedly?**
3. **What does the literature imply about real-world deployment readiness?**

## 5) Source inventory (uploaded vs. discovered)

### Uploaded sources
No sources were explicitly marked as **uploaded** in the provided material.

### Discovered sources
The following sources are included because they appear in the consolidated findings, with stable identifiers and cited claims.

1. **Neural Combinatorial Optimization with Reinforcement Learning**  
   - **Source ID:** 73d53ab4-4b1e-4298-b539-0411a6ba59ce  
   - **Provenance:** discovered  
   - **Contribution relevance:** reports strong benchmark claims for TSP (including 2D Euclidean TSP up to n=100), describes architectural/generalization limitations (e.g., cannot generalize beyond training sizes for certain seq2seq setups), and discusses active search as distribution-independent within the paper’s framework. Also contains comparisons involving OR tool metaheuristics as computational budgets increase.

2. **Attention, Learn to Solve Routing Problems!**  
   - **Source ID:** f5e8d0e9-d121-48eb-ae70-7e48a3a8a680  
   - **Provenance:** discovered  
   - **Contribution relevance:** canonical early attention-based learned routing approach claiming state-of-the-art TSP performance up to n=100.

3. **Machine Learning for Combinatorial Optimization: a Methodological Tour d'Horizon**  
   - **Source ID:** 457f7be9-c009-4252-91a3-a201b7155522  
   - **Provenance:** discovered  
   - **Contribution relevance:** methodological survey identifying recurring issues: generalization difficulty, scaling limits of many RL techniques, and framing of learned components (e.g., imitation learning value when speed is substantial). Serves as a central source for limitations/caveats and conceptual alignment with the “amortization vs robustness” frame.

4. **Reinforcement Learning: A Survey**  
   - **Source ID:** 8c17b181-d246-412a-824b-85b2750c3c2c  
   - **Provenance:** discovered  
   - **Contribution relevance:** general RL survey statements supporting the recurring claim that many RL methods work on small problems but scale poorly.

5. **ParamILS: An Automatic Algorithm Configuration Framework**  
   - **Source ID:** ce094c46-c68e-4855-b522-e4684060efa0  
   - **Provenance:** discovered  
   - **Contribution relevance:** evidence that classical solvers can be substantially improved via automated parameter configuration (including large speedups over defaults), which is critical for fair comparisons between “tuned classical OR” and learned solvers.

--- 

*Note:* The inventory reflects only sources explicitly referenced in the consolidated findings provided.