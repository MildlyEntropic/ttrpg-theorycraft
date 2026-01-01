import { useState, useEffect, useCallback } from 'react';
import SpellAnalysis from './SpellAnalysis.jsx';
import * as api from '../../services/api.js';

export default function SpellDetail({ spellKey, onClose }) {
  const [activeTab, setActiveTab] = useState('info'); // 'info' | 'analysis'
  const [context, setContext] = useState({
    casterLevel: 5,
    spellMod: 4,
    profBonus: 3,
    targetAC: 15,
    targets: 1,
    targetSaves: {
      strength: 2,
      dexterity: 3,
      constitution: 3,
      intelligence: 0,
      wisdom: 1,
      charisma: -1
    }
  });

  const [spell, setSpell] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState(null);

  // Initial fetch when spell changes
  useEffect(() => {
    if (!spellKey) {
      setSpell(null);
      setAnalysis(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    Promise.all([
      api.getSpell('dnd5e-2014', spellKey),
      api.analyzeSpell('dnd5e-2014', spellKey, context)
    ])
      .then(([spellData, analysisData]) => {
        setSpell(spellData);
        setAnalysis(analysisData);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [spellKey]);

  // Manual recalculate
  const handleRecalculate = useCallback(async () => {
    if (!spellKey) return;
    setAnalyzing(true);

    try {
      const analysisData = await api.analyzeSpell('dnd5e-2014', spellKey, context);
      setAnalysis(analysisData);
    } catch (err) {
      setError(err.message);
    } finally {
      setAnalyzing(false);
    }
  }, [spellKey, context]);

  const handleContextChange = (key, value) => {
    setContext(prev => ({ ...prev, [key]: value }));
  };

  const handleSaveChange = (save, value) => {
    setContext(prev => ({
      ...prev,
      targetSaves: { ...prev.targetSaves, [save]: parseInt(value) || 0 }
    }));
  };

  if (!spell && loading) {
    return (
      <div className="spell-detail spell-detail-compact">
        <div className="spell-detail-header">
          <h2>Loading...</h2>
          <button className="btn-close" onClick={onClose}>×</button>
        </div>
      </div>
    );
  }

  if (error && !spell) {
    return (
      <div className="spell-detail spell-detail-compact">
        <div className="spell-detail-header">
          <h2>Error</h2>
          <button className="btn-close" onClick={onClose}>×</button>
        </div>
        <div className="error-message">{error}</div>
      </div>
    );
  }

  if (!spell) return null;

  const classNames = spell.classes?.length > 0
    ? spell.classes.map(c => typeof c === 'string' ? c : c.name).join(', ')
    : 'N/A';

  return (
    <div className="spell-detail spell-detail-compact">
      {/* Compact Header */}
      <div className="spell-detail-header">
        <div>
          <h2>{spell.name}</h2>
          <div className="spell-detail-subtitle">
            {spell.level === 0 ? 'Cantrip' : `Level ${spell.level}`} {spell.school}
            {spell.ritual && ' (R)'}
            {spell.concentration && ' (C)'}
          </div>
        </div>
        <button className="btn-close" onClick={onClose}>×</button>
      </div>

      {/* Quick Stats Bar */}
      <div className="spell-quick-stats">
        <span title="Casting Time">{spell.castingTime}</span>
        <span title="Range">{spell.range}</span>
        <span title="Duration">{spell.duration}</span>
        {spell.damageRoll && <span className="damage-badge" title="Damage">{spell.damageRoll}</span>}
        {spell.savingThrow && <span className="save-badge" title="Saving Throw">{spell.savingThrow.substring(0, 3).toUpperCase()}</span>}
        {spell.attackRoll && <span className="attack-badge" title="Attack Roll">ATK</span>}
      </div>

      {/* Tab Navigation */}
      <div className="spell-detail-tabs">
        <button
          className={`detail-tab ${activeTab === 'info' ? 'active' : ''}`}
          onClick={() => setActiveTab('info')}
        >
          Info
        </button>
        <button
          className={`detail-tab ${activeTab === 'analysis' ? 'active' : ''}`}
          onClick={() => setActiveTab('analysis')}
        >
          Analysis
        </button>
      </div>

      {/* Tab Content */}
      <div className="spell-detail-body">
        {activeTab === 'info' && (
          <div className="spell-info-tab">
            <p className="spell-desc">{spell.description}</p>

            {spell.higherLevel && (
              <div className="spell-higher-level">
                <strong>At Higher Levels:</strong> {spell.higherLevel}
              </div>
            )}

            <div className="spell-meta">
              <span><strong>Classes:</strong> {classNames}</span>
              <span className="spell-source">{spell.source}</span>
            </div>
          </div>
        )}

        {activeTab === 'analysis' && (
          <div className="spell-analysis-tab">
            {/* Compact Context Inputs */}
            <div className="context-compact">
              <div className="context-row-compact">
                <label>Lvl</label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={context.casterLevel}
                  onChange={(e) => handleContextChange('casterLevel', parseInt(e.target.value))}
                />
                <label>Mod</label>
                <input
                  type="number"
                  min="-5"
                  max="10"
                  value={context.spellMod}
                  onChange={(e) => handleContextChange('spellMod', parseInt(e.target.value))}
                />
                <label>AC</label>
                <input
                  type="number"
                  min="1"
                  max="30"
                  value={context.targetAC}
                  onChange={(e) => handleContextChange('targetAC', parseInt(e.target.value))}
                />
                <label>#</label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={context.targets}
                  onChange={(e) => handleContextChange('targets', parseInt(e.target.value))}
                />
                {spell.savingThrow && (
                  <>
                    <label>{spell.savingThrow.substring(0, 3).toUpperCase()}</label>
                    <input
                      type="number"
                      min="-5"
                      max="15"
                      value={context.targetSaves[spell.savingThrow] || 0}
                      onChange={(e) => handleSaveChange(spell.savingThrow, e.target.value)}
                    />
                  </>
                )}
                <button
                  className="btn-calc"
                  onClick={handleRecalculate}
                  disabled={analyzing}
                  title="Recalculate"
                >
                  {analyzing ? '...' : '↻'}
                </button>
              </div>
            </div>

            <div className={`analysis-wrapper ${analyzing ? 'analyzing' : ''}`}>
              {analysis && <SpellAnalysis analysis={analysis} />}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
