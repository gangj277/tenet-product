## Unresolved questions (what the evidence does not settle)

1. **Where is the quantitative “tipping point” for real-vs-synthetic mixing?**
   - Evidence indicates *some* real-data fraction stabilizes training, and also that synthetic must be “exponentially smaller” to keep \(p\) close to \(p(1)\). But the literature does not provide a single reliable threshold that transfers across:
     - modality (text/image/tabular),
     - generation pipeline (sampling temperature/top‑p/beam, filtering),
     - model family (decoder-only vs diffusion vs encoder-decoder),
     - training objective (MLE vs RLHF-like vs contrastive).
   - **Actionable gap:** We need controlled experiments sweeping real-data fractions (e.g., 1%, 5%, 10%, 20%, 50%) *and* synthetic generation settings, reporting collapse curves over many generations.

2. **Is collapse driven primarily by “functional approximation error” or by “statistical/sampling error”?**
   - The consolidated findings list this as an unresolved disagreement.
   - Mechanistic resolution matters because it changes mitigation:
     - If approximation error dominates → spend effort on model capacity, distillation targets, better teachers, calibrated losses.
     - If sampling error dominates → mitigation focuses on variance reduction, better sampling, larger synthetic sample sizes, debiasing.

3. **What happens in long-horizon realistic loops (dozens to hundreds of generations) under compute/budget constraints?**
   - Many studies show trends; fewer characterize what happens when:
     - synthetic data generation cost grows,
     - training compute per iteration is fixed,
     - filtering uses imperfect heuristics or weak discriminators.
   - **Actionable gap:** Establish standardized “generation-depth” protocols and report whether collapse is:
     - inevitable but delayed,
     - asymptotically stable under certain mixes,
     - or a phase-transition dependent on hyperparameters.

4. **Does using intermediate-generation data help, or does it simply trade compute for slower collapse?**
   - The evidence suggests conflicting interpretations: intermediate generation may delay collapse in some settings but may not change the eventual attractor.
   - **Actionable gap:** Compare (a) recursive on latest model outputs vs (b) recursive using outputs from earlier checkpoints (or ensembles) with matched compute budgets, measuring tail metrics + downstream task performance over time.

5. **Can automated large-scale synthetic filtering be made robust (e.g., watermark-based or classifier-based) without becoming a new failure mode?**
   - Open question: whether watermarking enables dependable filtering at web-scale.
   - **Actionable gap:** Empirical study of end-to-end pipelines:
     - watermark detection false positives/negatives,
     - adversarial or accidental removal of real content,
     - resulting impact on collapse metrics across multiple recursion steps.

6. **Are certain modalities inherently more susceptible?**
   - Text vs image vs tabular: the consolidated open questions ask modality susceptibility, but the synthesis doesn’t yet map it to mechanisms (e.g., likelihood calibration, distribution tails, multimodality).
   - **Actionable gap:** Cross-modality experiments using analogous recursion/mixture protocols and comparable diversity/tail/benchmark metrics.

7. **Which metrics best detect early collapse and correlate with downstream usefulness?**
   - The project asks about entropy/tail measures/V-measure/task benchmarks.
   - **Actionable gap:** Determine metric sensitivity and lead/lag relationships:
     - early tail narrowing indicators vs later benchmark degradation,
     - whether “looks diverse” can still fail task calibration,
     - alignment between generative quality metrics and discriminative downstream metrics.

---

## Contradictions (direct disagreements in the sources)

1. **“Mixing real data stabilizes” vs “synthetic must be exponentially smaller”**
   - Source claiming stabilization: *“preservation of the original data … only minor degradation”* and *“mixing with real data ensures stability over generations”*.
   - Contradictory constraint: *“synthetic data should be exponentially smaller compared to real data”* to keep \(p\) near \(p(1)\).
   - **What this contradiction likely means:** different experimental regimes (finite generations, specific model families, specific evaluation metrics) vs theoretical asymptotics (very long-horizon or idealized assumptions).
   - **Actionable resolution:** report both:
     - empirical stability horizon as a function of mix ratio, and
     - theoretical assumptions under which “exponentially smaller” applies.

2. **Regularization / non-repetition penalties may mitigate vs may accelerate collapse**
   - Evidence in favor: regularization at an appropriate level is suggested to mitigate negative effects.
   - Evidence against: an ablation enforcing non-repetition *caused perplexity to double* and *models remain susceptible, if not more*.
   - **Actionable resolution:** specify:
     - what kind of regularization (weight decay? explicit penalties? constraints in decoding?),
     - whether it changes the recursion operator (i.e., whether it modifies the effective distribution transformation),
     - and whether the mitigation affects tail behavior or merely training loss.

3. **Dominant mechanism ambiguity**
   - Unresolved disagreement between “functional approximation error” vs “statistical sampling error.”
   - This is a contradiction at the level of causal attribution: both types of error can produce distribution drift, but the literature does not settle which dominates under typical settings.

---

## Weak evidence areas (claims supported by thin or low-quality evidence)

1. **Architectural/engineering mitigations are not yet generalizable**
   - The synthesis includes GAN/discriminator/one-to-one mapping and regression-regularization claims, but they appear **task-specific** (e.g., 3D motion prediction) and not necessarily transferrable to large-scale language/image diffusion systems.
   - **Why weak:** risk that results reflect inductive biases of a specific architecture/dataset rather than universal properties of recursion.

2. **Quantitative stability claims may rely on controlled simulations**
   - Confidence notes: evidence relies heavily on mathematical proofs and controlled simulations which may not capture:
     - open-web data dynamics,
     - imperfect generation quality,
     - data contamination and feedback loops in production,
     - adversarial behavior.
   - **Why weak:** simulations can overestimate stability and underestimate real-world distribution shift complexity.

3. **Metric validity and correlation remain under-validated**
   - Tail disappearance is repeatedly used as a characteristic signature, but the synthesis doesn’t confirm that tail metrics consistently predict downstream task failure across modalities and training regimes.
   - **Why weak:** correlation without robustness checks can lead to misleading early detection.

4. **Watermarking/filtering effectiveness is largely unresolved**
   - The open question suggests speculative uncertainty; there is not enough consolidated empirical evaluation here to treat it as a credible mitigation without further study.

5. **Model-size and loss-function resilience**
   - The project scope includes whether bigger architectures or specific losses are more resilient, but the consolidated findings emphasize only limited mitigation evidence and do not establish strong cross-model generality.

---

## What would change confidence (specific evidence/studies that materially improve the synthesis)

1. **Standardized multi-generation benchmarks with mix-ratio sweeps**
   - A study that:
     - defines a recursion protocol (generation settings + number of generations),
     - sweeps real-data fractions systematically,
     - and reports collapse curves using multiple metrics (tail/tightness + perplexity + downstream task scores).
   - **Impact:** would turn qualitative statements (“stability with mixing”) and theoretical asymptotics (“exponentially smaller”) into a practical threshold curve by modality/model family.

2. **Mechanism-identification experiments separating approximation vs sampling error**
   - Examples of what to look for:
     - identical recursion operator but varying dataset size / sampling variance,
     - controlling model capacity or optimization noise independently,
     - measuring how collapse scales with approximation error proxies vs variance proxies.
   - **Impact:** resolves the causal contradiction and determines which mitigation families are most likely to generalize.

3. **Ablations of mitigation types that explicitly measure distribution transformation**
   - For each mitigation (regularization, non-repetition penalties, filtering classifiers, reward models):
     - report whether it changes the recursion operator (effective distribution mapping) or just changes optimization behavior.
   - **Impact:** distinguishes true stabilizers from superficial training-loss fixes.

4. **Cross-modality replication under matched protocols**
   - At least: one text, one image, and one non-text modality (or tabular) study using the same recursion/mixing framework and comparable metrics.
   - **Impact:** answers modality susceptibility and whether collapse signatures are universal.

5. **End-to-end web-scale filtering evaluations (not just detector accuracy)**
   - Studies that include:
     - false positive/negative rates at scale,
     - impact on recursion stability over multiple generations,
     - robustness to adversarial or distribution-shifted synthetic content.
   - **Impact:** turns watermark/filtering from an open idea into an evidence-backed mitigation strategy.

6. **Long-horizon empirical confirmation of theoretical attractors/absorbing states**
   - Empirical work that tests convergence behavior consistent with “absorbing states” claims:
     - does it reach constant-like degenerate distributions at scale/time,
     - or does finite-data/optimization noise produce different fixed points?
   - **Impact:** directly validates or limits the “inevitable collapse” framing.

7. **Metric causality tests**
   - Evidence that early tail metrics causally predict later downstream degradation (e.g., intervene by reweighting/regularizing to preserve tails and observe whether downstream quality follows).
   - **Impact:** upgrades metric choice from heuristic to actionable early-warning system.

--- 

## Practical next steps for the researcher (where to dig first)

1. Collect and compare the *two* key sources driving the main contradiction:
   - the claim of inevitability under fully synthetic recursion,
   - and the claim of stability with preserving a real-data fraction.
   Then extract: recursion depth, mix ratios, metric definitions, and assumptions (theory vs simulation constraints).

2. Locate and catalog ablations on:
   - “non-repetition” penalties,
   - regularization strength/type,
   - filtering thresholds.
   The goal is to determine whether these methods change the effective recursion operator.

3. Build a matrix: modality × model family × recursion protocol × evaluation metrics × generation depth.
   Identify which cell(s) are least populated in the literature and prioritize them for targeted additional reading.