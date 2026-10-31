import React, { useState, useRef, useEffect, useCallback } from 'react';
import styles from './LiveMediaCapture.module.css';
import { Button } from './Button';
import {
  CameraIcon,
  VideoIcon,
  MicIcon,
  MicOffIcon,
  RotateCwIcon,
  StopIcon,
  CheckIcon,
  XIcon,
  AlertCircleIcon,
} from '@/components/icons';

export interface LiveMediaCaptureProps {
  onCapturePhoto: (file: File, previewUrl: string) => void;
  onRecordVideo: (file: File, previewUrl: string) => void;
  onClose?: () => void;
  maxDurationSeconds?: number;
}

export const LiveMediaCapture: React.FC<LiveMediaCaptureProps> = ({
  onCapturePhoto,
  onRecordVideo,
  onClose,
  maxDurationSeconds = 60,
}) => {
  // Capture mode: 'photo' or 'video'
  const [mode, setMode] = useState<'photo' | 'video'>('photo');

  // Facing mode: 'user' (selfie/webcam) or 'environment' (rear camera)
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');

  // Audio / Mic controls
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [micVolume, setMicVolume] = useState<number>(0);
  const [hasAudioPermission, setHasAudioPermission] = useState<boolean>(false);

  // Stream & Recording state
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [shutterFlash, setShutterFlash] = useState(false);

  // Review state after capture
  const [capturedPhotoUrl, setCapturedPhotoUrl] = useState<string | null>(null);
  const [capturedPhotoFile, setCapturedPhotoFile] = useState<File | null>(null);
  const [recordedVideoUrl, setRecordedVideoUrl] = useState<string | null>(null);
  const [recordedVideoFile, setRecordedVideoFile] = useState<File | null>(null);

  // DOM Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Helper: get a getUserMedia function that works across secure & insecure contexts
  const getGetUserMedia = useCallback((): ((constraints: MediaStreamConstraints) => Promise<MediaStream>) | null => {
    // Modern API — available in secure contexts (HTTPS / localhost)
    if (navigator.mediaDevices?.getUserMedia) {
      return (c) => navigator.mediaDevices.getUserMedia(c);
    }
    // Legacy prefixed fallbacks for older browsers or insecure contexts
    const legacyGetUserMedia =
      (navigator as any).getUserMedia ||
      (navigator as any).webkitGetUserMedia ||
      (navigator as any).mozGetUserMedia ||
      (navigator as any).msGetUserMedia;
    if (legacyGetUserMedia) {
      return (c) =>
        new Promise<MediaStream>((resolve, reject) => {
          legacyGetUserMedia.call(navigator, c, resolve, reject);
        });
    }
    return null;
  }, []);

  // Initialize camera & microphone stream
  const startCamera = useCallback(async (facing: 'user' | 'environment') => {
    try {
      setErrorMsg(null);

      // Stop previous tracks
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }

      // Get a working getUserMedia function
      const getUserMediaFn = getGetUserMedia();
      if (!getUserMediaFn) {
        // mediaDevices API is completely unavailable
        const isInsecure = window.location.protocol === 'http:' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
        setErrorMsg(
          isInsecure
            ? 'Camera & Microphone require a secure connection (HTTPS). You are currently on HTTP. Please access this site via HTTPS or localhost.'
            : 'Your browser does not support camera access. Please use a modern browser like Chrome, Firefox, or Edge.'
        );
        return;
      }

      // Request both video AND audio (microphone) access
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: facing,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: true,
      };

      let newStream: MediaStream;
      try {
        newStream = await getUserMediaFn(constraints);
      } catch (audioErr) {
        // If microphone fails or is blocked, try video only as fallback
        console.warn('Audio device access failed or denied, falling back to video only:', audioErr);
        newStream = await getUserMediaFn({
          video: constraints.video,
          audio: false,
        });
      }

      setStream(newStream);

      // Check audio track presence
      const audioTracks = newStream.getAudioTracks();
      const audioAvailable = audioTracks.length > 0;
      setHasAudioPermission(audioAvailable);

      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
        videoRef.current.play().catch(() => {});
      }

      // Hook up Web Audio API volume analyser for real-time visual VU meter
      if (audioAvailable) {
        try {
          const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
          if (AudioContextClass) {
            const ctx = new AudioContextClass();
            audioContextRef.current = ctx;
            const source = ctx.createMediaStreamSource(newStream);
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 64;
            source.connect(analyser);
            analyserRef.current = analyser;

            const dataArray = new Uint8Array(analyser.frequencyBinCount);
            const checkVolume = () => {
              if (analyserRef.current) {
                analyserRef.current.getByteFrequencyData(dataArray);
                let sum = 0;
                for (let i = 0; i < dataArray.length; i++) {
                  sum += dataArray[i];
                }
                const average = sum / dataArray.length;
                // Normalize roughly 0 to 100
                setMicVolume(Math.min(100, Math.round((average / 128) * 100)));
              }
              animFrameRef.current = requestAnimationFrame(checkVolume);
            };
            checkVolume();
          }
        } catch (e) {
          console.warn('Web Audio API analysis not available:', e);
        }
      }
    } catch (err: any) {
      console.error('Camera/Mic permission failed:', err);
      let message = err?.message || 'Unable to access camera and microphone.';
      if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
        message = 'Camera/Microphone permission was denied. Please allow access in your browser settings and try again.';
      } else if (err?.name === 'NotFoundError' || err?.name === 'DevicesNotFoundError') {
        message = 'No camera or microphone device was found. Please connect a camera and try again.';
      } else if (err?.name === 'NotReadableError' || err?.name === 'TrackStartError') {
        message = 'Camera is already in use by another application. Please close other apps using the camera and try again.';
      }
      setErrorMsg(message);
    }
  }, []);

  // Launch camera when mounted or facing changes
  useEffect(() => {
    startCamera(facingMode);

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
      }
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [facingMode]);

  // Handle Mute/Unmute Mic
  const toggleMicMute = () => {
    if (!stream) return;
    const audioTrack = stream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setIsMicMuted(!audioTrack.enabled);
    }
  };

  // Flip Camera
  const flipCamera = () => {
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'));
  };

  // Take Snapshot
  const handleTakeSnapshot = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;

    // Flash animation
    setShutterFlash(true);
    setTimeout(() => setShutterFlash(false), 300);

    // Render current frame to canvas
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (facingMode === 'user') {
      // Mirror if selfie
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `live_issue_${Date.now()}.jpg`, { type: 'image/jpeg' });
        const previewUrl = URL.createObjectURL(blob);
        setCapturedPhotoFile(file);
        setCapturedPhotoUrl(previewUrl);
      },
      'image/jpeg',
      0.92
    );
  };

  // Start Video Recording with Mic
  const handleStartRecording = () => {
    if (!stream) return;
    recordedChunksRef.current = [];
    setRecordingSeconds(0);

    // Pick best available MIME type
    const mimeTypes = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
      'video/mp4',
    ];
    let selectedMime = '';
    for (const type of mimeTypes) {
      if (MediaRecorder.isTypeSupported(type)) {
        selectedMime = type;
        break;
      }
    }

    try {
      const options = selectedMime ? { mimeType: selectedMime } : undefined;
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const mime = selectedMime || 'video/webm';
        const blob = new Blob(recordedChunksRef.current, { type: mime });
        const ext = mime.includes('mp4') ? 'mp4' : 'webm';
        const file = new File([blob], `live_recording_${Date.now()}.${ext}`, { type: mime });
        const videoUrl = URL.createObjectURL(blob);
        setRecordedVideoFile(file);
        setRecordedVideoUrl(videoUrl);
      };

      mediaRecorder.start(250);
      setIsRecording(true);

      // Start elapsed timer
      timerIntervalRef.current = window.setInterval(() => {
        setRecordingSeconds((prev) => {
          if (prev + 1 >= maxDurationSeconds) {
            handleStopRecording();
            return maxDurationSeconds;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err) {
      console.error('Failed to start MediaRecorder:', err);
      setErrorMsg('Could not start live video recording on this browser.');
    }
  };

  // Stop Video Recording
  const handleStopRecording = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  // Retake or Discard
  const handleRetake = () => {
    if (capturedPhotoUrl) {
      URL.revokeObjectURL(capturedPhotoUrl);
    }
    if (recordedVideoUrl) {
      URL.revokeObjectURL(recordedVideoUrl);
    }
    setCapturedPhotoUrl(null);
    setCapturedPhotoFile(null);
    setRecordedVideoUrl(null);
    setRecordedVideoFile(null);
    setRecordingSeconds(0);
    // Restart camera feed
    startCamera(facingMode);
  };

  // Confirm and submit photo
  const handleConfirmPhoto = () => {
    if (capturedPhotoFile && capturedPhotoUrl) {
      onCapturePhoto(capturedPhotoFile, capturedPhotoUrl);
    }
  };

  // Confirm and submit video
  const handleConfirmVideo = () => {
    if (recordedVideoFile && recordedVideoUrl) {
      onRecordVideo(recordedVideoFile, recordedVideoUrl);
    }
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Render Permission / Device Error
  if (errorMsg) {
    return (
      <div className={styles.container}>
        <div className={styles.permissionDenied}>
          <div className={styles.permissionIcon}>
            <AlertCircleIcon size={32} />
          </div>
          <h3 className={styles.permissionTitle}>Camera & Microphone Access Needed</h3>
          <p className={styles.permissionDesc}>{errorMsg}</p>
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
            <Button variant="primary" size="md" onClick={() => startCamera(facingMode)}>
              Try Again
            </Button>
            {onClose && (
              <Button variant="outline" size="md" onClick={onClose}>
                Use File Upload Instead
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Render Review Mode: Captured Photo
  if (capturedPhotoUrl) {
    return (
      <div className={styles.container}>
        <div className={styles.previewWrapper}>
          <div className={styles.header}>
            <div className={styles.headerTitleGroup}>
              <span className={styles.titleText}>Review Captured Snapshot</span>
            </div>
            <span style={{ fontSize: '0.8125rem', color: 'var(--color-mint-primary)', fontWeight: 600 }}>
              ✓ High-Resolution Freeze Frame
            </span>
          </div>

          <div className={styles.previewMediaContainer}>
            <img src={capturedPhotoUrl} alt="Captured preview" className={styles.previewImage} />
          </div>

          <div className={styles.previewActions}>
            <Button variant="outline" onClick={handleRetake} icon={<RotateCwIcon size={16} />}>
              Retake Photo
            </Button>
            <Button
              variant="primary"
              onClick={handleConfirmPhoto}
              icon={<CheckIcon size={16} />}
            >
              Attach Snapshot to Ticket
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Render Review Mode: Recorded Video with Audio
  if (recordedVideoUrl) {
    return (
      <div className={styles.container}>
        <div className={styles.previewWrapper}>
          <div className={styles.header}>
            <div className={styles.headerTitleGroup}>
              <span className={styles.titleText}>Review Live Video Recording</span>
            </div>
            <span style={{ fontSize: '0.8125rem', color: 'var(--color-mint-primary)', fontWeight: 600 }}>
              ✓ Audio & Video Synchronized
            </span>
          </div>

          <div className={styles.previewMediaContainer}>
            <video
              src={recordedVideoUrl}
              controls
              playsInline
              className={styles.previewVideo}
            />
          </div>

          <div className={styles.previewMetaBanner}>
            <span>Duration: {formatTimer(recordingSeconds)}</span>
            <span>Recorded with active microphone audio</span>
          </div>

          <div className={styles.previewActions}>
            <Button variant="outline" onClick={handleRetake} icon={<RotateCwIcon size={16} />}>
              Retake Recording
            </Button>
            <Button
              variant="primary"
              onClick={handleConfirmVideo}
              icon={<CheckIcon size={16} />}
            >
              Attach Video to Ticket
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Active Live Camera Viewfinder & Recording Studio
  return (
    <div className={styles.container}>
      {/* Studio Header */}
      <div className={styles.header}>
        <div className={styles.headerTitleGroup}>
          <div className={styles.badgeLive}>
            <span className={styles.liveDot} />
            <span>LIVE FEED</span>
          </div>
          <span className={styles.titleText}>Live Issue Capture Studio</span>
        </div>

        <div className={styles.headerControls}>
          {/* Mode Switcher */}
          {!isRecording && (
            <div className={styles.modeToggleGroup}>
              <button
                type="button"
                className={`${styles.modeBtn} ${mode === 'photo' ? styles.modeBtnActive : ''}`}
                onClick={() => setMode('photo')}
              >
                <CameraIcon size={14} />
                <span>Photo</span>
              </button>
              <button
                type="button"
                className={`${styles.modeBtn} ${mode === 'video' ? styles.modeBtnActive : ''}`}
                onClick={() => setMode('video')}
              >
                <VideoIcon size={14} />
                <span>Video + Audio</span>
              </button>
            </div>
          )}

          {onClose && !isRecording && (
            <button
              type="button"
              className={styles.toolBtn}
              onClick={onClose}
              title="Close camera studio"
              aria-label="Close"
            >
              <XIcon size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Camera Viewfinder */}
      <div className={styles.viewfinderWrapper}>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`${styles.videoFeed} ${facingMode === 'user' ? styles.videoFeedMirrored : ''}`}
        />

        {/* Shutter flash animation */}
        {shutterFlash && <div className={styles.shutterFlash} />}

        {/* Viewfinder Top Badges */}
        <div className={styles.viewfinderOverlayTop}>
          {/* Microphone Status with live pulsing visualizer */}
          <div className={styles.micStatusBadge}>
            {hasAudioPermission ? (
              isMicMuted ? (
                <>
                  <MicOffIcon size={14} style={{ color: '#EF4444' }} />
                  <span>Mic Muted</span>
                </>
              ) : (
                <>
                  <MicIcon size={14} style={{ color: 'var(--color-mint-primary)' }} />
                  <span>Mic Active</span>
                  <div className={styles.audioBars}>
                    <div className={styles.audioBar} style={{ height: `${Math.max(3, (micVolume * 14) / 100)}px` }} />
                    <div className={styles.audioBar} style={{ height: `${Math.max(3, (micVolume * 11) / 100)}px` }} />
                    <div className={styles.audioBar} style={{ height: `${Math.max(3, (micVolume * 15) / 100)}px` }} />
                    <div className={styles.audioBar} style={{ height: `${Math.max(3, (micVolume * 9) / 100)}px` }} />
                  </div>
                </>
              )
            ) : (
              <>
                <MicOffIcon size={14} style={{ color: '#F59E0B' }} />
                <span>Mic Not Available</span>
              </>
            )}
          </div>

          {/* Live Recording Badge & Timer */}
          {isRecording && (
            <div className={styles.recordingTimerBadge}>
              <span className={styles.liveDot} style={{ backgroundColor: '#FFFFFF' }} />
              <span>REC {formatTimer(recordingSeconds)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Controls Bar */}
      <div className={styles.controlsBar}>
        {/* Left tools: Flip camera */}
        <div className={styles.controlsLeft}>
          {!isRecording && (
            <button
              type="button"
              className={styles.toolBtn}
              onClick={flipCamera}
              title={`Switch camera (Currently ${facingMode === 'user' ? 'Front' : 'Rear'})`}
            >
              <RotateCwIcon size={18} />
            </button>
          )}

          {/* Mute/unmute microphone */}
          {hasAudioPermission && (
            <button
              type="button"
              className={`${styles.toolBtn} ${isMicMuted ? styles.toolBtnMuted : ''}`}
              onClick={toggleMicMute}
              title={isMicMuted ? 'Unmute microphone' : 'Mute microphone'}
            >
              {isMicMuted ? <MicOffIcon size={18} /> : <MicIcon size={18} />}
            </button>
          )}
        </div>

        {/* Center: Main Action (Capture or Record) */}
        <div className={styles.controlsCenter}>
          {mode === 'photo' ? (
            <button
              type="button"
              className={styles.captureSnapshotBtn}
              onClick={handleTakeSnapshot}
              title="Capture Photo Snapshot"
              aria-label="Capture Photo"
            >
              <CameraIcon size={26} />
            </button>
          ) : isRecording ? (
            <button
              type="button"
              className={styles.stopRecordBtn}
              onClick={handleStopRecording}
              title="Stop Recording Video"
              aria-label="Stop Recording"
            >
              <StopIcon size={24} />
            </button>
          ) : (
            <button
              type="button"
              className={styles.recordVideoBtn}
              onClick={handleStartRecording}
              title="Start Recording Video with Audio"
              aria-label="Start Recording"
            >
              <VideoIcon size={26} />
            </button>
          )}
        </div>

        {/* Right tools: Status or Cancel */}
        <div className={styles.controlsRight}>
          {isRecording ? (
            <span style={{ fontSize: '0.8125rem', color: '#EF4444', fontWeight: 700 }}>
              Recording Issue...
            </span>
          ) : mode === 'photo' ? (
            <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
              Click button to snap
            </span>
          ) : (
            <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
              Max {maxDurationSeconds}s with audio
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
