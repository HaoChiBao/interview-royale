import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabaseClient';
import Login from './components/Login';
import BattleScreen from './components/BattleScreen';
import './App.css';

function App() {
  const [session, setSession] = useState(null);

  useEffect(() => {
    // 1. Get current session from Supabase
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    // 2. Listen for the 'SIGNED_IN' event
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <div className="App">
      {!session ? (
        <Login />
      ) : (
        /* PASS THE USER TO THE ARENA */
        <BattleScreen user={session.user} />
      )}
    </div>
  );
}

export default App;