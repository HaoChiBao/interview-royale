import React, { useState, useEffect } from 'react';

const BattleScreen = ({ user }) => {
  const [socket, setSocket] = useState(null);
  const [gameState, setGameState] = useState('LOBBY'); // LOBBY, QUESTION, RESULTS
  const [players, setPlayers] = useState([]);
  const [question, setQuestion] = useState(null);
  const [submission, setSubmission] = useState('');

  useEffect(() => {
    // Connect to your friend's FastAPI server (default port 8000)
    const ws = new WebSocket('ws://localhost:8000/ws');

    ws.onopen = () => {
      console.log("Joined Battle Royale Server");
      // IDENTIFY: Use Supabase email to join his player list
      ws.send(JSON.stringify({ type: "join", username: user.email }));
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'player_update') {
        setPlayers(data.players);
        setGameState(data.game_state);
      } else if (data.type === 'new_question') {
        setQuestion(data.question);
        setGameState('QUESTION');
      }
    };

    setSocket(ws);
    return () => ws.close(); // Clean up on exit
  }, [user.email]);

  const startMatch = () => {
    socket.send(JSON.stringify({ type: "start_game" }));
  };

  const handleSend = () => {
    socket.send(JSON.stringify({ type: "submit", content: submission }));
  };

  return (
    <div className="arena">
      <h1>Arena: {gameState}</h1>
      {gameState === 'LOBBY' ? (
        <div className="lobby-ui">
          <h3>Players Connected: {players.length}</h3>
          <ul>{players.map((p, i) => <li key={i}>{p.username}</li>)}</ul>
          <button onClick={startMatch} className="start-btn">START MATCH</button>
        </div>
      ) : (
        <div className="question-ui">
          <h2>Prompt: {question?.prompt}</h2>
          <textarea 
            placeholder="Type your STAR answer..." 
            onChange={(e) => setSubmission(e.target.value)}
          />
          <button onClick={handleSend}>Submit to AI Judge</button>
        </div>
      )}
    </div>
  );
};

export default BattleScreen;