import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import {
  Camera,
  MapPin,
  Fingerprint,
  Clock,
  Shield,
  Keyboard,
} from 'lucide-react';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import PageHeader from '../../components/PageHeader';
import { db, storage, isSupabaseConfigured } from '../../services/supabaseClient';
import { getDayRecords, getLocalDateString, validatePunchSequence } from '../../services/timeProcessingService';
import {
  getCurrentLocationResult,
  geolocationReasonMessage,
  type GeoPosition,
  type GeolocationFailureReason,
} from '../../services/locationService';
import {
  validatePunch,
  generateDeviceFingerprint,
  type AllowedLocation,
  type DeviceFingerprint,
} from '../../security/antiFraudEngine';
import { detectBehaviorAnomaly } from '../../ai/anomalyDetection';
import { registerPunchSecure } from '../../rep/repEngine';
import { savePunchEvidence, createFraudAlertsForFlags } from '../../services/punchEvidenceService';
import { getCompanyLocations, isWithinAllowedLocation } from '../../services/settingsService';
import { useSettings } from '../../contexts/SettingsContext';
import { useToast } from '../../components/ToastProvider';
import { LogType, PunchMethod } from '../../../types';
import { LoadingState } from '../../../components/UI';
import {
  hasStoredPasskey,
  isWebAuthnSupported,
  registerPlatformPasskey,
  verifyPlatformPasskey,
} from '../../services/webAuthnPunchService';
/** Comprovação explícita: foto, biometria ou registro manual (quando a política permitir). */
type VerificationMode = 'photo' | 'digital' | 'manual';

function waitForVideoReady(video: HTMLVideoElement): Promise<void> {
  return new Promise((resolve, reject) => {
    if (video.videoWidth > 0 && video.videoHeight > 0) {
      resolve();
      return;
    }
    let tid: number;
    const onMeta = () => {
      video.removeEventListener('loadedmetadata', onMeta);
      window.clearTimeout(tid);
      if (video.videoWidth > 0 && video.videoHeight > 0) resolve();
      else reject(new Error('dimensões'));
    };
    video.addEventListener('loadedmetadata', onMeta);
    tid = window.setTimeout(() => {
      video.removeEventListener('loadedmetadata', onMeta);
      if (video.videoWidth > 0 && video.videoHeight > 0) resolve();
      else reject(new Error('timeout'));
    }, 12000);
  });
}

/** Normaliza tipo vindo do banco para comparação com a UI */
function normalizeLastType(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const lower = String(raw).toLowerCase();
  if (lower === 'saída' || lower === 'saida') return 'saída';
  if (lower === 'entrada') return 'entrada';
  if (lower === 'pausa') return 'pausa';
  return lower;
}

const EmployeeClockIn: React.FC = () => {
  const { user, loading } = useCurrentUser();
  const { settings: globalSettings } = useSettings();
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Último tipo de batida **do dia atual** (entrada | saída | pausa) */
  const [lastType, setLastType] = useState<string | null>(null);
  const [lastRecordAt, setLastRecordAt] = useState<string | null>(null);
  const [verificationMode, setVerificationMode] = useState<VerificationMode>('photo');
  /** Qual card está expandido; `null` = nenhum (ações só após clicar no card). */
  const [expandedMethod, setExpandedMethod] = useState<VerificationMode | null>(null);
  /** Modal de comprovação (GPS + câmera / digital) */
  const [proofModalOpen, setProofModalOpen] = useState(false);
  const [pendingLogType, setPendingLogType] = useState<LogType | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [geo, setGeo] = useState<GeoPosition | null>(null);
  const [gpsFailReason, setGpsFailReason] = useState<GeolocationFailureReason | null>(null);
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [hadBiometric, setHadBiometric] = useState(false);
  const [digitalFallbackToPhoto, setDigitalFallbackToPhoto] = useState(false);
  const [webAuthnBusy, setWebAuthnBusy] = useState(false);
  const modalVideoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const loadTodayState = useCallback(async () => {
    if (!user || !isSupabaseConfigured) return;
    try {
      const today = getLocalDateString();
      const dayRecords = await getDayRecords(user.id, today);
      if (!dayRecords.length) {
        setLastType(null);
        setLastRecordAt(null);
        return;
      }
      const last = dayRecords[dayRecords.length - 1];
      setLastType(normalizeLastType(last.type));
      setLastRecordAt(last.timestamp || last.created_at || null);
    } catch {
      setLastType(null);
      setLastRecordAt(null);
    }
  }, [user?.id]);

  useEffect(() => {
    void loadTodayState();
  }, [loadTodayState]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') void loadTodayState();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [loadTodayState]);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (modalVideoRef.current) modalVideoRef.current.srcObject = null;
  }, []);

  const startCameraPreview = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.addToast('error', 'Este navegador não permite acesso à câmera.');
      return;
    }
    if (typeof window !== 'undefined' && !window.isSecureContext && window.location.hostname !== 'localhost') {
      toast.addToast('error', 'Câmera e GPS costumam exigir HTTPS (exceto em localhost).');
    }
    try {
      stopCamera();
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'user' } },
          audio: false,
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }
      streamRef.current = stream;
      const video = modalVideoRef.current;
      if (!video) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;
      await video.play().catch(() => undefined);
    } catch {
      toast.addToast('error', 'Permita o acesso à câmera nas configurações do navegador.');
    }
  }, [stopCamera, toast]);

  const captureFrameFromModal = async (): Promise<string | null> => {
    const video = modalVideoRef.current;
    if (!video || !streamRef.current) return null;
    try {
      await waitForVideoReady(video);
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx || video.videoWidth < 2) return null;
      ctx.drawImage(video, 0, 0);
      return canvas.toDataURL('image/jpeg', 0.85);
    } catch {
      return null;
    }
  };

  const closeProofModal = useCallback(() => {
    stopCamera();
    setProofModalOpen(false);
    setPendingLogType(null);
    setGeo(null);
    setGpsFailReason(null);
    setPhotoDataUrl(null);
    setHadBiometric(false);
    setDigitalFallbackToPhoto(false);
    setGpsLoading(false);
    setWebAuthnBusy(false);
  }, [stopCamera]);

  const retryGps = useCallback(async () => {
    setGpsLoading(true);
    setGpsFailReason(null);
    const r = await getCurrentLocationResult();
    setGpsLoading(false);
    if (r.ok === false) {
      setGeo(null);
      setGpsFailReason(r.reason);
      return;
    }
    setGeo(r.position);
    setGpsFailReason(null);
  }, []);

  useEffect(() => {
    if (!proofModalOpen) return;
    let cancelled = false;
    (async () => {
      setGpsLoading(true);
      setGpsFailReason(null);
      setGeo(null);
      const r = await getCurrentLocationResult();
      if (cancelled) return;
      setGpsLoading(false);
      if (r.ok === false) {
        setGeo(null);
        setGpsFailReason(r.reason);
        return;
      }
      setGeo(r.position);
      setGpsFailReason(null);
    })();
    return () => {
      cancelled = true;
    };
  }, [proofModalOpen]);

  /** Ponto manual sem foto/GPS quando global e preferências do colaborador permitem. */
  const canUseManualPunch =
    (globalSettings?.allow_manual_punch ?? true) && (user?.preferences?.allowManualPunch ?? true);

  const manualBypassActive = canUseManualPunch && verificationMode === 'manual';

  const needsCameraPreview =
    proofModalOpen &&
    !manualBypassActive &&
    (globalSettings?.photo_required === true ||
      verificationMode === 'photo' ||
      (verificationMode === 'digital' && digitalFallbackToPhoto));

  useEffect(() => {
    if (!canUseManualPunch && verificationMode === 'manual') {
      setVerificationMode('photo');
    }
  }, [canUseManualPunch, verificationMode]);

  useEffect(() => {
    if (!needsCameraPreview) {
      if (!proofModalOpen) stopCamera();
      return;
    }
    void startCameraPreview();
    return () => {
      stopCamera();
    };
  }, [needsCameraPreview, proofModalOpen, startCameraPreview, stopCamera]);

  const uploadPhoto = async (dataUrl: string): Promise<string | null> => {
    if (!storage || !user) return null;
    try {
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const file = new File([blob], `punch-${Date.now()}.jpg`, { type: 'image/jpeg' });
      const path = `${user.id}/${Date.now()}-${file.name}`;
      await storage.upload('photos', path, file);
      return storage.getPublicUrl('photos', path);
    } catch {
      return null;
    }
  };

  const resolveMethod = (
    hadBiometric: boolean,
    photoUrl: string | null,
    geo: { latitude: number; longitude: number; accuracy?: number } | null
  ): PunchMethod => {
    if (hadBiometric) return PunchMethod.BIOMETRIC;
    if (photoUrl) return PunchMethod.PHOTO;
    if (geo?.latitude != null && geo?.longitude != null) return PunchMethod.GPS;
    return PunchMethod.MANUAL;
  };

  const executePunchRegistration = async (
    type: LogType,
    geoPos: GeoPosition | null,
    localPhotoDataUrl: string | null,
    biometricOk: boolean,
    opts?: { manualBypass?: boolean }
  ) => {
    if (!user) return;
    const manualBypass = opts?.manualBypass === true && canUseManualPunch;
    setSaving(true);
    setError(null);
    try {
      const fingerprint: DeviceFingerprint = generateDeviceFingerprint();

      const today = getLocalDateString();
      const dayRecords = await getDayRecords(user.id, today);
      const typeStr = type === LogType.IN ? 'entrada' : type === LogType.OUT ? 'saída' : 'pausa';
      const validation = validatePunchSequence(dayRecords, typeStr);
      if (!validation.valid) {
        setError(validation.error || 'Sequência inválida.');
        toast.addToast('error', validation.error || 'Sequência inválida.');
        return;
      }

      if (globalSettings?.gps_required && !manualBypass) {
        if (!geoPos?.latitude || !geoPos?.longitude) {
          setError('O registro de ponto exige localização. Ative o GPS e tente novamente.');
          toast.addToast('error', 'Ative o GPS para registrar o ponto.');
          return;
        }
        const locations = await getCompanyLocations(user.companyId);
        if (locations.length > 0 && !isWithinAllowedLocation(geoPos.latitude, geoPos.longitude, locations)) {
          setError('Você não está dentro da área permitida para registrar ponto.');
          toast.addToast('error', 'Fora da área permitida.');
          return;
        }
      }

      let photoUrl: string | null = null;
      if (localPhotoDataUrl) {
        photoUrl = await uploadPhoto(localPhotoDataUrl);
        if (!photoUrl) {
          // Fallback: mantém o registro com a evidência local para não bloquear a batida.
          photoUrl = localPhotoDataUrl;
          toast.addToast('info', 'Foto salva localmente para este registro (falha de upload no servidor).');
        }
      }

      const method = manualBypass ? PunchMethod.MANUAL : resolveMethod(biometricOk, photoUrl, geoPos);

      let allowedLocations: AllowedLocation[] = [];
      let trustedDeviceIds: string[] = [];
      let history: any[] = [];
      try {
        const [locRows, devRows, histRows] = await Promise.all([
          db.select('work_locations', [{ column: 'company_id', operator: 'eq', value: user.companyId }]) as Promise<any[]>,
          db.select('trusted_devices', [{ column: 'employee_id', operator: 'eq', value: user.id }]) as Promise<any[]>,
          db.select('time_records', [{ column: 'user_id', operator: 'eq', value: user.id }], { column: 'created_at', ascending: false }, 50) as Promise<any[]>,
        ]);
        allowedLocations = (locRows ?? []).map((r) => ({
          id: r.id,
          company_id: r.company_id,
          name: r.name,
          latitude: r.latitude,
          longitude: r.longitude,
          radius: r.radius ?? 200,
        }));
        trustedDeviceIds = (devRows ?? []).map((d) => d.device_id).filter(Boolean);
        history = (histRows ?? []).map((r) => ({
          type: r.type,
          timestamp: r.timestamp || r.created_at,
          latitude: r.latitude,
          longitude: r.longitude,
          device_id: r.device_id,
          created_at: r.created_at,
        }));
      } catch {
        // continua sem zonas/dispositivos confiáveis
      }

      const now = new Date();
      const anomaly = detectBehaviorAnomaly({
        employeeId: user.id,
        companyId: user.companyId,
        type: typeStr,
        timestamp: now,
        latitude: geoPos?.latitude,
        longitude: geoPos?.longitude,
        deviceId: fingerprint.deviceId,
        history,
      });

      const validationResult = validatePunch({
        employeeId: user.id,
        companyId: user.companyId,
        type: typeStr,
        location: geoPos ? { latitude: geoPos.latitude, longitude: geoPos.longitude, accuracy: geoPos.accuracy } : undefined,
        deviceFingerprint: fingerprint,
        allowedLocations,
        trustedDeviceIds,
        behaviorAnomaly: anomaly.behaviorAnomaly,
      });

      const recordId =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `rec-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

      const result = await registerPunchSecure({
        userId: user.id,
        companyId: user.companyId,
        type: typeStr,
        method,
        recordId,
        location: geoPos ? { lat: geoPos.latitude, lng: geoPos.longitude, accuracy: geoPos.accuracy } : undefined,
        photoUrl: photoUrl || undefined,
        source: 'web',
        latitude: geoPos?.latitude ?? null,
        longitude: geoPos?.longitude ?? null,
        accuracy: geoPos?.accuracy ?? null,
        deviceId: fingerprint.deviceId,
        deviceType: 'web',
        ipAddress: null,
        fraudScore: validationResult.fraudScore,
        fraudFlags: validationResult.fraudFlags.length ? validationResult.fraudFlags : null,
      });

      await savePunchEvidence({
        timeRecordId: result.id,
        photoUrl: photoUrl || null,
        locationLat: geoPos?.latitude ?? null,
        locationLng: geoPos?.longitude ?? null,
        deviceId: fingerprint.deviceId,
        fraudScore: validationResult.fraudScore,
      });

      if (validationResult.fraudFlags.length > 0) {
        await createFraudAlertsForFlags(user.id, result.id, validationResult.fraudFlags);
      }

      await loadTodayState();
      const label =
        typeStr === 'entrada'
          ? 'Entrada'
          : typeStr === 'saída'
            ? 'Saída'
            : typeStr === 'pausa'
              ? 'Intervalo'
              : typeStr;
      toast.addToast('success', `${label} registrada com sucesso.`);
      closeProofModal();
    } catch (e: any) {
      const msg = e?.message || 'Erro ao registrar ponto';
      setError(msg);
      toast.addToast('error', msg);
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmProof = async () => {
    if (!user || pendingLogType == null) return;
    const manualBypass = manualBypassActive;
    if (globalSettings?.gps_required && (!geo?.latitude || !geo?.longitude) && !manualBypass) {
      toast.addToast('error', 'É necessário obter a localização antes de registrar.');
      return;
    }
    if (globalSettings?.photo_required && !photoDataUrl && !manualBypass) {
      toast.addToast('error', 'Capture a foto obrigatória antes de registrar.');
      return;
    }
    if (
      verificationMode === 'digital' &&
      !hadBiometric &&
      !photoDataUrl &&
      globalSettings?.photo_required &&
      !manualBypass
    ) {
      toast.addToast('error', 'Valide a biometria ou capture a foto obrigatória.');
      return;
    }
    await executePunchRegistration(pendingLogType, geo, photoDataUrl, hadBiometric, { manualBypass });
  };

  const handleTryWebAuthnInModal = async () => {
    if (!user) return;
    setWebAuthnBusy(true);
    try {
      if (!isWebAuthnSupported()) {
        toast.addToast(
          'error',
          'Biometria digital requer HTTPS (ou localhost) e navegador compatível. Use a foto.'
        );
        setDigitalFallbackToPhoto(true);
        return;
      }
      const hadKeyBefore = hasStoredPasskey(user.id);
      const ok = hadKeyBefore
        ? await verifyPlatformPasskey(user.id)
        : await registerPlatformPasskey(user.id, user.email ?? '', user.nome ?? 'Colaborador');
      setHadBiometric(ok);
      if (ok) {
        toast.addToast(
          'success',
          hadKeyBefore ? 'Dispositivo validado com biometria.' : 'Biometria cadastrada neste aparelho.'
        );
      } else {
        setDigitalFallbackToPhoto(true);
        toast.addToast('info', 'Não foi possível validar. Use a foto.');
      }
    } catch {
      setDigitalFallbackToPhoto(true);
      toast.addToast('error', 'Operação cancelada ou indisponível. Use a foto.');
    } finally {
      setWebAuthnBusy(false);
    }
  };

  const handleCapturePhotoClick = async () => {
    const dataUrl = await captureFrameFromModal();
    if (!dataUrl) {
      toast.addToast('error', 'Não foi possível capturar a imagem. Aguarde a câmera iniciar e tente de novo.');
      return;
    }
    setPhotoDataUrl(dataUrl);
    toast.addToast('success', 'Foto capturada.');
  };

  const beginPunch = async (type: LogType) => {
    if (!user) return;
    if (!isSupabaseConfigured) {
      setError('Sistema de ponto indisponível. Tente mais tarde.');
      toast.addToast('error', 'Sistema de ponto indisponível.');
      return;
    }
    if (!user.companyId || String(user.companyId).trim() === '') {
      setError('Seu cadastro está incompleto (empresa não vinculada). Entre em contato com o administrador.');
      toast.addToast('error', 'Cadastro sem empresa vinculada.');
      return;
    }
    setError(null);
    const today = getLocalDateString();
    const dayRecords = await getDayRecords(user.id, today);
    const typeStr = type === LogType.IN ? 'entrada' : type === LogType.OUT ? 'saída' : 'pausa';
    const validation = validatePunchSequence(dayRecords, typeStr);
    if (!validation.valid) {
      setError(validation.error || 'Sequência inválida.');
      toast.addToast('error', validation.error || 'Sequência inválida.');
      return;
    }
    setPendingLogType(type);
    setGeo(null);
    setGpsFailReason(null);
    setPhotoDataUrl(null);
    setHadBiometric(false);
    setDigitalFallbackToPhoto(false);
    setProofModalOpen(true);
  };

  const handlePunch = (type: LogType) => {
    void beginPunch(type);
  };

  /** Em jornada: última batida do dia foi entrada (trabalhando ou após retorno de intervalo) */
  const isIn = lastType === 'entrada';
  /** Em intervalo: última batida foi início de pausa */
  const isBreak = lastType === 'pausa';

  if (loading) return <LoadingState message="Carregando..." />;
  if (!user) return <Navigate to="/" replace />;

  const lastLabel =
    lastType === 'entrada'
      ? 'Entrada'
      : lastType === 'saída'
        ? 'Saída'
        : lastType === 'pausa'
          ? 'Intervalo (em pausa)'
          : null;

  return (
    <div className="space-y-8 relative z-10">
      <PageHeader
        title="Registrar Ponto"
        subtitle="Marcações com sequência válida, localização automática, foto ou biometria do aparelho (HTTPS)."
        icon={<Clock className="w-5 h-5" />}
      />

      {error && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm">
          {error}
        </div>
      )}

      {user && (!user.companyId || String(user.companyId).trim() === '') && (
        <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-sm">
          Seu cadastro está sem empresa vinculada. Os botões de ponto só funcionarão após o administrador corrigir isso.
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 dark:border-slate-600 bg-white/90 dark:bg-slate-900 dark:shadow-lg dark:shadow-black/30 p-4 md:p-5 space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
          <Shield className="w-4 h-4 text-indigo-500 shrink-0" />
          <span>
            <strong>Hoje:</strong>{' '}
            {lastLabel ? (
              <>
                última batida — <strong>{lastLabel}</strong>
                {lastRecordAt && (
                  <span className="text-slate-500 dark:text-slate-400">
                    {' '}
                    às{' '}
                    {new Date(lastRecordAt).toLocaleTimeString('pt-BR', {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </span>
                )}
              </>
            ) : (
              'nenhuma batida ainda'
            )}
          </span>
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-slate-500 dark:text-slate-400">
          {globalSettings?.gps_required && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200">
              <MapPin className="w-3 h-3" /> GPS obrigatório
            </span>
          )}
          {globalSettings?.photo_required && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-sky-50 dark:bg-sky-900/20 text-sky-800 dark:text-sky-200">
              <Camera className="w-3 h-3" /> Foto obrigatória
            </span>
          )}
          {globalSettings && !globalSettings.gps_required && !globalSettings.photo_required && (
            <span className="text-slate-500">Localização obtida automaticamente; comprovação opcional: foto ou digital.</span>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Toque em <strong>FOTO</strong>, <strong>DIGITAL</strong>
          {canUseManualPunch ? <> ou <strong>MANUAL</strong></> : null} para ver as ações de registro. A{' '}
          <strong>localização</strong> é obtida no comprovante; no modo manual, conforme política da empresa.
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-500">
          {globalSettings?.photo_required && !manualBypassActive
            ? 'A empresa pode exigir imagem: use FOTO ou DIGITAL com “Usar foto” no comprovante — ou MANUAL, se disponível.'
            : 'DIGITAL usa Face ID / Windows Hello neste aparelho (HTTPS). MANUAL segue a política da empresa.'}
        </p>
      </div>

      <p className="text-sm text-slate-500 dark:text-slate-400">
        <strong>Sequência do dia:</strong> Entrada → (opcional) Início do intervalo (pausa) → Entrada (retorno) → Saída. Após pausa, use <strong>Registrar Entrada</strong> para voltar ou o atalho &quot;Finalizar intervalo&quot; abaixo.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { mode: 'photo' as const, label: 'FOTO', icon: Camera },
          { mode: 'digital' as const, label: 'DIGITAL', icon: Fingerprint },
          ...(canUseManualPunch ? [{ mode: 'manual' as const, label: 'MANUAL', icon: Keyboard }] : []),
        ].map((card) => {
          const selected = expandedMethod === card.mode;
          const Icon = card.icon;
          return (
            <div
              key={card.mode}
              className={`rounded-2xl border p-4 space-y-3 ${
                selected
                  ? 'border-indigo-500 bg-indigo-50/70 dark:bg-indigo-900/20'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900'
              }`}
            >
              <button
                type="button"
                aria-expanded={selected}
                aria-controls={`clock-actions-${card.mode}`}
                id={`clock-card-${card.mode}`}
                onClick={() => {
                  setVerificationMode(card.mode);
                  if (card.mode === 'photo' || card.mode === 'manual') setDigitalFallbackToPhoto(false);
                  setExpandedMethod((prev) => (prev === card.mode ? null : card.mode));
                }}
                className="w-full flex items-center justify-center gap-2 rounded-xl py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-semibold"
              >
                <Icon className="w-4 h-4" />
                {card.label}
              </button>
              {expandedMethod === card.mode && (
                <div id={`clock-actions-${card.mode}`} className="grid grid-cols-2 gap-2" role="group" aria-labelledby={`clock-card-${card.mode}`}>
                  <button
                    type="button"
                    disabled={saving || isIn}
                    onClick={() => {
                      setVerificationMode(card.mode);
                      handlePunch(LogType.IN);
                    }}
                    className="rounded-xl py-2 text-xs font-semibold bg-emerald-100 text-emerald-800 disabled:opacity-50"
                  >
                    Registrar entrada
                  </button>
                  <button
                    type="button"
                    disabled={saving || !isIn || isBreak}
                    onClick={() => {
                      setVerificationMode(card.mode);
                      handlePunch(LogType.BREAK);
                    }}
                    className="rounded-xl py-2 text-xs font-semibold bg-amber-100 text-amber-800 disabled:opacity-50"
                  >
                    Iniciar intervalo
                  </button>
                  <button
                    type="button"
                    disabled={saving || !isBreak}
                    onClick={() => {
                      setVerificationMode(card.mode);
                      handlePunch(LogType.IN);
                    }}
                    className="rounded-xl py-2 text-xs font-semibold bg-sky-100 text-sky-800 disabled:opacity-50"
                  >
                    Finalizar intervalo
                  </button>
                  <button
                    type="button"
                    disabled={saving || !isIn}
                    onClick={() => {
                      setVerificationMode(card.mode);
                      handlePunch(LogType.OUT);
                    }}
                    className="rounded-xl py-2 text-xs font-semibold bg-red-100 text-red-800 disabled:opacity-50"
                  >
                    Registrar saida
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-sm text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-2">
        <MapPin className="w-4 h-4 shrink-0" />
        {expandedMethod == null ? (
          <span>Abra um dos cards acima (FOTO, DIGITAL ou MANUAL) para escolher o modo antes de registrar.</span>
        ) : (
          <>
            {verificationMode === 'manual' && manualBypassActive
              ? 'Modo manual: registro sem GPS nem foto obrigatórios (conforme política).'
              : 'Localização enviada automaticamente no registro quando obtida.'}{' '}
            Comprovação escolhida:{' '}
            <strong>
              {verificationMode === 'photo'
                ? 'foto'
                : verificationMode === 'digital'
                  ? 'digital (WebAuthn)'
                  : 'manual'}
            </strong>
            .
          </>
        )}
      </p>

      {proofModalOpen && pendingLogType != null && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Fechar"
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => !saving && closeProofModal()}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="proof-modal-title"
            className="relative z-[101] w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl p-5 md:p-6 space-y-5"
          >
            <h2 id="proof-modal-title" className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Comprovar registro de ponto
            </h2>

            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-800 dark:text-slate-200">
                <MapPin className="w-4 h-4 text-indigo-500 shrink-0" />
                Localização (automática)
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Ao confirmar, o sistema envia a posição junto com a batida (se obtida). Se falhar, use &quot;Tentar localização novamente&quot;.
              </p>
              {typeof window !== 'undefined' && !window.isSecureContext && window.location.hostname !== 'localhost' && (
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  Em HTTP (sem HTTPS), o navegador pode bloquear GPS e câmera. Use HTTPS em produção ou teste em localhost.
                </p>
              )}
              {gpsLoading && <p className="text-sm text-slate-600 dark:text-slate-400">Obtendo localização…</p>}
              {!gpsLoading && geo && (
                <p className="text-sm text-emerald-700 dark:text-emerald-300">
                  Posição obtida (precisão ~{Math.round(geo.accuracy)} m).
                </p>
              )}
              {!gpsLoading && gpsFailReason && (
                <p className="text-sm text-red-700 dark:text-red-300">{geolocationReasonMessage(gpsFailReason)}</p>
              )}
              <button
                type="button"
                disabled={gpsLoading || saving}
                onClick={() => void retryGps()}
                className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline disabled:opacity-50"
              >
                Tentar localização novamente
              </button>
            </div>

            {verificationMode === 'manual' && manualBypassActive && (
              <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/80 dark:bg-amber-900/20 p-4 space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-amber-900 dark:text-amber-200">
                  <Keyboard className="w-4 h-4 shrink-0" />
                  Registro manual
                </div>
                <p className="text-xs text-amber-800 dark:text-amber-300">
                  Confirme abaixo para registrar o ponto sem foto, biometria ou localização obrigatórios. O método será marcado como manual para auditoria.
                </p>
              </div>
            )}

            {verificationMode === 'digital' && (
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-800 dark:text-slate-200">
                  <Fingerprint className="w-4 h-4 text-indigo-500 shrink-0" />
                  Comprovação digital (WebAuthn)
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Na primeira vez, cadastre a biometria neste aparelho; depois, valide com Face ID, Windows Hello ou sensor. Se falhar, use &quot;Usar foto&quot;. Requer HTTPS (exceto localhost).
                </p>
                <div className="flex flex-wrap gap-2 items-center">
                  <button
                    type="button"
                    disabled={saving || webAuthnBusy || hadBiometric}
                    onClick={() => void handleTryWebAuthnInModal()}
                    className="px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium disabled:opacity-50 min-h-[44px]"
                  >
                    {webAuthnBusy ? 'Aguardando…' : hadBiometric ? 'Dispositivo validado' : 'Tentar no dispositivo'}
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => setDigitalFallbackToPhoto(true)}
                    className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 text-sm font-medium min-h-[44px]"
                  >
                    Usar foto
                  </button>
                  {canUseManualPunch && (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => {
                        setVerificationMode('manual');
                        setDigitalFallbackToPhoto(false);
                      }}
                      className="px-4 py-2.5 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50/80 dark:bg-amber-900/30 text-amber-900 dark:text-amber-200 text-sm font-medium min-h-[44px]"
                    >
                      Registro manual
                    </button>
                  )}
                </div>
              </div>
            )}

            {needsCameraPreview && (
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-800 dark:text-slate-200">
                  <Camera className="w-4 h-4 text-sky-500 shrink-0" />
                  {globalSettings?.photo_required
                    ? 'Imagem obrigatória'
                    : verificationMode === 'photo'
                      ? 'Foto (opcional)'
                      : 'Foto de apoio'}
                </div>
                <div className="relative w-full aspect-[4/3] rounded-xl overflow-hidden bg-black">
                  <video ref={modalVideoRef} className="w-full h-full object-cover" playsInline muted autoPlay />
                </div>
                <div className="flex flex-wrap gap-2 items-center">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void handleCapturePhotoClick()}
                    className="px-4 py-2.5 rounded-xl bg-sky-600 text-white text-sm font-medium min-h-[44px]"
                  >
                    Capturar foto
                  </button>
                  {canUseManualPunch && !manualBypassActive && (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => setVerificationMode('manual')}
                      className="px-4 py-2.5 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50/80 dark:bg-amber-900/30 text-amber-900 dark:text-amber-200 text-sm font-medium min-h-[44px]"
                    >
                      Registro manual
                    </button>
                  )}
                  {photoDataUrl && !globalSettings?.photo_required && (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => setPhotoDataUrl(null)}
                      className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 text-sm min-h-[44px]"
                    >
                      Remover foto
                    </button>
                  )}
                </div>
                {photoDataUrl && (
                  <p className="text-xs text-emerald-700 dark:text-emerald-300">Foto pronta para envio.</p>
                )}
              </div>
            )}

            <div className="flex flex-wrap gap-2 justify-end pt-2 border-t border-slate-200 dark:border-slate-700">
              <button
                type="button"
                disabled={saving}
                onClick={() => closeProofModal()}
                className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 text-sm font-medium min-h-[44px]"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={
                  saving ||
                  (gpsLoading && !manualBypassActive) ||
                  (globalSettings?.gps_required === true &&
                    (!geo?.latitude || !geo?.longitude) &&
                    !manualBypassActive) ||
                  (globalSettings?.photo_required === true && !photoDataUrl && !manualBypassActive) ||
                  (verificationMode === 'digital' &&
                    !hadBiometric &&
                    !photoDataUrl &&
                    globalSettings?.photo_required === true &&
                    !manualBypassActive)
                }
                onClick={() => void handleConfirmProof()}
                className="px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-medium disabled:opacity-50 min-h-[44px]"
              >
                {saving ? 'Registrando…' : 'Confirmar e registrar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeClockIn;
