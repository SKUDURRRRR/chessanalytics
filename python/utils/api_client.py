"""API client utilities for making requests to the backend"""
import requests
from typing import Optional, Dict


def get_personality_scores(
    user_id: str,
    platform: str,
    backend_url: str = "http://localhost:8002"
) -> Optional[Dict]:
    """
    Get personality scores from the deep analysis API.
    
    Args:
        user_id: User identifier
        platform: Platform name (e.g., 'lichess', 'chess.com')
        backend_url: Backend API base URL
        
    Returns:
        Dictionary of personality scores or None if the request fails
    """
    url = f"{backend_url}/api/v1/deep-analysis/{user_id}/{platform}"
    try:
        response = requests.get(url, timeout=30)
        response.raise_for_status()
        return response.json().get('personality_scores', {})
    except requests.RequestException as e:
        print(f"Error fetching personality scores for {user_id} ({platform}): {e}")
        return None

