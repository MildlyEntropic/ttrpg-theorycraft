import { useState } from 'react';
import CharacterForm from './components/CharacterForm';
import ResultsPanel from './components/ResultsPanel';
import CheatSheet from './components/CheatSheet';
import { SpellBrowser, SpellComparison } from './components/spells';

function App() {
  const [results, setResults] = useState(null);
  const [cheatsheet, setCheatsheet] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('character'); // 'character' | 'spells' | 'compare'
  const [activeView, setActiveView] = useState('results');

  const handleSubmit = async (character) => {
    setLoading(true);
    try {
      // Get optimization results
      const optimizeRes = await fetch('http://localhost:3001/api/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(character),
      });
      const optimizeData = await optimizeRes.json();
      setResults(optimizeData);

      // Get cheat sheet
      const cheatsheetRes = await fetch('http://localhost:3001/api/cheatsheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(character),
      });
      const cheatsheetData = await cheatsheetRes.json();
      setCheatsheet(cheatsheetData);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app">
      <header>
        <h1>TTRPG Combat Optimizer</h1>
        <nav className="main-nav">
          <button
            className={`nav-tab ${activeTab === 'character' ? 'active' : ''}`}
            onClick={() => setActiveTab('character')}
          >
            Character
          </button>
          <button
            className={`nav-tab ${activeTab === 'spells' ? 'active' : ''}`}
            onClick={() => setActiveTab('spells')}
          >
            Spell Browser
          </button>
          <button
            className={`nav-tab ${activeTab === 'compare' ? 'active' : ''}`}
            onClick={() => setActiveTab('compare')}
          >
            Compare Spells
          </button>
        </nav>
      </header>

      <main className={`main-content ${activeTab !== 'character' ? 'full-width' : ''}`}>
        {activeTab === 'character' && (
          <>
            <aside>
              <CharacterForm onSubmit={handleSubmit} loading={loading} />
            </aside>

            <section className="results-panel">
              {results ? (
                <>
                  <div className="tabs">
                    <button
                      className={`tab ${activeView === 'results' ? 'active' : ''}`}
                      onClick={() => setActiveView('results')}
                    >
                      Analysis
                    </button>
                    <button
                      className={`tab ${activeView === 'cheatsheet' ? 'active' : ''}`}
                      onClick={() => setActiveView('cheatsheet')}
                    >
                      Cheat Sheet
                    </button>
                  </div>

                  {activeView === 'results' ? (
                    <ResultsPanel results={results} />
                  ) : (
                    <CheatSheet data={cheatsheet} />
                  )}
                </>
              ) : (
                <div className="empty-state">
                  <div className="dice">🎲</div>
                  <h3>Enter your character to get started</h3>
                  <p>We'll crunch the numbers so you don't have to.</p>
                </div>
              )}
            </section>
          </>
        )}

        {activeTab === 'spells' && <SpellBrowser />}
        {activeTab === 'compare' && <SpellComparison />}
      </main>
    </div>
  );
}

export default App;
