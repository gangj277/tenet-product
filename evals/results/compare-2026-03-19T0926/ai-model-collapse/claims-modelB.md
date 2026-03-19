## Claim 1 (Strongest): Model collapse is unavoidable when training exclusively on recursively generated synthetic data
- **Claim statement:** Model collapse is an inevitable degenerative process when a generative model is trained only on synthetic data produced from its own (recursive) generation loop.
- **Supporting sources:**
  - [Source: 083503ca-b550-4bfc-8ad6-2900d7b30856] *How Bad is Training on Synthetic Data? A Statistical Analysis of Language Model Collapse* (Abstract): “Specifically, we demonstrate that model collapse cannot be avoided when training solely on synthetic data.”
  - [Source: a599ea89-e42d-43e2-a931-547b30fff7c1] *The Curse of Recursion: Training on Generated Data Makes Models Forget* (4.1 Discrete distributions with exact approximation): “we are guaranteed to end up in a constant state… having lost all the information of the original distribution when the chain is absorbed.”
- **Contradicting sources:** None.
- **Confidence assessment:** **High** — The claim is supported both by explicit impossibility results (“cannot be avoided”) and by convergence/absorbing-state arguments in a recursive Markov-chain-style formulation.

---

## Claim 2: In recursive synthetic training, the process converges to degenerate “constant state” behavior (absorbing states)
- **Claim statement:** When framed as a stochastic recursive process (e.g., a Markov chain), the training dynamics have absorbing degenerate outcomes such that the model eventually forgets the original distribution and collapses to a constant/delta-like distribution.
- **Supporting sources:**
  - [Source: a599ea89-e42d-43e2-a931-547b30fff7c1] *The Curse of Recursion: Training on Generated Data Makes Models Forget* (4.1 Discrete distributions with exact approximation): “we are guaranteed to end up in a constant state…”
- **Contradicting sources:** None.
- **Confidence assessment:** **High** — The argument is described as a guarantee under the paper’s formal assumptions (e.g., discrete distributions/exact approximation).

---

## Claim 3: “Tail disappearance” (tail cutting/narrowing) is a core observable signature of model collapse
- **Claim statement:** Early-stage model collapse manifests as a progressive loss of probability mass in the low-probability regions (“tails”) of the original data distribution; AI-generated data can show “tail cutting” or “tail narrowing.”
- **Supporting sources:**
  - [Source: a599ea89-e42d-43e2-a931-547b30fff7c1] *The Curse of Recursion: Training on Generated Data Makes Models Forget* (3 What is Model Collapse?): “the model begins losing information about the tails of the distribution”
  - [Source: 04f02f33-7daf-4c48-8eb5-736385bcd1c3] *A Tale of Tails: Model Collapse as a Change of Scaling Laws* (Scaling Laws and Synthetic Data): “tail cutting” / “tail narrowing”
- **Contradicting sources:** None.
- **Confidence assessment:** **High** — Multiple sources explicitly connect collapse to tail-related degradation, and at least one provides empirical visualization evidence for tail narrowing.

---

## Claim 4: Mixing in real (human-generated) data can mitigate collapse; even small preservation can limit degradation
- **Claim statement:** Collapse is not always catastrophic: maintaining a sufficient ratio of real data in the training mix can stabilize the recursive process and significantly reduce quality degradation across generations.
- **Supporting sources:**
  - [Source: e527d42d-5b95-43f3-8c88-5da9815f7ea9] *AI models collapse when trained on recursively generated data* (Model collapse in language models): “preservation of the original data allows for better model fine-tuning and leads to only minor degradation of performance.”
  - [Source: 083503ca-b550-4bfc-8ad6-2900d7b30856] *How Bad is Training on Synthetic Data? A Statistical Analysis of Language Model Collapse* (4.1 Transformer-based Models): “while mixing with real data ensures stability over generations.”
- **Contradictions (related):**
  - [Source: 083503ca-b550-4bfc-8ad6-2900d7b30856] (3.2 Partially Synthetic): the amount of synthetic data must be “exponentially smaller compared to real data in order to ensure that p remains close to p(1).”
- **Confidence assessment:** **High** — Strong convergence/instability arguments for the fully synthetic case coexist with explicit claims of stability under real-data mixing, though the required ratio may be strict (see Claim 5 contradiction).

---

## Claim 5: Stability under partial synthesis may require extremely low synthetic dominance (synthetic must be exponentially smaller than real)
- **Claim statement:** To avoid (or substantially delay) collapse in partially synthetic regimes, the synthetic fraction may need to be exponentially smaller than the real fraction; otherwise the distribution drifts enough to trigger collapse.
- **Supporting sources:**
  - [Source: 083503ca-b550-4bfc-8ad6-2900d7b30856] *How Bad is Training on Synthetic Data? A Statistical Analysis of Language Model Collapse* (3.2 Partially Synthetic): “the amount of synthetic data should be exponentially smaller compared to real data…”
- **Contradicting sources:**
  - [Source: e527d42d-5b95-43f3-8c88-5da9815f7ea9] *AI models collapse when trained on recursively generated data* (Model collapse in language models): preservation “leads to only minor degradation,” including evidence consistent with a much less extreme constraint (e.g., cited “10%” preservation in the consolidated findings).
- **Confidence assessment:** **Medium** — The “exponentially smaller” requirement is presented as a theoretical/stability condition, but empirical results reporting only minor degradation with non-negligible real-data preservation suggest the practical threshold may vary by setup and assumptions.

---

## Claim 6: Some architectural/learning interventions can reduce mode-collapse in specific contexts (e.g., enforcing one-to-one mappings in GAN training)
- **Claim statement:** Certain architectural or training-design interventions can reduce mode-collapse (e.g., by constraining mappings or improving training objectives), potentially serving as mitigation for collapse-like failure modes.
- **Supporting sources:**
  - [Source: 10689496-ee43-49a3-a97e-a2522b7a156f] *BiHMP-GAN: Bidirectional 3D Human Motion Prediction GAN* (Approach): “regressing r during training enforces a one-to-one mapping, avoiding mode-collapse.”
- **Contradicting sources:** None directly, but note this addresses mode collapse in a GAN setting rather than necessarily recursive synthetic-data training loops.
- **Confidence assessment:** **Low–Medium** — Evidence is task- and architecture-specific (GAN bidirectional regression), so transferability to recursive synthetic-data loops is uncertain.

---

## Claim 7: Regularization may mitigate the negative effects of learning on AI-generated data—though some “non-repetition” penalties can worsen susceptibility
- **Claim statement:** Appropriate regularization can reduce harmful effects of training on AI-generated data; however, certain constraints (e.g., non-repetition penalties) may not help and can increase collapse risk.
- **Supporting sources:**
  - [Source: d17c6a20-4fb5-4d15-a4bc-ca7eb517c0b0] *Model Collapse Demystified: The Case of Regression* (4. Exact Test Error Characterization): “a good strategy for mitigating the negative effects… is regularization at an appropriate level.”
- **Contradicting sources:**
  - [Source: e527d42d-5b95-43f3-8c88-5da9815f7ea9] *AI models collapse when trained on recursively generated data* (Ablation: Repetitions): “enforcing this… causes the perplexity to double… Models remain as susceptible to model collapse, if not more.”
- **Confidence assessment:** **Medium** — Supports the plausibility of regularization-based mitigation, but indicates that not all “constraint” strategies generalize; some may amplify degradation.

---