import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Mic,
  Square,
  Sparkles,
  AlertCircle,
  X,
  Volume2,
  Check,
  RotateCcw,
  Tag,
  Smile,
  ArrowRight,
  Radio,
  Send,
} from 'lucide-react';
import { AudioTranscriptionResult, JournalCategory, CATEGORY_CONFIG } from '../types';

export interface UseAudioRecorderOptions {
  onTranscriptionComplete: (result: AudioTranscriptionResult, autoSend?: boolean) => void;
  disabled?: boolean;
}

export function useAudioRecorder({
  onTranscriptionComplete,
  disabled = false,
}: UseAudioRecorderOptions) {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<AudioTranscriptionResult | null>(null);
  const [volumeLevel, setVolumeLevel] = useState<number>(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Maximum recording time: 5 minutes (300 seconds)
  const MAX_RECORDING_SECONDS = 300;

  // Cleanup helper
  const cleanupStream = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
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
  }, []);

  useEffect(() => {
    return () => {
      cleanupStream();
    };
  }, [cleanupStream]);

  // Format seconds into MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Start live volume analyzer
  const startVolumeAnalyzer = (stream: MediaStream) => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;

      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;

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
        // Normalize to 0 - 100
        setVolumeLevel(Math.min(100, Math.round((average / 128) * 100)));
        animationFrameRef.current = requestAnimationFrame(checkVolume);
      };

      checkVolume();
    } catch (e) {
      console.warn('AudioContext volume analyzer could not be initialized:', e);
    }
  };

  // Start Recording
  const startRecording = async () => {
    if (disabled) return;
    setAudioError(null);
    setLastResult(null);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setAudioError('Media recording is not supported in this browser environment.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      streamRef.current = stream;
      startVolumeAnalyzer(stream);

      // Determine supported MIME types
      let mimeType = 'audio/webm';
      const possibleTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/ogg;codecs=opus',
        'audio/wav',
      ];
      for (const type of possibleTypes) {
        if (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(type)) {
          mimeType = type;
          break;
        }
      }

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        cleanupStream();
        if (audioBlob.size > 100) {
          await processAudioWithGemini(audioBlob, mimeType);
        } else {
          setIsRecording(false);
          setAudioError('No audio data was captured. Please check your microphone and try again.');
        }
      };

      // Start recording with 500ms time slices
      mediaRecorder.start(500);
      setIsRecording(true);
      setRecordingDuration(0);

      // Start timer
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
      cleanupStream();
      setIsRecording(false);

      const isPermissionDenied =
        err.name === 'NotAllowedError' ||
        err.name === 'PermissionDeniedError' ||
        err.message?.toLowerCase().includes('denied') ||
        err.message?.toLowerCase().includes('permission');

      if (isPermissionDenied) {
        console.warn('Microphone permission was denied by user or browser:', err?.message || err);
        setAudioError('Microphone permission was denied. Please allow microphone access in your browser site settings.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        console.warn('No microphone detected on device:', err?.message || err);
        setAudioError('No microphone detected on your device.');
      } else {
        console.warn('Could not start audio recording:', err?.message || err);
        setAudioError(err.message || 'Could not access microphone.');
      }
    }
  };

  // Stop Recording & Trigger Gemini Processing
  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      setIsTranscribing(true);
      setIsRecording(false);
      mediaRecorderRef.current.stop();
    }
  };

  // Cancel Recording without sending to Gemini
  const cancelRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      audioChunksRef.current = []; // Clear chunks so onstop won't process
      mediaRecorderRef.current.stop();
    }
    cleanupStream();
    setIsRecording(false);
    setIsTranscribing(false);
    setRecordingDuration(0);
    setAudioError(null);
  };

  // Convert Blob to base64 and send to server API
  const processAudioWithGemini = async (blob: Blob, mimeType: string) => {
    setIsTranscribing(true);
    setAudioError(null);

    try {
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          // Extract base64 part
          const base64 = result.includes(',') ? result.split(',')[1] : result;
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      const response = await fetch('/api/audio/transcribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          audioData: base64Data,
          mimeType,
        }),
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || `Server error ${response.status}`);
      }

      const data: AudioTranscriptionResult = await response.json();

      if (!data.transcription || data.transcription.trim().length === 0) {
        setAudioError('No speech was detected in the audio. You can try speaking closer to your microphone.');
        setIsTranscribing(false);
        return;
      }

      setLastResult(data);
      // Automatically send transcription to composer
      onTranscriptionComplete(data, false);
    } catch (err: any) {
      console.error('Audio transcription error:', err);
      setAudioError(err.message || 'Failed to transcribe audio. Please try again.');
    } finally {
      setIsTranscribing(false);
    }
  };

  return {
    isRecording,
    isTranscribing,
    recordingDuration,
    audioError,
    lastResult,
    volumeLevel,
    MAX_RECORDING_SECONDS,
    formatTime,
    startRecording,
    stopRecording,
    cancelRecording,
    setAudioError,
    setLastResult,
  };
}

interface AudioRecorderPanelProps {
  recorder: ReturnType<typeof useAudioRecorder>;
  onTranscriptionComplete: (result: AudioTranscriptionResult, autoSend?: boolean) => void;
}

export const AudioRecorderPanel: React.FC<AudioRecorderPanelProps> = ({
  recorder,
  onTranscriptionComplete,
}) => {
  const {
    isRecording,
    isTranscribing,
    recordingDuration,
    audioError,
    lastResult,
    volumeLevel,
    MAX_RECORDING_SECONDS,
    formatTime,
    stopRecording,
    cancelRecording,
    startRecording,
    setAudioError,
    setLastResult,
  } = recorder;

  if (!audioError && !lastResult && !isRecording && !isTranscribing) {
    return null;
  }

  return (
    <div className="space-y-2 mb-2">
      {/* 1. Error Banner */}
      {audioError && (
        <div
          id="audio-recording-error"
          className="p-3 text-xs bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 border border-amber-200 dark:border-amber-900/60 rounded-xl flex items-center justify-between gap-3 animate-in fade-in"
        >
          <div className="flex items-center gap-2 flex-1">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-amber-600 dark:text-amber-400" />
            <span className="leading-relaxed">{audioError}</span>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              type="button"
              onClick={startRecording}
              className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-amber-200/70 hover:bg-amber-300/70 dark:bg-amber-900/60 dark:hover:bg-amber-800/60 text-amber-900 dark:text-amber-100 transition-colors cursor-pointer"
            >
              Retry
            </button>
            <button
              type="button"
              onClick={() => setAudioError(null)}
              className="p-1 text-amber-700 hover:text-amber-900 dark:text-amber-400 dark:hover:text-amber-100 cursor-pointer"
              title="Dismiss error"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* 2. Last Result Emotional Insights Card */}
      {lastResult && (
        <div
          id="audio-insights-card"
          className="p-3.5 rounded-xl bg-[#FAF9F5] dark:bg-[#1E1D18] border border-[#E6E4DD] dark:border-[#2E2C26] shadow-xs animate-in fade-in space-y-2.5"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#5A5A40] dark:text-[#D4D0C2]">
              <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span>Voice Reflection Transcribed</span>
            </div>

            <button
              type="button"
              onClick={() => setLastResult(null)}
              className="text-[#858376] hover:text-[#3A3A35] dark:text-[#A6A498] dark:hover:text-[#EDEAE2] p-1 rounded-md cursor-pointer transition-colors"
              title="Dismiss audio card"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Emotional Observation & Category */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {lastResult.dominantCategory && (
              <span
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold text-white shadow-2xs"
                style={{
                  backgroundColor:
                    CATEGORY_CONFIG[lastResult.dominantCategory as JournalCategory]?.color ||
                    '#5A5A40',
                }}
              >
                {lastResult.dominantCategory}
              </span>
            )}

            {lastResult.emotionalTags &&
              lastResult.emotionalTags.map((tag, idx) => (
                <span
                  key={idx}
                  className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-[#EAE8E0] dark:bg-[#2A2823] text-[#5A5A40] dark:text-[#D4D0C2] border border-[#D5D2C7] dark:border-[#3E3C34]"
                >
                  #{tag}
                </span>
              ))}
          </div>

          {lastResult.emotionalSummary && (
            <p className="text-xs text-[#757469] dark:text-[#A6A498] italic leading-relaxed">
              "{lastResult.emotionalSummary}"
            </p>
          )}

          {/* Quick Action to Send Directly */}
          <div className="pt-1 flex items-center justify-between text-xs">
            <span className="text-[11px] text-[#858376] dark:text-[#8E8C7F]">
              Inserted into journal composer
            </span>
            <button
              type="button"
              onClick={() => onTranscriptionComplete(lastResult, true)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#4A4A38] hover:bg-[#38382A] text-white dark:bg-[#D4D0C2] dark:hover:bg-[#EDEAE2] dark:text-[#1A1916] text-[11px] font-medium transition-colors cursor-pointer"
            >
              <span>Send reflection now</span>
              <Send className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* 3. Active Recording / Transcribing Control Bar */}
      {isRecording ? (
        <div
          id="audio-recording-active-bar"
          className="p-3.5 rounded-2xl bg-rose-50/90 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3 animate-in fade-in"
        >
          {/* Recording pulse & duration */}
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center">
              <span className="w-3 h-3 bg-rose-500 rounded-full animate-ping absolute" />
              <span className="w-3 h-3 bg-rose-600 rounded-full relative" />
            </div>

            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-rose-800 dark:text-rose-200 font-sans tracking-wide">
                  RECORDING AUDIO
                </span>
                <span className="text-xs font-mono font-medium text-rose-700 dark:text-rose-300">
                  {formatTime(recordingDuration)} / {formatTime(MAX_RECORDING_SECONDS)}
                </span>
              </div>

              {/* Reactive Waveform Audio Bars */}
              <div className="flex items-center gap-0.5 h-3 pt-0.5">
                {Array.from({ length: 16 }).map((_, i) => {
                  const baseHeight = Math.max(3, (volumeLevel / 100) * 12);
                  const randomVar = ((i * 7) % 5) - 2;
                  const finalHeight = Math.min(12, Math.max(3, baseHeight + randomVar));
                  return (
                    <div
                      key={i}
                      style={{ height: `${finalHeight}px` }}
                      className="w-1 bg-rose-500/80 rounded-full transition-all duration-75"
                    />
                  );
                })}
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 self-end sm:self-center">
            <button
              id="cancel-audio-record-btn"
              type="button"
              onClick={cancelRecording}
              className="px-3 py-1.5 rounded-xl border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/40 text-xs font-medium transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              id="stop-audio-record-btn"
              type="button"
              onClick={stopRecording}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-medium shadow-sm transition-all cursor-pointer active:scale-95"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>Done & Transcribe</span>
            </button>
          </div>
        </div>
      ) : isTranscribing ? (
        <div
          id="audio-transcribing-state-bar"
          className="p-3.5 rounded-2xl bg-[#FAF9F5] dark:bg-[#1E1D18] border border-[#E6E4DD] dark:border-[#2E2C26] shadow-xs flex items-center justify-center gap-2.5 text-xs text-[#5A5A40] dark:text-[#D4D0C2] animate-pulse"
        >
          <Sparkles className="w-4 h-4 animate-spin text-amber-600 dark:text-amber-400" />
          <span className="font-medium">
            Transcribing audio and analyzing emotional tags with Gemini...
          </span>
        </div>
      ) : null}
    </div>
  );
};

interface AudioRecordButtonProps {
  recorder: ReturnType<typeof useAudioRecorder>;
  disabled?: boolean;
  size?: 'sm' | 'md';
}

export const AudioRecordButton: React.FC<AudioRecordButtonProps> = ({
  recorder,
  disabled = false,
  size = 'md',
}) => {
  const { isRecording, isTranscribing, startRecording, stopRecording } = recorder;
  const isSmall = size === 'sm';

  return (
    <button
      id="mic-voice-button"
      type="button"
      disabled={disabled || isTranscribing}
      onClick={isRecording ? stopRecording : startRecording}
      className={`${isSmall ? 'p-1.5 rounded-lg' : 'p-2 rounded-xl'} transition-all duration-200 cursor-pointer relative ${
        isRecording
          ? 'bg-rose-600 text-white shadow-md animate-pulse ring-2 ring-rose-300 dark:ring-rose-800'
          : isTranscribing
          ? 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 opacity-70 cursor-wait'
          : 'text-rose-600 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300 hover:bg-[#EAE8E0] dark:hover:bg-[#2E2C26]'
      } disabled:opacity-40 disabled:cursor-not-allowed`}
      title={
        isRecording
          ? 'Tap to stop and transcribe audio'
          : isTranscribing
          ? 'Transcribing audio reflection...'
          : 'Record audio reflection with Gemini transcription'
      }
      aria-label={isRecording ? 'Stop voice recording' : 'Record voice reflection'}
    >
      <Mic className={`${isSmall ? 'w-3.5 h-3.5' : 'w-4 h-4'} ${isRecording ? 'animate-bounce' : ''}`} />
      {isRecording && (
        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-rose-500 rounded-full animate-ping" />
      )}
    </button>
  );
};

interface AudioRecorderProps {
  onTranscriptionComplete: (result: AudioTranscriptionResult, autoSend?: boolean) => void;
  disabled?: boolean;
}

export const AudioRecorder: React.FC<AudioRecorderProps> = ({
  onTranscriptionComplete,
  disabled = false,
}) => {
  const recorder = useAudioRecorder({ onTranscriptionComplete, disabled });

  return (
    <div>
      <AudioRecorderPanel
        recorder={recorder}
        onTranscriptionComplete={onTranscriptionComplete}
      />
      <div className="flex items-center">
        <AudioRecordButton recorder={recorder} disabled={disabled} />
      </div>
    </div>
  );
};
