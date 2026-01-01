import React from 'react';

function CheatSheet({ data }) {
  if (!data) return null;

  const { character, sections } = data;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="cheatsheet">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2>Combat Cheat Sheet</h2>
        <button className="cheatsheet-btn" onClick={handlePrint}>
          🖨️ Print
        </button>
      </div>

      <div className="cheatsheet-content">
        {sections.map((section, index) => (
          <CheatSheetSection key={index} section={section} />
        ))}
      </div>
    </div>
  );
}

function CheatSheetSection({ section }) {
  switch (section.type) {
    case 'header':
      return (
        <div className="breakpoint-card" style={{ textAlign: 'center', borderLeftColor: 'var(--accent-blue)' }}>
          <h3 style={{ fontSize: '1.3rem' }}>{section.content}</h3>
        </div>
      );

    case 'stats':
      return (
        <div className="breakpoint-card">
          <h3>{section.title}</h3>
          <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
            {section.items.map((item, i) => (
              <span key={i} style={{ color: 'var(--text-secondary)' }}>{item}</span>
            ))}
          </div>
        </div>
      );

    case 'decision':
      return (
        <div className="breakpoint-card">
          <h3>{section.title}</h3>
          <div className="decision-rules">
            {section.rules.map((rule, i) => (
              <div key={i} className={`rule ${rule.priority}`}>
                <span className="condition">{rule.condition}</span>
                <span className="action">{rule.action}</span>
              </div>
            ))}
          </div>
          {section.modifiers && (
            <div style={{ marginTop: '0.8rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              <strong>Modifiers:</strong>
              <ul style={{ marginTop: '0.3rem', paddingLeft: '1.2rem' }}>
                {section.modifiers.map((mod, i) => (
                  <li key={i}>{mod}</li>
                ))}
              </ul>
            </div>
          )}
          {section.notes && (
            <div style={{ marginTop: '0.8rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              {section.notes.map((note, i) => (
                <div key={i}>• {note}</div>
              ))}
            </div>
          )}
        </div>
      );

    case 'tips':
      return (
        <div className="breakpoint-card" style={{ borderLeftColor: 'var(--accent-blue)' }}>
          <h3>{section.title}</h3>
          <div style={{ fontSize: '0.9rem' }}>
            {section.items.map((item, i) => (
              <div key={i} style={{ marginBottom: '0.3rem', color: 'var(--text-secondary)' }}>
                {item}
              </div>
            ))}
          </div>
        </div>
      );

    case 'reference':
      return (
        <div className="breakpoint-card" style={{ borderLeftColor: 'var(--accent-green)' }}>
          <h3>{section.title}</h3>
          <div style={{ fontSize: '0.85rem' }}>
            {section.items.map((item, i) => (
              <div key={i} style={{ marginBottom: '0.2rem', color: 'var(--text-secondary)' }}>
                {item}
              </div>
            ))}
          </div>
        </div>
      );

    default:
      return null;
  }
}

export default CheatSheet;
