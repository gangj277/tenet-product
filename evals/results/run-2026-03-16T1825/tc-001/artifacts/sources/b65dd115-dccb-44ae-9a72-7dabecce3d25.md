## The Global Convergence Time of Stochastic Gradient Descent in Non-Convex Landscapes: Sharp Estimates via Large Deviations

**Publication:** arXiv preprint (2020)

**Authors:** Waïss Azizian, Franck Iutzeler, Jérôme Malick, and Panayotis Mertikopoulos

This paper analyzes the time it takes for Stochastic Gradient Descent (SGD) to converge to the global minimum of a non-convex function. Using the framework of randomly perturbed dynamical systems and large deviations theory, the authors derive tight upper and lower bounds for this convergence time. These bounds are shown to be determined by the most challenging "obstacles" in the loss landscape that SGD must overcome, linking the global geometry of the landscape to the noise statistics of the process. The paper also offers refinements for loss functions with shallow local minima, relevant to deep learning applications.

### Key Claims:

*   The global convergence time of SGD in non-convex landscapes can be tightly characterized using large deviations theory.
*   This convergence time is primarily dictated by the "costliest" set of obstacles (e.g., local minima, saddle points) that SGD must traverse to reach a global minimum.
*   The convergence time is inversely proportional to the step-size ($\eta$) and is exponentially dependent on an "energy function" that captures the landscape's geometry and noise statistics.
*   The analysis reveals that the convergence time is often dominated by the "longest" or most difficult transition path between critical points, rather than the shortest one.
*   For deep neural networks, specific analyses for functions with shallow local minima are provided.

### Relevant Evidence/Quotes:

*   "In this paper, we examine the time it takes for stochastic gradient descent (SGD) to reach the global minimum of a general, non-convex loss function."
*   "We approach this question through the lens of randomly perturbed dynamical systems and large deviations theory, and we provide a tight characterization of the global convergence time of SGD via matching upper and lower bounds."
*   "These bounds are dominated by the most 'costly' set of obstacles that the algorithm may need to overcome in order to reach a global minimizer from a given initialization, coupling in this way the global geometry of the underlying loss landscape with the statistics of the noise entering the process."
*   Informal expression for convergence time: $E[\tau] \approx \frac{E(x)}{\eta}$, where $\tau$ is the number of iterations, $x$ is the initialization, and $E(x)$ is an "energy function" encoding landscape geometry and noise statistics via a "transition graph".
*   The edge weight in the transition graph is given by $B_{ij} = 2 \frac{[f(p_j) - f(p_i)]_+}{\sigma^2}$, where $\sigma^2$ is related to noise variance. This indicates that overcoming a positive objective value gap is costly and inversely proportional to noise variance.

### Contribution to/Challenge of Research Frame:

This source directly addresses the research frame's core interest in understanding the dynamics of optimization algorithms in complex, non-convex landscapes, specifically focusing on the *time* it takes to reach a global optimum. It provides a theoretical framework (large deviations theory) and a methodology (transition graphs, energy functions) for quantifying this convergence time.

*   **Contribution:** It offers a rigorous mathematical explanation for why SGD can be slow to converge globally in non-convex settings, identifying specific landscape features (obstacles, energy gaps) as the primary determinants of convergence speed. This aligns with the research frame's goal of understanding the "risk" associated with recursive training by framing it as a challenge of navigating a complex "landscape." The paper's focus on "obstacles" and "costly transitions" can be seen as a theoretical precursor to understanding how synthetic data might create or exacerbate such obstacles, leading to "model collapse."
*   **Challenge:** While the paper focuses on general non-convex functions and not specifically on synthetic data generation loops, its findings on the exponential dependence of convergence time on landscape difficulty could be interpreted as a potential mechanism for model collapse. If recursive training on synthetic data effectively "warps" or "degrades" the loss landscape, making it harder to navigate (e.g., by creating deeper spurious minima or more difficult saddle points), then the convergence time to a desirable state would increase exponentially, potentially leading to a collapse in performance or diversity. The paper's emphasis on "global information about the geometry of $f$" is crucial, as it suggests that understanding the entire landscape, not just local properties, is key to predicting convergence, which is highly relevant to the long-term effects of synthetic data.