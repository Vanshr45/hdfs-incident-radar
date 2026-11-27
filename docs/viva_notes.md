# Viva notes

**Historical:** These notes describe the earlier stratified row split and predate the grouped evaluation. Use the notebooks and current result tables for the current methodology and numbers.

Numbers below come from `reports/tables/model_comparison.csv` (validation), `reports/tables/final_test_results.csv` (test) and the printed outputs of notebooks 01–03.

1. **Why is accuracy not enough here?**
   Only 16,838 of 575,061 blocks (2.93%) are anomalies. A model that always says "normal" scores 97.07% accuracy on the test set and finds none of the 3,368 broken test blocks.

2. **How was leakage avoided?**
   One stratified 80/20 train/test split with `random_state=42`; validation (25% of the 80%) comes only from the training portion. Notebook 03 ends with a leakage-check section: the features are exactly `E1`–`E29`, every scaler, the PCA and every model report having been fitted on the 345,036 training rows (334,933 normal training rows for the PCA detector), test rows share nothing with training or validation, and the test set was scored once.

3. **Which fields are model features?**
   Only the 29 event-count columns `E1` to `E29`. Block IDs, labels and other fields are excluded.

4. **What was wrong with the `Type` column?**
   `Event_occurrence_matrix.csv` contains a `Type` column (and its own Success/Fail `Label`). `Type` is only filled in for failed blocks, so it encodes the answer. An old figure (`event_correlation.png`, now in `_cleanup_trash/`) included it as if it were a feature. The current notebooks keep only `E1`–`E29`.

5. **Why use a stratified split?**
   It keeps the anomaly rate the same in every part: 0.029281 (train), 0.029275 (validation), 0.029284 (test).

6. **What does PCA do in this project?**
   The PCA detector is fitted on normal training blocks only and keeps 7 components (95% of their variance). A block that those components rebuild badly (large squared reconstruction error) is suspicious. It never sees an anomaly while learning. Its validation cost was 11,067, the worst of the real models, because it misses 977 of 3,367 validation anomalies.

7. **What is the alarm threshold rule?**
   On validation data, cost = 10 × missed anomalies + 1 × false alarms. Every distinct validation score, a 201-point grid and "never alarm" are tried; the lowest cost wins, and ties go to the lowest threshold.

8. **What was the `>=` threshold bug?**
   The earlier version chose thresholds with `score >= t` but computed the metrics with `score > t`. Naive Bayes and kNN give many blocks a score of exactly 1.0, so a threshold of 1.0 flagged thousands of blocks while being chosen and none while being evaluated: zero true positives with AUC near 0.998. Notebook 03 reproduces it: at 1.0, Naive Bayes flags 3,775 validation blocks with `>=` and 0 with `>`. Now a single function, `predict_at`, is used for both choosing and evaluating.

9. **Why is the Naive Bayes threshold so small (about 1.3e-9)?**
   Naive Bayes treats near-duplicate events as independent evidence, so its probabilities are pushed to the extremes: 96.72% of validation scores are below 0.000001 and 3.28% are exactly 1. The cheapest cut sits just above the near-zero group. It catches all 3,367 validation anomalies but raises 412 false alarms (cost 412).

10. **Why are kNN and SVM no longer sampled?**
    kNN on all 345,036 training rows scores the validation set in under a minute per k, and `LinearSVC` fits in about 20 seconds, so no sample was needed. k was chosen from 5, 15 and 25 by validation cost: k = 5 and k = 25 tied at 56, and the smaller k was kept.

11. **What was the best model?**
    Random forest (200 trees), chosen by the lowest validation cost (34: 2 missed, 14 false alarms) at threshold 0.135, before the test set was scored.

12. **How did it do on the test set?**
    Precision 0.998517, recall 0.999703, F1 0.999110, AUC 0.999995. It found 3,367 of 3,368 broken test blocks, missed 1, and raised 5 false alarms among 111,645 healthy ones.

13. **Why did kNN and the decision tree beat the MLP?**
    The data has very few distinct patterns: 495 different count vectors among 345,036 training blocks. Models that memorise exact patterns (a deep tree, nearest neighbours) can match them almost perfectly. The MLP actually ranks blocks slightly better (validation AUC 0.999995 against 0.999361 for kNN and 0.999545 for the tree), but at its cheapest threshold it still flags 74 healthy blocks, against 16 for kNN and 13 for the tree, so its cost is higher (104 against 56 and 63). AUC measures ranking; the cost rule measures one cut-off.

14. **Why compare a balanced logistic model?**
    Class weighting makes each anomaly count more during fitting. Because the threshold is tuned afterwards, both logistic models end up close: validation cost 129 (balanced) and 134 (plain).

15. **What do the decision-tree rules provide?**
    Readable if-then conditions. Example from the depth-3 tree: if "copy fully received" (`E9`) happened at most 2 times, the block is broken; 3,755 training blocks match and all are anomalies.

16. **Why is the depth-3 rule tree separate from the depth-12 scoring tree?**
    The depth sweep picks depth 12 (highest validation F1, 0.997330), which has far too many branches to read. A separate depth-3 tree is fitted only to explain the main splits; its validation F1 is 0.902284, so it explains the pattern but is not used for scoring.

17. **What does the bias-variance plot show?**
    Training F1 keeps rising up to 0.998862 as depth grows, while validation F1 peaks at depth 12 (0.997330) and then drops slightly to 0.997179: deeper trees start to fit training noise.

18. **Why is AdaBoost's log loss so high (0.543) when its AUC is 0.999949?**
    Its `predict_proba` values stay between 0.41 and 0.70, so they are not calibrated probabilities. Ranking is good; probability estimates are poor.

19. **What is a limitation of the result?**
    One labelled benchmark from one cluster; labels came from hand-written rules, so the models learned to agree with those rules. Event counts ignore order.

20. **Do event counts prove the cause of an incident?**
    No. They show patterns associated with known labels; root-cause analysis needs more operational context.
