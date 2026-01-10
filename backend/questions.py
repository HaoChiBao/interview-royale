QUESTIONS = [
    {
        "id": "q1",
        "type": "technical",
        "prompt": "Write a function to reverse a string in Python.",
        "difficulty": "easy"
    },
    {
        "id": "q2",
        "type": "behavioral",
        "prompt": "Tell me about a time you had a conflict with a coworker and how you resolved it.",
        "difficulty": "medium"
    },
     {
        "id": "q3",
        "type": "technical",
        "prompt": "Explain the difference between a process and a thread.",
        "difficulty": "medium"
    },
    {
        "id": "q4",
        "type": "behavioral",
        "prompt": "Describe a project you are most proud of.",
        "difficulty": "easy"
    }
]

def get_random_question():
    import random
    return random.choice(QUESTIONS)
