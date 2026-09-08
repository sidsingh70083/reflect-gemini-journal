import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Video,
  VideoOff,
  Camera,
  Mic,
  MicOff,
  Square,
  Sparkles,
  AlertCircle,
  X,
  Play,
  Pause,
  Check,
  RotateCcw,
  Send,
  Eye,
  Smile,
  Activity,
  Heart,
  ChevronDown,
  ChevronUp,
  Radio,
  Clock,
  Volume2,
} from 'lucide-react';
import { VideoAnalysisResult, JournalCategory, CATEGORY_CONFIG } from '../types';

export interface UseVideoRecorderOptions {
  onAnalysisComplete: (result: VideoAnalysisResult, autoSend?: boolean) => void;
  disabled?: boolean;
}

export function useVideoRecorder({
  onAnalysisComplete,
  disabled = false,
}: UseVideoRecorderOptions) {
  const [isOpen, setIsOpen] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<VideoAnalysisResult | null>(null);
  const [volumeLevel, setVolumeLevel] = useState<number>(0);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [recordedVideoUrl, setRecordedVideoUrl] = useState<string | null>(null);
  const [analysisStep, setAnalysisStep] = useState<string>('');

  const videoPreviewRef = useRef<HTMLVideoElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const videoChunksRef = useRef<Blob[]>([]);
  const capturedFramesRef = useRef<string[]>([]);
  const thumbnailRef = useRef<string | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const frameIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const MAX_RECORDING_SECONDS = 300; // 5 minutes max

  // Cleanup helper
  const cleanupStream = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    setVolumeLevel(0);
    setIsReady(false);
  }, []);

  // Format seconds MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Capture a snapshot frame from the live video stream onto a hidden canvas
  const captureFrame = useCallback((): string | null => {
    if (!videoPreviewRef.current) return null;
    const video = videoPreviewRef.current;
    if (video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) {
      return null;
    }

    try {
      const canvas = document.createElement('canvas');
      // Scale frame down for optimal token and bandwidth efficiency (max 480px width)
      const scale = Math.min(1, 480 / video.videoWidth);
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);

      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/jpeg', 0.75);
    } catch (e) {
      console.warn('Failed to capture video snapshot frame:', e);
      return null;
    }
  }, []);

  // Volume Analyzer
  const startVolumeAnalyzer = (stream: MediaStream) => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;

      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;

      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) return;

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const checkVolume = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;
        setVolumeLevel(Math.min(100, Math.round((average / 128) * 100)));
        animationFrameRef.current = requestAnimationFrame(checkVolume);
      };

      checkVolume();
    } catch (e) {
      console.warn('AudioContext volume analyzer could not be started for video:', e);
    }
  };

  // Open camera stream preview
  const openCamera = async () => {
    setVideoError(null);
    setRecordedVideoUrl(null);
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setVideoError('Camera recording is not supported in this browser environment.');
      return;
    }

    try {
      cleanupStream();

      // First attempt: with both video and audio
      let stream: MediaStream | null = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode,
            width: { ideal: 640 },
            height: { ideal: 480 },
          },
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
      } catch (firstErr: any) {
        // If combined video+audio request fails due to audio restriction/overconstrained, try video-only
        const isPermDenied =
          firstErr.name === 'NotAllowedError' ||
          firstErr.name === 'PermissionDeniedError' ||
          firstErr.message?.toLowerCase().includes('denied') ||
          firstErr.message?.toLowerCase().includes('permission');

        if (!isPermDenied) {
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              video: {
                facingMode,
                width: { ideal: 640 },
                height: { ideal: 480 },
              },
            });
          } catch {
            throw firstErr;
          }
        } else {
          throw firstErr;
        }
      }

      if (!stream) {
        throw new Error('Could not initialize video stream');
      }

      streamRef.current = stream;
      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
        videoPreviewRef.current.play().catch(() => {});
      }

      startVolumeAnalyzer(stream);
      setIsReady(true);
      setIsOpen(true);
    } catch (err: any) {
      cleanupStream();
      setIsReady(false);

      const isPermissionDenied =
        err.name === 'NotAllowedError' ||
        err.name === 'PermissionDeniedError' ||
        err.message?.toLowerCase().includes('denied') ||
        err.message?.toLowerCase().includes('permission');

      if (isPermissionDenied) {
        console.warn('Camera or microphone permission was denied by user or browser:', err?.message || err);
        setVideoError('Camera permission was denied. Please allow camera and microphone access in your browser site permissions to record video notes.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        console.warn('No camera or microphone detected on device:', err?.message || err);
        setVideoError('No camera detected on your device. Please check your camera connection.');
      } else {
        console.warn('Could not open camera stream:', err?.message || err);
        setVideoError(err.message || 'Could not access camera. Please check your device camera permissions.');
      }
    }
  };

  // Close camera & reset
  const closeCamera = () => {
    if (isRecording) {
      cancelRecording();
    } else {
      cleanupStream();
    }
    setIsOpen(false);
    setVideoError(null);
  };

  // Toggle Camera Facing Mode (Front vs Rear)
  const toggleFacingMode = async () => {
    const nextMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(nextMode);
    if (isOpen && !isRecording) {
      setTimeout(() => {
        openCamera();
      }, 50);
    }
  };

  // Start Video Recording
  const startRecording = async () => {
    if (disabled || !streamRef.current) {
      if (!streamRef.current) {
        await openCamera();
      }
      return;
    }

    setVideoError(null);
    setLastResult(null);
    setRecordedVideoUrl(null);
    capturedFramesRef.current = [];

    // Capture initial thumbnail frame
    const initialThumb = captureFrame();
    if (initialThumb) {
      thumbnailRef.current = initialThumb;
      capturedFramesRef.current.push(initialThumb);
    }

    try {
      const stream = streamRef.current;

      // Determine supported mime types for video
      let mimeType = 'video/webm';
      const possibleTypes = [
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm',
        'video/mp4',
      ];
      for (const type of possibleTypes) {
        if (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(type)) {
          mimeType = type;
          break;
        }
      }

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      videoChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          videoChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const videoBlob = new Blob(videoChunksRef.current, { type: mimeType });
        if (videoBlob.size > 100) {
          const url = URL.createObjectURL(videoBlob);
          setRecordedVideoUrl(url);
          // Final frame
          const finalFrame = captureFrame();
          if (finalFrame) {
            capturedFramesRef.current.push(finalFrame);
          }
          await processVideoWithGemini(videoBlob, mimeType);
        } else {
          setIsRecording(false);
          setVideoError('No video/audio data was recorded. Please check your camera/mic.');
        }
      };

      mediaRecorder.start(1000); // 1-second chunks
      setIsRecording(true);
      setIsPaused(false);
      setRecordingDuration(0);

      // Periodically sample key frames every 6 seconds for facial/mood progression analysis
      frameIntervalRef.current = setInterval(() => {
        if (capturedFramesRef.current.length < 6) {
          const frame = captureFrame();
          if (frame) {
            capturedFramesRef.current.push(frame);
          }
        }
      }, 6000);

      // Timer
      timerRef.current = setInterval(() => {
        setRecordingDuration((prev) => {
          if (prev + 1 >= MAX_RECORDING_SECONDS) {
            stopRecording();
            return MAX_RECORDING_SECONDS;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err: any) {
      console.error('Error starting video recording:', err);
      setIsRecording(false);
      setVideoError(err.message || 'Could not start video recording.');
    }
  };

  // Stop Recording & Send to Gemini Multimodal
  const stopRecording = () => {
    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      setIsAnalyzing(true);
      setIsRecording(false);
      mediaRecorderRef.current.stop();
    }
  };

  // Cancel Recording
  const cancelRecording = () => {
    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      videoChunksRef.current = [];
      mediaRecorderRef.current.stop();
    }
    cleanupStream();
    setIsRecording(false);
    setIsPaused(false);
    setIsAnalyzing(false);
    setRecordingDuration(0);
    setVideoError(null);
  };

  // Process Video with Gemini Multimodal API
  const processVideoWithGemini = async (blob: Blob, mimeType: string) => {
    setIsAnalyzing(true);
    setVideoError(null);
    setAnalysisStep('Encoding video frames & audio stream...');

    try {
      // 1. Convert video blob to base64
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          const base64 = result.includes(',') ? result.split(',')[1] : result;
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      setAnalysisStep('Reflecting on spoken thoughts and video note...');

      // Ensure at least 1 frame is present
      const frames = capturedFramesRef.current.length > 0
        ? capturedFramesRef.current
        : [thumbnailRef.current || ''].filter(Boolean);

      const response = await fetch('/api/video/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          audioData: base64Data,
          audioMimeType: mimeType,
          frames,
          thumbnail: thumbnailRef.current || frames[0] || null,
        }),
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || `Server error ${response.status}`);
      }

      setAnalysisStep('Finalizing emotional breakdown & category...');
      const data: VideoAnalysisResult = await response.json();

      if (!data.transcription && data.emotionalTags.length === 0) {
        setVideoError('No speech or clear emotional expression was detected. Please try recording again.');
        setIsAnalyzing(false);
        return;
      }

      setLastResult(data);
      onAnalysisComplete(data, false);
    } catch (err: any) {
      console.error('Video mood analysis error:', err);
      setVideoError(err.message || 'Failed to analyze video note. Please try again.');
    } finally {
      setIsAnalyzing(false);
      setAnalysisStep('');
    }
  };

  // Attach video stream to ref when opened
  useEffect(() => {
    if (isOpen && streamRef.current && videoPreviewRef.current) {
      videoPreviewRef.current.srcObject = streamRef.current;
      videoPreviewRef.current.play().catch(() => {});
    }
  }, [isOpen]);

  // Clean up when unmounting
  useEffect(() => {
    return () => {
      cleanupStream();
      if (recordedVideoUrl) {
        URL.revokeObjectURL(recordedVideoUrl);
      }
    };
  }, [cleanupStream, recordedVideoUrl]);

  return {
    isOpen,
    isReady,
    isRecording,
    isPaused,
    isAnalyzing,
    recordingDuration,
    videoError,
    lastResult,
    volumeLevel,
    facingMode,
    recordedVideoUrl,
    analysisStep,
    MAX_RECORDING_SECONDS,
    videoPreviewRef,
    formatTime,
    openCamera,
    closeCamera,
    toggleFacingMode,
    startRecording,
    stopRecording,
    cancelRecording,
    setVideoError,
    setLastResult,
  };
}

interface VideoRecorderStudioProps {
  recorder: ReturnType<typeof useVideoRecorder>;
  onAnalysisComplete: (result: VideoAnalysisResult, autoSend?: boolean) => void;
  disabled?: boolean;
}

export const VideoRecorderStudio: React.FC<VideoRecorderStudioProps> = ({
  recorder,
  onAnalysisComplete,
  disabled = false,
}) => {
  const {
    isOpen,
    isReady,
    isRecording,
    isAnalyzing,
    recordingDuration,
    videoError,
    lastResult,
    volumeLevel,
    facingMode,
    recordedVideoUrl,
    analysisStep,
    MAX_RECORDING_SECONDS,
    videoPreviewRef,
    formatTime,
    openCamera,
    closeCamera,
    toggleFacingMode,
    startRecording,
    stopRecording,
    cancelRecording,
    setVideoError,
    setLastResult,
  } = recorder;

  if (!isOpen && !lastResult && !videoError) {
    return null;
  }

  return (
    <div className="space-y-3 mb-3">
      {/* 1. Error Notice */}
      {videoError && (
        <div
          id="video-recording-error"
          className="p-3 text-xs bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 border border-amber-200 dark:border-amber-900/60 rounded-xl flex items-center justify-between gap-3 animate-in fade-in"
        >
          <div className="flex items-center gap-2 flex-1">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-amber-600 dark:text-amber-400" />
            <span className="leading-relaxed">{videoError}</span>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              type="button"
              onClick={openCamera}
              className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-amber-200/70 hover:bg-amber-300/70 dark:bg-amber-900/60 dark:hover:bg-amber-800/60 text-amber-900 dark:text-amber-100 transition-colors cursor-pointer"
            >
              Retry
            </button>
            <button
              type="button"
              onClick={() => setVideoError(null)}
              className="p-1 text-amber-700 hover:text-amber-900 dark:text-amber-400 dark:hover:text-amber-100 cursor-pointer"
              title="Dismiss error"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* 2. Video Analysis Breakdown Card */}
      {lastResult && (
        <div
          id="video-analysis-card"
          className="p-4 rounded-2xl bg-[#FFFFFF] dark:bg-[#1E1D18] border border-violet-200 dark:border-violet-900/50 shadow-sm animate-in fade-in space-y-3"
        >
          <div className="flex items-center justify-between border-b border-[#E6E4DD] dark:border-[#2E2C26] pb-2.5">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-violet-100 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-[#3A3A35] dark:text-[#EDEAE2]">
                  Video Note Reflection
                </h4>
                <p className="text-[11px] text-[#858376] dark:text-[#8E8C7F]">
                  Spoken thoughts, tone, and visual reflection breakdown
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setLastResult(null)}
              className="text-[#858376] hover:text-[#3A3A35] dark:text-[#A6A498] dark:hover:text-[#EDEAE2] p-1 rounded-md cursor-pointer transition-colors"
              title="Dismiss analysis card"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-start">
            {/* Thumbnail snapshot */}
            {lastResult.videoThumbnail && (
              <div className="sm:col-span-4 rounded-xl overflow-hidden border border-[#E6E4DD] dark:border-[#2E2C26] bg-[#141310] relative group aspect-video sm:aspect-square flex items-center justify-center">
                <img
                  src={lastResult.videoThumbnail}
                  alt="Video note snapshot"
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-1.5 left-1.5 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-xs text-[10px] text-white flex items-center gap-1">
                  <Camera className="w-3 h-3 text-violet-400" />
                  <span>Snapshot</span>
                </div>
              </div>
            )}

            {/* Analysis details */}
            <div className={`space-y-2.5 ${lastResult.videoThumbnail ? 'sm:col-span-8' : 'sm:col-span-12'}`}>
              {/* Category & Emotional Tags */}
              <div className="flex flex-wrap items-center gap-1.5">
                {lastResult.dominantCategory && (
                  <span
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold text-white shadow-2xs"
                    style={{
                      backgroundColor:
                        CATEGORY_CONFIG[lastResult.dominantCategory as JournalCategory]?.color ||
                        '#7c3aed',
                    }}
                  >
                    {lastResult.dominantCategory}
                  </span>
                )}

                {lastResult.overallSentiment && (
                  <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800/60">
                    {lastResult.overallSentiment}
                  </span>
                )}

                {lastResult.emotionalTags &&
                  lastResult.emotionalTags.map((tag, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-[#FAF9F5] dark:bg-[#2A2823] text-[#5A5A40] dark:text-[#D4D0C2] border border-[#D5D2C7] dark:border-[#3E3C34]"
                    >
                      #{tag}
                    </span>
                  ))}
              </div>

              {/* Spoken transcript quote */}
              {lastResult.transcription && (
                <div className="p-2.5 rounded-xl bg-[#FAF9F5] dark:bg-[#1A1915] border border-[#E6E4DD] dark:border-[#2E2C26]">
                  <span className="text-[10px] font-medium text-[#858376] dark:text-[#8E8C7F] uppercase tracking-wider block mb-1">
                    Spoken Reflection
                  </span>
                  <p className="text-xs text-[#3A3A35] dark:text-[#EDEAE2] font-serif italic leading-relaxed">
                    "{lastResult.transcription}"
                  </p>
                </div>
              )}

              {/* Visual Mood & Demeanor Analysis */}
              {lastResult.visualMoodAnalysis && (
                <div className="text-xs text-[#5A5A40] dark:text-[#D4D0C2] flex items-start gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400 mt-0.5 flex-shrink-0" />
                  <span className="leading-relaxed">
                    <strong className="font-medium text-[#3A3A35] dark:text-[#EDEAE2]">
                      Visual Demeanor:{' '}
                    </strong>
                    {lastResult.visualMoodAnalysis}
                  </span>
                </div>
              )}

              {/* Emotional Summary */}
              {lastResult.emotionalSummary && (
                <p className="text-xs text-[#757469] dark:text-[#A6A498] italic leading-relaxed">
                  "{lastResult.emotionalSummary}"
                </p>
              )}

              {/* Suggested Micro-Commitment */}
              {lastResult.suggestedCommitment && (
                <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 text-[11px] text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <span>
                    <strong>Suggested Next-Day Action:</strong> {lastResult.suggestedCommitment}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="pt-2 border-t border-[#E6E4DD] dark:border-[#2E2C26] flex items-center justify-between text-xs">
            <span className="text-[11px] text-[#858376] dark:text-[#8E8C7F]">
              Reflection ready in composer
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setLastResult(null)}
                className="px-3 py-1 rounded-lg border border-[#D5D2C7] dark:border-[#3E3C34] text-[#757469] dark:text-[#A6A498] hover:bg-[#F4F1E8] dark:hover:bg-[#262520] text-xs font-medium cursor-pointer"
              >
                Keep in composer
              </button>
              <button
                type="button"
                onClick={() => onAnalysisComplete(lastResult, true)}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#4A4A38] hover:bg-[#38382A] text-white dark:bg-[#D4D0C2] dark:hover:bg-[#EDEAE2] dark:text-[#1A1916] text-xs font-medium transition-colors cursor-pointer shadow-xs"
              >
                <span>Send reflection now</span>
                <Send className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Live Camera Viewfinder & Recording Studio Panel */}
      {isOpen && (
        <div
          id="video-recording-studio"
          className="p-4 rounded-2xl bg-[#141310] text-[#EDEAE2] border border-[#2E2C26] shadow-lg animate-in fade-in space-y-3"
        >
          {/* Header Bar */}
          <div className="flex items-center justify-between pb-2 border-b border-[#2A2923]">
            <div className="flex items-center gap-2">
              <div className="relative flex items-center justify-center">
                {isRecording ? (
                  <>
                    <span className="w-2.5 h-2.5 bg-rose-500 rounded-full animate-ping absolute" />
                    <span className="w-2.5 h-2.5 bg-rose-600 rounded-full relative" />
                  </>
                ) : (
                  <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full" />
                )}
              </div>
              <span className="text-xs font-semibold tracking-wide">
                {isRecording
                  ? 'RECORDING VIDEO NOTE'
                  : isAnalyzing
                  ? 'REFLECTING WITH GEMINI'
                  : 'CAMERA READY'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* Duration Timer */}
              {isRecording && (
                <div className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-950/80 border border-rose-800/80 text-rose-300 font-mono text-xs font-medium">
                  <Clock className="w-3 h-3" />
                  <span>
                    {formatTime(recordingDuration)} / {formatTime(MAX_RECORDING_SECONDS)}
                  </span>
                </div>
              )}

              {/* Close Button */}
              <button
                type="button"
                onClick={closeCamera}
                disabled={isRecording || isAnalyzing}
                className="p-1 rounded-lg text-[#8E8C7F] hover:text-white hover:bg-[#2A2923] transition-colors cursor-pointer disabled:opacity-40"
                title="Close video note"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Live Viewfinder Container */}
          <div className="relative rounded-xl overflow-hidden bg-black aspect-video max-h-[340px] flex items-center justify-center border border-[#2E2C26]">
            <video
              ref={videoPreviewRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover ${
                facingMode === 'user' ? 'scale-x-[-1]' : ''
              }`}
            />

            {/* Framing Guide Overlay */}
            {!isRecording && !isAnalyzing && (
              <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-4 border border-white/10 m-3 rounded-lg">
                <div className="w-36 h-48 border border-dashed border-white/25 rounded-full flex items-center justify-center">
                  <span className="text-[10px] text-white/40 text-center px-2">
                    Position your face comfortably
                  </span>
                </div>
              </div>
            )}

            {/* Analyzing Overlay */}
            {isAnalyzing && (
              <div className="absolute inset-0 bg-black/80 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-center space-y-3 z-20">
                <div className="relative">
                  <Sparkles className="w-8 h-8 text-violet-400 animate-spin" />
                  <div className="absolute inset-0 blur-md bg-violet-500/30 -z-10" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-semibold text-white">
                    Reflecting on Video Note
                  </h4>
                  <p className="text-xs text-[#A6A498] max-w-sm font-sans">
                    {analysisStep || 'Gemini is reflecting on your spoken thoughts and video note...'}
                  </p>
                </div>
                <div className="w-48 h-1 bg-[#2E2C26] rounded-full overflow-hidden">
                  <div className="w-full h-full bg-gradient-to-r from-violet-500 via-rose-500 to-amber-500 animate-pulse" />
                </div>
              </div>
            )}

            {/* Real-time Audio Level Bar Overlay */}
            {isRecording && (
              <div className="absolute bottom-3 left-3 px-2.5 py-1 rounded-lg bg-black/70 backdrop-blur-xs border border-white/10 flex items-center gap-2 text-xs">
                <Volume2 className="w-3.5 h-3.5 text-rose-400" />
                <div className="flex items-center gap-0.5 h-3">
                  {Array.from({ length: 12 }).map((_, i) => {
                    const baseHeight = Math.max(2, (volumeLevel / 100) * 12);
                    const randomVar = ((i * 5) % 4) - 1;
                    const finalHeight = Math.min(12, Math.max(2, baseHeight + randomVar));
                    return (
                      <div
                        key={i}
                        style={{ height: `${finalHeight}px` }}
                        className="w-1 bg-rose-500 rounded-full transition-all duration-75"
                      />
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Control Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="text-xs text-[#8E8C7F]">
              {isRecording ? (
                <span>Speak naturally into your camera. Tap Stop when finished.</span>
              ) : (
                <span>Record a short video reflection for your journal.</span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* Flip camera */}
              {!isRecording && !isAnalyzing && (
                <button
                  type="button"
                  onClick={toggleFacingMode}
                  className="p-2 rounded-xl bg-[#22211C] hover:bg-[#2D2C26] text-[#D4D0C2] text-xs font-medium border border-[#3E3C34] transition-colors cursor-pointer"
                  title="Switch camera"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              )}

              {/* Cancel Button */}
              {isRecording && (
                <button
                  type="button"
                  onClick={cancelRecording}
                  className="px-3 py-1.5 rounded-xl border border-[#3E3C34] hover:bg-[#22211C] text-[#EDEAE2] text-xs font-medium cursor-pointer transition-colors"
                >
                  Cancel
                </button>
              )}

              {/* Main Record / Stop Action Button */}
              {!isRecording ? (
                <button
                  type="button"
                  disabled={isAnalyzing || !isReady}
                  onClick={startRecording}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 active:scale-98 text-white text-xs font-semibold shadow-md transition-all cursor-pointer disabled:opacity-40"
                >
                  <span className="w-2.5 h-2.5 bg-white rounded-full" />
                  <span>Start Video Recording</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={stopRecording}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 active:scale-98 text-white text-xs font-semibold shadow-md transition-all cursor-pointer"
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                  <span>Stop & Save Note</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface VideoRecordButtonProps {
  recorder: ReturnType<typeof useVideoRecorder>;
  disabled?: boolean;
}

export const VideoRecordButton: React.FC<VideoRecordButtonProps> = ({
  recorder,
  disabled = false,
}) => {
  const { isOpen, isRecording, isAnalyzing, openCamera, closeCamera } = recorder;

  return (
    <button
      id="video-camera-button"
      type="button"
      disabled={disabled || isAnalyzing}
      onClick={isOpen ? closeCamera : openCamera}
      className={`p-2 rounded-xl transition-all duration-200 cursor-pointer relative ${
        isRecording
          ? 'bg-rose-600 text-white shadow-md animate-pulse ring-2 ring-rose-300 dark:ring-rose-800'
          : isOpen
          ? 'bg-violet-600 text-white shadow-xs'
          : isAnalyzing
          ? 'text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/40 opacity-70 cursor-wait'
          : 'text-violet-600 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300 hover:bg-[#EAE8E0] dark:hover:bg-[#2E2C26]'
      } disabled:opacity-40 disabled:cursor-not-allowed`}
      title={
        isRecording
          ? 'Recording video note...'
          : isOpen
          ? 'Close video note'
          : isAnalyzing
          ? 'Reflecting on video note...'
          : 'Record a short video reflection'
      }
      aria-label={isOpen ? 'Close video note' : 'Record a short video reflection'}
    >
      <Video className={`w-4 h-4 ${isRecording ? 'animate-bounce' : ''}`} />
      {isRecording && (
        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-rose-500 rounded-full animate-ping" />
      )}
    </button>
  );
};
