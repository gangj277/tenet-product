# Research Overview: Learned Routing vs. Classical OR

### 1. Original Research Question
How competitive are learned reinforcement-learning approaches for routing and combinatorial optimization relative to classical operations research methods?

### 2. Interpreted Research Objective
To determine the specific problem domains and operational constraints where neural combinatorial optimization (NCO) provides a measurable return on investment (ROI) over established OR solvers (e.g., Gurobi, LKH3), specifically evaluating the trade-off between amortized inference speed and the robustness of classical methods.

### 3. Inferred Research Frame
The project operates under the **"Amortization vs. Robustness"** hypothesis: Learned methods excel at rapid, repeated solving of specific problem distributions but degrade significantly when faced with distribution shifts or the requirement for hard optimality bounds. The research examines whether neural approaches are currently viable for production-grade logistics or remain experimental prototypes limited by generalization collapse and lack of formal guarantees.

### 4. Scope Boundaries
*   **Domain:** Routing and combinatorial optimization (CO) papers comparing neural/reinforcement-learning approaches to classical OR heuristics.
*   **Exclusions:** General deep learning applications for logistics that do not directly address combinatorial optimization or routing solvers.
*   **Geography:** Global literature.
*   **Time Horizon:** 2016–2024.

### 5. Source Inventory

| Source Name | Provenance |
| :--- | :--- |
| *Neural Combinatorial Optimization with Reinforcement Learning* (Bello et al.) | Discovered |
| *Attention, Learn to Solve Routing Problems!* (Kool et al.) | Discovered |
| *Machine Learning for Combinatorial Optimization: a Methodological Tour d'Horizon* (Bengio et al.) | Discovered |
| *Reinforcement Learning: A Survey* (Kaelbling et al.) | Discovered |
| *ParamILS: An Automatic Algorithm Configuration Framework* (Hutter et al.) | Discovered |