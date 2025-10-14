#!/usr/bin/env python3
"""
CLI tool for analyzing famous players from PGN collections.

Usage:
    python analyze_famous_players.py --input players.pgn --output profiles.json

This tool:
1. Reads PGN files containing games of famous players
2. Analyzes their moves to calculate personality scores
3. Saves the profiles to a JSON file
"""

import argparse
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from core.famous_player_profiler import FamousPlayerProfiler, FamousPlayerProfile


def main():
    parser = argparse.ArgumentParser(
        description='Analyze famous chess players from PGN collections'
    )
    parser.add_argument(
        '--input',
        required=True,
        help='Path to PGN file containing games'
    )
    parser.add_argument(
        '--output',
        required=True,
        help='Path to output JSON file for profiles'
    )
    parser.add_argument(
        '--player',
        required=True,
        help='Name of the player to analyze'
    )
    parser.add_argument(
        '--era',
        required=True,
        help='Era of the player (e.g., "1960s-1970s")'
    )
    parser.add_argument(
        '--description',
        required=True,
        help='Brief description of the player'
    )
    parser.add_argument(
        '--strengths',
        required=True,
        help='Comma-separated list of strengths (e.g., "Tactics,Endgames,Calculation")'
    )
    parser.add_argument(
        '--color',
        choices=['white', 'black', 'both'],
        default='both',
        help='Filter games by color (default: both)'
    )
    parser.add_argument(
        '--append',
        action='store_true',
        help='Append to existing profiles file instead of overwriting'
    )

    args = parser.parse_args()

    # Read PGN file
    print(f"Reading PGN file: {args.input}")
    try:
        with open(args.input, 'r', encoding='utf-8') as f:
            pgn_content = f.read()
    except FileNotFoundError:
        print(f"Error: File not found: {args.input}")
        return 1
    except Exception as e:
        print(f"Error reading file: {e}")
        return 1

    # Analyze player
    print(f"Analyzing games for: {args.player}")
    profiler = FamousPlayerProfiler()

    color_filter = None if args.color == 'both' else args.color

    analysis_result = profiler.analyze_pgn_collection(
        pgn_content,
        args.player,
        color_filter=color_filter
    )

    if 'error' in analysis_result:
        print(f"Error: {analysis_result['error']}")
        return 1

    # Display results
    print(f"\nAnalysis complete!")
    print(f"  Games analyzed: {analysis_result['games_analyzed']}")
    print(f"  Total moves: {analysis_result['total_moves']}")
    print(f"  Confidence: {analysis_result['confidence']:.1f}%")
    print(f"\nPersonality Profile:")
    for trait, score in analysis_result['profile'].items():
        print(f"  {trait.capitalize():12} {score:5.1f}")

    # Create profile
    strengths = [s.strip() for s in args.strengths.split(',')]
    profile = profiler.create_player_profile(
        name=args.player,
        era=args.era,
        description=args.description,
        strengths=strengths,
        profile_data=analysis_result
    )

    # Load existing profiles if appending
    profiles = []
    if args.append and os.path.exists(args.output):
        print(f"\nLoading existing profiles from: {args.output}")
        try:
            profiles = profiler.load_profiles(args.output)
            print(f"  Found {len(profiles)} existing profiles")
        except Exception as e:
            print(f"Warning: Could not load existing profiles: {e}")

    # Add new profile
    profiles.append(profile)

    # Save profiles
    print(f"\nSaving {len(profiles)} profile(s) to: {args.output}")
    profiler.save_profiles(profiles, args.output)

    print("\n✓ Success!")
    return 0


if __name__ == '__main__':
    sys.exit(main())
