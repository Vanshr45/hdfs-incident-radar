"""Export the small JSON files that the website in docs/ reads.

The website never trains anything. It only shows results that the notebooks
already saved. This script reads:

    datasets/processed/hdfs_clean.csv        (notebook 01)
    datasets/processed/splits.npz            (notebook 01)
    datasets/hdfs_v1/preprocessed/HDFS.log_templates.csv
    datasets/hdfs_v1/HDFS.log                (only to count lines, machines and hours)
    datasets/processed/validation_scores.npz (notebook 03, every model's validation scores)
    models/best_final_model.pkl              (notebook 03)
    reports/tables/model_comparison.csv      (notebook 03)
    reports/tables/final_test_results.csv    (notebook 03)
    reports/tables/model_settings.csv        (notebook 03)
    reports/tables/decision_tree_rules.txt   (notebook 03)
    reports/tables/tree_depth_sweep.csv      (notebook 03)
    reports/tables/event_correlations.csv, pca_explained_variance.csv,
    kmeans_elbow.csv, kmeans_cluster_anomaly_rates.csv (notebook 02)
    reports/figures/*.png                    (notebooks 01-03)

and writes facts.json, events.json, dial.json, models.json, blocks.json,
rules.json and charts.json to docs/data/, plus resized copies of the notebook
figures to docs/assets/figures/. Every number it writes is printed, so it can
be checked against the notebooks.

Run from the project root, after the notebooks:

    python src/export_web_data.py
"""

from datetime import datetime
from pathlib import Path
import json
import pickle
import re

import numpy as np
import pandas as pd
from PIL import Image
from sklearn.metrics import precision_recall_curve, roc_auc_score, roc_curve
from sklearn.model_selection import train_test_split

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / 'datasets' / 'hdfs_v1'
PROCESSED = ROOT / 'datasets' / 'processed'
TABLES = ROOT / 'reports' / 'tables'
FIGURES = ROOT / 'reports' / 'figures'
OUT = ROOT / 'docs' / 'data'
FIGURES_OUT = ROOT / 'docs' / 'assets' / 'figures'

FN_COST = 10  # same cost rule as notebook 03
FP_COST = 1
SAMPLE_SIZE = 2000  # test blocks used for diaries, the detective game and the barcode wall
MAX_DATA_BYTES = 1_500_000
MAX_FIGURE_BYTES = 150_000
CURVE_POINTS = 150     # target number of points per ROC or precision-recall curve
ROC_ZOOM_FPR = 0.01    # the ROC chart zooms into false-positive rates up to 1%
PR_ZOOM_RECALL = 0.99  # the precision-recall chart zooms into recall above 99%
PR_MODELS = ['Random forest', 'kNN', 'MLP']
HISTOGRAM_BINS = 40
BARCODE_HEALTHY = 241  # with every broken block in the sample (59) this makes 300 strips
BARCODE_CAP = 9        # counts above 9 are drawn as 9

# Notebook figures shown on the site, with a caption that says what each one shows.
FIGURE_CAPTIONS = [
    ('class_balance.png', '01', 'Blocks per class. Anomalies are the thin orange bar.'),
    ('total_events_by_class.png', '01', 'Diary length per block (log scale). Broken and healthy blocks have similar '
                                        'lengths, so length alone does not give them away.'),
    ('event_frequency_overview.png', '01', 'Total count of each event type over all blocks. Ten types make up '
                                           'almost every log line.'),
    ('event_label_correlation.png', '02', 'Correlation of each event count with the anomaly label, training blocks only.'),
    ('event_correlation_heatmap.png', '02', 'Correlation between event counts. The dark pairs are events that '
                                            'always happen together.'),
    ('logistic_event_coefficients.png', '02', 'The twelve largest standardised coefficients of the weighted logistic '
                                              'regression.'),
    ('pca_scatter.png', '02', 'A fixed sample of 8,000 training blocks on the first two PCA components.'),
    ('kmeans_elbow.png', '02', 'k-means inertia against k, fitted on 30,000 normal training blocks.'),
    ('tree_depth_bias_variance.png', '03', 'Training and validation F1 as the decision tree gets deeper.'),
    ('decision_tree.png', '03', 'The depth-3 tree whose rules appear on this page.'),
    ('validation_precision_recall.png', '03', 'Validation precision-recall for the three cheapest models, zoomed in.'),
    ('test_roc_curves.png', '03', 'Test ROC curves for the three tested models, zoomed in.'),
]


# ---------------------------------------------------------------------------
# Plain-English names for the 29 log templates. The original template text is
# exported next to each name so a reader can check the wording.
# 'later' marks steps that happen when a file is deleted, so the diary can draw
# a gap line before them.
# ---------------------------------------------------------------------------
EVENT_NAMES = {
    'E22': ('storage space allocated', 'write'),
    'E5': ('machine starts receiving a copy', 'write'),
    'E6': ('copy received from another machine', 'write'),
    'E9': ('copy fully received', 'write'),
    'E11': ('copy confirmation finished', 'write'),
    'E26': ('master records the stored copy', 'write'),
    'E2': ('copy checked and verified', 'write'),
    'E3': ('block read by a program', 'write'),
    'E4': ('error while sending the block to a reader', 'write'),
    'E16': ('copy sent to another machine', 'write'),
    'E18': ('started re-copying', 'write'),
    'E25': ('master asks for an extra copy', 'write'),
    'E27': ('duplicate copy report', 'write'),
    'E28': ('copy report for a block no file owns', 'write'),
    'E1': ('tried to add a block that already exists', 'write'),
    'E7': ('write failed', 'write'),
    'E8': ('copy confirmation interrupted', 'write'),
    'E10': ('copy confirmation error', 'write'),
    'E12': ('error passing the copy to the next machine', 'write'),
    'E13': ('empty data packet received', 'write'),
    'E14': ('error while receiving a copy', 'write'),
    'E15': ('write position moved back', 'write'),
    'E17': ('copy transfer failed', 'write'),
    'E19': ('block reopened for writing', 'write'),
    'E29': ('re-copy timed out', 'write'),
    'E24': ('re-copy dropped: block belongs to no file', 'write'),
    'E23': ('block marked for deletion', 'later'),
    'E21': ('block file deleted', 'later'),
    'E20': ('tried to delete a block that was not there', 'later'),
}
# The order above is the order in which steps are listed in a diary.
DIARY_ORDER = list(EVENT_NAMES)

# Names whose wording is a best guess from a terse template (reported at the end).
UNSURE_NAMES = ['E15', 'E24', 'E28', 'E13']

# Rows of the "how often each step shows up" chart, chosen by hand and checked below.
DUMBBELL_GROUPS = {
    'missing_in_broken': ['E9', 'E11', 'E26'],
    'showing_in_broken': ['E20', 'E18', 'E6', 'E7', 'E28', 'E27'],
}

DISPLAY_NAMES = {
    'Random forest': 'Random forest',
    'kNN': 'Nearest neighbours',
    'Decision tree': 'Decision tree',
    'MLP': 'Small neural network',
    'Linear SVM': 'Linear SVM',
    'Logistic regression balanced': 'Logistic regression, weighted',
    'Logistic regression': 'Logistic regression',
    'AdaBoost': 'Boosted stumps (AdaBoost)',
    'Naive Bayes': 'Naive Bayes',
    'PCA anomaly detector': 'PCA normal-pattern check',
    'Baseline (always normal)': 'Always says healthy',
}


def write_json(name, content):
    path = OUT / name
    path.write_text(json.dumps(content, separators=(',', ':')))
    print(f'  wrote {path.relative_to(ROOT)} ({path.stat().st_size:,} bytes)')


def clean_number(value):
    """JSON has no NaN or infinity; both become null."""
    if value is None or (isinstance(value, float) and not np.isfinite(value)):
        return None
    if isinstance(value, (np.integer,)):
        return int(value)
    if isinstance(value, (np.floating,)):
        return float(value) if np.isfinite(value) else None
    return value


def setting_value(settings_text, name):
    """Read one hyperparameter, e.g. n_estimators=200, from model_settings.csv text."""
    # A value is either a bracketed group like (32, 16) or a single token like 200.
    match = re.search(name + r'=(\([^)]*\)|[^,;)\s]+)', settings_text)
    return match.group(1) if match else None


def short_id(block_id):
    # 'blk_-1608999687919862906' -> 'blk …919862906' (enough to tell 2,000 blocks apart)
    return 'blk …' + block_id[-9:]


# ---------------------------------------------------------------------------
# Loading
# ---------------------------------------------------------------------------
def load_everything():
    clean = pd.read_csv(PROCESSED / 'hdfs_clean.csv')
    splits = np.load(PROCESSED / 'splits.npz')
    templates = pd.read_csv(RAW / 'preprocessed' / 'HDFS.log_templates.csv').set_index('EventId')['EventTemplate']
    with open(ROOT / 'models' / 'best_final_model.pkl', 'rb') as file:
        package = pickle.load(file)
    comparison = pd.read_csv(TABLES / 'model_comparison.csv')
    final = pd.read_csv(TABLES / 'final_test_results.csv')
    settings = pd.read_csv(TABLES / 'model_settings.csv').set_index('model')['settings']
    return clean, splits, templates, package, comparison, final, settings


def read_log_summary(example_block_id):
    """Count log lines, distinct DataNode addresses and the time span of HDFS.log,
    and collect the raw lines of one example block for the pipeline diagram."""
    line_count = 0
    machines = set()
    example_lines = []
    example_bytes = example_block_id.encode()
    first_line = last_line = None
    with open(RAW / 'HDFS.log', 'rb') as log:
        for line in log:
            line_count += 1
            if first_line is None:
                first_line = line
            last_line = line
            # Every write names the receiving DataNode as 'dest: /ip:port'.
            position = line.find(b'dest: /')
            if position != -1:
                address = line[position + 7:].split(b':')[0]
                machines.add(address)
            # The id must not be followed by another digit (blk_12 is not blk_123).
            found = line.find(example_bytes)
            if found != -1:
                next_char = line[found + len(example_bytes):found + len(example_bytes) + 1]
                if not next_char.isdigit():
                    example_lines.append(line.decode().strip())
    # Each line starts with a date and time like '081109 203518'.
    start = datetime.strptime(first_line[:13].decode(), '%y%m%d %H%M%S')
    end = datetime.strptime(last_line[:13].decode(), '%y%m%d %H%M%S')
    return line_count, len(machines), start, end, example_lines


# ---------------------------------------------------------------------------
# facts.json
# ---------------------------------------------------------------------------
def build_facts(clean, splits, package, final, event_columns, log_summary):
    y = clean['target'].values
    y_test = y[splits['test_idx']]
    y_val = y[splits['validation_idx']]
    total = len(clean)
    anomalous = int(y.sum())
    lines, machines, start, end, _ = log_summary
    train_patterns = clean.iloc[splits['train_idx']][event_columns].drop_duplicates()

    best_test = final.set_index('model').loc[package['model_name']]
    facts = {
        'total_blocks': total,
        'normal_blocks': total - anomalous,
        'anomalous_blocks': anomalous,
        'anomaly_ratio': anomalous / total,
        'one_in': round(total / anomalous),
        'log_lines': lines,
        'machines': machines,
        'log_start': start.strftime('%Y-%m-%d %H:%M'),
        'log_end': end.strftime('%Y-%m-%d %H:%M'),
        'log_hours': round((end - start).total_seconds() / 3600, 1),
        'event_types': len(event_columns),
        'distinct_patterns_train': len(train_patterns),
        'train_blocks': len(splits['train_idx']),
        'validation_blocks': len(splits['validation_idx']),
        'validation_anomalies': int(y_val.sum()),
        'validation_normal': int((y_val == 0).sum()),
        'test_blocks': len(y_test),
        'test_anomalies': int(y_test.sum()),
        'test_normal': int((y_test == 0).sum()),
        'test_fraction': 0.2,
        'validation_fraction_of_rest': 0.25,
        'random_state': 42,
        # The always-normal baseline is right exactly on the normal test blocks.
        'baseline_test_accuracy': float((y_test == 0).mean()),
        'best_model': package['model_name'],
        'best_model_display': DISPLAY_NAMES[package['model_name']],
        'best_model_trees': int(package['model'].n_estimators),
        'threshold': package['threshold'],
        'best_test_accuracy': float(best_test['accuracy']),
        'best_test_found': int(best_test['tp']),
        'best_test_missed': int(best_test['fn']),
        'best_test_false_alarms': int(best_test['fp']),
        'best_test_precision': float(best_test['precision']),
        'best_test_recall': float(best_test['recall']),
        'best_test_f1': float(best_test['f1']),
        'best_test_auc': float(best_test['auc']),
        'fn_cost': FN_COST,
        'fp_cost': FP_COST,
        'cost_rule': f'A missed broken block counts as much as {FN_COST} false alarms.',
        'zenodo_record': '8196385',
    }
    # The baseline accuracy from the labels must match the saved notebook result.
    saved_baseline = pd.read_csv(TABLES / 'model_comparison.csv').set_index('model').loc['Baseline (always normal)']
    assert saved_baseline['tp'] == 0 and saved_baseline['fp'] == 0
    return facts


# ---------------------------------------------------------------------------
# events.json
# ---------------------------------------------------------------------------
def build_events(clean, splits, templates, event_columns):
    train = clean.iloc[splits['train_idx']]
    healthy = train.loc[train['target'] == 0, event_columns]
    broken = train.loc[train['target'] == 1, event_columns]
    assert sorted(EVENT_NAMES) == sorted(event_columns), 'every event needs a plain name'

    events = []
    for order, event_id in enumerate(DIARY_ORDER):
        name, phase = EVENT_NAMES[event_id]
        events.append({
            'id': event_id,
            'name': name,
            'template': templates[event_id],
            'phase': phase,
            'order': order,
            'healthy_median': int(healthy[event_id].median()),
            'healthy_share': float((healthy[event_id] > 0).mean()),
            'broken_share': float((broken[event_id] > 0).mean()),
            'name_unsure': event_id in UNSURE_NAMES,
        })

    # Check the hand-picked chart groups really point the way their titles say.
    by_id = {event['id']: event for event in events}
    for event_id in DUMBBELL_GROUPS['missing_in_broken']:
        assert by_id[event_id]['healthy_share'] > by_id[event_id]['broken_share'], event_id
    for event_id in DUMBBELL_GROUPS['showing_in_broken']:
        assert by_id[event_id]['broken_share'] > by_id[event_id]['healthy_share'], event_id

    return {'events': events, 'dumbbell_groups': DUMBBELL_GROUPS,
            'healthy_training_blocks': len(healthy), 'broken_training_blocks': len(broken)}


# ---------------------------------------------------------------------------
# dial.json
# ---------------------------------------------------------------------------
def build_dial(validation_scores, y_val, threshold, comparison):
    # About 200 evenly spaced thresholds, plus the chosen one so the slider can land on it exactly.
    thresholds = np.unique(np.append(np.linspace(0, 1, 201), threshold))
    points = []
    for value in thresholds:
        flagged = validation_scores >= value  # the same >= rule as notebook 03
        points.append({
            't': round(float(value), 6),
            'tp': int(np.sum(flagged & (y_val == 1))),
            'fp': int(np.sum(flagged & (y_val == 0))),
            'tn': int(np.sum(~flagged & (y_val == 0))),
            'fn': int(np.sum(~flagged & (y_val == 1))),
        })
    chosen_index = int(np.where(thresholds == threshold)[0][0])

    # Stop if the dial disagrees with the saved validation result for the chosen model.
    saved = comparison.set_index('model').loc['Random forest']
    chosen = points[chosen_index]
    for key in ['tp', 'fp', 'tn', 'fn']:
        if chosen[key] != int(saved[key]):
            raise SystemExit(f'dial.json {key}={chosen[key]} does not match model_comparison.csv {key}={saved[key]}')

    return {'set': 'validation', 'model': 'Random forest', 'positives': int(y_val.sum()),
            'negatives': int((y_val == 0).sum()), 'chosen_threshold': float(threshold),
            'chosen_index': chosen_index, 'points': points}


# ---------------------------------------------------------------------------
# models.json
# ---------------------------------------------------------------------------
def describe_models(settings):
    trees = setting_value(settings['Random forest'], 'n_estimators')
    k = setting_value(settings['kNN'], 'n_neighbors')
    depth = setting_value(settings['Decision tree'], 'max_depth')
    layers = setting_value(settings['MLP'], 'hidden_layer_sizes').strip('()').replace(', ', ' and ')
    stumps = setting_value(settings['AdaBoost'], 'n_estimators')
    return {
        'Random forest': f'{trees} decision trees, each trained on a different resample of blocks, vote on every block.',
        'kNN': f'Finds the {k} training blocks with the most similar diaries and copies their verdict.',
        'Decision tree': f'One flowchart of yes-or-no questions about step counts, up to {depth} questions deep.',
        'MLP': f'A small neural network with two layers of {layers} units that learns a smooth boundary.',
        'Linear SVM': 'Draws one straight boundary between healthy and broken diaries.',
        'Logistic regression balanced': 'Adds up weighted step counts into one score, giving broken blocks extra weight while learning.',
        'Logistic regression': 'Adds up weighted step counts into one score.',
        'AdaBoost': f'{stumps} one-question trees added one after another, each fixing the last one\'s mistakes.',
        'Naive Bayes': 'Treats every step as separate evidence and multiplies the odds together.',
        'PCA anomaly detector': 'Learns what healthy diaries look like and flags any diary it cannot rebuild from that pattern.',
        'Baseline (always normal)': 'Says every block is healthy. This is the number to beat, not a model.',
    }


def build_models(comparison, final, settings):
    descriptions = describe_models(settings)
    metric_columns = ['accuracy', 'precision', 'recall', 'f1', 'auc', 'log_loss', 'tn', 'fp', 'fn', 'tp']

    validation = []
    for _, row in comparison.iterrows():
        entry = {'key': row['model'], 'name': DISPLAY_NAMES[row['model']],
                 'description': descriptions[row['model']],
                 'is_baseline': row['model'] == 'Baseline (always normal)',
                 'threshold': clean_number(float(row['threshold'])),
                 'validation_cost': int(row['validation_cost'])}
        for column in metric_columns:
            entry[column] = clean_number(row[column])
        validation.append(entry)
    # Sorted by validation cost, with the baseline always last.
    validation.sort(key=lambda entry: (entry['is_baseline'], entry['validation_cost']))

    test = []
    for _, row in final.iterrows():
        entry = {'key': row['model'], 'name': DISPLAY_NAMES[row['model']], 'threshold': float(row['threshold'])}
        for column in metric_columns:
            entry[column] = clean_number(row[column])
        test.append(entry)
    return {'validation': validation, 'test': test}


# ---------------------------------------------------------------------------
# blocks.json
# ---------------------------------------------------------------------------
def build_blocks(clean, splits, test_scores, threshold, event_columns):
    test = clean.iloc[splits['test_idx']].reset_index(drop=True)
    test['score'] = test_scores
    test['flagged'] = (test_scores >= threshold).astype(int)
    test['wrong'] = test['flagged'] != test['target']

    # A fixed sample at the true anomaly ratio (stratified), plus every block the model got wrong.
    sample_rows, _ = train_test_split(np.arange(len(test)), train_size=SAMPLE_SIZE,
                                      stratify=test['target'], random_state=42)
    sample_rows = set(sample_rows.tolist())
    wrong_rows = set(np.where(test['wrong'])[0].tolist())
    keep = sorted(sample_rows | wrong_rows)

    # How often the exact same diary appeared in training, by label.
    train = clean.iloc[splits['train_idx']]
    pattern_counts = train.groupby(event_columns)['target'].agg(['size', 'sum'])

    blocks = []
    for row_number in keep:
        row = test.iloc[row_number]
        counts = {event: int(row[event]) for event in event_columns if row[event] > 0}
        key = tuple(int(row[event]) for event in event_columns)
        seen_total, seen_broken = (0, 0)
        if key in pattern_counts.index:
            seen_total, seen_broken = pattern_counts.loc[key]
        score = round(float(row['score']), 4)
        # Rounding must not change the decision the site shows.
        assert (score >= threshold) == bool(row['flagged'])
        blocks.append({
            'id': short_id(row['BlockId']),
            'label': int(row['target']),
            'counts': counts,
            'score': score,
            'flagged': int(row['flagged']),
            'wrong': bool(row['wrong']),
            'in_sample': row_number in sample_rows,
            'seen_healthy': int(seen_total - seen_broken),
            'seen_broken': int(seen_broken),
        })
    assert len({block['id'] for block in blocks}) == len(blocks), 'short ids must be unique'
    return blocks, test


def summarise_mistakes(blocks, events):
    """One plain sentence about the model's test mistakes. Each claim is checked first."""
    medians = {event['id']: event['healthy_median'] for event in events['events']}
    false_alarms = [block for block in blocks if block['wrong'] and block['flagged'] == 1]
    missed = [block for block in blocks if block['wrong'] and block['flagged'] == 0]

    # Claim 1: every false alarm recorded the stored copy 4 times instead of the usual 3.
    stored_copy_counts = [block['counts'].get('E26', 0) for block in false_alarms]
    assert medians['E26'] == 3 and all(count == 4 for count in stored_copy_counts), stored_copy_counts
    # Claim 2: most false alarms have a diary that was mostly broken in training.
    mostly_broken = [block for block in false_alarms if block['seen_broken'] > block['seen_healthy']]
    # Claim 3: the missed block(s) have every copy received and a diary never seen in training.
    assert all(block['counts'].get('E9', 0) == medians['E9'] for block in missed)
    assert all(block['seen_healthy'] + block['seen_broken'] == 0 for block in missed)
    assert len(missed) == 1, 'the sentence below is written for exactly one missed block'
    started = missed[0]['counts'].get('E5', 0)

    return (f'All {len(false_alarms)} false alarms show "master records the stored copy" '
            f'{stored_copy_counts[0]} times instead of the usual {medians["E26"]}, and '
            f'{len(mostly_broken)} of them have a diary that, in training, belonged mostly to broken blocks. '
            f'The one missed block received all {medians["E9"]} copies normally but started {started} copies '
            f'instead of {medians["E5"]}, a diary that never appeared in training.')


# ---------------------------------------------------------------------------
# rules.json
# ---------------------------------------------------------------------------
def read_rule_leaves(path):
    """Turn export_text output into leaves: the conditions on the way down plus the leaf weights."""
    leaves = []
    conditions = []
    for line in path.read_text().splitlines():
        depth = line.count('|')
        text = line.split('--- ', 1)[1]
        if text.startswith('weights:'):
            numbers = re.findall(r'[\d.]+', text.split(']')[0])
            leaves.append({'conditions': conditions[:depth - 1],
                           'normal': int(float(numbers[0])), 'broken': int(float(numbers[1]))})
        else:
            conditions = conditions[:depth - 1] + [text]
    return leaves


# The rules shown on the site. The plain wording sits next to the original rule.
RULE_TEXT = [
    (['E9 <= 2.50'],
     'If "copy fully received" happened at most 2 times instead of 3, the block is broken.'),
    (['E9 >  2.50', 'E20 >  0.50', 'E3 <= 7.50'],
     'If all copies arrived, but the system later tried to delete a block that was not there, '
     'and programs read the block at most 7 times, the block is broken.'),
    (['E9 >  2.50', 'E20 <= 0.50', 'E26 <= 3.50'],
     'If all copies arrived, nothing tried to delete a missing block, and the master recorded '
     'the stored copy at most 3 times, the block is healthy.'),
]


def build_rules():
    leaves = read_rule_leaves(TABLES / 'decision_tree_rules.txt')
    rules = []
    for conditions, plain in RULE_TEXT:
        matches = [leaf for leaf in leaves if leaf['conditions'] == conditions]
        assert len(matches) == 1, f'rule not found in decision_tree_rules.txt: {conditions}'
        leaf = matches[0]
        verdict = 'broken' if leaf['broken'] > leaf['normal'] else 'healthy'
        rules.append({'original': ' and '.join(' '.join(c.split()) for c in conditions),
                      'verdict': verdict, 'plain': plain,
                      'training_blocks': leaf['normal'] + leaf['broken'],
                      'training_broken': leaf['broken'], 'training_healthy': leaf['normal']})
    return {'tree_depth': 3, 'rules': rules}


# ---------------------------------------------------------------------------
# charts.json: the data behind every chart on the site
# ---------------------------------------------------------------------------
def thin(positions, count):
    """Keep `count` evenly spaced items of a list, always including the first and last."""
    if len(positions) <= count:
        return list(positions)
    picks = np.unique(np.linspace(0, len(positions) - 1, count).round().astype(int))
    return [positions[i] for i in picks]


def thin_curve(xs, ys, in_zoom):
    """Shorten a curve to about CURVE_POINTS points, keeping most of them inside the zoomed area."""
    inside = [i for i in range(len(xs)) if in_zoom[i]]
    outside = [i for i in range(len(xs)) if not in_zoom[i]]
    keep = sorted(set(thin(inside, CURVE_POINTS - 30) + thin(outside, 30)))
    return [round(float(xs[i]), 6) for i in keep], [round(float(ys[i]), 6) for i in keep]


def load_validation_scores():
    saved = np.load(PROCESSED / 'validation_scores.npz')
    return {str(name): saved['scores'][row] for row, name in enumerate(saved['model_names'])}


def chart_roc(scores, y_val):
    curves = []
    for name, model_scores in scores.items():
        if name == 'Baseline (always normal)':
            continue  # one constant score: its ROC curve is the diagonal, with nothing to see
        fpr, tpr, _ = roc_curve(y_val, model_scores)
        fpr_kept, tpr_kept = thin_curve(fpr, tpr, fpr <= ROC_ZOOM_FPR)
        curves.append({'key': name, 'name': DISPLAY_NAMES[name], 'auc': float(roc_auc_score(y_val, model_scores)),
                       'fpr': fpr_kept, 'tpr': tpr_kept})
    curves.sort(key=lambda curve: -curve['auc'])
    return {'zoom_fpr': ROC_ZOOM_FPR, 'curves': curves}


def chart_pr(scores, y_val):
    curves = []
    for name in PR_MODELS:
        precision, recall, _ = precision_recall_curve(y_val, scores[name])
        recall_kept, precision_kept = thin_curve(recall, precision, recall >= PR_ZOOM_RECALL)
        curves.append({'key': name, 'name': DISPLAY_NAMES[name], 'recall': recall_kept, 'precision': precision_kept})
    return {'zoom_recall': PR_ZOOM_RECALL, 'curves': curves}


def chart_confusion(comparison, final):
    def rows(table):
        return [{'key': row['model'], 'name': DISPLAY_NAMES[row['model']], 'tn': int(row['tn']),
                 'fp': int(row['fp']), 'fn': int(row['fn']), 'tp': int(row['tp'])} for _, row in table.iterrows()]
    return {'validation': rows(comparison), 'test': rows(final)}


def chart_importance(model, event_columns):
    saved = pd.read_csv(TABLES / 'event_importance.csv').set_index('event')['importance']
    bars = []
    for event, importance in zip(event_columns, model.feature_importances_):
        assert abs(saved[event] - importance) < 1e-9, 'event_importance.csv does not match the saved model'
        bars.append({'id': event, 'name': EVENT_NAMES[event][0], 'importance': float(importance)})
    bars.sort(key=lambda bar: -bar['importance'])
    return bars


def chart_depth(settings):
    sweep = pd.read_csv(TABLES / 'tree_depth_sweep.csv')
    chosen = int(setting_value(settings['Decision tree'], 'max_depth'))
    return {'chosen_depth': chosen, 'depth': sweep['depth'].tolist(),
            'train_f1': sweep['train_f1'].round(6).tolist(), 'validation_f1': sweep['validation_f1'].round(6).tolist()}


def chart_pca():
    table = pd.read_csv(TABLES / 'pca_explained_variance.csv')
    reaches = int(table.loc[table['cumulative'] >= 0.95, 'component'].iloc[0])
    return {'component': table['component'].tolist(), 'ratio': table['explained_variance_ratio'].round(6).tolist(),
            'cumulative': table['cumulative'].round(6).tolist(), 'line': 0.95, 'components_for_95': reaches}


def chart_kmeans(broken_training_blocks):
    elbow = pd.read_csv(TABLES / 'kmeans_elbow.csv')
    clusters = pd.read_csv(TABLES / 'kmeans_cluster_anomaly_rates.csv')
    cluster_rows = []
    for _, row in clusters.iterrows():
        broken = int(round(row['blocks'] * row['anomaly_rate']))
        cluster_rows.append({'cluster': int(row['cluster']), 'blocks': int(row['blocks']),
                             'anomaly_share': float(row['anomaly_rate']), 'broken_blocks': broken})
    assert sum(row['broken_blocks'] for row in cluster_rows) == broken_training_blocks
    return {'k': elbow['k'].tolist(), 'inertia': elbow['inertia'].round(1).tolist(),
            'chosen_k': len(cluster_rows), 'fitted_on_normal_blocks': 30000, 'clusters': cluster_rows}


def chart_scores(validation_scores, y_val, threshold):
    edges = np.linspace(0, 1, HISTOGRAM_BINS + 1)
    healthy, _ = np.histogram(validation_scores[y_val == 0], bins=edges)
    broken, _ = np.histogram(validation_scores[y_val == 1], bins=edges)
    return {'edges': edges.round(4).tolist(), 'healthy': healthy.tolist(), 'broken': broken.tolist(),
            'threshold': threshold, 'set': 'validation'}


def chart_cost(dial):
    thresholds = [point['t'] for point in dial['points']]
    costs = [FN_COST * point['fn'] + FP_COST * point['fp'] for point in dial['points']]
    best = int(np.argmin(costs))
    assert best == dial['chosen_index'], 'the cost curve minimum must be the chosen threshold'
    return {'threshold': thresholds, 'cost': costs, 'chosen_index': best, 'chosen_cost': costs[best]}


def chart_correlation():
    table = pd.read_csv(TABLES / 'event_correlations.csv')
    return [{'id': row['event'], 'name': EVENT_NAMES[row['event']][0], 'r': round(float(row['correlation_with_anomaly']), 6)}
            for _, row in table.iterrows()]


def chart_barcodes(blocks):
    """About 300 sampled test blocks as 29-number strips (counts capped at 9), healthy first, then broken."""
    sample = [index for index, block in enumerate(blocks) if block['in_sample']]
    broken = [index for index in sample if blocks[index]['label'] == 1]
    healthy = [index for index in sample if blocks[index]['label'] == 0]
    rng = np.random.default_rng(42)
    healthy = sorted(rng.choice(healthy, size=BARCODE_HEALTHY, replace=False).tolist())

    def strip(index):
        counts = blocks[index]['counts']
        return [min(counts.get(event, 0), BARCODE_CAP) for event in DIARY_ORDER]

    # Within each group, identical diaries sit next to each other (most common first),
    # which is what makes the regularity of healthy blocks visible.
    def ordered(indices):
        patterns = {}
        for index in indices:
            patterns.setdefault(tuple(strip(index)), []).append(index)
        groups = sorted(patterns.values(), key=len, reverse=True)
        return [index for group in groups for index in group]

    strips = [{'block': index, 'cells': strip(index)} for index in ordered(healthy) + ordered(broken)]
    return {'order': DIARY_ORDER, 'cap': BARCODE_CAP, 'healthy': len(healthy), 'broken': len(broken), 'strips': strips}


def chart_pipeline(example, log_lines):
    total = sum(example['counts'].values())
    return {'block_id': example['full_id'], 'short_id': example['id'], 'label': example['label'],
            'score': example['score'], 'flagged': example['flagged'], 'line_count': len(log_lines),
            'event_total': total, 'first_lines': log_lines[:4], 'counts': example['counts']}


def export_figures():
    """Copy the notebook figures to docs/assets/figures/, resized and reduced to a small palette."""
    FIGURES_OUT.mkdir(parents=True, exist_ok=True)
    figures = []
    for file_name, notebook, caption in FIGURE_CAPTIONS:
        image = Image.open(FIGURES / file_name).convert('RGB')
        for width, colours in [(1100, 64), (900, 48), (800, 32)]:
            resized = image.copy()
            if resized.width > width:
                resized = resized.resize((width, round(resized.height * width / resized.width)), Image.LANCZOS)
            resized.convert('P', palette=Image.ADAPTIVE, colors=colours).save(FIGURES_OUT / file_name, optimize=True)
            if (FIGURES_OUT / file_name).stat().st_size <= MAX_FIGURE_BYTES:
                break
        size = (FIGURES_OUT / file_name).stat().st_size
        assert size <= MAX_FIGURE_BYTES, f'{file_name} is still {size} bytes'
        figures.append({'file': 'assets/figures/' + file_name, 'notebook': notebook, 'caption': caption,
                        'width': resized.width, 'height': resized.height, 'bytes': size})
    return figures


# ---------------------------------------------------------------------------
# Printing
# ---------------------------------------------------------------------------
def print_numbers(title, mapping):
    print(f'\n{title}')
    for key, value in mapping.items():
        print(f'  {key}: {value}')


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    clean, splits, templates, package, comparison, final, settings = load_everything()
    event_columns = package['event_columns']
    assert package['model_name'] == 'Random forest', 'the dial, dots and diaries are written for the random forest'

    model = package['model']
    threshold = package['threshold']
    X = clean[event_columns].values
    y = clean['target'].values
    validation_scores = model.predict_proba(X[splits['validation_idx']])[:, 1]
    test_scores = model.predict_proba(X[splits['test_idx']])[:, 1]

    blocks, test = build_blocks(clean, splits, test_scores, threshold, event_columns)

    # Example block for the pipeline diagram: the shortest diary of at least 12 lines among sampled
    # broken blocks the alarm caught (shorter ones have too few steps to show the counting).
    caught = [block for block in blocks if block['in_sample'] and block['label'] == 1 and block['flagged'] == 1
              and sum(block['counts'].values()) >= 12]
    example = dict(min(caught, key=lambda block: (sum(block['counts'].values()), block['id'])))
    matches = test.loc[test['BlockId'].map(short_id) == example['id'], 'BlockId']
    assert len(matches) == 1
    example['full_id'] = matches.iloc[0]

    print('Reading HDFS.log (about 1.5 GB, takes a few seconds)...')
    log_summary = read_log_summary(example['full_id'])
    facts = build_facts(clean, splits, package, final, event_columns, log_summary)
    events = build_events(clean, splits, templates, event_columns)
    y_val = y[splits['validation_idx']]
    dial = build_dial(validation_scores, y_val, threshold, comparison)
    models = build_models(comparison, final, settings)
    rules = build_rules()

    # The caption on event_frequency_overview.png says ten event types make up almost every line.
    event_totals = clean[event_columns].sum().sort_values(ascending=False)
    top_ten_share = event_totals.head(10).sum() / event_totals.sum()
    assert top_ten_share > 0.99, top_ten_share

    saved_scores = load_validation_scores()
    assert np.allclose(saved_scores['Random forest'], validation_scores), 'saved scores must match the saved model'
    charts = {
        'roc': chart_roc(saved_scores, y_val),
        'pr': chart_pr(saved_scores, y_val),
        'confusion': chart_confusion(comparison, final),
        'importance': chart_importance(model, event_columns),
        'depth': chart_depth(settings),
        'pca': chart_pca(),
        'kmeans': chart_kmeans(events['broken_training_blocks']),
        'scores': chart_scores(validation_scores, y_val, threshold),
        'costcurve': chart_cost(dial),
        'correlation': chart_correlation(),
        'barcodes': chart_barcodes(blocks),
        'pipeline': chart_pipeline(example, log_summary[4]),
        'figures': export_figures(),
        'top_ten_event_share': float(top_ten_share),
    }

    sample = [block for block in blocks if block['in_sample']]
    blocks_file = {
        'set': 'test',
        'sample_size': len(sample),
        'sample_broken': sum(block['label'] for block in sample),
        'sample_healthy': sum(1 - block['label'] for block in sample),
        'mistakes': sum(block['wrong'] for block in blocks),
        'mistakes_summary': summarise_mistakes(blocks, events),
        'blocks': blocks,
    }

    print_numbers('facts.json', facts)
    print('\nevents.json')
    for event in events['events']:
        print(f"  {event['id']:>3} {event['name']:<44} median {event['healthy_median']:>2}  "
              f"healthy {event['healthy_share']:.6f}  broken {event['broken_share']:.6f}"
              + ('   (name unsure)' if event['name_unsure'] else ''))
    print(f"  healthy training blocks {events['healthy_training_blocks']}, broken {events['broken_training_blocks']}")
    print(f"\ndial.json: {len(dial['points'])} thresholds, chosen {dial['chosen_threshold']} at index {dial['chosen_index']}")
    print(f"  positives {dial['positives']}, negatives {dial['negatives']}, chosen point {dial['points'][dial['chosen_index']]}")
    for point in dial['points'][::25]:
        print('  ', point)
    print('\nmodels.json (validation)')
    for entry in models['validation']:
        print(f"  {entry['name']:<32} cost {entry['validation_cost']:>6}  recall {entry['recall']:.6f}  "
              f"precision {entry['precision']:.6f}  tp {entry['tp']} fp {entry['fp']} fn {entry['fn']} tn {entry['tn']}")
        print(f"      {entry['description']}")
    print('models.json (test)')
    for entry in models['test']:
        print(f"  {entry['name']:<32} tp {entry['tp']} fp {entry['fp']} fn {entry['fn']} tn {entry['tn']}  "
              f"accuracy {entry['accuracy']:.6f} precision {entry['precision']:.6f} recall {entry['recall']:.6f}")
    print_numbers('blocks.json', {key: value for key, value in blocks_file.items() if key != 'blocks'})
    for block in blocks:
        if block['wrong']:
            print('   mistake:', block)
    print('\nrules.json')
    for rule in rules['rules']:
        print(f"  {rule['original']} -> {rule['verdict']}: {rule['training_broken']} broken, "
              f"{rule['training_healthy']} healthy of {rule['training_blocks']}")
        print(f"      {rule['plain']}")

    print('\ncharts.json (size and one sample value per series)')
    for name, series in charts.items():
        sample = json.dumps(series)[:110]
        print(f'  {name:<12} {len(json.dumps(series)):>7,} bytes   {sample}')
    for curve in charts['roc']['curves']:
        print(f"    roc {curve['name']:<32} {len(curve['fpr'])} points  AUC {curve['auc']:.6f}")
    for curve in charts['pr']['curves']:
        print(f"    pr  {curve['name']:<32} {len(curve['recall'])} points")
    print(f"    pipeline example {charts['pipeline']['block_id']}: {charts['pipeline']['line_count']} log lines, "
          f"{charts['pipeline']['event_total']} counted events, score {charts['pipeline']['score']}")
    for line in charts['pipeline']['first_lines']:
        print('      ', line)
    for figure in charts['figures']:
        print(f"    figure {figure['file']:<45} {figure['bytes']:>7,} bytes  {figure['width']}x{figure['height']}")

    print('\nWriting files')
    write_json('charts.json', charts)
    write_json('facts.json', facts)
    write_json('events.json', events)
    write_json('dial.json', dial)
    write_json('models.json', models)
    write_json('blocks.json', blocks_file)
    write_json('rules.json', rules)

    total_bytes = sum(path.stat().st_size for path in OUT.glob('*.json'))
    print(f'\ndocs/data total: {total_bytes:,} bytes')
    assert total_bytes < MAX_DATA_BYTES, 'docs/data must stay under 1 MB'
    print('Names marked unsure:', ', '.join(f'{e} ({EVENT_NAMES[e][0]})' for e in UNSURE_NAMES))


if __name__ == '__main__':
    main()
