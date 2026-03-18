# ForTIFAI: Fending Off Recursive Training Induced Failure for AI Models

**Authors:** Soheil Zibakhsh Shabgahi, Pedram Aghazadeh, Azalia Mirhosseini, Farinaz Koushanfar

**Affiliations:** UC San Diego, Stanford University

**Abstract:** This paper addresses the critical issue of "model collapse" in generative AI, a phenomenon where recursive training on synthetic data leads to performance degradation. The authors identify model overconfidence in self-generated data as a key driver of this collapse. They propose a novel confidence-aware loss function called Truncated Cross Entropy (TCE) that downweights high-confidence predictions during training. TCE is demonstrated to significantly delay model collapse, extending the model's fidelity interval by over 2.3x. The approach is model-agnostic, theoretically and empirically validated, and shown to generalize across different modalities.

## Key Claims

*   Generative models trained recursively on synthetic data suffer from "model collapse," leading to performance degradation.
*   A primary cause of model collapse is the overconfidence of models in their own self-generated data.
*   Truncated Cross Entropy (TCE) is a novel, confidence-aware loss function designed to mitigate model collapse.
*   TCE works by downweighting high-confidence predictions, forcing the model to learn from less certain data points and preserve distribution tails.
*   TCE is model-agnostic and can be easily implemented on top of standard Cross Entropy loss.
*   Empirical evaluations show that TCE significantly delays model collapse, extending model fidelity by over 2.3x compared to standard Cross Entropy.
*   The proposed method generalizes across different generative model architectures (Transformers, VAEs, GMMs) and modalities.

## Relevant Evidence/Quotes

*   "This shift to a mainly synthetic content presents a critical challenge: repeated training in synthetic data leads to a phenomenon known as model collapse, where model performance degrades over generations of training, eventually rendering the models ineffective."
*   "In this paper, we identify model overconfidence in their self-generated data as a key driver of collapse."
*   "Building on this observation, we propose a confidence-aware loss function that downweights high-confidence predictions during training. We introduce a novel loss function we call Truncated Cross Entropy (TCE)."
*   "We demonstrate that TCE significantly delays model collapse in recursive training. We provide a model-agnostic framework that links the loss function design to model collapse mitigation and validate our approach both theoretically and empirically, showing that it can extend the model’s fidelity interval before collapse by more than 2.3 × 2.3\\times ."
*   "Figure 1 illustrates a consistent gap in model confidence between self-generated samples and unseen data. We exploit this difference as a signal to identify and discount synthetic samples during training, allowing the model to reduce their influence and mitigate collapse."
*   "TCE(p_{t})=\\chi_{\\gamma}(p_{t})\\times CE(p_{t})" where $\\chi_{\\gamma}(p_{t}) = 1$ if $p_{t}\\leq\\gamma$ and $0$ if $p_{t}>\\gamma$.
*   "As illustrated in Figure 6, Cross Entropy collapses (reaches 75 % 75\\% accuracy) between the first and the second generation and both TCE reaches this point after three stages of self-consuming generation, increasing the time to failure by 2.3 × 2.3\\times ."
*   "Figure 7 illustrates that TCE lead to a significantly lower KL divergence over generations compared to Cross Entropy, indicating better preservation of the original data distribution."

## Contribution to Research Frame

This source directly supports the research frame by providing a concrete technical solution to mitigate model collapse, which is a central concern.

*   **Supports the hypothesis that model collapse is a manageable risk:** The paper demonstrates that by modifying the loss function, the negative effects of recursive training on synthetic data can be significantly delayed and mitigated. This directly challenges the idea that collapse is an inevitable outcome.
*   **Identifies a specific causal mechanism:** The paper pinpoints "model overconfidence in their self-generated data" as a key driver, offering a more nuanced understanding beyond just "synthetic data contamination."
*   **Proposes an actionable mitigation strategy:** The introduction of TCE provides a practical, model-agnostic intervention that can be integrated into existing training pipelines.
*   **Provides theoretical and empirical evidence:** The work includes mathematical intuition (Gaussian example) and empirical validation across different model types and datasets, strengthening the findings.
*   **Highlights the importance of preserving distribution tails:** The mechanism of TCE, by downweighting high-confidence predictions, directly addresses the concern of models losing diversity and collapsing towards a narrow subset of the data distribution.