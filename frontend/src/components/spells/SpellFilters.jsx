import { useState } from 'react';

const SCHOOLS = [
  'Abjuration', 'Conjuration', 'Divination', 'Enchantment',
  'Evocation', 'Illusion', 'Necromancy', 'Transmutation'
];

const CLASSES = [
  'Bard', 'Cleric', 'Druid', 'Paladin', 'Ranger',
  'Sorcerer', 'Warlock', 'Wizard', 'Artificer'
];

const SAVE_TYPES = [
  { value: 'strength', label: 'STR' },
  { value: 'dexterity', label: 'DEX' },
  { value: 'constitution', label: 'CON' },
  { value: 'intelligence', label: 'INT' },
  { value: 'wisdom', label: 'WIS' },
  { value: 'charisma', label: 'CHA' }
];

export default function SpellFilters({ filters, onFilterChange, stats }) {
  const [searchInput, setSearchInput] = useState(filters.search || '');

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    onFilterChange({ search: searchInput });
  };

  const handleSearchClear = () => {
    setSearchInput('');
    onFilterChange({ search: '' });
  };

  return (
    <div className="spell-filters">
      <form className="search-form" onSubmit={handleSearchSubmit}>
        <input
          type="text"
          placeholder="Search spells..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="search-input"
        />
        <button type="submit" className="btn-search">Search</button>
        {searchInput && (
          <button type="button" className="btn-clear" onClick={handleSearchClear}>
            Clear
          </button>
        )}
      </form>

      <div className="filter-row">
        <div className="filter-group">
          <label>Level</label>
          <select
            value={filters.level ?? ''}
            onChange={(e) => onFilterChange({
              level: e.target.value === '' ? undefined : parseInt(e.target.value)
            })}
          >
            <option value="">All Levels</option>
            <option value="0">Cantrip{stats?.byLevel?.[0] ? ` (${stats.byLevel[0]})` : ''}</option>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(level => (
              <option key={level} value={level}>
                Level {level}
                {stats?.byLevel?.[level] ? ` (${stats.byLevel[level]})` : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label>School</label>
          <select
            value={filters.school || ''}
            onChange={(e) => onFilterChange({ school: e.target.value || undefined })}
          >
            <option value="">All Schools</option>
            {SCHOOLS.map(school => (
              <option key={school} value={school}>{school}</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label>Class</label>
          <select
            value={filters.className || ''}
            onChange={(e) => onFilterChange({ className: e.target.value || undefined })}
          >
            <option value="">All Classes</option>
            {CLASSES.map(cls => (
              <option key={cls} value={cls}>{cls}</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label>Save Type</label>
          <select
            value={filters.savingThrow || ''}
            onChange={(e) => onFilterChange({ savingThrow: e.target.value || undefined })}
          >
            <option value="">Any</option>
            {SAVE_TYPES.map(save => (
              <option key={save.value} value={save.value}>{save.label} Save</option>
            ))}
          </select>
        </div>
      </div>

      <div className="filter-row">
        <label className="checkbox-filter">
          <input
            type="checkbox"
            checked={filters.hasDamage || false}
            onChange={(e) => onFilterChange({ hasDamage: e.target.checked || undefined })}
          />
          Damage spells only
        </label>

        <label className="checkbox-filter">
          <input
            type="checkbox"
            checked={filters.concentration === true}
            onChange={(e) => onFilterChange({
              concentration: e.target.checked ? true : undefined
            })}
          />
          Concentration
        </label>

        <label className="checkbox-filter">
          <input
            type="checkbox"
            checked={filters.ritual === true}
            onChange={(e) => onFilterChange({
              ritual: e.target.checked ? true : undefined
            })}
          />
          Ritual
        </label>

        <label className="checkbox-filter">
          <input
            type="checkbox"
            checked={filters.attackRoll === true}
            onChange={(e) => onFilterChange({
              attackRoll: e.target.checked ? true : undefined
            })}
          />
          Attack Roll
        </label>
      </div>
    </div>
  );
}
