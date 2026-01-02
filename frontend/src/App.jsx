import { useState, useEffect } from 'react';
import CharacterForm from './components/CharacterForm';
import ResultsPanel from './components/ResultsPanel';
import CheatSheet from './components/CheatSheet';
import { SpellBrowser, SpellComparison } from './components/spells';
import { calculateBreakpoints, generateCheatSheet } from './lib/calculator.js';
import { preloadAllData } from './lib/data.js';

function App() {
  const [results, setResults] = useState(null);
  const [cheatsheet, setCheatsheet] = useState(null);
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('character');
  const [activeView, setActiveView] = useState('results');

  // Preload spell data on mount
  useEffect(() => {
    preloadAllData()
      .then(() => setDataLoading(false))
      .catch(err => {
        console.error('Failed to preload data:', err);
        setDataLoading(false);
      });
  }, []);

  const handleSubmit = async (character) => {
    setLoading(true);
    try {
      // Calculate locally - no API call needed
      const optimizeData = calculateBreakpoints(character);
      setResults(optimizeData);

      // Generate cheat sheet locally
      const cheatsheetData = generateCheatSheet(character, optimizeData);
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
            disabled={dataLoading}
          >
            {dataLoading ? 'Loading...' : 'Spell Browser'}
          </button>
          <button
            className={`nav-tab ${activeTab === 'compare' ? 'active' : ''}`}
            onClick={() => setActiveTab('compare')}
            disabled={dataLoading}
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
