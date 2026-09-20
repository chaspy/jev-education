export function parseNumericAnswer(input) {
  const normalized = input.normalize('NFKC').replaceAll('−', '-').replace(/\s/g, '').replace(/^x=/i, '');
  if (!/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)(?:\/[+-]?(?:\d+(?:\.\d+)?|\.\d+))?$/.test(normalized)) return null;
  const [a, b = '1'] = normalized.split('/').map(Number);
  return b !== 0 && Number.isFinite(a / b) ? a / b : null;
}
