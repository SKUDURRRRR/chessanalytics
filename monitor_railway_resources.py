#!/usr/bin/env python3
"""
Railway Resource Monitoring Script
Monitors CPU, memory, and analysis performance in real-time
"""

import psutil
import time
import os
import sys
from datetime import datetime
import json

def get_system_resources():
    """Get current system resource usage."""
    # CPU usage
    cpu_percent = psutil.cpu_percent(interval=1)
    cpu_count = psutil.cpu_count()
    
    # Memory usage
    memory = psutil.virtual_memory()
    memory_used_gb = memory.used / (1024**3)
    memory_total_gb = memory.total / (1024**3)
    memory_percent = memory.percent
    
    # Python processes
    python_processes = []
    total_python_memory = 0
    total_python_cpu = 0
    
    for proc in psutil.process_iter(['pid', 'name', 'memory_info', 'cpu_percent']):
        try:
            if proc.info['name'] and 'python' in proc.info['name'].lower():
                memory_mb = proc.info['memory_info'].rss / (1024**2)
                cpu_percent = proc.info['cpu_percent']
                
                python_processes.append({
                    'pid': proc.info['pid'],
                    'memory_mb': round(memory_mb, 2),
                    'cpu_percent': cpu_percent
                })
                
                total_python_memory += memory_mb
                total_python_cpu += cpu_percent
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            continue
    
    return {
        'timestamp': datetime.now().isoformat(),
        'system': {
            'cpu_percent': cpu_percent,
            'cpu_count': cpu_count,
            'memory_used_gb': round(memory_used_gb, 2),
            'memory_total_gb': round(memory_total_gb, 2),
            'memory_percent': memory_percent
        },
        'python_processes': {
            'count': len(python_processes),
            'total_memory_mb': round(total_python_memory, 2),
            'total_cpu_percent': round(total_python_cpu, 2),
            'processes': python_processes
        },
        'railway_limits': {
            'max_memory_gb': 8,
            'max_cpu_cores': 8,
            'memory_usage_percent': round((memory_used_gb / 8) * 100, 2),
            'cpu_usage_percent': round((cpu_percent / 100) * 100, 2)
        }
    }

def print_resource_report(data):
    """Print a formatted resource report."""
    print("=" * 60)
    print(f"RAILWAY RESOURCE MONITORING - {data['timestamp']}")
    print("=" * 60)
    
    # System Resources
    sys = data['system']
    print(f"🖥️  SYSTEM RESOURCES:")
    print(f"   CPU: {sys['cpu_percent']:.1f}% ({sys['cpu_count']} cores)")
    print(f"   Memory: {sys['memory_used_gb']:.2f}GB / {sys['memory_total_gb']:.2f}GB ({sys['memory_percent']:.1f}%)")
    
    # Python Processes
    py = data['python_processes']
    print(f"\n🐍 PYTHON PROCESSES:")
    print(f"   Count: {py['count']}")
    print(f"   Total Memory: {py['total_memory_mb']:.2f}MB")
    print(f"   Total CPU: {py['total_cpu_percent']:.1f}%")
    
    # Railway Limits
    limits = data['railway_limits']
    print(f"\n🚀 RAILWAY HOBBY TIER USAGE:")
    print(f"   Memory: {limits['memory_usage_percent']:.1f}% of 8GB limit")
    print(f"   CPU: {limits['cpu_usage_percent']:.1f}% of 8 cores")
    
    # Optimization Recommendations
    print(f"\n💡 OPTIMIZATION RECOMMENDATIONS:")
    
    if limits['memory_usage_percent'] < 50:
        print("   ✅ Memory usage is low - can increase concurrency")
        print("   📈 Consider: MAX_CONCURRENT_ANALYSES=8, MOVE_CONCURRENCY=6")
    elif limits['memory_usage_percent'] < 75:
        print("   ⚠️  Memory usage is moderate - current settings are good")
    else:
        print("   ⚠️  Memory usage is high - consider reducing concurrency")
        print("   📉 Consider: MAX_CONCURRENT_ANALYSES=4, MOVE_CONCURRENCY=3")
    
    if limits['cpu_usage_percent'] < 50:
        print("   ✅ CPU usage is low - can increase parallel processing")
        print("   📈 Consider: STOCKFISH_THREADS=6, more workers")
    elif limits['cpu_usage_percent'] < 75:
        print("   ⚠️  CPU usage is moderate - current settings are good")
    else:
        print("   ⚠️  CPU usage is high - consider reducing parallelism")
    
    print("=" * 60)

def monitor_continuously(interval=5):
    """Monitor resources continuously."""
    print("Starting Railway resource monitoring...")
    print("Press Ctrl+C to stop")
    
    try:
        while True:
            data = get_system_resources()
            print_resource_report(data)
            time.sleep(interval)
    except KeyboardInterrupt:
        print("\nMonitoring stopped.")

def get_optimization_suggestions(data):
    """Get specific optimization suggestions based on current usage."""
    suggestions = []
    
    memory_usage = data['railway_limits']['memory_usage_percent']
    cpu_usage = data['railway_limits']['cpu_usage_percent']
    python_count = data['python_processes']['count']
    
    if memory_usage < 40 and cpu_usage < 40:
        suggestions.append("🚀 AGGRESSIVE OPTIMIZATION AVAILABLE:")
        suggestions.append("   - Set MAX_CONCURRENT_ANALYSES=8")
        suggestions.append("   - Set MOVE_CONCURRENCY=6")
        suggestions.append("   - Set STOCKFISH_THREADS=6")
        suggestions.append("   - Set STOCKFISH_HASH_SIZE=256")
        suggestions.append("   - Expected: 3-4x faster analysis")
    
    elif memory_usage < 60 and cpu_usage < 60:
        suggestions.append("⚡ MODERATE OPTIMIZATION AVAILABLE:")
        suggestions.append("   - Set MAX_CONCURRENT_ANALYSES=6")
        suggestions.append("   - Set MOVE_CONCURRENCY=5")
        suggestions.append("   - Set STOCKFISH_THREADS=5")
        suggestions.append("   - Set STOCKFISH_HASH_SIZE=192")
        suggestions.append("   - Expected: 2-3x faster analysis")
    
    elif memory_usage > 80 or cpu_usage > 80:
        suggestions.append("⚠️  CONSERVATIVE SETTINGS RECOMMENDED:")
        suggestions.append("   - Set MAX_CONCURRENT_ANALYSES=4")
        suggestions.append("   - Set MOVE_CONCURRENCY=3")
        suggestions.append("   - Set STOCKFISH_THREADS=3")
        suggestions.append("   - Set STOCKFISH_HASH_SIZE=128")
        suggestions.append("   - Current settings are optimal")
    
    else:
        suggestions.append("✅ CURRENT SETTINGS ARE OPTIMAL")
        suggestions.append("   - Memory and CPU usage are well balanced")
        suggestions.append("   - No changes needed")
    
    return suggestions

if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--continuous":
        monitor_continuously()
    else:
        # Single report
        data = get_system_resources()
        print_resource_report(data)
        
        print("\n🎯 SPECIFIC OPTIMIZATION SUGGESTIONS:")
        suggestions = get_optimization_suggestions(data)
        for suggestion in suggestions:
            print(suggestion)
