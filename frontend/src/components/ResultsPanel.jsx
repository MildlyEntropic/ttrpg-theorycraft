import React, { useState } from 'react';

function ResultsPanel({ results }) {
  const [showTable, setShowTable] = useState(null);

  if (!results) return null;

  const { character, breakpoints, recommendations, spellPacing } = results;

  return (
    <div className="results-container">
      <h2>
        Analysis for {character.name || 'Your Character'}
      </h2>

      {/* GWM/Sharpshooter Breakpoints */}
      {breakpoints.GWM && (
        <BreakpointCard
          title="Great Weapon Master"
          data={breakpoints.GWM}
          showTable={showTable === 'gwm'}
          onToggleTable={() => setShowTable(showTable === 'gwm' ? null : 'gwm')}
        />
      )}

      {breakpoints.Sharpshooter && (
        <BreakpointCard
          title="Sharpshooter"
          data={breakpoints.Sharpshooter}
          showTable={showTable === 'ss'}
          onToggleTable={() => setShowTable(showTable === 'ss' ? null : 'ss')}
        />
      )}

      {/* Reckless Attack */}
      {breakpoints.recklessAttack && (
        <div className="breakpoint-card">
          <h3>Reckless Attack</h3>
          <div className="decision-rules">
            <div className="rule high">
              <span className="condition">High HP + Rage active</span>
              <span className="action">USE IT</span>
            </div>
            <div className="rule medium">
              <span className="condition">Moderate HP, 1-2 enemies</span>
              <span className="action">Consider it</span>
            </div>
            <div className="rule low">
              <span className="condition">Low HP or many enemies</span>
              <span className="action">DON'T</span>
            </div>
          </div>
          <p className="detail">
            Reckless gives you advantage, but enemies also get advantage against you.
            Only worth it when you can take the extra hits.
          </p>
        </div>
      )}

      {/* Stunning Strike */}
      {breakpoints.stunningStrike && (
        <div className="breakpoint-card">
          <h3>Stunning Strike</h3>
          <div className="advice">
            Your DC: {breakpoints.stunningStrike.vsAverageCon?.dc || '??'}
          </div>
          <div className="decision-rules">
            <div className="rule high">
              <span className="condition">vs. Low CON (casters, rogues)</span>
              <span className="action">~{breakpoints.stunningStrike.vsBadCon?.failProbability}% success</span>
            </div>
            <div className="rule medium">
              <span className="condition">vs. Average CON</span>
              <span className="action">~{breakpoints.stunningStrike.vsAverageCon?.failProbability}% success</span>
            </div>
            <div className="rule low">
              <span className="condition">vs. High CON (brutes)</span>
              <span className="action">~{breakpoints.stunningStrike.vsGoodCon?.failProbability}% success</span>
            </div>
          </div>
          <p className="detail">{breakpoints.stunningStrike.vsAverageCon?.reasoning}</p>
        </div>
      )}

      {/* Divine Smite */}
      {breakpoints.divineSmite && (
        <div className="breakpoint-card">
          <h3>Divine Smite</h3>
          <div className="decision-rules">
            <div className="rule high">
              <span className="condition">You rolled a CRIT</span>
              <span className="action">ALWAYS SMITE</span>
            </div>
            <div className="rule medium">
              <span className="condition">Target nearly dead</span>
              <span className="action">Smite to finish</span>
            </div>
            <div className="rule low">
              <span className="condition">Normal hit, healthy target</span>
              <span className="action">Save for crits</span>
            </div>
          </div>
          <p className="detail">
            <strong>Smite Damage:</strong> 1st: 2d8 (9) | 2nd: 3d8 (13.5) | 3rd: 4d8 (18) | 4th: 5d8 (22.5)
            <br />
            Crits double all smite dice!
          </p>
        </div>
      )}

      {/* Spell Slot Pacing */}
      {spellPacing && (
        <div className="breakpoint-card">
          <h3>Spell Slot Pacing</h3>
          <div className="advice">
            {spellPacing.slotsPerEncounter} slots available per encounter
          </div>
          <div className="detail">
            <p>Total slots: {spellPacing.totalSlots} | Expected encounters: {spellPacing.expectedEncounters}</p>
            <ul style={{ marginTop: '0.5rem', paddingLeft: '1.2rem' }}>
              {spellPacing.recommendations.map((rec, i) => (
                <li key={i}>{rec}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* General Recommendations */}
      {recommendations && recommendations.length > 0 && (
        <div className="recommendations">
          <h3>Quick Reference</h3>
          <ul>
            {recommendations.map((rec, i) => (
              <li key={i}>{rec}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function BreakpointCard({ title, data, showTable, onToggleTable }) {
  const { normal, withAdvantage } = data;

  return (
    <div className="breakpoint-card">
      <h3>{title} (-5 attack / +10 damage)</h3>

      <div className="decision-rules">
        <div className="rule high">
          <span className="condition">AC ≤ {normal.breakpoint - 2}</span>
          <span className="action">ALWAYS USE</span>
        </div>
        <div className="rule medium">
          <span className="condition">AC {normal.breakpoint - 1} - {normal.breakpoint + 1}</span>
          <span className="action">Use with advantage</span>
        </div>
        <div className="rule low">
          <span className="condition">AC ≥ {normal.breakpoint + 2}</span>
          <span className="action">DON'T USE</span>
        </div>
      </div>

      <p className="detail">
        <strong>Normal:</strong> {normal.advice}
        <br />
        <strong>With Advantage:</strong> {withAdvantage.advice}
      </p>

      <button
        onClick={onToggleTable}
        style={{
          marginTop: '0.5rem',
          padding: '0.3rem 0.6rem',
          background: 'transparent',
          border: '1px solid var(--border-color)',
          color: 'var(--text-secondary)',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '0.85rem',
        }}
      >
        {showTable ? 'Hide' : 'Show'} full AC table
      </button>

      {showTable && (
        <table className="ac-table">
          <thead>
            <tr>
              <th>AC</th>
              <th>Normal DPR</th>
              <th>{title} DPR</th>
              <th>Difference</th>
              <th>Use?</th>
            </tr>
          </thead>
          <tbody>
            {normal.details.map((row) => (
              <tr key={row.ac} className={row.useGWM ? 'use-feat' : 'no-feat'}>
                <td>{row.ac}</td>
                <td>{row.normalDPR}</td>
                <td>{row.gwmDPR}</td>
                <td>{row.difference > 0 ? '+' : ''}{row.difference}</td>
                <td>{row.useGWM ? '✓' : '✗'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default ResultsPanel;
