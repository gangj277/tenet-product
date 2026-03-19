# Learned Routing vs Classical OR — Overview

## 1. Original research question
**How competitive are learned reinforcement-learning approaches for routing and combinatorial optimization relative to classical operations research methods?**

## 2. Interpreted research objective
To synthesize the evidence and identify **where learned RL/neural solvers are genuinely competitive** with classical OR methods (e.g., improved objective quality at lower inference latency, or meaningful search acceleration), and **where they remain weaker** due to shortcomings in:
- **Robustness and out-of-distribution (OOD) generalization**
- **Scaling to larger instance sizes**
- **Hard guarantees/optimality bounds and convergence behavior**
- **Practical deployment readiness** (e.g., training/tuning cost accounting)

Concretely, the project targets the operational trade-off between **amortized inference speed** (learning-based) and **robustness/guarantees** (classical OR).

## 3. Inferred research frame / working hypothesis
**“Amortization vs. Robustness” trade-off.** Learned routing/optimization methods are most likely to outperform classical OR in settings where:
- there is **repeat structure** across a target distribution of instances,
- **fast repeated solving** yields an ROI, and
- the method’s search or policy remains stable under mild perturbations.

However, learned approaches are expected to **degrade** when:
- instances move beyond training regimes (OOD / scaling shifts),
- instance size exceeds the training envelope,
- hard feasibility and constraint satisfaction dominate difficulty (multi-constraint routing),
- formal optimality/robustness guarantees are required.

The synthesis will therefore test a comparative lens across benchmarks, scaling regimes, and evaluation protocols—especially whether any reported advantages survive **strict cost accounting** (including training time and tuning overhead).

## 4. Scope boundaries
**Included:**
- Routing and combinatorial optimization literature (primarily **2016–2024**) that investigates **neural/RL approaches** and/or compares against **classical OR solvers/heuristics**.
- Work focusing on learned solvers’ performance claims, generalization/scaling behavior, and hybridizations (e.g., learned guidance embedded into classical search).

**Excluded:**
- Broad deep learning for logistics without a routing/optimization focus.
- Generic reinforcement learning benchmarks not tied to combinatorial optimization/routing.

**Problem families emphasized by the working evidence:**
- **TSP / Euclidean TSP**
- **Knapsack**
- Routing variants where feasibility is nontrivial (notably multi-constraint settings, as discussed in the synthesis’s open questions)
- Algorithm configuration and tuning as a classical baseline enhancement (e.g., ParamILS)

## 5. Source inventory (with provenance)
### Uploaded sources
1. **Neural Combinatorial Optimization with Reinforcement Learning** — sourceId: `73d53ab4-4b1e-4298-b539-0411a6ba59ce`  
   - Key evidence used: claims of near-optimal performance on small Euclidean TSP (up to ~100 nodes); limitations on generalizing beyond training sizes (e.g., inability of seq2seq variants to generalize to more cities than seen); notes on architectural/search choices (e.g., active search as potentially distribution independent); discussion of OR-Tools metaheuristics timing trade-offs.

2. **Machine Learning for Combinatorial Optimization: a Methodological Tour d'Horizon** — sourceId: `457f7be9-c009-4252-91a3-a201b7155522`  
   - Key evidence used: generalization difficulty and scaling degradation; typical RL scaling limitations; methodological framing of learning within combinatorial optimization; discussion of imitation learning conditions relative to speedups; references to hybrid/search components (e.g., active search comparisons).

3. **ParamILS: An Automatic Algorithm Configuration Framework** — sourceId: `ce094c46-c68e-4855-b522-e4684060efa0`  
   - Key evidence used: classical solver enhancement via automated parameter configuration; empirical speedups over default settings (including order-of-magnitude improvements for specific problem cases).

### Discovered sources (unuploaded)
4. **Attention, Learn to Solve Routing Problems!** — sourceId: `f5e8d0e9-d121-48eb-ae70-7e48a3a8a680`  
   - Key evidence used: claim of state-of-the-art performance for TSP up to ~100 nodes via the Attention Model.

5. **Reinforcement Learning: A Survey** — sourceId: `8c17b181-d246-412a-824b-85b2750c3c2c`  
   - Key evidence used: general statement that many RL methods perform well on small problems but scale poorly to larger ones.

--- 

*End of overview.*