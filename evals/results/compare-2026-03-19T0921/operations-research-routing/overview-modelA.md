# Research Overview: Learned Routing vs. Classical Operations Research

## 1. Original Research Question
How competitive are learned reinforcement-learning (RL) approaches for routing and combinatorial optimization relative to classical operations research (OR) methods?

## 2. Interpreted Research Objective
To determine the specific problem domains and operational constraints where neural combinatorial optimization (NCO) provides a measurable return on investment (ROI) over established OR solvers (e.g., Gurobi, LKH3), specifically evaluating the trade-off between amortized inference speed and the robustness/optimality guarantees of classical methods.

## 3. Inferred Research Frame
The project operates under the **"Amortization vs. Robustness"** hypothesis. This frame posits that while learned methods excel at rapid, repeated solving of specific problem distributions, they frequently encounter "generalization collapse" when faced with distribution shifts or the requirement for hard optimality bounds. The research examines whether neural approaches are currently viable production-grade alternatives or remain experimental prototypes limited to synthetic, small-scale benchmarks.

## 4. Scope Boundaries
*   **Domain:** Routing and combinatorial optimization (CO) exclusively.
*   **Methodology:** Focus on neural and reinforcement-learning approaches compared against classical OR heuristics.
*   **Exclusions:** General deep learning applications in logistics that do not directly address combinatorial optimization or routing solvers.
*   **Time Horizon:** 2016–2024.
*   **Geography:** Global literature.

## 5. Source Inventory

| Source Name | Provenance |
| :--- | :--- |
| *Neural Combinatorial Optimization with Reinforcement Learning* (Bello et al.) | Discovered |
| *Attention, Learn to Solve Routing Problems!* (Kool et al.) | Discovered |
| *Machine Learning for Combinatorial Optimization: a Methodological Tour d'Horizon* (Bengio et al.) | Discovered |
| *Reinforcement Learning: A Survey* (Sutton & Barto) | Discovered |
| *ParamILS: An Automatic Algorithm Configuration Framework* (Hutter et al.) | Discovered |