import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabaseClient';
import Login from './components/Login';
import './App.css';

function App() {
  const [session, setSession] = useState(null);

  useEffect(() => {
    // 1. Check if a session already exists (on page refresh)
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    // 2. THIS IS THE KEY: Listen for the 'SIGNED_IN' event
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log("Auth Event:", _event); // This will log "SIGNED_IN" when you click Enter Arena
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <div className="App">
      {!session ? (
        // Show this if NOT logged in
        <Login />
      ) : (
        // SHOW THIS once the user signs up/logs in
        <div className="lobby-container" style={{ textAlign: 'center', padding: '50px' }}>
          <header>
            <h1>🏟️ Battle Royale Lobby</h1>
            <p>Welcome to the Arena, <strong>{session.user.email}</strong></p>
            <button onClick={() => supabase.auth.signOut()} style={{ background: '#f87171', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '5px', cursor: 'pointer' }}>
              Leave Arena
            </button>
          </header>

          <main style={{ marginTop: '30px' }}>
            <div style={{ background: '#1e293b', color: 'white', padding: '20px', borderRadius: '10px', display: 'inline-block' }}>
              <h2>Ready for your Interview?</h2>
              <p>The AI Judge is calibrating...</p>
              <button style={{ background: '#4ade80', border: 'none', padding: '15px 30px', fontSize: '1.2rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                Start Matchmaking
              </button>
            </div>
          </main>
        </div>
      )}
    </div>
  );
}

export default App;