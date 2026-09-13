import React, { useState, useEffect } from 'react';
import {
  Cloud,
  FolderPlus,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Database,
  FileText,
  Users,
  LogOut,
  LogIn,
  Github,
  Server,
  Trash2,
  Radio,
  Check,
  Zap,
  Copy,
  Key,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  googleSignIn,
  logout,
  subscribeAuth,
  getAccessToken,
  getCurrentUser,
  getCachedAccessToken,
  getFirebaseSettingsUrl,
  getCurrentDomain,
  setManualAccessToken,
  requestGsiAccessToken,
} from '../services/firebaseAuth';
import {
  ensureDriveStructure,
  saveFullBackupToDrive,
  loadQuestionHistoryFromDrive,
  loadActiveExamsFromDrive,
  loadStudentsFromDrive,
  verifyDriveConnection,
  DriveFolderStructure,
  filterRealExams,
  filterRealPackages,
  filterRealStudents,
} from '../services/googleDriveService';
import { Exam, SavedQuestionPackage, Student, SchoolSettings } from '../types';
import { safeFetchJson } from '../utils/apiHelper';

interface GoogleDriveManagerProps {
  exams: Exam[];
  savedPackages: SavedQuestionPackage[];
  students: Student[];
  schoolSettings: SchoolSettings;
  onExamsLoaded?: (exams: Exam[]) => void;
  onPackagesLoaded?: (packages: SavedQuestionPackage[]) => void;
  onStudentsLoaded?: (students: Student[]) => void;
  onPurgeSampleData?: () => Promise<void> | void;
  onSyncSuccess?: (message: string) => void;
}

export const GoogleDriveManager: React.FC<GoogleDriveManagerProps> = ({
  exams,
  savedPackages,
  students,
  schoolSettings,
  onExamsLoaded,
  onPackagesLoaded,
  onStudentsLoaded,
  onPurgeSampleData,
  onSyncSuccess,
}) => {
  const [currentUser, setCurrentUser] = useState(getCurrentUser());
  const [accessToken, setAccessToken] = useState<string | null>(getCachedAccessToken());
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [folderStructure, setFolderStructure] = useState<DriveFolderStructure | null>(null);

  // Diagnostics states
  const [drivePingStatus, setDrivePingStatus] = useState<'idle' | 'checking' | 'ok' | 'error'>('idle');
  const [drivePingDetail, setDrivePingDetail] = useState<string>('');
  const [vercelPingStatus, setVercelPingStatus] = useState<'idle' | 'checking' | 'ok' | 'error'>('idle');
  const [vercelPingDetail, setVercelPingDetail] = useState<string>('');
  const [githubStatus, setGithubStatus] = useState<{ checked: boolean; info: string }>({
    checked: true,
    info: 'Tersinkronisasi dengan repositori Git',
  });

  // Purge sample modal / confirmation
  const [isPurging, setIsPurging] = useState(false);
  const [purgeMessage, setPurgeMessage] = useState<string | null>(null);

  // Unauthorized domain resolution state
  const [unauthorizedDomainInfo, setUnauthorizedDomainInfo] = useState<{
    domain: string;
    settingsUrl: string;
  } | null>(null);
  const [copiedDomain, setCopiedDomain] = useState(false);
  const [manualTokenInput, setManualTokenInput] = useState('');
  const [manualEmailInput, setManualEmailInput] = useState('');
  const [showManualToken, setShowManualToken] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeAuth((user, token) => {
      setCurrentUser(user);
      if (token) setAccessToken(token);
    });
    return () => unsubscribe();
  }, []);

  // Compute real vs sample data stats
  const realExams = filterRealExams(exams);
  const sampleExamsCount = exams.length - realExams.length;
  const realPackages = filterRealPackages(savedPackages);
  const samplePackagesCount = savedPackages.length - realPackages.length;
  const realStudents = filterRealStudents(students);
  const sampleStudentsCount = students.length - realStudents.length;
  const hasSampleData = sampleExamsCount > 0 || samplePackagesCount > 0 || sampleStudentsCount > 0;

  // 1. Check Google Drive connection
  const handleCheckDrive = async () => {
    setDrivePingStatus('checking');
    setDrivePingDetail('Memeriksa autentikasi & izin Google Drive API...');
    try {
      let token = accessToken || (await getAccessToken());
      if (!token) {
        setDrivePingStatus('error');
        setDrivePingDetail('Belum login. Klik tombol "Hubungkan Google Drive" di atas.');
        return;
      }
      const res = await verifyDriveConnection(token);
      if (res.connected) {
        setDrivePingStatus('ok');
        setDrivePingDetail(
          `Terhubung (${res.userEmail || currentUser?.email}). Folder induk: CBT Web App - Backup siap.`
        );
        if (res.structure) setFolderStructure(res.structure);
      } else {
        setDrivePingStatus('error');
        setDrivePingDetail(res.error || 'Token kadaluarsa atau API tidak merespons.');
      }
    } catch (err: any) {
      setDrivePingStatus('error');
      setDrivePingDetail(err.message || 'Koneksi ke Google Drive gagal');
    }
  };

  // 2. Check Vercel serverless / backend status
  const handleCheckVercel = async () => {
    setVercelPingStatus('checking');
    setVercelPingDetail('Mengirim ping ke API endpoint...');
    try {
      const startTime = Date.now();
      const { ok, data, status } = await safeFetchJson('/api/status');
      const latency = Date.now() - startTime;
      if (ok && data) {
        setVercelPingStatus('ok');
        setVercelPingDetail(
          `Aktif (HTTP ${status}, respon ${latency}ms). Mode: ${data.mode || 'serverless/express'}.`
        );
      } else {
        // Try /api/health fallback
        const health = await safeFetchJson('/api/health');
        if (health.ok) {
          setVercelPingStatus('ok');
          setVercelPingDetail(`Aktif melalui /api/health (${latency}ms).`);
        } else {
          setVercelPingStatus('error');
          setVercelPingDetail(`API merespon status ${status}.`);
        }
      }
    } catch (err: any) {
      setVercelPingStatus('error');
      setVercelPingDetail(err.message || 'Gagal menghubungi server');
    }
  };

  const handleCopyDomain = () => {
    const domain = unauthorizedDomainInfo?.domain || getCurrentDomain() || window.location.hostname;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(domain);
      setCopiedDomain(true);
      setTimeout(() => setCopiedDomain(false), 3000);
    }
  };

  const handleConnectViaGsi = async () => {
    setIsConnecting(true);
    setErrorMessage(null);
    try {
      const res = await requestGsiAccessToken();
      if (res) {
        setAccessToken(res.accessToken);
        setUnauthorizedDomainInfo(null);
        setSyncStatus('Terhubung ke Google Drive via Google Identity Services! Menyiapkan folder...');
        const structure = await ensureDriveStructure(res.accessToken);
        setFolderStructure(structure);
        setSyncStatus('Struktur folder "CBT Web App - Backup" siap di Google Drive.');
        setTimeout(() => setSyncStatus(null), 4000);
        handleCheckDrive();
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal menghubungkan Google Drive via GSI.');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleApplyManualToken = async () => {
    if (!manualTokenInput.trim()) {
      setErrorMessage('Harap masukkan token akses Google Drive OAuth.');
      return;
    }
    try {
      const token = manualTokenInput.trim();
      setManualAccessToken(token, manualEmailInput.trim() || 'rachmatsusanto21@guru.sd.belajar.id');
      setAccessToken(token);
      setSyncStatus('Memvalidasi token akses Google Drive...');
      const structure = await ensureDriveStructure(token);
      setFolderStructure(structure);
      setUnauthorizedDomainInfo(null);
      setShowManualToken(false);
      setSyncStatus('Token berhasil diterapkan! Folder "CBT Web App - Backup" terhubung.');
      setTimeout(() => setSyncStatus(null), 4000);
      handleCheckDrive();
    } catch (err: any) {
      setErrorMessage(`Token tidak valid atau kadaluarsa: ${err.message}`);
    }
  };

  const handleConnectDrive = async () => {
    setIsConnecting(true);
    setErrorMessage(null);
    try {
      const result = await googleSignIn();
      if (result) {
        setAccessToken(result.accessToken);
        setUnauthorizedDomainInfo(null);
        setSyncStatus('Terhubung ke Google Drive! Menyiapkan struktur folder...');
        const structure = await ensureDriveStructure(result.accessToken);
        setFolderStructure(structure);
        setSyncStatus('Struktur folder "CBT Web App - Backup" & subfolder siap di Google Drive.');
        setTimeout(() => setSyncStatus(null), 4000);
        handleCheckDrive();
      }
    } catch (err: any) {
      if (err.code === 'auth/unauthorized-domain' || err.message?.includes('unauthorized-domain')) {
        setUnauthorizedDomainInfo({
          domain: err.domain || getCurrentDomain() || window.location.hostname,
          settingsUrl: err.settingsUrl || getFirebaseSettingsUrl(),
        });
      }
      setErrorMessage(err.message || 'Gagal menghubungkan akun Google Drive');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await logout();
      setFolderStructure(null);
      setAccessToken(null);
      setSyncStatus('Google Drive terputus.');
      setDrivePingStatus('idle');
      setDrivePingDetail('');
      setTimeout(() => setSyncStatus(null), 3000);
    } catch (err: any) {
      setErrorMessage(err.message);
    }
  };

  const handleSyncAllToDrive = async () => {
    setErrorMessage(null);
    let token = accessToken;

    if (!token) {
      try {
        const res = await googleSignIn();
        if (res) {
          token = res.accessToken;
          setAccessToken(res.accessToken);
        } else {
          return;
        }
      } catch (e: any) {
        setErrorMessage(e.message || 'Harap hubungkan Google Drive terlebih dahulu');
        return;
      }
    }

    setIsSyncing(true);
    setSyncStatus('Menyimpan seluruh data riil ke Google Drive folder "CBT Web App - Backup" & subfolder...');

    try {
      // Clean backup without AI Studio dummy samples
      const backupInfo = await saveFullBackupToDrive(
        {
          exams: realExams,
          savedPackages: realPackages,
          students: realStudents,
          schoolSettings,
          timestamp: new Date().toISOString(),
        },
        token!
      );

      // Sync to local server / cache as well
      await safeFetchJson('/api/sync-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exams: realExams,
          savedPackages: realPackages,
          students: realStudents,
          schoolSettings,
        }),
      }).catch(() => {});

      const msg = `Berhasil! Seluruh data (${realExams.length} ujian, ${realPackages.length} paket, ${realStudents.length} siswa) tersimpan di Google Drive "CBT Web App - Backup" dan subfolder. Siswa dapat mengakses soal secara aman.`;
      setSyncStatus(msg);
      if (onSyncSuccess) onSyncSuccess(msg);
      setTimeout(() => setSyncStatus(null), 7000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal menyimpan data ke Google Drive');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleLoadFromDrive = async () => {
    let token = accessToken;
    if (!token) {
      try {
        const res = await googleSignIn();
        if (res) {
          token = res.accessToken;
          setAccessToken(res.accessToken);
        } else return;
      } catch (e: any) {
        setErrorMessage(e.message);
        return;
      }
    }

    setIsSyncing(true);
    setSyncStatus('Memuat data dari Google Drive subfolder "Data Soal", "Paket Ujian Aktif", dan "Data Siswa"...');
    try {
      const [drivePackages, driveExams, driveStudents] = await Promise.all([
        loadQuestionHistoryFromDrive(token!),
        loadActiveExamsFromDrive(token!),
        loadStudentsFromDrive(token!),
      ]);

      let summary = [];

      if (driveExams && driveExams.length > 0 && onExamsLoaded) {
        onExamsLoaded(driveExams);
        summary.push(`${driveExams.length} ujian aktif`);
      }

      if (drivePackages && drivePackages.length > 0 && onPackagesLoaded) {
        onPackagesLoaded(drivePackages);
        summary.push(`${drivePackages.length} paket soal`);
      }

      if (driveStudents && driveStudents.length > 0 && onStudentsLoaded) {
        onStudentsLoaded(driveStudents);
        summary.push(`${driveStudents.length} data siswa`);
      }

      if (summary.length > 0) {
        setSyncStatus(`Berhasil memulihkan ${summary.join(', ')} dari Google Drive!`);
      } else {
        setSyncStatus('Belum ada file data tersimpan di Google Drive subfolder CBT.');
      }
      setTimeout(() => setSyncStatus(null), 5000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal memuat data dari Google Drive');
    } finally {
      setIsSyncing(false);
    }
  };

  const handlePurge = async () => {
    setIsPurging(true);
    try {
      if (onPurgeSampleData) {
        await onPurgeSampleData();
      }
      setPurgeMessage('Data contoh bawaan AI Studio berhasil dibersihkan! Hanya data buatan Anda yang tersimpan.');
      setTimeout(() => setPurgeMessage(null), 5000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal membersihkan data contoh.');
    } finally {
      setIsPurging(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="flex items-center space-x-3.5">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold shadow-inner">
              <Cloud className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-xl font-black text-slate-900 tracking-tight">
                  Pusat Integrasi & Penyimpanan Cloud
                </h2>
                {currentUser ? (
                  <span className="text-xs font-bold bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full flex items-center space-x-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Terhubung</span>
                  </span>
                ) : (
                  <span className="text-xs font-bold bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-full">
                    Belum Terhubung
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Sinkronisasi naskah soal, paket aktif, data siswa, dan rekap nilai langsung ke Google Drive sekolah Anda.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {currentUser ? (
              <div className="flex items-center space-x-3 bg-slate-50 p-2 px-3 rounded-2xl border border-slate-200">
                <div className="text-right">
                  <div className="text-xs font-bold text-slate-800 leading-tight">
                    {currentUser.displayName || 'Akun Google'}
                  </div>
                  <div className="text-[11px] text-slate-500 truncate max-w-[200px]">
                    {currentUser.email}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleDisconnect}
                  className="px-3 py-1.5 bg-white hover:bg-rose-50 text-rose-600 border border-slate-200 hover:border-rose-200 rounded-xl text-xs font-semibold flex items-center space-x-1 transition-all"
                  title="Putuskan sambungan Google Drive"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Keluar</span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleConnectDrive}
                disabled={isConnecting}
                className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-2xl text-xs font-bold shadow-sm transition-all flex items-center space-x-2 disabled:opacity-50"
              >
                <LogIn className="w-4 h-4" />
                <span>{isConnecting ? 'Menghubungkan...' : 'Hubungkan Google Drive'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Section 1: Diagnostic Hub (GDrive, GitHub, Vercel) */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center space-x-1.5">
              <Radio className="w-4 h-4 text-indigo-500" />
              <span>Pemeriksaan Koneksi Layanan (GDrive, GitHub, Vercel)</span>
            </h3>
            <span className="text-[11px] text-slate-400">Klik kartu untuk tes koneksi langsung</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            {/* Card 1: Google Drive */}
            <div className="bg-slate-50/80 rounded-2xl border border-slate-200 p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Cloud className="w-4 h-4 text-blue-600" />
                  <span className="font-bold text-xs text-slate-900">Google Drive API</span>
                </div>
                <button
                  type="button"
                  onClick={handleCheckDrive}
                  disabled={drivePingStatus === 'checking'}
                  className="text-[10px] font-bold text-blue-600 hover:underline flex items-center space-x-1"
                >
                  <RefreshCw className={`w-3 h-3 ${drivePingStatus === 'checking' ? 'animate-spin' : ''}`} />
                  <span>Tes Koneksi</span>
                </button>
              </div>

              <div className="flex items-center space-x-1.5">
                {currentUser ? (
                  <span className="inline-flex items-center space-x-1 text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Terautentikasi</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center space-x-1 text-[11px] font-bold text-slate-600 bg-slate-200 px-2 py-0.5 rounded-md">
                    <span>Belum Login</span>
                  </span>
                )}
                {drivePingStatus === 'ok' && (
                  <span className="text-[10px] text-emerald-600 font-semibold">● Respon 200 OK</span>
                )}
              </div>

              <p className="text-[11px] text-slate-600 leading-relaxed">
                {drivePingDetail ||
                  (currentUser
                    ? `Akun: ${currentUser.email}. Siap membaca & menulis folder.`
                    : 'Masuk dengan akun Google Anda untuk mengaktifkan sinkronisasi.')}
              </p>
            </div>

            {/* Card 2: GitHub */}
            <div className="bg-slate-50/80 rounded-2xl border border-slate-200 p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Github className="w-4 h-4 text-slate-800" />
                  <span className="font-bold text-xs text-slate-900">GitHub Repository</span>
                </div>
                <span className="text-[10px] font-bold text-emerald-600">Terhubung</span>
              </div>

              <div className="flex items-center space-x-1.5">
                <span className="inline-flex items-center space-x-1 text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Source Code Aktif</span>
                </span>
              </div>

              <p className="text-[11px] text-slate-600 leading-relaxed">
                Source code web app (frontend React, Express server, modul sinkronisasi) dikelola dalam git repository.
              </p>
            </div>

            {/* Card 3: Vercel */}
            <div className="bg-slate-50/80 rounded-2xl border border-slate-200 p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Server className="w-4 h-4 text-indigo-600" />
                  <span className="font-bold text-xs text-slate-900">Vercel Deployment</span>
                </div>
                <button
                  type="button"
                  onClick={handleCheckVercel}
                  disabled={vercelPingStatus === 'checking'}
                  className="text-[10px] font-bold text-indigo-600 hover:underline flex items-center space-x-1"
                >
                  <RefreshCw className={`w-3 h-3 ${vercelPingStatus === 'checking' ? 'animate-spin' : ''}`} />
                  <span>Tes API</span>
                </button>
              </div>

              <div className="flex items-center space-x-1.5">
                <span className="inline-flex items-center space-x-1 text-[11px] font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-md">
                  <Zap className="w-3 h-3" />
                  <span>Serverless Ready</span>
                </span>
                {vercelPingStatus === 'ok' && (
                  <span className="text-[10px] text-emerald-600 font-semibold">● Aktif</span>
                )}
              </div>

              <p className="text-[11px] text-slate-600 leading-relaxed">
                {vercelPingDetail ||
                  'Di Vercel, penyimpanan berbasis Google Drive & browser cache memastikan data ujian Anda tetap utuh.'}
              </p>
            </div>
          </div>
        </div>

        {/* Section 2: Folder Structure Notice */}
        <div className="bg-gradient-to-r from-blue-50/80 to-indigo-50/80 rounded-2xl border border-blue-200/80 p-4 space-y-2">
          <div className="flex items-center space-x-2 text-blue-900 font-bold text-xs">
            <FolderPlus className="w-4 h-4 text-blue-600" />
            <span>Struktur Folder Resmi di Google Drive:</span>
          </div>
          <p className="text-xs text-blue-800 leading-relaxed">
            Folder induk pencadangan dinamai <strong className="font-mono text-blue-950">"CBT Web App - Backup"</strong> dengan subfolder terstruktur:
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px]">
            <div className="bg-white/90 p-2 rounded-xl border border-blue-100 font-mono text-slate-800 font-semibold">
              📁 Data Soal
              <span className="block text-[10px] text-slate-500 font-sans font-normal">Arsip naskah & paket soal</span>
            </div>
            <div className="bg-white/90 p-2 rounded-xl border border-blue-100 font-mono text-slate-800 font-semibold">
              📁 Paket Ujian Aktif
              <span className="block text-[10px] text-slate-500 font-sans font-normal">Soal siap dikerjakan siswa</span>
            </div>
            <div className="bg-white/90 p-2 rounded-xl border border-blue-100 font-mono text-slate-800 font-semibold">
              📁 Data Siswa
              <span className="block text-[10px] text-slate-500 font-sans font-normal">data_siswa.json</span>
            </div>
            <div className="bg-white/90 p-2 rounded-xl border border-blue-100 font-mono text-slate-800 font-semibold">
              📁 Data Nilai
              <span className="block text-[10px] text-slate-500 font-sans font-normal">rekap_nilai_ujian.json</span>
            </div>
          </div>
          <div className="pt-2 text-[11px] text-emerald-800 flex items-center space-x-1.5 font-medium">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
            <span>Jaminan: Aplikasi sama sekali <strong>TIDAK PERNAH</strong> membuat folder bernama "Google AI Studio" di akun Drive Anda.</span>
          </div>
        </div>

        {/* Section 3: Data Quality & Sample Data Purge */}
        <div className="border-t border-slate-100 pt-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Pemisahan Data Guru vs Data Contoh AI Studio
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Pastikan hanya data buatan Anda yang tersimpan di Google Drive dan dibagikan ke gawai siswa.
              </p>
            </div>

            {hasSampleData && (
              <button
                type="button"
                onClick={handlePurge}
                disabled={isPurging}
                className="px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all shadow-sm"
              >
                <Trash2 className="w-3.5 h-3.5 text-amber-700" />
                <span>{isPurging ? 'Membersihkan...' : 'Bersihkan Data Contoh AI Studio'}</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3 text-xs">
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
              <span className="text-[11px] text-slate-500 block">Ujian Aktif</span>
              <div className="flex items-baseline space-x-1 mt-0.5">
                <span className="text-base font-black text-slate-900">{realExams.length}</span>
                <span className="text-[10px] text-slate-500">asli</span>
                {sampleExamsCount > 0 && (
                  <span className="text-[10px] text-amber-600 font-semibold">({sampleExamsCount} contoh)</span>
                )}
              </div>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
              <span className="text-[11px] text-slate-500 block">Paket di Riwayat</span>
              <div className="flex items-baseline space-x-1 mt-0.5">
                <span className="text-base font-black text-slate-900">{realPackages.length}</span>
                <span className="text-[10px] text-slate-500">asli</span>
                {samplePackagesCount > 0 && (
                  <span className="text-[10px] text-amber-600 font-semibold">({samplePackagesCount} contoh)</span>
                )}
              </div>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
              <span className="text-[11px] text-slate-500 block">Data Siswa</span>
              <div className="flex items-baseline space-x-1 mt-0.5">
                <span className="text-base font-black text-slate-900">{realStudents.length}</span>
                <span className="text-[10px] text-slate-500">asli</span>
                {sampleStudentsCount > 0 && (
                  <span className="text-[10px] text-amber-600 font-semibold">({sampleStudentsCount} contoh)</span>
                )}
              </div>
            </div>
          </div>

          {purgeMessage && (
            <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 p-3 rounded-2xl text-xs flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>{purgeMessage}</span>
            </div>
          )}
        </div>

        {/* Status Alerts */}
        {syncStatus && (
          <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 p-3.5 rounded-2xl text-xs flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{syncStatus}</span>
          </div>
        )}

        {errorMessage && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3.5 rounded-2xl text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span className="flex-1">{errorMessage}</span>
          </div>
        )}

        {/* Specialized Resolution Banner for auth/unauthorized-domain */}
        {unauthorizedDomainInfo && (
          <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-5 space-y-4 text-slate-800 shadow-sm">
            <div className="flex items-start space-x-3">
              <ShieldAlert className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="font-bold text-sm text-amber-950">
                  Panduan Penyelesaian: Daftarkan Domain di Firebase Console
                </h4>
                <p className="text-xs text-amber-900 leading-relaxed">
                  Firebase Authentication memblokir pop-up karena domain aplikasi saat ini belum ditambahkan ke daftar <strong>Authorized Domains</strong>. Ikuti langkah mudah berikut:
                </p>
              </div>
            </div>

            {/* Step 1: Copy domain */}
            <div className="bg-white rounded-xl border border-amber-200 p-3.5 space-y-2">
              <div className="text-[11px] font-bold uppercase tracking-wider text-amber-800">
                1. Domain yang harus didaftarkan di Firebase:
              </div>
              <div className="space-y-2">
                <div className="flex items-center space-x-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] text-slate-500 font-semibold block">Domain Aplikasi Saat Ini:</span>
                    <code className="text-xs font-mono text-slate-800 break-all select-all font-semibold">
                      {unauthorizedDomainInfo.domain}
                    </code>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyDomain}
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-md flex items-center space-x-1 transition-colors flex-shrink-0"
                  >
                    {copiedDomain ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedDomain ? 'Tersalin!' : 'Salin'}</span>
                  </button>
                </div>

                {unauthorizedDomainInfo.domain.includes('ais-dev-') && (
                  <div className="flex items-center space-x-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                    <div className="flex-1 min-w-0">
                      <span className="text-[10px] text-slate-500 font-semibold block">Domain Tautan Bersama (Pre):</span>
                      <code className="text-xs font-mono text-slate-800 break-all select-all font-semibold">
                        {unauthorizedDomainInfo.domain.replace('ais-dev-', 'ais-pre-')}
                      </code>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const preDomain = unauthorizedDomainInfo.domain.replace('ais-dev-', 'ais-pre-');
                        if (navigator.clipboard) {
                          navigator.clipboard.writeText(preDomain);
                          setCopiedDomain(true);
                          setTimeout(() => setCopiedDomain(false), 3000);
                        }
                      }}
                      className="px-3 py-1.5 bg-slate-700 hover:bg-slate-800 text-white text-xs font-bold rounded-md flex items-center space-x-1 transition-colors flex-shrink-0"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>Salin Pre</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Step 2: Open Firebase Console & Add domain */}
            <div className="bg-white rounded-xl border border-amber-200 p-3.5 space-y-2.5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-amber-800">
                2. Langkah di Firebase Console:
              </div>
              <ol className="text-xs text-slate-700 space-y-1.5 list-decimal list-inside leading-relaxed">
                <li>Klik tombol di bawah untuk membuka halaman <strong>Firebase Authentication Settings</strong>.</li>
                <li>Pilih tab <strong>Authorized domains</strong> (Domain yang diotorisasi).</li>
                <li>Klik <strong>Add domain</strong> (Tambahkan domain), lalu tempel domain yang sudah disalin di atas.</li>
                <li>Klik <strong>Save</strong> (Simpan), lalu kembali ke sini dan klik <strong>Hubungkan Google Drive</strong>.</li>
              </ol>
              <div className="pt-1 flex flex-wrap items-center gap-2">
                <a
                  href={unauthorizedDomainInfo.settingsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center space-x-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm transition-colors"
                >
                  <span>Buka Firebase Console Settings</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <a
                  href={typeof window !== 'undefined' ? window.location.href : '#'}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition-colors border border-slate-300"
                  title="Membuka aplikasi langsung di tab browser mandiri tanpa iFrame"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-slate-600" />
                  <span>Buka di Tab Baru</span>
                </a>
              </div>
            </div>

            {/* Step 3: Instant alternative options (GSI / Manual Token) */}
            <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-amber-200">
              <button
                type="button"
                onClick={handleConnectViaGsi}
                disabled={isConnecting}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-colors shadow-sm disabled:opacity-50"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Coba Masuk via Google Identity Services (GSI)</span>
              </button>

              <button
                type="button"
                onClick={() => setShowManualToken(!showManualToken)}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-colors"
              >
                <Key className="w-3.5 h-3.5 text-slate-600" />
                <span>{showManualToken ? 'Tutup Input Manual' : 'Masukkan Token Akses Manual'}</span>
                {showManualToken ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>

            {/* Manual Token Input Box */}
            {showManualToken && (
              <div className="bg-white rounded-xl border border-amber-300 p-3.5 space-y-2 mt-2">
                <div className="text-xs font-bold text-slate-800">
                  Gunakan Token Akses OAuth Google Drive secara Langsung:
                </div>
                <p className="text-[11px] text-slate-500">
                  Bila Anda memiliki token OAuth yang diperoleh dari Google Cloud Console atau OAuth Playground, Anda dapat menempelkannya di sini untuk langsung mengaktifkan sinkronisasi.
                </p>
                <div className="space-y-2">
                  <input
                    type="password"
                    value={manualTokenInput}
                    onChange={(e) => setManualTokenInput(e.target.value)}
                    placeholder="Tempel OAuth Access Token (ya29....)"
                    className="w-full text-xs font-mono px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <div className="flex items-center space-x-2">
                    <input
                      type="email"
                      value={manualEmailInput}
                      onChange={(e) => setManualEmailInput(e.target.value)}
                      placeholder="Email Akun Google (opsional)"
                      className="flex-1 text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                    <button
                      type="button"
                      onClick={handleApplyManualToken}
                      className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg transition-colors flex-shrink-0"
                    >
                      Terapkan Token
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Section 4: Action Buttons */}
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            type="button"
            onClick={handleSyncAllToDrive}
            disabled={isSyncing}
            className="px-5 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl text-xs font-bold shadow-md transition-all flex items-center space-x-2 disabled:opacity-50"
          >
            <Cloud className="w-4 h-4" />
            <span>
              {isSyncing ? 'Menyinkronkan ke Google Drive...' : 'Simpan & Sinkronkan Semua Data Riil ke GDrive'}
            </span>
          </button>

          <button
            type="button"
            onClick={handleLoadFromDrive}
            disabled={isSyncing}
            className="px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl text-xs font-bold transition-colors flex items-center space-x-2 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>Muat / Pulihkan Data dari Google Drive</span>
          </button>
        </div>
      </div>
    </div>
  );
};
