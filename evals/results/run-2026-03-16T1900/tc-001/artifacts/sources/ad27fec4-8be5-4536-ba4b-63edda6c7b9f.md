# Approximation Error

**Source:** Wikipedia

## Summary

This Wikipedia entry defines and explains approximation error, a fundamental concept in mathematics and computer science. It distinguishes between absolute error (the direct difference between a true value and its approximation) and relative error (the absolute error scaled by the true value). The article details various causes of approximation error, including computational limitations (machine precision) and measurement inaccuracies. It also introduces related concepts like numerical stability, error bounds, and percent error, providing formal definitions and illustrative examples. Finally, it touches upon the computational complexity of approximating real numbers with specific error tolerances and how error is generalized to higher-dimensional spaces.

## Key Claims

*   Approximation error quantifies the discrepancy between an exact value and its approximation.
*   It can be measured as absolute error (direct difference) or relative error (scaled difference).
*   Common sources include machine precision limitations and measurement instrument constraints.
*   Numerical stability refers to an algorithm's sensitivity to initial errors.
*   Error bounds provide guarantees on the maximum deviation of an approximation.
*   Relative error is often more meaningful than absolute error when comparing approximations of values with different magnitudes.
*   Relative error is undefined when the true value is zero and is most meaningful on ratio scales.
*   Polynomial computability with relative error implies polynomial computability with absolute error, but not necessarily vice-versa without additional conditions.
*   Instrument accuracy is often specified as a percentage of full-scale reading, which can lead to large relative errors at low measurement values.
*   Approximation error concepts can be generalized to vectors and matrices using norms.

## Relevant Evidence/Quotes

*   "The approximation error in a given data value represents the significant discrepancy that arises when an exact, true value is compared against some approximation derived for it."
*   "An approximation error can manifest due to a multitude of diverse reasons. Prominent among these are limitations related to computing machine precision... Another common source is inherent measurement error..."
*   Formal definition of absolute error: $|v - v_{\text{approx}}| \leq \varepsilon$
*   Formal definition of relative error: $|v - v_{\text{approx}}| \leq \eta \cdot |v|$ (for $v \neq 0$)
*   "The utility of relative error becomes particularly evident when it is employed to compare the quality of approximations for numbers that possess widely differing magnitudes..."
*   "Firstly, relative error becomes mathematically undefined whenever the true value (v) is zero..."
*   "Secondly, the concept of relative error is most truly meaningful and consistently interpretable only when the measurements under consideration are performed on a ratio scale."
*   "In the context of most indicating measurement instruments... the specified accuracy is frequently guaranteed... as a certain percentage of the instrument's full-scale reading capability, rather than as a percentage of the actual reading."
*   "The fundamental definitions of absolute and relative error... can be naturally and rigorously extended to more complex scenarios where the quantity of interest v and its corresponding approximation $v_{\text{approx}}$ are n-dimensional vectors, matrices, or, more generally, elements of a normed vector space."

## Contribution to Research Frame

This source is highly relevant to the research frame by providing the foundational mathematical definitions and distinctions between different types of errors that are central to understanding "model collapse." Specifically:

*   **Challenges Criteria:** The source directly addresses the "specific mathematical mechanisms (e.g., approximation error, functional error) that drive the collapse process?" subquestion. It defines approximation error, which is a core component of how models learn and potentially degrade. The distinction between absolute and relative error is crucial for understanding how errors might scale differently depending on the magnitude of values in the data distribution.
*   **Supports Criteria:** The discussion on "numerical stability" and how "initial errors or perturbations... are likely to propagate and potentially amplify" directly supports the idea of cumulative distributional drift. The examples illustrating how relative error becomes more meaningful for values across different orders of magnitude could be analogous to how errors in tail-end distributions might be masked by larger errors in the mean, contributing to the "loss of tail-end distribution data."
*   **Nuance:** The source highlights that relative error is undefined for zero values and sensitive to the measurement scale. This could inform how "distributional drift" might manifest differently in distributions with zero-valued features or when using different data representations (e.g., interval vs. ratio scales), potentially impacting the "statistical washing" of rare data points. The generalization to higher dimensions also suggests that model collapse might not just be a scalar issue but could affect complex, multi-dimensional data representations.