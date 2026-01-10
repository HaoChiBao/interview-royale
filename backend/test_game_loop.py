import asyncio
import websockets
import json

async def test_game_loop():
    uri = "ws://localhost:8000/ws"
    async with websockets.connect(uri) as websocket:
        print(f"Connecting to {uri}...")

        # 1. Join
        await websocket.send(json.dumps({"type": "join", "username": "Player1"}))
        print("Sent: JOIN")
        
        # Read player list update
        while True:
            response = await websocket.recv()
            data = json.loads(response)
            if data.get("type") == "player_update":
                print(f"Received: PLAYER_UPDATE ({len(data['players'])} players)")
                break

        # 2. Start Game
        await websocket.send(json.dumps({"type": "start_game"}))
        print("Sent: START_GAME")

        # Read Broadcast (New Question)
        while True:
            response = await websocket.recv()
            data = json.loads(response)
            if data.get("type") == "new_question":
                print(f"Received: NEW_QUESTION ({data['question']['prompt']})")
                break

        # 3. Submit
        submission = {
            "type": "submit",
            "content": "def solution(): return True"
        }
        await websocket.send(json.dumps(submission))
        print("Sent: SUBMIT")

        # Read Grading Result
        while True:
            response = await websocket.recv()
            data = json.loads(response)
            
            if data.get("type") == "grading_complete":
                print(f"Received: GRADING_COMPLETE (Score: {data['result']['score']})")
            
            if data.get("type") == "round_over":
                print("Received: ROUND_OVER (Game finished!)")
                print("Leaderboard:", data.get("results"))
                break

if __name__ == "__main__":
    try:
        asyncio.run(test_game_loop())
    except ConnectionRefusedError:
        print("Error: Could not connect to server. Make sure it is running on port 8000.")
