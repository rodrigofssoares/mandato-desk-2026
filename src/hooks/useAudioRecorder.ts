import { useCallback, useEffect, useRef, useState } from 'react';

// ─── Tipos ──────────────────────────────────────────────────────────────────

export type AudioRecorderStatus = 'idle' | 'recording' | 'recorded';

export interface UseAudioRecorder {
  /** Estado atual da máquina: idle → recording → recorded. */
  status: AudioRecorderStatus;
  /** Duração em segundos — ao vivo durante a gravação, fixa depois. */
  durationSec: number;
  /** Object URL do áudio gravado, pra pré-escuta. null fora do estado `recorded`. */
  previewUrl: string | null;
  /** Falso quando o navegador não suporta MediaRecorder/getUserMedia. */
  isSupported: boolean;
  /** Mensagem de erro amigável (permissão negada, sem microfone, etc.). */
  error: string | null;
  /** Pede permissão e começa a gravar. */
  start: () => Promise<void>;
  /** Encerra a gravação — transiciona pra `recorded`. */
  stop: () => void;
  /** Descarta tudo e volta pra `idle`. */
  reset: () => void;
  /** Embrulha o áudio gravado num File pronto pra upload. null se não há áudio. */
  getFile: () => File | null;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Escolhe o primeiro container/codec de áudio suportado pelo navegador. */
function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined;
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/mp4',
  ];
  return candidates.find((t) => MediaRecorder.isTypeSupported(t));
}

/** Extensão de arquivo coerente com o mimeType gravado. */
function extensionForMime(mime: string): string {
  if (mime.includes('ogg')) return 'ogg';
  if (mime.includes('mp4')) return 'm4a';
  return 'webm';
}

// ─── useAudioRecorder ───────────────────────────────────────────────────────

/**
 * Encapsula a Web `MediaRecorder` API pra gravar áudio do microfone.
 *
 * Ciclo de vida: `idle` → start() → `recording` → stop() → `recorded`.
 * reset() volta pra `idle` a qualquer momento, descartando o áudio.
 *
 * Garante limpeza: ao parar/resetar/desmontar, as tracks do microfone são
 * encerradas (apaga o indicador de gravação do navegador) e o object URL
 * de pré-escuta é revogado.
 */
export function useAudioRecorder(): UseAudioRecorder {
  const [status, setStatus] = useState<AudioRecorderStatus>('idle');
  const [durationSec, setDurationSec] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const blobRef = useRef<Blob | null>(null);
  const mimeRef = useRef<string>('audio/webm');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Espelha previewUrl pra que o cleanup de unmount sempre revogue o valor atual.
  const previewUrlRef = useRef<string | null>(null);

  const isSupported =
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== 'undefined';

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const stopTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const revokePreview = useCallback(() => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    clearTimer();
    stopTracks();
    const rec = recorderRef.current;
    if (rec && rec.state !== 'inactive') {
      // Evita que o onstop pendente reabra o estado `recorded`.
      rec.onstop = null;
      rec.stop();
    }
    recorderRef.current = null;
    chunksRef.current = [];
    blobRef.current = null;
    revokePreview();
    setPreviewUrl(null);
    setDurationSec(0);
    setError(null);
    setStatus('idle');
  }, [clearTimer, stopTracks, revokePreview]);

  const start = useCallback(async () => {
    if (!isSupported) {
      setError('Gravação de áudio não é suportada neste navegador');
      return;
    }
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mime = pickMimeType();
      mimeRef.current = mime ?? 'audio/webm';
      const recorder = mime
        ? new MediaRecorder(stream, { mimeType: mime })
        : new MediaRecorder(stream);

      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        clearTimer();
        stopTracks();
        const blob = new Blob(chunksRef.current, { type: mimeRef.current });
        blobRef.current = blob;
        revokePreview();
        const objUrl = URL.createObjectURL(blob);
        previewUrlRef.current = objUrl;
        setPreviewUrl(objUrl);
        setStatus('recorded');
      };

      recorderRef.current = recorder;
      // recorder.mimeType reflete o formato REAL escolhido pelo browser — pode
      // diferir do candidato pedido (ou do fallback quando nenhum foi suportado).
      if (recorder.mimeType) mimeRef.current = recorder.mimeType;
      recorder.start();
      setDurationSec(0);
      setStatus('recording');

      const startedAt = Date.now();
      timerRef.current = setInterval(() => {
        setDurationSec(Math.floor((Date.now() - startedAt) / 1000));
      }, 250);
    } catch (err) {
      stopTracks();
      const name = (err as { name?: string } | null)?.name;
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        setError('Permita o acesso ao microfone para gravar áudio');
      } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        setError('Nenhum microfone encontrado');
      } else {
        setError('Não foi possível iniciar a gravação');
      }
      setStatus('idle');
    }
  }, [isSupported, stopTracks, clearTimer, revokePreview]);

  const stop = useCallback(() => {
    const rec = recorderRef.current;
    if (rec && rec.state !== 'inactive') rec.stop();
  }, []);

  const getFile = useCallback((): File | null => {
    if (!blobRef.current) return null;
    const ext = extensionForMime(mimeRef.current);
    return new File([blobRef.current], `audio-${Date.now()}.${ext}`, {
      type: mimeRef.current,
    });
  }, []);

  // Limpeza no unmount — encerra microfone e revoga URL mesmo se o componente
  // sumir no meio de uma gravação.
  useEffect(() => {
    return () => {
      clearTimer();
      const rec = recorderRef.current;
      if (rec && rec.state !== 'inactive') {
        // Previne callback onstop órfão tentando criar URL/atualizar estado
        // depois do unmount (vazaria o object URL recém-criado).
        rec.onstop = null;
        rec.stop();
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
      revokePreview();
    };
  }, [clearTimer, revokePreview]);

  return {
    status,
    durationSec,
    previewUrl,
    isSupported,
    error,
    start,
    stop,
    reset,
    getFile,
  };
}
