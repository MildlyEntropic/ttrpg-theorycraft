import React, { useState } from 'react';

const CLASSES = [
  'Barbarian',
  'Bard',
  'Cleric',
  'Druid',
  'Fighter',
  'Monk',
  'Paladin',
  'Ranger',
  'Rogue',
  'Sorcerer',
  'Warlock',
  'Wizard',
];

const FEATS = [
  { id: 'GWM', name: 'Great Weapon Master' },
  { id: 'Sharpshooter', name: 'Sharpshooter' },
  { id: 'PAM', name: 'Polearm Master' },
  { id: 'Sentinel', name: 'Sentinel' },
  { id: 'CBE', name: 'Crossbow Expert' },
  { id: 'Lucky', name: 'Lucky' },
];

function CharacterForm({ onSubmit, loading }) {
  const [character, setCharacter] = useState({
    name: '',
    class: 'Fighter',
    level: 5,
    attackBonus: 7,
    baseDamage: 10,
    ac: 16,
    feats: [],
    stats: {
      strength: 2,
      dexterity: 2,
      constitution: 2,
      intelligence: 0,
      wisdom: 1,
      charisma: 0,
    },
    resources: {
      spellSlots: [3, 2],
      ki: 5,
      expectedEncounters: 4,
      expectedEnemyDamage: 10,
    },
  });

  const handleChange = (field, value) => {
    setCharacter((prev) => ({ ...prev, [field]: value }));
  };

  const handleStatChange = (stat, value) => {
    setCharacter((prev) => ({
      ...prev,
      stats: { ...prev.stats, [stat]: parseInt(value) || 0 },
    }));
  };

  const handleResourceChange = (resource, value) => {
    setCharacter((prev) => ({
      ...prev,
      resources: { ...prev.resources, [resource]: parseInt(value) || 0 },
    }));
  };

  const handleFeatToggle = (featId) => {
    setCharacter((prev) => ({
      ...prev,
      feats: prev.feats.includes(featId)
        ? prev.feats.filter((f) => f !== featId)
        : [...prev.feats, featId],
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(character);
  };

  const showMonkOptions = character.class === 'Monk';
  const showPaladinOptions = character.class === 'Paladin';
  const showBarbarianOptions = character.class === 'Barbarian';
  const showCasterOptions = ['Bard', 'Cleric', 'Druid', 'Paladin', 'Ranger', 'Sorcerer', 'Warlock', 'Wizard'].includes(character.class);

  return (
    <form className="character-form" onSubmit={handleSubmit}>
      <h2>🛡️ Character Builder</h2>

      <div className="form-group">
        <label>Character Name</label>
        <input
          type="text"
          value={character.name}
          onChange={(e) => handleChange('name', e.target.value)}
          placeholder="Grog the Mighty"
        />
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>Class</label>
          <select
            value={character.class}
            onChange={(e) => handleChange('class', e.target.value)}
          >
            {CLASSES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>Level</label>
          <input
            type="number"
            min="1"
            max="20"
            value={character.level}
            onChange={(e) => handleChange('level', parseInt(e.target.value))}
          />
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>Attack Bonus</label>
          <input
            type="number"
            value={character.attackBonus}
            onChange={(e) => handleChange('attackBonus', parseInt(e.target.value))}
          />
        </div>

        <div className="form-group">
          <label>Base Damage (avg)</label>
          <input
            type="number"
            value={character.baseDamage}
            onChange={(e) => handleChange('baseDamage', parseInt(e.target.value))}
          />
        </div>
      </div>

      <div className="form-group">
        <label>Your AC</label>
        <input
          type="number"
          value={character.ac}
          onChange={(e) => handleChange('ac', parseInt(e.target.value))}
        />
      </div>

      <div className="form-group">
        <label>Feats</label>
        <div className="feat-checkboxes">
          {FEATS.map((feat) => (
            <label key={feat.id} className="feat-checkbox">
              <input
                type="checkbox"
                checked={character.feats.includes(feat.id)}
                onChange={() => handleFeatToggle(feat.id)}
              />
              {feat.name}
            </label>
          ))}
        </div>
      </div>

      {showMonkOptions && (
        <div className="form-row">
          <div className="form-group">
            <label>Wisdom Modifier</label>
            <input
              type="number"
              value={character.stats.wisdom}
              onChange={(e) => handleStatChange('wisdom', e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>Current Ki Points</label>
            <input
              type="number"
              value={character.resources.ki}
              onChange={(e) => handleResourceChange('ki', e.target.value)}
            />
          </div>
        </div>
      )}

      {showBarbarianOptions && (
        <div className="form-group">
          <label>Expected Enemy Damage/Round</label>
          <input
            type="number"
            value={character.resources.expectedEnemyDamage}
            onChange={(e) => handleResourceChange('expectedEnemyDamage', e.target.value)}
          />
        </div>
      )}

      {showCasterOptions && (
        <>
          <div className="form-row">
            <div className="form-group">
              <label>1st Level Slots</label>
              <input
                type="number"
                min="0"
                value={character.resources.spellSlots[0] || 0}
                onChange={(e) => {
                  const slots = [...character.resources.spellSlots];
                  slots[0] = parseInt(e.target.value) || 0;
                  setCharacter((prev) => ({
                    ...prev,
                    resources: { ...prev.resources, spellSlots: slots },
                  }));
                }}
              />
            </div>
            <div className="form-group">
              <label>2nd Level Slots</label>
              <input
                type="number"
                min="0"
                value={character.resources.spellSlots[1] || 0}
                onChange={(e) => {
                  const slots = [...character.resources.spellSlots];
                  slots[1] = parseInt(e.target.value) || 0;
                  setCharacter((prev) => ({
                    ...prev,
                    resources: { ...prev.resources, spellSlots: slots },
                  }));
                }}
              />
            </div>
          </div>
          <div className="form-group">
            <label>Expected Encounters Today</label>
            <input
              type="number"
              min="1"
              value={character.resources.expectedEncounters}
              onChange={(e) => handleResourceChange('expectedEncounters', e.target.value)}
            />
          </div>
        </>
      )}

      <button type="submit" className="submit-btn" disabled={loading}>
        {loading ? 'Calculating...' : '⚔️ Optimize My Combat'}
      </button>
    </form>
  );
}

export default CharacterForm;
