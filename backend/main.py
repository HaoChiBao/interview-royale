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

import time

class PlayerState:
    def __init__(self, x=400, y=300):
        self.x = x
        self.y = y
        self.keys = {"w": False, "a": False, "s": False, "d": False}
        self.last_update = time.time()

class Game:
    def __init__(self):
        self.state = "LOBBY"
        self.current_question = None
        self.submissions = {} # {username: {submission: ..., score: ...}}
        self.players = {} # {username: PlayerState}
        
        # New Settings
        self.settings = {
            "num_rounds": 3,
            "round_duration": 60
        }
        self.votes = {} # {username: num_rounds}
        self.current_round = 0
        self.cumulative_scores = {} # {username: int}
        
        # Physics loop task
        self.physics_task = None
        self.round_end_time = None
    def cleanup(self):
        if self.physics_task and not self.physics_task.done():
            self.physics_task.cancel()
            print("Physics task cancelled.")

    def handle_input(self, username: str, key: str, is_down: bool):
        if username not in self.players:
            self.players[username] = PlayerState()
        
        key = key.lower()
        if key in self.players[username].keys:
            self.players[username].keys[key] = is_down

    async def run_physics_loop(self, room_code: str):
        print(f"Starting physics loop for {room_code}")
        while self.state == "INTERMISSION": # Only run during intermission? Or always?
            # Ideally always if we want movement in lobby too, but let's stick to Intermission request.
            # Actually, user said "Intermission Room", but let's make it robust.
            # If we constrain to Intermission, we need to start/stop this task.
            # For simplicity, let's just check state inside loop and sleep if not active.
            
            start_time = time.time()
            
            state_snapshot = {}
            for name, p in self.players.items():
                speed = 300 # pixels per second
                dt = 0.05 # 50ms tick
                
                dx = 0
                dy = 0
                if p.keys["w"]: dy -= speed * dt
                if p.keys["s"]: dy += speed * dt
                if p.keys["a"]: dx -= speed * dt
                if p.keys["d"]: dx += speed * dt
                
                p.x += dx
                p.y += dy
                
                # Infinite boundaries
                # p.x = max(0, min(800, p.x))
                # p.y = max(0, min(600, p.y))
                
                state_snapshot[name] = {"x": p.x, "y": p.y}
            
            if state_snapshot:
                await manager.broadcast_to_room(room_code, {
                    "type": "world_update",
                    "players": state_snapshot
                })
            
            await asyncio.sleep(0.05) # 20 ticks per second

    async def start_physics(self, room_code):
        if self.physics_task is None or self.physics_task.done():
             self.physics_task = asyncio.create_task(self.run_physics_loop(room_code))


    def update_settings(self, settings: dict):
        self.settings.update(settings)

    def cast_vote(self, username: str, num_rounds: int):
        self.votes[username] = num_rounds
        # Update settings to reflect a "preview" or average? 
        # For now, we don't update self.settings until game start, 
        # but we might want to show the current "consensus" or just last vote?
        # Let's keep self.settings as the "live" value for now so the UI updates
        # But conceptually, we will pick from self.votes at start.
        self.settings["num_rounds"] = num_rounds 
    
    def start_round(self):
        self.state = "QUESTION"
        self.current_round += 1
        self.current_question = get_random_question()
        self.submissions = {}
        self.round_end_time = time.time() + self.settings["round_duration"]
        return self.current_question

    async def handle_intermission(self, room_code: str):
        if room_code not in games: return
        game = games[room_code]
        
        # Start physics for intermission
        game.state = "INTERMISSION" # Strictly set this state
        await game.start_physics(room_code)
        
        # Wait for intermission
        await asyncio.sleep(60) # 1 minute intermission

        
        # Check if game over
        if game.current_round >= game.settings["num_rounds"]:
            game.state = "GAME_OVER"
            leaderboard = game.get_leaderboard()
            await manager.broadcast_to_room(room_code, {
                "type": "game_over",
                "leaderboard": leaderboard
            })
            return

        # Start next round
        question = game.start_round()
        
        # Start monitoring
        asyncio.create_task(game.monitor_round(room_code, game.current_round))
        
        await manager.broadcast_to_room(room_code, {
            "type": "new_question",
            "question": question,
            "state": "QUESTION",
            "current_round": game.current_round,
            "total_rounds": game.settings["num_rounds"]
        })

    async def monitor_round(self, room_code: str, round_num: int):
        duration = self.settings["round_duration"]
        await asyncio.sleep(duration)
        
        # Check if we are still in the same round and state is QUESTION
        if self.state == "QUESTION" and self.current_round == round_num:
            print(f"Round {round_num} time expired. Force ending.")
            results = self.end_round()
            leaderboard = self.get_leaderboard()
            
            # Broadcast round over
            await manager.broadcast_to_room(room_code, {
                "type": "round_over",
                "results": results,
                "leaderboard": leaderboard,
                "state": "RESULTS",
                "is_final_round": self.current_round >= self.settings["num_rounds"],
                "intermission_end_time": time.time() + 60
            })
            
            # Start intermission
            asyncio.create_task(self.handle_intermission(room_code))

    def end_round(self):
        self.state = "RESULTS"
        if not self.submissions:
            return []
            
        # Update cumulative scores
        for username, data in self.submissions.items():
            score = data.get("score", 0)
            self.cumulative_scores[username] = self.cumulative_scores.get(username, 0) + score
            
        # Return round results sorted by score
        sorted_results = sorted(
            [{"username": k, **v} for k, v in self.submissions.items() if v.get("score") is not None],
            key=lambda x: x["score"],
            reverse=True
        )
        return sorted_results
        
    def get_leaderboard(self):
        # Return cumulative leaderboard
        return sorted(
            [{"username": k, "score": v} for k, v in self.cumulative_scores.items()],
            key=lambda x: x["score"],
            reverse=True
        )

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
        
        # Iterate over a copy to avoid RuntimeError if connections close during iteration
        for connection, data in list(self.active_connections.items()):
            if data.get("room_code") == room_code:
                try:
                    await connection.send_json(message)
                except:
                    pass

    async def broadcast_player_list(self, room_code: str):
        if not room_code: return

        players_list = []
        game_instance = games.get(room_code)
        
        # Check leader integrity
        if game_instance:
             # If no leader or leader not connected, pick new
             active_users = [data["username"] for _, data in self.active_connections.items() if data.get("room_code") == room_code]
             
             if not game_instance.leader or game_instance.leader not in active_users:
                 if active_users:
                     game_instance.leader = active_users[0] # First one or random
                     print(f"New leader for {room_code}: {game_instance.leader}")
                 else:
                     game_instance.leader = None

        current_leader = game_instance.leader if game_instance else None

        for _, data in list(self.active_connections.items()):
            if data.get("room_code") == room_code and data.get("username"):
                is_leader = (data["username"] == current_leader)
                players_list.append({
                    "username": data["username"],
                    "is_leader": is_leader
                })
        
        current_state = game_instance.state if game_instance else "LOBBY"

        await self.broadcast_to_room(room_code, {
            "type": "player_update",
            "players": players_list,
            "game_state": current_state,
            "leader": current_leader
        })

manager = ConnectionManager()

@app.get("/")
async def get():
    return {"message": "Interview Royale Backend Running"}

import string
import random
import asyncio

def generate_room_code(length=6):
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=length)) 

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_json()
            message_type = data.get("type")
            # print(f"Received: {data}")

            if message_type == "create_room":
                username = data.get("username")
                room_code = generate_room_code()
                
                # Ensure uniqueness
                while room_code in games:
                    room_code = generate_room_code()
                
                games[room_code] = Game()
                # Initialize creator's vote to default
                games[room_code].votes[username] = 3
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
                # ... existing join logic ...
                username = data.get("username")
                room_code = data.get("room_code", "").upper()
                
                if room_code not in games:
                    print(f"Room {room_code} not found, auto-creating...")
                    games[room_code] = Game()

                manager.active_connections[websocket]["username"] = username
                manager.active_connections[websocket]["room_code"] = room_code
                
                print(f"Player {username} joined room {room_code}")
                
                # Send current settings to the new joiner
                game = games[room_code]
                # Default vote for new player?
                game.votes[username] = 3
                await websocket.send_json({
                    "type": "settings_update",
                    "settings": game.settings,
                    "votes": game.votes
                })
                
                await manager.broadcast_player_list(room_code)
                
                # If game is in progress, sync state
                if game.state != "LOBBY":
                    # Determine current phase details
                    # Note: We need to send relevant info depending on phase
                    await websocket.send_json({
                        "type": "sync_game_state",
                        "phase": game.state, # QUESTION, RESULTS, INTERMISSION
                        "question": game.current_question,
                        "current_round": game.current_round,
                        "total_rounds": game.settings["num_rounds"],
                        "round_end_time": game.round_end_time
                    })

            elif message_type == "update_settings":
                # {type: update_settings, settings: {num_rounds: 5}}
                room_code = manager.active_connections[websocket]["room_code"]
                username = manager.active_connections[websocket]["username"]
                if not room_code or room_code not in games: continue
                
                game = games[room_code]
                print(f"Update settings: {username} in {room_code}. State: {game.state}")
                if game.state == "LOBBY":
                    new_settings = data.get("settings", {})
                    # Cast vote
                    rounds = new_settings.get("num_rounds", 3)
                    print(f"Casting vote: {rounds}")
                    rounds = new_settings.get("num_rounds")
                    
                    if rounds is not None:
                         # Clamp 1-10
                         rounds = max(1, min(10, int(rounds)))
                         game.settings["num_rounds"] = rounds
                    
                    # Broadcast updated settings to everyone (visual sync)
                    await manager.broadcast_to_room(room_code, {
                        "type": "settings_update",
                        "settings": game.settings
                    })

            elif message_type == "start_game":
                # Only leader can start
                username = manager.active_connections[websocket]["username"]
                room_code = manager.active_connections[websocket]["room_code"]
                if not room_code or room_code not in games: continue
                game = games[room_code]

                if game.leader and game.leader != username:
                    print(f"User {username} tried to start game but is not leader ({game.leader})")
                    continue
                
                # Broadcast STARTING event for countdown on frontend
                await manager.broadcast_to_room(room_code, {
                    "type": "game_starting"
                })
                
                # 3 second countdown logic on server (wait before sending new question)
                await asyncio.sleep(4) # 3s countdown + 1s buffer

                # Reset game state
                if game.state == "LOBBY" or game.state == "GAME_OVER":
                     game.current_round = 0
                     game.cumulative_scores = {}
                
                question = game.start_round()
                
                # Start round monitoring
                asyncio.create_task(game.monitor_round(room_code, game.current_round))
                
                await manager.broadcast_to_room(room_code, {
                    "type": "new_question",
                    "question": question,
                    "state": "QUESTION",
                    "current_round": game.current_round,
                    "total_rounds": game.settings["num_rounds"]
                })

            elif message_type == "skip_intermission":
                username = manager.active_connections[websocket]["username"]
                room_code = manager.active_connections[websocket]["room_code"]
                if not room_code or room_code not in games: continue
                game = games[room_code]

                if game.leader and game.leader != username:
                    print(f"User {username} tried to skip intermission but is not leader")
                    continue
                
                if game.state == "INTERMISSION":
                    # Cancel existing physics task or just force state change?
                    # The handle_intermission loop is sleeping. We can't easily cancel the sleep unless we store the task.
                    # Or we just force start the next round and the sleep will wake up and see state is not INTERMISSION?
                    # But the sleep continues.
                    # To properly skip, we should probably set a flag or cancel the task.
                    # Creating a new round immediately is easiest. The old task will wake up, check conditions, and ideally exit or do nothing.
                    # Refactored handle_intermission to check (if game.state != INTERMISSION return)
                    pass
                    # Actually, since handle_intermission has a sleep(60), we can't easily interrupt it without storing the task object.
                    # Let's simple call start_round. The previous handle_intermission will eventually wake up.
                    # To prevent double rounds, we should check state in handle_intermission after wake.
                    
                    # Force start next round logic (similar to next_round)
                    # We reuse next_round logic basically.
                    
                    if game.current_round >= game.settings["num_rounds"]:
                         game.state = "GAME_OVER"
                         await manager.broadcast_to_room(room_code, {
                            "type": "game_over",
                            "leaderboard": game.get_leaderboard()
                         })
                    else:
                        question = game.start_round() # This changes state to QUESTION
                        
                        # Start round monitoring
                        asyncio.create_task(game.monitor_round(room_code, game.current_round))

                        await manager.broadcast_to_room(room_code, {
                            "type": "new_question",
                            "question": question,
                            "state": "QUESTION",
                            "current_round": game.current_round,
                            "total_rounds": game.settings["num_rounds"]
                        })

            elif message_type == "next_round":
                # Only leader can advance? Or anyone? 
                # Original request says Game Leader can skip intermission.
                # Assuming next_round is triggered by skip button or automatic?
                # Let's enforce leader for next_round too just in case client calls it.
                username = manager.active_connections[websocket]["username"]
                room_code = manager.active_connections[websocket]["room_code"]
                if not room_code or room_code not in games: continue
                game = games[room_code]
                
                if game.leader and game.leader != username:
                     continue
                     
                if game.current_round >= game.settings["num_rounds"]:
                     game.state = "GAME_OVER"
                     await manager.broadcast_to_room(room_code, {
                        "type": "game_over",
                        "leaderboard": game.get_leaderboard()
                     })
                else:
                    question = game.start_round()
                    
                    # Start round monitoring
                    asyncio.create_task(game.monitor_round(room_code, game.current_round))

                    await manager.broadcast_to_room(room_code, {
                        "type": "new_question",
                        "question": question,
                        "state": "QUESTION",
                        "current_round": game.current_round,
                        "total_rounds": game.settings["num_rounds"]
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
                room_players_count = len([
                    p for p in manager.active_connections.values() 
                    if p.get("room_code") == room_code and p.get("username")
                ])
                
                if len(game.submissions) >= room_players_count:
                    results = game.end_round()
                    leaderboard = game.get_leaderboard()
                    
                    # Schedule automatic next round (Intermission)
                    asyncio.create_task(game.handle_intermission(room_code))

                    await manager.broadcast_to_room(room_code, {
                        "type": "round_over",
                        "results": results,
                        "leaderboard": leaderboard, # Cumulative
                        "state": "RESULTS",
                        "is_final_round": game.current_round >= game.settings["num_rounds"],
                        "intermission_end_time": time.time() + 120
                    })

            elif message_type == "video_update":
                # ... existing video logic ...
                username = manager.active_connections[websocket]["username"]
                room_code = manager.active_connections[websocket]["room_code"]
                frame_data = data.get("frame")
                
                if room_code:
                    await manager.broadcast_to_room(room_code, {
                        "type": "video_update",
                        "username": username,
                        "frame": frame_data
                    })

            elif message_type == "keydown":
                # {type: keydown, key: "w"}
                username = manager.active_connections[websocket]["username"]
                room_code = manager.active_connections[websocket]["room_code"]
                key = data.get("key")
                
                if room_code and room_code in games:
                    games[room_code].handle_input(username, key, is_down=True)

            elif message_type == "keyup":
                # {type: keyup, key: "w"}
                username = manager.active_connections[websocket]["username"]
                room_code = manager.active_connections[websocket]["room_code"]
                key = data.get("key")
                
                if room_code and room_code in games:
                    games[room_code].handle_input(username, key, is_down=False)

    except WebSocketDisconnect:
        room_code = manager.disconnect(websocket)
        # ... existing disconnect logic ...
        if room_code:
            await manager.broadcast_player_list(room_code)
            # Check if room is empty
            active_in_room = [p for p in manager.active_connections.values() if p.get("room_code") == room_code]
            if not active_in_room and room_code in games:
                print(f"Room {room_code} is empty. Deleting...")
                if hasattr(games[room_code], 'cleanup'):
                    games[room_code].cleanup()
                del games[room_code]
    except Exception as e:
        print(f"Error: {e}")
        manager.disconnect(websocket)
