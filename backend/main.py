from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict
from questions import get_random_question
from grading import grade_submission

app = FastAPI()

# CORS configuration
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class Game:
    def __init__(self):
        self.state = "LOBBY"
        self.current_question = None
        self.submissions = {} # {username: {submission: ..., score: ...}}
    
    def start_round(self):
        self.state = "QUESTION"
        self.current_question = get_random_question()
        self.submissions = {}
        return self.current_question

    def end_round(self):
        self.state = "RESULTS"
        # Determine winner based on highest score
        if not self.submissions:
            return None
        
        # Sort by score descending
        sorted_results = sorted(
            [{"username": k, **v} for k, v in self.submissions.items() if v.get("score") is not None],
            key=lambda x: x["score"],
            reverse=True
        )
        return sorted_results

game_enigne = Game()

class ConnectionManager:
    def __init__(self):
        # Key: WebSocket, Value: dict (player info)
        self.active_connections: Dict[WebSocket, dict] = {}

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections[websocket] = {"username": None}
        print(f"Client connected. Total: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            username = self.active_connections[websocket].get("username")
            del self.active_connections[websocket]
            print(f"Client {username} disconnected. Total: {len(self.active_connections)}")

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except:
                pass # Handle disconnected clients gracefully

    async def broadcast_player_list(self):
        players_list = [{"username": data["username"]} for _, data in self.active_connections.items() if data["username"]]
        await self.broadcast({
            "type": "player_update",
            "players": players_list,
            "game_state": game_enigne.state
        })

manager = ConnectionManager()

@app.get("/")
async def get():
    return {"message": "Interview Royale Backend Running"}

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_json()
            message_type = data.get("type")
            print(f"Received: {data}")

            if message_type == "join":
                username = data.get("username")
                manager.active_connections[websocket]["username"] = username
                await manager.broadcast_player_list()

            elif message_type == "start_game":
                # Ideally, check if user is host. For now, anyone can start.
                question = game_enigne.start_round()
                await manager.broadcast({
                    "type": "new_question",
                    "question": question,
                    "state": "QUESTION"
                })

            elif message_type == "submit":
                username = manager.active_connections[websocket]["username"]
                submission_content = data.get("content")
                
                # Grade immediately (mock async)
                result = await grade_submission(submission_content, game_enigne.current_question)
                
                # Store result
                game_enigne.submissions[username] = {
                    "content": submission_content,
                    "score": result["score"],
                    "feedback": result["feedback"]
                }
                
                # Notify user of their result
                await websocket.send_json({
                    "type": "grading_complete",
                    "result": result
                })
                
                # Check if everyone has submitted (simplification: just wait or manual end?)
                # For this MVP, let's treat every submission as an update to the lobby
                # Or create a "results" view if all active players submitted
                
                active_players_count = len([p for p in manager.active_connections.values() if p["username"]])
                if len(game_enigne.submissions) >= active_players_count:
                    # Everyone submitted! Show results
                    results = game_enigne.end_round()
                    await manager.broadcast({
                        "type": "round_over",
                        "results": results,
                        "state": "RESULTS"
                    })

    except WebSocketDisconnect:
        manager.disconnect(websocket)
        await manager.broadcast_player_list()
    except Exception as e:
        print(f"Error: {e}")
        # import traceback
        # traceback.print_exc()
        manager.disconnect(websocket)
