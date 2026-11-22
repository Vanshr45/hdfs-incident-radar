# Viva notes

1. Why is accuracy not enough here?  
   Anomalies are rare, so a model can obtain high accuracy by predicting normal too often. Precision, recall and F1 show anomaly performance directly.

2. How was leakage avoided?  
   The data uses one stratified 80/20 train/test split with `random_state=42`. Validation comes only from the training portion, and the test set is used for final reporting.

3. Which fields are model features?  
   Only event-count columns E1 to E29 are features. Block IDs, labels and non-event fields are excluded.

4. Why use a stratified split?  
   It preserves the small anomaly proportion in training, validation and test data.

5. What does PCA do in this project?  
   PCA learns normal event-count structure. A large reconstruction error can indicate an unusual block.

6. What is the alarm threshold rule?  
   On validation data, one missed anomaly costs 10 times one false alarm. The selected threshold minimises that cost.

7. Why are kNN and SVM trained on samples?  
   Their runtime grows strongly with data size. Fixed stratified samples keep the comparison practical and reproducible.

8. What was the best final model?  
   Random forest had the highest final F1, 0.990291.

9. What was the random forest recall?  
   Its final recall was 0.999406, meaning it detected almost all labelled anomalous blocks in the test set.

10. What was the random forest precision?  
    Its final precision was 0.981341, so most blocks it flagged were anomalous.

11. Why compare a balanced logistic model?  
    Class weighting gives more importance to the minority anomaly class during fitting.

12. What do decision-tree rules provide?  
    They turn event-count thresholds into readable if-then conditions that can be inspected by an engineer.

13. What does the bias-variance plot show?  
    It compares training and validation F1 as tree depth changes, helping identify a tree that is neither too simple nor too specialised to training data.

14. What is a limitation of the result?  
    The evaluation uses one labelled HDFS benchmark from one system, so performance may change on a different deployment.

15. Do event counts prove the cause of an incident?  
    No. They show patterns associated with known labels; root-cause analysis needs additional operational context.
