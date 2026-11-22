# Problem statement

Large distributed systems such as Hadoop write millions of log lines, which engineers cannot inspect manually during incidents. This project builds a machine-learning incident radar that classifies each HDFS block as normal or anomalous from the counts of events in its log history, compares unsupervised (PCA-based) and supervised models on a heavily imbalanced dataset, and produces human-readable rules explaining what failing blocks look like.

# Objectives

1. Clean and explore the HDFS_v1 block-event data and show how normal and anomalous blocks differ.
2. Statistically test which log events best separate anomalous blocks.
3. Build and compare a PCA anomaly detector and supervised models (logistic regression, decision tree, kNN, Naive Bayes, SVM, random forest) using recall, precision, F1, AUC and confusion matrices.
4. Choose an alarm threshold from the relative cost of missed failures and false alarms.
5. Extract readable decision-tree rules and publish the results as a public website.
