// Shared with the standalone HTML; pure calculations over frozen benchmark logs.
(() => {
  function selected(row, threshold) {
    return row.ranked.filter(item => item.probability >= threshold).slice(0, 3).map(item => item.id);
  }
  function selectionSummary(rows, threshold) {
    let answerable = 0, top1 = 0, success = 0, shown = 0, relevantShown = 0, noMatch = 0, falseRecommendations = 0;
    for (const row of rows) {
      const ids = selected(row, threshold), gold = new Set(row.goldRelevantIds);
      if (gold.size) {
        answerable++;
        if (ids.length && gold.has(ids[0])) top1++;
        if (ids.some(id => gold.has(id))) success++;
      } else {
        noMatch++;
        if (ids.length) falseRecommendations++;
      }
      shown += ids.length;
      relevantShown += ids.filter(id => gold.has(id)).length;
    }
    return { answerable, top1, success, shown, relevantShown, noMatch, falseRecommendations };
  }
  function stageIds(row, materials, stage, threshold) {
    if (stage === 0) return materials.map(m => m.id);
    if (stage === 1 || stage === 2) return row.shortlist.map(m => m.id);
    if (stage === 3) return row.ranked.map(m => m.id);
    return selected(row, threshold);
  }
  globalThis.ExperimentModel = { selected, selectionSummary, stageIds };
})();
