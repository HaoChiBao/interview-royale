import random

async def grade_submission(submission_data):
    """
    Mock grading function.
    In real life, this would call an LLM API.
    """
    
    # Random score between 0 and 100
    score = random.randint(40, 100)
    
    feedback = "Good effort!"
    if score > 90:
        feedback = "Outstanding solution!"
    elif score < 60:
        feedback = "Needs improvement on clarity."
        
    return {
        "score": score,
        "feedback": feedback
    }
