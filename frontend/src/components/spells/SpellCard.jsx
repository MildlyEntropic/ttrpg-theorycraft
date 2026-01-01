const SCHOOL_COLORS = {
  'Abjuration': '#4a9eff',
  'Conjuration': '#ffcc00',
  'Divination': '#cc99ff',
  'Enchantment': '#ff99cc',
  'Evocation': '#ff6644',
  'Illusion': '#99ccff',
  'Necromancy': '#66cc66',
  'Transmutation': '#ffaa44'
};

export default function SpellCard({ spell, selected, onClick }) {
  const schoolColor = SCHOOL_COLORS[spell.school] || '#888';

  const levelLabel = spell.level === 0 ? 'Cantrip' : `Level ${spell.level}`;

  return (
    <div
      className={`spell-card ${selected ? 'selected' : ''}`}
      onClick={onClick}
      style={{ '--school-color': schoolColor }}
    >
      <div className="spell-card-header">
        <span className="spell-level">{levelLabel}</span>
        <span className="spell-school">{spell.school}</span>
      </div>

      <h3 className="spell-name">{spell.name}</h3>

      <div className="spell-card-tags">
        {spell.concentration && <span className="tag concentration">C</span>}
        {spell.ritual && <span className="tag ritual">R</span>}
        {spell.damageRoll && <span className="tag damage">{spell.damageRoll}</span>}
        {spell.savingThrow && (
          <span className="tag save">{spell.savingThrow.substring(0, 3).toUpperCase()}</span>
        )}
        {spell.attackRoll && <span className="tag attack">ATK</span>}
      </div>

      <div className="spell-card-meta">
        <span className="casting-time">{spell.castingTime}</span>
        <span className="range">{spell.range}</span>
      </div>
    </div>
  );
}
