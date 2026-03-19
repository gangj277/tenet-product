# Claims: Learned Routing vs. Classical OR

This document synthesizes the current literature regarding the competitiveness of learned reinforcement learning (RL) approaches against classical Operations Research (OR) methods for routing and combinatorial optimization (CO).

---

### 1. Hybrid Approaches and Automated Configuration Enhance Classical Solvers
**Claim:** Integrating machine learning to automate parameter configuration or to approximate complex decision-making within classical algorithms significantly improves performance over default settings.

*   **Supporting Sources:**
    *   [Source: ParamILS: An Automatic Algorithm Configuration Framework]: Found parameter configurations that outperformed CPLEX defaults by over an order of magnitude, with speedups up to 3540x.
    *   [Source: Machine Learning for Combinatorial Optimization: a Methodological Tour d'Horizon]: ML offers a way to approximate complex decisions within CO algorithms, potentially improving performance.
*   **Contradicting Sources:** None.
*   **Confidence Assessment:** **High.** There is strong empirical evidence that ML-assisted configuration is a mature, high-ROI application in OR.

---

### 2. Neural Combinatorial Optimization (NCO) Achieves Near-Optimality on Small-Scale Benchmarks
**Claim:** NCO models, particularly those using attention mechanisms, achieve near-optimal performance on standard, small-scale (up to 100 nodes) 2D Euclidean TSP and Knapsack problems.

*   **Supporting Sources:**
    *   [Source: Neural Combinatorial Optimization with Reinforcement Learning]: Achieves close to optimal results on 2D Euclidean graphs with up to 100 nodes.
    *   [Source: Attention, Learn to Solve Routing Problems!]: The Attention Model (AM) achieves state-of-the-art results on TSP for up to 100 nodes.
*   **Contradicting Sources:**
    *   [Source: Neural Combinatorial Optimization with Reinforcement Learning]: Notes that supervised learning for pointer networks remains suboptimal compared to other approaches.
*   **Confidence Assessment:** **High.** The performance on synthetic, small-scale Euclidean benchmarks is well-documented and consistent across leading papers.

---

### 3. Learned Solvers Face Significant Generalization Challenges
**Claim:** Learned policies struggle to generalize to out-of-distribution instances or problem scales larger than those encountered during the training phase.

*   **Supporting Sources:**
    *   [Source: Machine Learning for Combinatorial Optimization: a Methodological Tour d'Horizon]: Generalizing learned policies to unseen problems is a challenge; performance degrades as instance size increases beyond training sizes.
    *   [Source: Reinforcement Learning: A Survey]: Many RL techniques work well on small problems but scale poorly to larger ones.
    *   [Source: Neural Combinatorial Optimization with Reinforcement Learning]: Vanilla seq2seq models cannot generalize to more cities than seen during training.
*   **Contradicting Sources:**
    *   [Source: Neural Combinatorial Optimization with Reinforcement Learning]: Argues that "Active Search" is distribution-independent and improves generalization.
*   **Confidence Assessment:** **Medium.** While architectural innovations like Active Search mitigate some issues, "generalization collapse" remains a widely reported risk in the literature.

---

### 4. Amortized Inference vs. Total Computational Cost
**Claim:** Neural solvers provide a speed advantage at inference time due to amortized computation, but this is often offset by the high computational cost of the training phase when compared to classical metaheuristics.

*   **Supporting Sources:**
    *   [Source: Machine Learning for Combinatorial Optimization: a Methodological Tour d'Horizon]: Imitation learning is valuable if the learned policy is significantly faster than the expert's.
*   **Contradicting Sources:**
    *   [Source: Neural Combinatorial Optimization with Reinforcement Learning]: Classical solvers remain highly competitive when considering the total computational cost, as metaheuristics can be tuned to provide high-quality solutions without the massive upfront training overhead.
*   **Confidence Assessment:** **Medium.** There is an unresolved tension between the "inference-only" speed of neural models and the "total-cost-of-ownership" (training + inference) of learned systems versus classical solvers.