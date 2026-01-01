import { useState, useEffect, useRef } from 'react';
import { useSpellSearch, useSpellComparison } from '../../hooks/useSpells.js';

export default function SpellComparison() {
  const [selectedSpells, setSelectedSpells] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [context, setContext] = useState({
    casterLevel: 5,
    spellMod: 4,
    targetAC: 15,
    targets: 1
  });

  const { results: searchResults, search, loading: searching } = useSpellSearch();
  const { comparison, compare, loading: comparing } = useSpellComparison();
  const debounceRef = useRef(null);

  // Debounced search effect
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (searchQuery.length >= 2) {
      debounceRef.current = setTimeout(() => {
        search(searchQuery);
      }, 200);
    }

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [searchQuery, search]);

  const handleSearch = (e) => {
    setSearchQuery(e.target.value);
  };

  const addSpell = (spell) => {
    if (selectedSpells.length < 6 && !selectedSpells.find(s => s.key === spell.key)) {
      setSelectedSpells([...selectedSpells, spell]);
    }
    setSearchQuery('');
  };

  const removeSpell = (key) => {
    setSelectedSpells(selectedSpells.filter(s => s.key !== key));
  };

  const runComparison = () => {
    if (selectedSpells.length >= 2) {
      compare(selectedSpells.map(s => s.key), context);
    }
  };

  const handleContextChange = (key, value) => {
    setContext(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="spell-comparison">
      <div className="comparison-header">
        <h2>Spell Comparison</h2>
        <p>Compare up to 6 spells to find the best option for your situation</p>
      </div>

      <div className="comparison-setup">
        <div className="spell-selector">
          <h3>Select Spells</h3>
          <div className="search-box">
            <input
              type="text"
              placeholder="Search for spells to compare..."
              value={searchQuery}
              onChange={handleSearch}
            />
            {searching && <span className="searching">Searching...</span>}

            {searchQuery.length >= 2 && searchResults.length > 0 && (
              <div className="search-dropdown">
                {searchResults.map(spell => (
                  <div
                    key={spell.key}
                    className="search-result"
                    onClick={() => addSpell(spell)}
                  >
                    <span className="result-name">{spell.name}</span>
                    <span className="result-level">
                      {spell.level === 0 ? 'Cantrip' : `Lvl ${spell.level}`}
                    </span>
                    {spell.damageRoll && (
                      <span className="result-damage">{spell.damageRoll}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="selected-spells">
            {selectedSpells.length === 0 ? (
              <div className="no-spells">Search and select spells to compare</div>
            ) : (
              selectedSpells.map(spell => (
                <div key={spell.key} className="selected-spell">
                  <span className="spell-info">
                    <strong>{spell.name}</strong>
                    <span className="spell-meta">
                      {spell.level === 0 ? 'Cantrip' : `Level ${spell.level}`}
                      {spell.damageRoll && ` - ${spell.damageRoll}`}
                    </span>
                  </span>
                  <button
                    className="btn-remove"
                    onClick={() => removeSpell(spell.key)}
                  >
                    ×
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="context-setup">
          <h3>Combat Context</h3>
          <div className="context-grid">
            <div className="context-field">
              <label>Caster Level</label>
              <input
                type="number"
                min="1"
                max="20"
                value={context.casterLevel}
                onChange={(e) => handleContextChange('casterLevel', parseInt(e.target.value))}
              />
            </div>
            <div className="context-field">
              <label>Spell Modifier</label>
              <input
                type="number"
                min="-5"
                max="10"
                value={context.spellMod}
                onChange={(e) => handleContextChange('spellMod', parseInt(e.target.value))}
              />
            </div>
            <div className="context-field">
              <label>Target AC</label>
              <input
                type="number"
                min="1"
                max="30"
                value={context.targetAC}
                onChange={(e) => handleContextChange('targetAC', parseInt(e.target.value))}
              />
            </div>
            <div className="context-field">
              <label>Number of Targets</label>
              <input
                type="number"
                min="1"
                max="20"
                value={context.targets}
                onChange={(e) => handleContextChange('targets', parseInt(e.target.value))}
              />
            </div>
          </div>

          <button
            className="btn-compare"
            disabled={selectedSpells.length < 2 || comparing}
            onClick={runComparison}
          >
            {comparing ? 'Comparing...' : 'Compare Spells'}
          </button>
        </div>
      </div>

      {comparison && (
        <div className="comparison-results">
          <h3>Comparison Results</h3>

          <div className="comparison-summary">
            <div className="best-pick">
              <label>Best Damage</label>
              <span className="winner">{comparison.bestDamage}</span>
            </div>
            <div className="best-pick">
              <label>Best Efficiency</label>
              <span className="winner">{comparison.bestEfficiency}</span>
            </div>
          </div>

          <div className="comparison-table-wrapper">
            <table className="comparison-table">
              <thead>
                <tr>
                  <th>Spell</th>
                  <th>Level</th>
                  <th>Base Damage</th>
                  <th>Hit Chance</th>
                  <th>Expected Damage</th>
                  <th>Total (w/ targets)</th>
                  <th>Efficiency</th>
                </tr>
              </thead>
              <tbody>
                {comparison.spells.map((analysis, i) => (
                  <tr
                    key={analysis.spell.key}
                    className={i === 0 ? 'top-spell' : ''}
                  >
                    <td className="spell-name-cell">
                      {analysis.spell.name}
                      {analysis.spell.concentration && <span className="conc-badge">C</span>}
                    </td>
                    <td>{analysis.spell.level === 0 ? 'C' : analysis.spell.level}</td>
                    <td>{analysis.damage?.baseDamage || '-'}</td>
                    <td>{analysis.damage?.hitChance ? `${analysis.damage.hitChance}%` : '-'}</td>
                    <td>{analysis.damage?.expectedDamage?.toFixed(1) || '-'}</td>
                    <td className="total-damage">
                      {analysis.damage?.totalExpectedDamage?.toFixed(1) || '-'}
                    </td>
                    <td className={`efficiency-${analysis.efficiency?.slotEfficiency?.rating}`}>
                      {analysis.efficiency?.slotEfficiency?.rating || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="comparison-notes">
            {comparison.spells.map(analysis => (
              analysis.tactical?.notes?.length > 0 && (
                <div key={analysis.spell.key} className="spell-notes">
                  <strong>{analysis.spell.name}:</strong>
                  <ul>
                    {analysis.tactical.notes.map((note, i) => (
                      <li key={i}>{note}</li>
                    ))}
                  </ul>
                </div>
              )
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
