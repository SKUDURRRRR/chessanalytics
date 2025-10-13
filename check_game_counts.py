#!/usr/bin/env python3
"""Check how many games each player has"""
import requests
import requests.exceptions

BACKEND_URL = "http://localhost:8002"

def get_stats(user_id, platform):
    url = f"{BACKEND_URL}/api/v1/stats/{user_id}/{platform}?analysis_type=stockfish"
    try:
        response = requests.get(url, timeout=10)
        if response.status_code == 200:
            return response.json()
        return None
    except requests.exceptions.RequestException as e:
        print(f"Request failed for {user_id}: {e}")
        return None

players = [("krecetas", "lichess"), ("skudurelis", "lichess")]

print("="*60)
print("GAMES ANALYZED PER PLAYER")
print("="*60)

for user_id, platform in players:
    stats = get_stats(user_id, platform)
    if stats:
        total = stats.get('total_games_analyzed', 0)
        print(f"\n{user_id.upper()}:")
        print(f"  Total games analyzed: {total}")
        print(f"  Re-analyzing 5 games = {5/total*100:.1f}% of data" if total > 0 else "  No games")
    else:
        print(f"\n{user_id.upper()}: Could not fetch stats")

print(f"\n{'='*60}")
print("RECOMMENDATION")
print("="*60)
print("\nTo see significant changes in Patient scores:")
print("1. Need to re-analyze ALL games (not just 5)")
print("2. Or wait until enough new games accumulate")

# Ask user if they want to re-analyze all games
try:
    response = input("\nWould you like to re-analyze all games? (~1-2 minutes) [y/N]: ").strip().lower()
    
    if response in ['y', 'yes']:
        print("\nStarting re-analysis of all games...")
        print("This will take approximately 1-2 minutes per player.")
        
        # Import required modules for re-analysis
        import asyncio
        import requests
        
        async def reanalyze_all_games():
            """Re-analyze all games for both players"""
            backend_url = "http://localhost:8002"
            
            # Check if backend is running
            try:
                health_response = requests.get(f"{backend_url}/health", timeout=5)
                if health_response.status_code != 200:
                    print(f"✗ Backend not responding properly at {backend_url}")
                    print("  Please start the backend first!")
                    return False
                print(f"✓ Backend is running at {backend_url}")
            except Exception as e:
                print(f"✗ Cannot reach backend at {backend_url}")
                print(f"  Error: {e}")
                print("  Please start the backend first!")
                return False
            
            # Re-analyze each player
            success_count = 0
            for user_id, platform in players:
                print(f"\nRe-analyzing {user_id} on {platform}...")
                
                analyze_url = f"{backend_url}/api/v1/analyze"
                payload = {
                    "user_id": user_id,
                    "platform": platform,
                    "analysis_type": "stockfish",
                    "limit": 1000  # Large limit to analyze all games
                }
                
                try:
                    response = requests.post(f"{analyze_url}?use_parallel=false", json=payload, timeout=600)
                    
                    if response.status_code == 200:
                        result = response.json()
                        print(f"✓ Analysis started successfully for {user_id}")
                        print(f"  Message: {result.get('message', 'N/A')}")
                        success_count += 1
                    else:
                        print(f"✗ Analysis request failed for {user_id}: {response.status_code}")
                        print(f"  Response: {response.text[:200]}")
                except Exception as e:
                    print(f"✗ Error analyzing {user_id}: {e}")
                
                # Brief pause between requests
                await asyncio.sleep(2)
            
            return success_count > 0
        
        # Run the re-analysis
        try:
            result = asyncio.run(reanalyze_all_games())
            if result:
                print(f"\n{'='*60}")
                print("RE-ANALYSIS COMPLETED")
                print("="*60)
                print("\n✓ Re-analysis has been initiated for all players")
                print("  The analysis will run in the background")
                print("  Check the backend logs for progress updates")
                print("  Refresh your browser to see updated scores")
            else:
                print(f"\n{'='*60}")
                print("RE-ANALYSIS FAILED")
                print("="*60)
                print("\n✗ Could not start re-analysis")
                print("  Please check that the backend is running")
                print("  and try again later")
        except Exception as e:
            print(f"\n✗ Error during re-analysis: {e}")
            print("  Please try again or check the backend status")
    else:
        print("\nSkipping re-analysis.")
        print("You can run this script again later to re-analyze games when ready.")

except KeyboardInterrupt:
    print("\n\nOperation cancelled by user.")
    print("No re-analysis was performed.")

