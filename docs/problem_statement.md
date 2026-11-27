# Problem statement

Large distributed systems such as Hadoop write millions of log lines. HDFS Incident Radar classifies blocks as normal or anomalous using event counts from their completed log histories. It compares classifiers and exploratory PCA and clustering on an imbalanced benchmark. This is retrospective classification, not a real-time or early-warning system.

# Objectives

1. Clean and explore the HDFS_v1 block-event data and show how normal and anomalous blocks differ.
2. Compare event counts using descriptive statistics and correlation.
3. Build and compare a PCA anomaly detector and supervised models (logistic regression, decision tree, kNN, Naive Bayes, SVM, random forest) using recall, precision, F1, AUC and confusion matrices.
4. Choose an alarm threshold from the relative cost of missed failures and false alarms.
5. Extract readable decision-tree rules and publish the results as a public website.
