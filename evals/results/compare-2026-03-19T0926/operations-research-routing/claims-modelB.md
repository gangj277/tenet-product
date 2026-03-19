## Claim 1 (strongest evidence)
**Claim:** Neural Combinatorial Optimization (NCO) achieves near-optimal performance on standard benchmarks such as 2D Euclidean TSP (up to 100 nodes) and Knapsack/TSP settings reported in the NCO literature.

**Supporting sources:**
- [Source: Neural Combinatorial Optimization with Reinforcement Learning] (ABSTRACT)  
  “Neural Combinatorial Optimization achieves close to optimal results on 2D Euclidean graphs with up to 100 nodes.”
- [Source: Attention, Learn to Solve Routing Problems!] (ABSTRACT)  
  “Our model achieves state-of-the-art results on the Traveling Salesman Problem (TSP) for up to 100 nodes”

**Contradicting sources (if any):**
- None directly contradicting near-optimality; one related qualification about method family comparisons (see Claim 5).

**Confidence assessment:** **High** — Multiple primary NCO/attention-routing papers report close-to-optimal or state-of-the-art results on TSP up to 100 nodes.

---

## Claim 2
**Claim:** Learned routing/optimization policies face significant challenges generalizing to out-of-distribution instances and to larger problem scales than those seen during training.

**Supporting sources:**
- [Source: Machine Learning for Combinatorial Optimization: a Methodological Tour d'Horizon] (7 Conclusions)  
  “Learning policies that generalize to unseen problems is a challenge.”
- [Source: Reinforcement Learning: A Survey] (9. Conclusions)  
  “Many reinforcement-learning techniques work well on small problems but scale poorly to larger ones.”
- [Source: Machine Learning for Combinatorial Optimization: a Methodological Tour d'Horizon] (6.3 Scaling)  
  “Performance degrades as instance size increases beyond training sizes.”

**Contradicting sources (if any):**
- [Source: Neural Combinatorial Optimization with Reinforcement Learning] (4.1 SEARCH STRATEGIES)  
  “In contrast, Active Search is distribution independent.”

**Confidence assessment:** **Medium** — Strong consensus about generalization/scaling difficulty, with some mitigation suggested by distribution-independent search variants; however, the degree of mitigation is unclear from the provided excerpts.

---

## Claim 3
**Claim:** Automated parameter configuration (e.g., ParamILS) can significantly improve classical OR solver performance over default settings, yielding large practical speedups.

**Supporting sources:**
- [Source: ParamILS: An Automatic Algorithm Configuration Framework] (7. Case Study)  
  “parameter configurations that significantly outperformed CPLEX defaults… sometimes by over an order of magnitude.”
- [Source: ParamILS: An Automatic Algorithm Configuration Framework] (6.1 Empirical Comparison)  
  “Substantial speedups… with factors up to 3540”
  
**Contradicting sources (if any):**
- None provided.

**Confidence assessment:** **High** — Concrete empirical evidence that classical solvers can be dramatically improved via automated tuning.

---

## Claim 4
**Claim:** Learned solvers can provide inference-time speed advantages via amortized computation, but the training overhead is substantial; accounting for end-to-end costs may leave classical methods highly competitive.

**Supporting sources:**
- [Source: Machine Learning for Combinatorial Optimization: a Methodological Tour d'Horizon] (7 Conclusions)  
  “Imitation learning is valuable if the learned policy is significantly faster than the expert's.”
- [Source: Neural Combinatorial Optimization with Reinforcement Learning] (A.3 OR TOOL'S METAHEURISTICS)  
  “times increasing significantly” as more solutions are considered (used here as evidence that classical compute costs can be nontrivial to factor in comprehensively).

**Contradicting sources (if any):**
- The “contradiction” is partial and conditional: classical methods may remain competitive once total compute cost is considered, rather than denying inference-time speed claims.  
  [Source: Neural Combinatorial Optimization with Reinforcement Learning] (A.3 OR TOOL'S METAHEURISTICS) indicates increasing times for OR tools’ metaheuristics.

**Confidence assessment:** **Medium** — The premise about amortization/inference speed is well-supported conceptually; the net competitiveness when including training/tuning costs is presented with indirect evidence from the excerpted material.

---

## Claim 5 (weaker evidence / more conditional)
**Claim:** Supervised learning approaches (e.g., pointer networks) are not competitive with stronger NCO baselines under the NCO framework; they remain suboptimal compared to other approaches.

**Supporting sources:**
- [Source: Neural Combinatorial Optimization with Reinforcement Learning] (5 EXPERIMENTS)  
  “all of which are suboptimal compared to other approaches.”

**Contradicting sources (if any):**
- None provided in the consolidated findings.

**Confidence assessment:** **Low** — The excerpt provides a general comparative statement (“suboptimal”) without specifying the precise competitor set, metrics, or magnitude; thus the claim is not tightly quantified here.