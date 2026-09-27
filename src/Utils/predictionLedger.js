const KEY = "homeocure-prediction-ledger";

export function loadPredictionLedger() {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

export function savePredictionLedger(rows) {
  localStorage.setItem(KEY, JSON.stringify(rows));
  window.dispatchEvent(new CustomEvent("homeocure:prediction-ledger"));
}

export function recordPrediction(type, predictionDate, predictedValue, metadata = {}) {
  const rows = loadPredictionLedger();
  const id = `${type}:${predictionDate}`;
  const existing = rows.findIndex((x) => x.id === id);
  const row = {
    id,
    type,
    predictionDate,
    predictedValue: Number(predictedValue) || 0,
    actualValue: null,
    absoluteError: null,
    accuracy: null,
    resolved: false,
    resolvedAt: null,
    metadata,
  };
  if (existing >= 0) rows[existing] = { ...rows[existing], ...row };
  else rows.push(row);
  savePredictionLedger(rows);
}

export function resolvePrediction(type, predictionDate, actualValue) {
  const rows = loadPredictionLedger();
  const index = rows.findIndex((x) => x.id === `${type}:${predictionDate}`);
  if (index < 0) return;
  const row = rows[index];
  const predicted = Number(row.predictedValue) || 0;
  const actual = Number(actualValue) || 0;
  const denominator = Math.max(Math.abs(predicted), Math.abs(actual), 1);
  const accuracy = Math.max(0, Math.min(100, (1 - Math.abs(predicted - actual) / denominator) * 100));
  rows[index] = {
    ...row,
    actualValue: actual,
    absoluteError: Math.abs(predicted - actual),
    accuracy,
    resolved: true,
    resolvedAt: new Date().toISOString(),
  };
  savePredictionLedger(rows);
    }
