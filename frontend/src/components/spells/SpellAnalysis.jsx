export default function SpellAnalysis({ analysis }) {
  if (!analysis) return null;

  const { damage, efficiency, tactical, context } = analysis;

  if (!damage?.hasDamage) {
    return (
      <div className="spell-analysis-compact">
        <div className="analysis-note">
          {damage?.note || 'This spell does not deal direct damage.'}
        </div>
      </div>
    );
  }

  const getEfficiencyClass = (rating) => {
    switch (rating) {
      case 'excellent': return 'eff-excellent';
      case 'good': return 'eff-good';
      case 'average': return 'eff-average';
      case 'poor': return 'eff-poor';
      default: return '';
    }
  };

  return (
    <div className="spell-analysis-compact">
      {/* Quick Context */}
      <div className="analysis-quick-context">
        DC {context.spellDC} | +{context.spellAttackBonus} hit
      </div>

      {/* Damage Stats - Compact Grid */}
      <div className="analysis-stats-grid">
        <div className="stat-box">
          <span className="stat-label">Damage</span>
          <span className="stat-main">{damage.baseDamage}</span>
          <span className="stat-sub">avg {damage.averageRoll}</span>
        </div>

        <div className="stat-box">
          <span className="stat-label">Hit %</span>
          <span className="stat-main">{damage.hitChance}%</span>
          {damage.saveForHalf && <span className="stat-sub">½ on save</span>}
        </div>

        <div className="stat-box highlight">
          <span className="stat-label">Expected</span>
          <span className="stat-main">{damage.expectedDamage.toFixed(1)}</span>
          {damage.targets > 1 && (
            <span className="stat-sub">{damage.totalExpectedDamage.toFixed(1)} total</span>
          )}
        </div>

        <div className={`stat-box ${getEfficiencyClass(efficiency.slotEfficiency?.rating)}`}>
          <span className="stat-label">Efficiency</span>
          <span className="stat-main">{efficiency.slotEfficiency?.rating?.toUpperCase() || '-'}</span>
          <span className="stat-sub">
            {efficiency.vsCantrip?.ratio?.toFixed(1)}x cantrip
          </span>
        </div>
      </div>

      {/* Tactical Notes - Condensed */}
      {tactical && tactical.notes.length > 0 && (
        <div className="analysis-tactical">
          {tactical.notes.slice(0, 2).map((note, i) => (
            <span key={i} className="tactical-note">{note}</span>
          ))}
          {tactical.bestConditions.length > 0 && (
            <div className="condition-tags-compact">
              {tactical.bestConditions.slice(0, 3).map((condition, i) => (
                <span key={i} className="cond-tag">
                  {condition.replace(/_/g, ' ')}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
