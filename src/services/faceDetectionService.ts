/**
 * Detecção facial leve no navegador (Face Detection API, Chrome/Edge).
 * Sem API nativa, a captura ainda é permitida com aviso ao usuário.
 */

export type FaceCheckResult = { ok: true } | { ok: false; reason: string };

type FaceDetectorCtor = new (opts?: { fastMode?: boolean; maxDetectedFaces?: number }) => {
  detect: (image: CanvasImageSource) => Promise<Array<{ boundingBox: DOMRectReadOnly }>>;
};

export function isFaceDetectionAvailable(): boolean {
  return typeof window !== 'undefined' && 'FaceDetector' in window;
}

/**
 * Verifica se há pelo menos um rosto no frame de vídeo (quando suportado).
 */
export async function detectFaceInVideoFrame(video: HTMLVideoElement): Promise<FaceCheckResult> {
  const Ctor = (window as unknown as { FaceDetector?: FaceDetectorCtor }).FaceDetector;
  if (!Ctor || video.videoWidth < 2 || video.videoHeight < 2) {
    return { ok: true };
  }
  try {
    const detector = new Ctor({ fastMode: true, maxDetectedFaces: 2 });
    const faces = await detector.detect(video);
    if (faces.length >= 1) return { ok: true };
    return {
      ok: false,
      reason: 'Nenhum rosto detectado. Posicione-se de frente para a câmera, com boa iluminação.',
    };
  } catch {
    return { ok: false, reason: 'Não foi possível analisar o rosto. Tente novamente.' };
  }
}
