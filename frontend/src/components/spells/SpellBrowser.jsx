import { useState } from 'react';
import { useSpells, useSpellStats } from '../../hooks/useSpells.js';
import SpellCard from './SpellCard.jsx';
import SpellFilters from './SpellFilters.jsx';
import SpellDetail from './SpellDetail.jsx';

export default function SpellBrowser() {
  const [selectedSpell, setSelectedSpell] = useState(null);
  const { spells, loading, error, filters, pagination, updateFilters } = useSpells({
    limit: 50,
    hasDamage: false
  });
  const { stats } = useSpellStats();

  return (
    <div className="spell-browser">
      <div className="spell-browser-header">
        <h2>Spell Browser</h2>
        {stats && (
          <div className="spell-stats-summary">
            <span>{stats.total} spells</span>
            <span className="separator">|</span>
            <span>{stats.damageSpells} damage spells</span>
          </div>
        )}
      </div>

      <SpellFilters
        filters={filters}
        onFilterChange={updateFilters}
        stats={stats}
      />

      {error && (
        <div className="error-message">
          Error loading spells: {error}
        </div>
      )}

      <div className="spell-browser-content">
        <div className="spell-list">
          {loading ? (
            <div className="loading">Loading spells...</div>
          ) : spells.length === 0 ? (
            <div className="no-results">No spells found matching your filters</div>
          ) : (
            <>
              <div className="spell-grid">
                {spells.map(spell => (
                  <SpellCard
                    key={spell.key}
                    spell={spell}
                    selected={selectedSpell?.key === spell.key}
                    onClick={() => setSelectedSpell(spell)}
                  />
                ))}
              </div>
              {pagination.hasMore && (
                <div className="pagination-info">
                  Showing {spells.length} of {pagination.total} spells
                </div>
              )}
            </>
          )}
        </div>

        {selectedSpell && (
          <SpellDetail
            spellKey={selectedSpell.key}
            onClose={() => setSelectedSpell(null)}
          />
        )}
      </div>
    </div>
  );
}
