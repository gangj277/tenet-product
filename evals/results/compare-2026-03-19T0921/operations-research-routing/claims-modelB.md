## Claim 1: Neural Combinatorial Optimization (NCO) achieves near-optimal performance on standard benchmarks such as 2D Euclidean TSP (up to 100 nodes)
- **Claim statement:** NCO achieves close-to-optimal performance on common combinatorial optimization benchmarks, specifically 2D Euclidean TSP graphs with up to 100 nodes.
- **Supporting sources:**
  - [Source: 73d53ab4-4b1e-4298-b539-0411a6ba59ce] Neural Combinatorial Optimization with Reinforcement Learning (ABSTRACT) — “Neural Combinatorial Optimization achieves close to optimal results on 2D Euclidean graphs with up to 100 nodes.”
  - [Source: f5e8d0e9-d121-48eb-ae70-7e48a3a8a680] Attention, Learn to Solve Routing Problems! (ABSTRACT) — “Our model achieves state-of-the-art results on the Traveling Salesman Problem (TSP) for up to 100 nodes.”
- **Contradicting sources:** None reported against this performance claim in the provided findings.
- **Confidence assessment:** **High** — Multiple sources explicitly report strong (near-optimal / state-of-the-art) results on the same benchmark family and size range (n ≤ 100).

---

## Claim 2: Learned policies face significant generalization challenges to out-of-distribution instances and to larger problem scales
- **Claim statement:** Learned RL policies and learned solvers struggle to generalize to unseen distributions and often degrade as instance size increases beyond what they were trained on.
- **Supporting sources:**
  - [Source: 457f7be9-c009-4252-91a3-a201b7155522] Machine Learning for Combinatorial Optimization: a Methodological Tour d'Horizon (7 Conclusions) — “Learning policies that generalize to unseen problems is a challenge.”
  - [Source: 8c17b181-d246-412a-824b-85b2750c3c2c] Reinforcement Learning: A Survey (9. Conclusions) — “Many reinforcement-learning techniques work well on small problems but scale poorly to larger ones.”
  - [Source: 457f7be9-c009-4252-91a3-a201b7155522] Machine Learning for Combinatorial Optimization: a Methodological Tour d'Horizon (6.3 Scaling) — “Performance degrades as instance size increases beyond training sizes.”
- **Contradicting sources:**
  - [Source: 73d53ab4-4b1e-4298-b539-0411a6ba59ce] Neural Combinatorial Optimization with Reinforcement Learning (4.1 SEARCH STRATEGIES) — “In contrast, Active Search is distribution independent.”
- **Confidence assessment:** **Medium** — Broad consensus from survey/conclusion-level statements and scaling notes, but at least one paper positions specific search strategies (Active Search) as distribution-independent, reducing certainty about how universal the limitation is.

---

## Claim 3: Vanilla seq2seq-style neural architectures cannot generalize to larger TSP sizes than seen during training
- **Claim statement:** Certain neural architectures used for routing (notably described as “networks trained in this fashion”) cannot generalize to instances with more cities than those seen during training.
- **Supporting sources:**
  - [Source: 73d53ab4-4b1e-4298-b539-0411a6ba59ce] Neural Combinatorial Optimization with Reinforcement Learning (3 NEURAL NETWORK ARCHITECTURE) — “networks trained in this fashion cannot generalize to inputs with more than n cities.”
- **Contradicting sources:** None reported in the provided findings specifically against this architectural limitation.
- **Confidence assessment:** **High** — The limitation is stated directly and categorically for the described training setup/architecture.

---

## Claim 4: Hybrid approaches and automated parameter configuration can substantially improve classical OR solver performance (e.g., ParamILS over CPLEX defaults)
- **Claim statement:** Automated algorithm configuration and hybridization can significantly outperform default classical solver settings; e.g., ParamILS finds configurations that outperform CPLEX defaults by large margins.
- **Supporting sources:**
  - [Source: ce094c46-c68e-4855-b522-e4684060efa0] ParamILS: An Automatic Algorithm Configuration Framework (7. Case Study) — “significantly outperformed CPLEX defaults, sometimes by over an order of magnitude.”
  - [Source: ce094c46-c68e-4855-b522-e4684060efa0] ParamILS: An Automatic Algorithm Configuration Framework (6.1 Empirical Comparison) — “Substantial speedups are observed, with factors up to 3540 for SAPS-SWGCP.”
  - [Source: 457f7be9-c009-4252-91a3-a201b7155522] Machine Learning for Combinatorial Optimization: a Methodological Tour d'Horizon (ABSTRACT) — “ML offers a way to approximate complex decisions within CO algorithms, potentially improving performance.”
- **Contradicting sources:** None reported in the provided findings.
- **Confidence assessment:** **High** — Strong empirical evidence (order-of-magnitude and up-to-3540x speedups) directly supports the performance improvement claim.

---

## Claim 5: In learned solvers, amortized inference can be fast, but training overhead is substantial; accounting for total compute can reduce or negate speed advantages
- **Claim statement:** Learned methods can provide inference-time speedups via amortization, but end-to-end competitiveness depends on training cost; classical solvers may remain competitive once the full training/tuning cost is considered.
- **Supporting sources:**
  - [Source: 457f7be9-c009-4252-91a3-a201b7155522] Machine Learning for Combinatorial Optimization: a Methodological Tour d'Horizon (7 Conclusions) — “Imitation learning is valuable if the learned policy is significantly faster than the expert's.”
- **Contradicting sources:**
  - [Source: 73d53ab4-4b1e-4298-b539-0411a6ba59ce] Neural Combinatorial Optimization with Reinforcement Learning (A.3 OR TOOL'S METAHEURISTICS) — shows rising runtimes as more solutions are considered; implies that classical methods can be highly competitive depending on accounting and evaluation choices. (Table cited in the findings: “times increasing significantly.”)
- **Confidence assessment:** **Medium** — The amortization principle is broadly plausible and supported directionally, but the provided evidence about “classical remains competitive once training/tuning cost is accounted for” is indirect and depends on evaluation design and accounting conventions.

---

## Claim 6: Supervised learning for pointer networks remains suboptimal compared to other approaches (within the NCO line of work)
- **Claim statement:** Within the referenced NCO context, pointer-network supervised learning is described as suboptimal relative to other approaches.
- **Supporting sources:**
  - [Source: 73d53ab4-4b1e-4298-b539-0411a6ba59ce] Neural Combinatorial Optimization with Reinforcement Learning (5 EXPERIMENTS) — “all of which are suboptimal compared to other approaches.”
- **Contradicting sources:** None reported in the provided findings.
- **Confidence assessment:** **Medium** — The statement is clear but not quantified in the provided excerpt, and it refers to comparisons “to other approaches” whose specific performance gap is not detailed in the findings snippet.