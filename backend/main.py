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

# Global dictionary to store game instances keyed by room_code
# { "ABCD": Game() }
games: Dict[str, Game] = {}

class ConnectionManager:
    def __init__(self):
        # Key: WebSocket, Value: dict (player info: username, room_code)
        self.active_connections: Dict[WebSocket, dict] = {}

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        # Initial connection doesn't have metadata yet
        self.active_connections[websocket] = {"username": None, "room_code": None}
        print(f"Client connected. Total: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            data = self.active_connections[websocket]
            username = data.get("username")
            room_code = data.get("room_code")
            del self.active_connections[websocket]
            print(f"Client {username} disconnected from room {room_code}. Total: {len(self.active_connections)}")
            return room_code

    async def broadcast_to_room(self, room_code: str, message: dict):
        if not room_code: return
        
        for connection, data in self.active_connections.items():
            if data.get("room_code") == room_code:
                try:
                    await connection.send_json(message)
                except:
                    pass

    async def broadcast_player_list(self, room_code: str):
        if not room_code: return

        players_list = []
        for _, data in self.active_connections.items():
            if data.get("room_code") == room_code and data.get("username"):
                players_list.append({"username": data["username"]})
        
        game_instance = games.get(room_code)
        current_state = game_instance.state if game_instance else "LOBBY"

        await self.broadcast_to_room(room_code, {
            "type": "player_update",
            "players": players_list,
            "game_state": current_state
        })

manager = ConnectionManager()

@app.get("/")
async def get():
    return {"message": "Interview Royale Backend Running"}

import string
import random

def generate_room_code(length=6):
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=length))

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_json()
            message_type = data.get("type")
            print(f"Received: {data}")

            if message_type == "create_room":
                username = data.get("username")
                room_code = generate_room_code()
                
                # Ensure uniqueness
                while room_code in games:
                    room_code = generate_room_code()
                
                games[room_code] = Game()
                print(f"Created new room: {room_code}")
                
                manager.active_connections[websocket]["username"] = username
                manager.active_connections[websocket]["room_code"] = room_code
                
                # Notify creator (they need the room code to share)
                await websocket.send_json({
                    "type": "room_created",
                    "room_code": room_code
                })
                
                await manager.broadcast_player_list(room_code)

            elif message_type == "join":
                username = data.get("username")
                room_code = data.get("room_code", "").upper()
                
                if room_code not in games:
                    await websocket.send_json({
                        "type": "error",
                        "message": "Room not found"
                    })
                    continue

                manager.active_connections[websocket]["username"] = username
                manager.active_connections[websocket]["room_code"] = room_code
                
                print(f"Player {username} joined room {room_code}")
                await manager.broadcast_player_list(room_code)

            elif message_type == "start_game":
                room_code = manager.active_connections[websocket]["room_code"]
                if not room_code or room_code not in games: continue
                
                game = games[room_code]
                question = game.start_round()
                
                await manager.broadcast_to_room(room_code, {
                    "type": "new_question",
                    "question": question,
                    "state": "QUESTION"
                })

            elif message_type == "submit":
                room_code = manager.active_connections[websocket]["room_code"]
                if not room_code or room_code not in games: continue
                
                game = games[room_code]
                username = manager.active_connections[websocket]["username"]
                submission_content = data.get("content")
                
                # Grade immediately
                result = await grade_submission(submission_content, game.current_question)
                
                # Store result
                game.submissions[username] = {
                    "content": submission_content,
                    "score": result["score"],
                    "feedback": result["feedback"]
                }
                
                # Notify user of their result
                await websocket.send_json({
                    "type": "grading_complete",
                    "result": result
                })
                
                # Check for round end
                # Count active players IN THIS ROOM
                room_players_count = len([
                    p for p in manager.active_connections.values() 
                    if p.get("room_code") == room_code and p.get("username")
                ])
                
                if len(game.submissions) >= room_players_count:
                    results = game.end_round()
                    await manager.broadcast_to_room(room_code, {
                        "type": "round_over",
                        "results": results,
                        "state": "RESULTS"
                    })

            elif message_type == "video_update":
                # Broadcast video frame to all OTHERS (not back to sender ideally, but broadcast is fine too)
                # To save bandwidth, we could exclude sender.
                username = manager.active_connections[websocket]["username"]
                frame_data = data.get("frame")
                await manager.broadcast({
                    "type": "video_update",
                    "username": username,
                    "frame": frame_data
                })

    except WebSocketDisconnect:
        room_code = manager.disconnect(websocket)
        if room_code:
            await manager.broadcast_player_list(room_code)
            # Optional: Delete room if empty
            # active_in_room = [p for p in manager.active_connections.values() if p["room_code"] == room_code]
            # if not active_in_room and room_code in games:
            #     del games[room_code]
    except Exception as e:
        print(f"Error: {e}")
        manager.disconnect(websocket)
