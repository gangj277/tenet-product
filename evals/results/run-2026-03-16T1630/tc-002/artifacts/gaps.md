# Gaps in Research: Learned Routing vs. Classical OR

This document outlines the unresolved questions, contradictions, and evidentiary weaknesses identified in the synthesis of reinforcement learning (RL) and classical operations research (OR) for routing and combinatorial optimization.

## 1. Unresolved Questions
These areas represent "known unknowns" where the current literature lacks definitive data or consensus.

*   **The "Strong Heuristic" Ceiling:** While evidence shows neural modules can enhance weak base heuristics, it remains unclear if they can provide marginal gains when integrated into state-of-the-art (SOTA) solvers like LKH-3 or highly tuned commercial solvers (Gurobi/CPLEX).
*   **Quantifiable Generalization Limits:** There is no established metric or "unit of shift" to predict at what point a distribution change (e.g., moving from uniform random nodes to clustered nodes) renders a pre-trained model obsolete. We lack a "phase transition" map for model expiration.
*   **Reliability of LLM-Generated Heuristics:** While Large Language Models (LLMs) have shown promise in "discovering" new optimization strategies, it is unknown if these agents can reliably self-correct or if their successes are primarily stochastic "lucky finds" within a narrow search space.
*   **Non-Euclidean Performance:** Most neural routing research focuses on Euclidean TSP/VRP. The performance gap in non-Euclidean, real-world road networks (where triangle inequality may not hold) is significantly less documented.

## 2. Contradictions
Direct disagreements in the literature that require targeted testing to resolve.

*   **Training Paradigm Superiority:** There is a conflict regarding the most effective training signal for constraint satisfaction. Some evidence suggests unsupervised training paradigms (e.g., loss functions based on constraint violations) significantly outperform supervised learning, while other benchmarks suggest supervised learning remains more stable for complex routing.
*   **Efficiency in "Fast Mode":** Some papers claim RL solvers are the only viable option for millisecond-latency decisions. Conversely, recent comparative studies (e.g., Source 1) argue that classical heuristics, when restricted to the same "fast" time budget as a neural forward pass, often yield higher-quality solutions.

## 3. Weak Evidence Areas
Claims that currently rely on thin, low-quality, or potentially biased evidence.

*   **Real-World Deployment Readiness:** Claims of "production readiness" are largely anecdotal or based on simulated "real-world" datasets. There is a lack of peer-reviewed longitudinal studies showing neural solvers maintaining performance in live logistics environments with shifting constraints.
*   **Amortized Cost-Benefit Analysis:** The argument that "high training cost is offset by low inference cost" is rarely backed by rigorous energy or CO2e accounting. Most papers ignore the cumulative carbon/compute footprint of the training phase when claiming "efficiency."
*   **GNN Global Structure Capture:** The claim that Graph Neural Networks (GNNs) can scale to capture global problem constraints is weak. Current evidence suggests they are fundamentally biased toward local neighborhood structures, and their ability to "see" the whole graph on large scales is more theoretical than empirical.

## 4. What Would Change Confidence
Specific evidence or study designs that would materially affect the current synthesis.

*   **Standardized Hardware/Time Benchmarking:** Confidence in RL superiority would increase if studies utilized a "Total Compute Budget" (Training + Inference) comparison against classical solvers over a fixed number of problem instances (e.g., 1 million runs).
*   **Cross-Distribution Stress Tests:** A study that benchmarks a single pre-trained model across five distinct, non-synthetic distributions (e.g., historical data from five different cities) without fine-tuning would settle the "generalization gap" debate.
*   **Hybridization with SOTA:** Evidence showing a neural-guided LKH-3 consistently outperforming a vanilla LKH-3 by >1% on instances with $N > 1000$ would shift the consensus from "RL as a niche tool" to "RL as a mandatory component of SOTA OR."
*   **Feasibility Guarantees:** The development of a neural architecture that provides a 100% guarantee of solution feasibility for complex constrained VRPs (without a classical post-processing "fixer") would fundamentally change the assessment of their deployment readiness.