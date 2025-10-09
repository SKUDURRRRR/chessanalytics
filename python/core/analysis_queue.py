#!/usr/bin/env python3
"""
Analysis Queue System for Chess Analytics

This module implements a proper queue system to handle multiple analysis requests
without blocking the server or overwhelming system resources.
"""

import asyncio
import time
from datetime import datetime
from typing import Dict, Any, Optional, Callable
from dataclasses import dataclass, field
from enum import Enum
import threading
from concurrent.futures import ThreadPoolExecutor
import uuid

class AnalysisStatus(Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"

@dataclass
class AnalysisJob:
    """Represents a single analysis job in the queue."""
    job_id: str
    user_id: str
    platform: str
    analysis_type: str
    limit: int
    depth: int
    skill_level: int
    status: AnalysisStatus = AnalysisStatus.PENDING
    created_at: datetime = field(default_factory=datetime.now)
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    progress_percentage: int = 0
    current_phase: str = "queued"
    total_games: int = 0
    analyzed_games: int = 0
    error_message: Optional[str] = None
    result: Optional[Dict[str, Any]] = None

class AnalysisQueue:
    """
    Thread-safe analysis queue that manages analysis jobs and prevents
    resource exhaustion by limiting concurrent analysis processes.
    """
    
    def __init__(self, max_concurrent_jobs: int = 2, max_workers_per_job: int = 4):
        """
        Initialize the analysis queue.
        
        Args:
            max_concurrent_jobs: Maximum number of analysis jobs running simultaneously
            max_workers_per_job: Maximum workers per job (reduced from 8 to 4)
        """
        self.max_concurrent_jobs = max_concurrent_jobs
        self.max_workers_per_job = max_workers_per_job
        self.jobs: Dict[str, AnalysisJob] = {}
        self.queue: asyncio.Queue = asyncio.Queue()
        self.running_jobs: Dict[str, AnalysisJob] = {}
        self.lock = threading.Lock()
        self.executor = ThreadPoolExecutor(max_workers=max_concurrent_jobs)
        self._queue_processor_task: Optional[asyncio.Task] = None
        self._start_queue_processor()
    
    def _start_queue_processor(self):
        """Start the background queue processor."""
        if self._queue_processor_task is None or self._queue_processor_task.done():
            try:
                # Try to get the current event loop
                loop = asyncio.get_event_loop()
                self._queue_processor_task = loop.create_task(self._process_queue())
                print("Queue processor started successfully")
            except RuntimeError:
                # No event loop running, start one
                print("No event loop running, queue processor will start when server starts")
                self._queue_processor_task = None
    
    async def _process_queue(self):
        """Background task that processes the analysis queue."""
        while True:
            try:
                # Wait for a job to be available
                job = await self.queue.get()
                
                # Check if we can start this job (respect max concurrent limit)
                if len(self.running_jobs) >= self.max_concurrent_jobs:
                    # Put the job back and wait
                    await self.queue.put(job)
                    await asyncio.sleep(1)  # Wait 1 second before checking again
                    continue
                
                # Start the job
                await self._start_job(job)
                
            except Exception as e:
                print(f"Error in queue processor: {e}")
                await asyncio.sleep(1)
    
    async def _start_job(self, job: AnalysisJob):
        """Start a single analysis job."""
        with self.lock:
            job.status = AnalysisStatus.RUNNING
            job.started_at = datetime.now()
            job.current_phase = "starting"
            self.running_jobs[job.job_id] = job
            
            # Update in-memory progress to starting
            try:
                print(f"[QUEUE] Job {job.job_id} starting for user {job.user_id} on {job.platform}")
                from .unified_api_server import analysis_progress, _canonical_user_id
                # Use the same canonicalization logic as the realtime endpoint
                canonical_user_id = _canonical_user_id(job.user_id, job.platform)
                platform_key = job.platform.strip().lower()
                progress_key = f"{canonical_user_id}_{platform_key}"
                analysis_progress[progress_key] = {
                    "analyzed_games": 0,
                    "total_games": 0,  # Will be updated when we know the total
                    "progress_percentage": 0,
                    "is_complete": False,
                    "current_phase": "starting",
                    "estimated_time_remaining": None
                }
                print(f"[QUEUE] Initialized progress for key '{progress_key}'")
            except Exception as e:
                print(f"Warning: Could not update in-memory progress on start: {e}")
        
        try:
            # Run the analysis in a thread pool to avoid blocking
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(
                self.executor,
                self._run_analysis_job,
                job
            )
            
            # Mark job as completed
            with self.lock:
                job.status = AnalysisStatus.COMPLETED
                job.completed_at = datetime.now()
                job.progress_percentage = 100
                job.current_phase = "completed"
                job.result = result
                if job.job_id in self.running_jobs:
                    del self.running_jobs[job.job_id]
                
            # Update in-memory progress to completed
            try:
                from .unified_api_server import analysis_progress, _canonical_user_id
                # Use the same canonicalization logic as the realtime endpoint
                canonical_user_id = _canonical_user_id(job.user_id, job.platform)
                platform_key = job.platform.strip().lower()
                progress_key = f"{canonical_user_id}_{platform_key}"
                progress_snapshot = {
                    "analyzed_games": job.analyzed_games,
                    "total_games": job.total_games,
                    "progress_percentage": 100,
                    "is_complete": True,
                    "current_phase": "completed",
                    "estimated_time_remaining": None
                }
                analysis_progress[progress_key] = progress_snapshot
                print(f"[QUEUE] Job {job.job_id} complete. Stored progress for key '{progress_key}': {progress_snapshot}")
            except Exception as e:
                print(f"Warning: Could not update in-memory progress on completion: {e}")
                    
        except Exception as e:
            # Mark job as failed
            with self.lock:
                job.status = AnalysisStatus.FAILED
                job.completed_at = datetime.now()
                job.error_message = str(e)
                job.current_phase = "failed"
                if job.job_id in self.running_jobs:
                    del self.running_jobs[job.job_id]
            print(f"Analysis job {job.job_id} failed: {e}")
    
    def _run_analysis_job(self, job: AnalysisJob) -> Dict[str, Any]:
        """
        Run the actual analysis job.
        This runs in a separate thread to avoid blocking the main event loop.
        """
        try:
            # Import here to avoid circular imports
            from .parallel_analysis_engine import ParallelAnalysisEngine
            
            # Create analysis engine with reduced worker count
            parallel_engine = ParallelAnalysisEngine(max_workers=self.max_workers_per_job)
            
            # Create progress callback
            def update_progress(completed: int, total: int, percentage: int):
                with self.lock:
                    if job.job_id in self.jobs:
                        job.analyzed_games = completed
                        job.total_games = total
                        job.progress_percentage = percentage
                        job.current_phase = "analyzing"
                        
                        # Also update the in-memory progress for realtime endpoint
                        try:
                            from .unified_api_server import analysis_progress, _canonical_user_id
                            # Use the same canonicalization logic as the realtime endpoint
                            canonical_user_id = _canonical_user_id(job.user_id, job.platform)
                            platform_key = job.platform.strip().lower()
                            progress_key = f"{canonical_user_id}_{platform_key}"
                            progress_data = {
                                "analyzed_games": completed,
                                "total_games": total,
                                "progress_percentage": percentage,
                                "is_complete": False,
                                "current_phase": "analyzing",
                                "estimated_time_remaining": None
                            }
                            analysis_progress[progress_key] = progress_data
                            print(f"[QUEUE] Progress update for job {job.job_id} -> key '{progress_key}': {progress_data}")
                        except Exception as e:
                            print(f"Warning: Could not update in-memory progress: {e}")
            
            # Run analysis (this is synchronous within the thread)
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            
            result = loop.run_until_complete(
                parallel_engine.analyze_games_parallel(
                    user_id=job.user_id,
                    platform=job.platform,
                    analysis_type=job.analysis_type,
                    limit=job.limit,
                    depth=job.depth,
                    skill_level=job.skill_level,
                    progress_callback=update_progress
                )
            )
            
            loop.close()
            return result
            
        except Exception as e:
            print(f"Error in analysis job {job.job_id}: {e}")
            raise
    
    async def submit_job(
        self,
        user_id: str,
        platform: str,
        analysis_type: str = "stockfish",
        limit: int = 5,
        depth: int = 8,
        skill_level: int = 8
    ) -> str:
        """
        Submit a new analysis job to the queue.
        
        Returns:
            job_id: Unique identifier for the job
        """
        job_id = str(uuid.uuid4())
        job = AnalysisJob(
            job_id=job_id,
            user_id=user_id,
            platform=platform,
            analysis_type=analysis_type,
            limit=limit,
            depth=depth,
            skill_level=skill_level
        )
        
        with self.lock:
            self.jobs[job_id] = job
        
        # Add to queue
        await self.queue.put(job)
        
        print(f"[QUEUE] Analysis job {job_id} submitted for {user_id} on {platform}")
        return job_id
    
    def get_job_status(self, job_id: str) -> Optional[AnalysisJob]:
        """Get the status of a specific job."""
        with self.lock:
            return self.jobs.get(job_id)
    
    def get_all_jobs(self) -> Dict[str, AnalysisJob]:
        """Get all jobs (for admin/debugging purposes)."""
        with self.lock:
            return self.jobs.copy()
    
    def cancel_job(self, job_id: str) -> bool:
        """Cancel a pending job."""
        with self.lock:
            if job_id in self.jobs:
                job = self.jobs[job_id]
                if job.status == AnalysisStatus.PENDING:
                    job.status = AnalysisStatus.CANCELLED
                    job.completed_at = datetime.now()
                    job.current_phase = "cancelled"
                    return True
        return False
    
    def get_queue_stats(self) -> Dict[str, Any]:
        """Get queue statistics."""
        with self.lock:
            pending = sum(1 for job in self.jobs.values() if job.status == AnalysisStatus.PENDING)
            running = len(self.running_jobs)
            completed = sum(1 for job in self.jobs.values() if job.status == AnalysisStatus.COMPLETED)
            failed = sum(1 for job in self.jobs.values() if job.status == AnalysisStatus.FAILED)
            
            return {
                "pending_jobs": pending,
                "running_jobs": running,
                "completed_jobs": completed,
                "failed_jobs": failed,
                "max_concurrent_jobs": self.max_concurrent_jobs,
                "max_workers_per_job": self.max_workers_per_job,
                "queue_size": self.queue.qsize()
            }

# Global queue instance
_analysis_queue: Optional[AnalysisQueue] = None

def get_analysis_queue() -> AnalysisQueue:
    """Get the global analysis queue instance."""
    global _analysis_queue
    if _analysis_queue is None:
        _analysis_queue = AnalysisQueue(
            max_concurrent_jobs=2,  # Only 2 concurrent analysis jobs
            max_workers_per_job=4   # Only 4 workers per job (reduced from 8)
        )
    return _analysis_queue
