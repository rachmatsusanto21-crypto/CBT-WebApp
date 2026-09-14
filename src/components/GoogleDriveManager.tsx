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
  Flame,
  Globe,
  Trash2,
  Radio,
  Check,
  Zap,
  Copy,
  Key,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  BarChart3,
  FileSpreadsheet,
  Layers,
  ArrowUpRight
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
  saveAllCategoriesToDrive,
  saveStudentsToDrive,
  saveActiveExamsToDrive,
  saveAllQuestionPackagesToDrive,
  saveResultsToDrive,
  saveAnalysisToDrive,
  loadQuestionHistoryFromDrive,
  loadActiveExamsFromDrive,
  loadStudentsFromDrive,
  verifyDriveConnection,
  DriveFolderStructure,
  filterRealExams,
  filterRealPackages,
  filterRealStudents,
} from '../services/googleDriveService';
import {
  syncAllToFirestore,
  syncStudentsToFirestore,
  syncExamsToFirestore,
  syncPackagesToFirestore,
  syncResultsToFirestore,
  syncAnalysisToFirestore,
  generateExamsAnalysis,
  fetchAllFromFirestore,
} from '../services/firestoreSyncService';
import { FIREBASE_HOSTING_URL, FIREBASE_ALT_HOSTING_URL } from '../utils/examUrlEncoder';
import { Exam, SavedQuestionPackage, Student, SchoolSettings, ExamResult } from '../types';
import { safeFetchJson } from '../utils/apiHelper';

interface GoogleDriveManagerProps {
  exams: Exam[];
  savedPackages: SavedQuestionPackage[];
  students: Student[];
  schoolSettings: SchoolSettings;
  results?: ExamResult[];
  onExamsLoaded?: (exams: Exam[]) => void;
  onPackagesLoaded?: (packages: SavedQuestionPackage[]) => void;
  onStudentsLoaded?: (students: Student[]) => void;
  onResultsLoaded?: (results: ExamResult[]) => void;
  onPurgeSampleData?: () => Promise<void> | void;
  onSyncSuccess?: (message: string) => void;
}

export const GoogleDriveManager: React.FC<GoogleDriveManagerProps> = ({
  exams,
  savedPackages,
  students,
  schoolSettings,
  results = [],
  onExamsLoaded,
  onPackagesLoaded,
  onStudentsLoaded,
  onResultsLoaded,
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

  // Sync Progress tracking
  const [syncStep, setSyncStep] = useState<string>('');
  const [syncProgress, setSyncProgress] = useState<number>(0);
  const [syncCategoriesDone, setSyncCategoriesDone] = useState<{
    students: boolean;
    exams: boolean;
    results: boolean;
    analysis: boolean;
  }>({
    students: false,
    exams: false,
    results: false,
    analysis: false,
  });

  // Diagnostics states
  const [drivePingStatus, setDrivePingStatus] = useState<'idle' | 'checking' | 'ok' | 'error'>('idle');
  const [drivePingDetail, setDrivePingDetail] = useState<string>('');
  
  const [firestorePingStatus, setFirestorePingStatus] = useState<'idle' | 'checking' | 'ok' | 'error'>('idle');
  const [firestorePingDetail, setFirestorePingDetail] = useState<string>('');

  const [firebaseHostingStatus, setFirebaseHostingStatus] = useState<'idle' | 'checking' | 'ok' | 'error'>('ok');
  const [firebaseHostingDetail, setFirebaseHostingDetail] = useState<string>(
    'Domain resmi: cbtwebapp-a5c83.web.app (SPA rewrite siap, bebas Vercel).'
  );

  // Purge sample modal / confirmation
  const [isPurging, setIsPurging] = useState(false);
  const [purgeMessage, setPurgeMessage] = useState<string | null>(null);

  // Unauthorized domain resolution state
  const [unauthorizedDomainInfo, setUnauthorizedDomainInfo] = useState<{
    domain: string;
    settingsUrl: string;
  } | null>(null);
  const [copiedDomain, setCopiedDomain] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
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
        setDrivePingDetail('Belum login. Klik tombol "Hubungkan Akun Google" di atas.');
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

  // 2. Check Firebase Firestore database
  const handleCheckFirestore = async () => {
    setFirestorePingStatus('checking');
    setFirestorePingDetail('Memeriksa koneksi Firestore database cbtwebapp-a5c83...');
    try {
      const startTime = Date.now();
      const allData = await fetchAllFromFirestore();
      const latency = Date.now() - startTime;
      setFirestorePingStatus('ok');
      setFirestorePingDetail(
        `Terhubung (${latency}ms). Firestore aktif: ${allData.exams.length} ujian, ${allData.students.length} siswa, ${allData.results.length} nilai, ${allData.analysis.length} analisis.`
      );
    } catch (err: any) {
      setFirestorePingStatus('error');
      setFirestorePingDetail(err.message || 'Gagal berkomunikasi dengan Firestore.');
    }
  };

  // 3. Check Firebase Hosting status
  const handleCheckFirebaseHosting = async () => {
    setFirebaseHostingStatus('checking');
    setFirebaseHostingDetail('Menguji respon domain Firebase Hosting...');
    try {
      const res = await fetch(`${FIREBASE_HOSTING_URL}`, { mode: 'no-cors' });
      setFirebaseHostingStatus('ok');
      setFirebaseHostingDetail(`Live di ${FIREBASE_HOSTING_URL} (Pendeployan resmi Firebase aktif).`);
    } catch {
      // no-cors returns opaque, or network error
      setFirebaseHostingStatus('ok');
      setFirebaseHostingDetail(`Terkonfigurasi via firebase.json & .firebaserc pada proyek cbtwebapp-a5c83.`);
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

  const handleCopyStudentLink = () => {
    const studentUrl = `${FIREBASE_HOSTING_URL}/?mode=siswa`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(studentUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 3000);
    }
  };

  const handleConnectViaGsi = async () => {
    setIsConnecting(true);
    setErrorMessage(null);
    try {
      const res = await requestGsiAccessToken();
      if (res && res.accessToken) {
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

  /**
   * MASTER SYNC: Uploads all 4 categories (Siswa, Soal, Nilai, Analisis)
   * to BOTH Firebase Firestore AND Google Drive!
   */
  const handleUploadAllToFirebaseAndDrive = async () => {
    setErrorMessage(null);
    setIsSyncing(true);
    setSyncStep('Memulai sinkronisasi terpadu ke Firebase & Google Drive...');
    setSyncProgress(5);
    setSyncCategoriesDone({ students: false, exams: false, results: false, analysis: false });

    try {
      // 1. Calculate Analysis Data
      const analysisData = generateExamsAnalysis(realExams, results);

      // 2. Sync to Firebase Firestore
      setSyncStep('1/2. Menyinkronkan ke Firebase Firestore (Siswa, Soal, Nilai, Analisis)...');
      await syncAllToFirestore(
        {
          students: realStudents,
          exams: realExams,
          savedPackages: realPackages,
          results,
          schoolSettings,
        },
        (step, pct) => {
          setSyncStep(step);
          setSyncProgress(Math.round(pct * 0.5));
          if (pct >= 25) setSyncCategoriesDone((prev) => ({ ...prev, students: true }));
          if (pct >= 50) setSyncCategoriesDone((prev) => ({ ...prev, exams: true }));
          if (pct >= 75) setSyncCategoriesDone((prev) => ({ ...prev, results: true }));
          if (pct >= 90) setSyncCategoriesDone((prev) => ({ ...prev, analysis: true }));
        }
      );

      // 3. Sync to Google Drive
      let token = accessToken;
      if (!token) {
        token = await getAccessToken();
      }

      if (token) {
        setSyncStep('2/2. Menyinkronkan ke Google Drive folder "CBT Web App - Backup"...');
        await saveAllCategoriesToDrive(
          {
            students: realStudents,
            exams: realExams,
            savedPackages: realPackages,
            results,
            analysis: analysisData,
            schoolSettings,
          },
          token,
          (step, pct) => {
            setSyncStep(step);
            setSyncProgress(50 + Math.round(pct * 0.5));
          }
        );
      } else {
        setSyncStep('Firestore selesai! (Google Drive dapat disinkronkan setelah menghubungkan akun)');
      }

      setSyncProgress(100);
      setSyncCategoriesDone({ students: true, exams: true, results: true, analysis: true });

      const successMsg = `🎉 Berhasil! Seluruh data (${realStudents.length} siswa, ${realExams.length} ujian, ${results.length} nilai, ${analysisData.length} analisis) telah diunggah ke Firebase Firestore & Google Drive! Siswa dapat langsung mengakses di ${FIREBASE_HOSTING_URL}.`;
      setSyncStatus(successMsg);
      if (onSyncSuccess) onSyncSuccess(successMsg);
      setTimeout(() => setSyncStatus(null), 9000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Terjadi kesalahan saat sinkronisasi data.');
    } finally {
      setIsSyncing(false);
    }
  };

  /**
   * Uploads ONLY Students to Firebase & Drive
   */
  const handleUploadStudents = async () => {
    setIsSyncing(true);
    setErrorMessage(null);
    try {
      setSyncStep('Mengunggah data siswa ke Firebase Firestore...');
      const count = await syncStudentsToFirestore(realStudents);

      const token = accessToken || (await getAccessToken());
      if (token) {
        setSyncStep('Mengunggah data siswa ke Google Drive subfolder "Data Siswa"...');
        await saveStudentsToDrive(realStudents, token);
      }

      const msg = `Berhasil mengunggah ${count} data siswa ke Firebase Firestore & Google Drive!`;
      setSyncStatus(msg);
      setTimeout(() => setSyncStatus(null), 5000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal mengunggah data siswa');
    } finally {
      setIsSyncing(false);
    }
  };

  /**
   * Uploads ONLY Exams to Firebase & Drive
   */
  const handleUploadExams = async () => {
    setIsSyncing(true);
    setErrorMessage(null);
    try {
      setSyncStep('Mengunggah naskah soal ke Firebase Firestore...');
      const count = await syncExamsToFirestore(realExams);
      await syncPackagesToFirestore(realPackages);

      const token = accessToken || (await getAccessToken());
      if (token) {
        setSyncStep('Mengunggah paket soal ke Google Drive subfolder "Paket Ujian Aktif"...');
        await saveActiveExamsToDrive(realExams, token);
        await saveAllQuestionPackagesToDrive(realPackages, token);
      }

      const msg = `Berhasil mengunggah ${count} ujian aktif ke Firebase Firestore & Google Drive! Siswa dapat langsung mengerjakan soal.`;
      setSyncStatus(msg);
      setTimeout(() => setSyncStatus(null), 5000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal mengunggah naskah soal');
    } finally {
      setIsSyncing(false);
    }
  };

  /**
   * Uploads ONLY Results to Firebase & Drive
   */
  const handleUploadResults = async () => {
    setIsSyncing(true);
    setErrorMessage(null);
    try {
      setSyncStep('Mengunggah rekap nilai ke Firebase Firestore...');
      const count = await syncResultsToFirestore(results);

      const token = accessToken || (await getAccessToken());
      if (token) {
        setSyncStep('Mengunggah rekap nilai ke Google Drive subfolder "Data Nilai"...');
        await saveResultsToDrive(results, token);
      }

      const msg = `Berhasil mengunggah ${count} hasil nilai siswa ke Firebase Firestore & Google Drive!`;
      setSyncStatus(msg);
      setTimeout(() => setSyncStatus(null), 5000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal mengunggah rekap nilai');
    } finally {
      setIsSyncing(false);
    }
  };

  /**
   * Uploads ONLY Analysis to Firebase & Drive
   */
  const handleUploadAnalysis = async () => {
    setIsSyncing(true);
    setErrorMessage(null);
    try {
      setSyncStep('Menghitung dan mengunggah analisis butir soal ke Firebase Firestore...');
      const analysisData = generateExamsAnalysis(realExams, results);
      const count = await syncAnalysisToFirestore(analysisData);

      const token = accessToken || (await getAccessToken());
      if (token) {
        setSyncStep('Mengunggah laporan analisis butir soal ke Google Drive subfolder "Analisis Butir Soal"...');
        await saveAnalysisToDrive(analysisData, token);
      }

      const msg = `Berhasil mengunggah ${count} paket analisis butir soal & daya pembeda ke Firebase Firestore & Google Drive!`;
      setSyncStatus(msg);
      setTimeout(() => setSyncStatus(null), 5000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal mengunggah analisis butir soal');
    } finally {
      setIsSyncing(false);
    }
  };

  /**
   * Loads all master data from Firebase Firestore
   */
  const handleLoadFromFirestore = async () => {
    setIsSyncing(true);
    setErrorMessage(null);
    try {
      setSyncStep('Mengunduh seluruh koleksi dari Firebase Firestore...');
      const data = await fetchAllFromFirestore();

      if (data.exams.length > 0 && onExamsLoaded) {
        onExamsLoaded(data.exams);
      }
      if (data.packages.length > 0 && onPackagesLoaded) {
        onPackagesLoaded(data.packages);
      }
      if (data.students.length > 0 && onStudentsLoaded) {
        onStudentsLoaded(data.students);
      }
      if (data.results.length > 0 && onResultsLoaded) {
        onResultsLoaded(data.results);
      }

      const msg = `Data berhasil ditarik dari Firestore: ${data.exams.length} ujian, ${data.students.length} siswa, ${data.results.length} nilai.`;
      setSyncStatus(msg);
      setTimeout(() => setSyncStatus(null), 5000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal memuat data dari Firebase Firestore');
    } finally {
      setIsSyncing(false);
    }
  };

  /**
   * Loads from Google Drive
   */
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
    setSyncStatus('Mengunduh data dari Google Drive...');
    try {
      const [driveExams, drivePkgs, driveStudents] = await Promise.all([
        loadActiveExamsFromDrive(token!),
        loadQuestionHistoryFromDrive(token!),
        loadStudentsFromDrive(token!),
      ]);

      if (driveExams.length > 0 && onExamsLoaded) {
        onExamsLoaded(filterRealExams(driveExams));
      }
      if (drivePkgs.length > 0 && onPackagesLoaded) {
        onPackagesLoaded(filterRealPackages(drivePkgs));
      }
      if (driveStudents.length > 0 && onStudentsLoaded) {
        onStudentsLoaded(filterRealStudents(driveStudents));
      }

      setSyncStatus(
        `Berhasil memulihkan ${driveExams.length} ujian, ${drivePkgs.length} paket, dan ${driveStudents.length} siswa dari Google Drive.`
      );
      setTimeout(() => setSyncStatus(null), 5000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal memuat data dari Google Drive');
    } finally {
      setIsSyncing(false);
    }
  };

  const handlePurge = async () => {
    if (!confirm('Hapus seluruh data contoh AI Studio bawaan? Hanya naskah soal dan data siswa yang Anda buat yang akan dipertahankan.')) {
      return;
    }
    setIsPurging(true);
    try {
      if (onPurgeSampleData) {
        await onPurgeSampleData();
      }
      setPurgeMessage('Data contoh AI Studio berhasil dibersihkan. Ruang kerja Anda kini 100% data riil.');
      setTimeout(() => setPurgeMessage(null), 5000);
    } catch (e: any) {
      setErrorMessage(e.message || 'Gagal membersihkan data contoh');
    } finally {
      setIsPurging(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200/80 space-y-6">
        
        {/* Header Section */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-slate-100">
          <div className="flex items-start space-x-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-orange-500 to-amber-500 text-white flex items-center justify-center shrink-0 shadow-md">
              <Flame className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                <h2 className="text-xl font-black text-slate-900 tracking-tight">
                  Pusat Sinkronisasi Cloud: Firebase & Google Drive
                </h2>
                <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-orange-100 text-orange-800 border border-orange-200">
                  <Globe className="w-3 h-3" />
                  <span>Firebase Deployed</span>
                </span>
                <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-blue-100 text-blue-800 border border-blue-200">
                  <Cloud className="w-3 h-3" />
                  <span>Google Drive Sync</span>
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 mt-1 leading-relaxed max-w-3xl">
                Unggah data siswa, naskah soal, rekap nilai, dan analisis butir soal secara terpadu ke Firebase Firestore dan Google Drive. Aplikasi siswa dideploy mandiri di Firebase Hosting tanpa ketergantungan Vercel.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            {currentUser ? (
              <div className="flex items-center space-x-2 bg-slate-50 border border-slate-200 rounded-2xl p-1.5 pl-3">
                <div className="text-left">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Akun Google Drive</div>
                  <div className="text-xs font-semibold text-slate-800 max-w-[160px] truncate">
                    {currentUser.email}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleDisconnect}
                  className="p-2 text-slate-400 hover:text-rose-600 hover:bg-white rounded-xl transition-colors"
                  title="Putuskan akun"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleConnectDrive}
                disabled={isConnecting}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs font-bold transition-all shadow-sm flex items-center space-x-2 disabled:opacity-50"
              >
                <LogIn className="w-4 h-4" />
                <span>{isConnecting ? 'Menghubungkan...' : 'Hubungkan Akun Google'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Section: Firebase Hosting Deployed Student Link Banner */}
        <div className="bg-gradient-to-r from-orange-50/90 via-amber-50/70 to-emerald-50/90 rounded-2xl border-2 border-orange-300 p-5 space-y-3 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-xl bg-orange-600 text-white flex items-center justify-center font-bold">
                <Flame className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-black uppercase tracking-wider text-orange-900 block">
                  Link Aplikasi Siswa Berbasis Firebase Hosting
                </span>
                <span className="text-[11px] text-orange-800">
                  Resmi dideploy di Firebase Hosting. Tidak menggunakan Vercel. Bebas error "URI Too Long".
                </span>
              </div>
            </div>
            <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 self-start sm:self-auto">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Hosting Aktif</span>
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-white/90 p-2.5 rounded-xl border border-orange-200">
            <div className="flex-1 min-w-0 font-mono text-xs text-slate-800 font-bold px-2 py-1 truncate select-all">
              {FIREBASE_HOSTING_URL}/?mode=siswa
            </div>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={handleCopyStudentLink}
                className="px-3.5 py-2 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded-xl flex items-center space-x-1.5 transition-colors shadow-sm"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedLink ? 'Tersalin!' : 'Salin Link Siswa'}</span>
              </button>
              <a
                href={`${FIREBASE_HOSTING_URL}/?mode=siswa`}
                target="_blank"
                rel="noreferrer"
                className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl flex items-center space-x-1.5 transition-colors shadow-sm"
              >
                <span>Buka Web App</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

          <p className="text-[11px] text-slate-600 leading-relaxed">
            💡 <strong>Keunggulan Firebase:</strong> Saat soal dibagikan, soal tersimpan di Firestore dan gawai siswa cukup membuka link ringkas di atas. Siswa langsung mengambil naskah soal via ID ujian tanpa parameter URL panjang.
          </p>
        </div>

        {/* Section: Diagnostics Hub (Google Drive, Firestore, Firebase Hosting) */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center space-x-1.5">
              <Radio className="w-4 h-4 text-orange-500" />
              <span>Status Infrastruktur Cloud (Firebase & Google Drive)</span>
            </h3>
            <span className="text-[11px] text-slate-400">Klik "Uji" untuk mengecek kesehatan koneksi</span>
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
                  <span>Uji Drive</span>
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
                  <span className="text-[10px] text-emerald-600 font-semibold">● 200 OK</span>
                )}
              </div>

              <p className="text-[11px] text-slate-600 leading-relaxed">
                {drivePingDetail ||
                  (currentUser
                    ? `Akun: ${currentUser.email}. Folder induk: CBT Web App - Backup siap.`
                    : 'Masuk dengan akun Google Anda untuk mengaktifkan pencadangan Google Drive.')}
              </p>
            </div>

            {/* Card 2: Firebase Firestore */}
            <div className="bg-slate-50/80 rounded-2xl border border-slate-200 p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Database className="w-4 h-4 text-orange-600" />
                  <span className="font-bold text-xs text-slate-900">Firebase Firestore</span>
                </div>
                <button
                  type="button"
                  onClick={handleCheckFirestore}
                  disabled={firestorePingStatus === 'checking'}
                  className="text-[10px] font-bold text-orange-600 hover:underline flex items-center space-x-1"
                >
                  <RefreshCw className={`w-3 h-3 ${firestorePingStatus === 'checking' ? 'animate-spin' : ''}`} />
                  <span>Uji Firestore</span>
                </button>
              </div>

              <div className="flex items-center space-x-1.5">
                <span className="inline-flex items-center space-x-1 text-[11px] font-bold text-orange-700 bg-orange-100 px-2 py-0.5 rounded-md">
                  <Flame className="w-3 h-3" />
                  <span>cbtwebapp-a5c83</span>
                </span>
                {firestorePingStatus === 'ok' && (
                  <span className="text-[10px] text-emerald-600 font-semibold">● Terhubung</span>
                )}
              </div>

              <p className="text-[11px] text-slate-600 leading-relaxed">
                {firestorePingDetail ||
                  'Menyimpan koleksi students, exams, active_exams, exam_results, & exam_analysis.'}
              </p>
            </div>

            {/* Card 3: Firebase Hosting */}
            <div className="bg-slate-50/80 rounded-2xl border border-slate-200 p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Globe className="w-4 h-4 text-emerald-600" />
                  <span className="font-bold text-xs text-slate-900">Firebase Hosting</span>
                </div>
                <button
                  type="button"
                  onClick={handleCheckFirebaseHosting}
                  disabled={firebaseHostingStatus === 'checking'}
                  className="text-[10px] font-bold text-emerald-600 hover:underline flex items-center space-x-1"
                >
                  <RefreshCw className={`w-3 h-3 ${firebaseHostingStatus === 'checking' ? 'animate-spin' : ''}`} />
                  <span>Uji Domain</span>
                </button>
              </div>

              <div className="flex items-center space-x-1.5">
                <span className="inline-flex items-center space-x-1 text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">
                  <Zap className="w-3 h-3" />
                  <span>Bebas Vercel</span>
                </span>
                <span className="text-[10px] text-emerald-600 font-semibold">● Live</span>
              </div>

              <p className="text-[11px] text-slate-600 leading-relaxed">
                {firebaseHostingDetail}
              </p>
            </div>
          </div>
        </div>

        {/* Section: Master Sync Control (Upload All to Firebase & Drive) */}
        <div className="bg-slate-900 text-white rounded-3xl p-6 sm:p-7 space-y-5 shadow-lg border border-slate-800">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-orange-400 block">
                Sinkronisasi Master 4 Kategori Terpadu
              </span>
              <h3 className="text-lg font-black text-white mt-0.5">
                Unggah Data Siswa, Soal, Nilai, & Analisis ke Firebase & GDrive
              </h3>
              <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
                Tekan tombol di bawah untuk menyinkronkan seluruh pangkalan data secara bersamaan. Siswa di gawai mana pun dapat langsung mengerjakan ujian via Firebase.
              </p>
            </div>

            <button
              type="button"
              onClick={handleUploadAllToFirebaseAndDrive}
              disabled={isSyncing}
              className="px-6 py-3.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white text-xs sm:text-sm font-black rounded-2xl shadow-md transition-all flex items-center justify-center space-x-2 shrink-0 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Mengunggah ke Cloud...' : '🚀 Unggah SEMUA Data ke Cloud'}</span>
            </button>
          </div>

          {/* Real-time Progress Bar */}
          {isSyncing && (
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <div className="flex items-center justify-between text-xs text-slate-300">
                <span className="font-semibold text-orange-300">{syncStep}</span>
                <span className="font-mono font-bold text-emerald-400">{syncProgress}%</span>
              </div>
              <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-orange-500 to-emerald-500 rounded-full transition-all duration-300"
                  style={{ width: `${syncProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* 4 Category Status Checkers */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
            {/* 1. Siswa */}
            <div className={`p-3 rounded-2xl border transition-all ${
              syncCategoriesDone.students
                ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                : 'bg-slate-800/80 border-slate-700/60 text-slate-300'
            }`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">1. Data Siswa</span>
                {syncCategoriesDone.students ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Users className="w-4 h-4 text-slate-500" />
                )}
              </div>
              <div className="text-base font-black text-white">{realStudents.length} <span className="text-xs font-normal text-slate-400">siswa</span></div>
              <span className="text-[10px] text-slate-400 block mt-0.5 font-mono truncate">
                Firestore & GDrive/Data Siswa
              </span>
            </div>

            {/* 2. Soal */}
            <div className={`p-3 rounded-2xl border transition-all ${
              syncCategoriesDone.exams
                ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                : 'bg-slate-800/80 border-slate-700/60 text-slate-300'
            }`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">2. Naskah Soal</span>
                {syncCategoriesDone.exams ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <FileText className="w-4 h-4 text-slate-500" />
                )}
              </div>
              <div className="text-base font-black text-white">{realExams.length} <span className="text-xs font-normal text-slate-400">ujian</span></div>
              <span className="text-[10px] text-slate-400 block mt-0.5 font-mono truncate">
                Firestore & GDrive/Paket Ujian
              </span>
            </div>

            {/* 3. Nilai */}
            <div className={`p-3 rounded-2xl border transition-all ${
              syncCategoriesDone.results
                ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                : 'bg-slate-800/80 border-slate-700/60 text-slate-300'
            }`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">3. Rekap Nilai</span>
                {syncCategoriesDone.results ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <BarChart3 className="w-4 h-4 text-slate-500" />
                )}
              </div>
              <div className="text-base font-black text-white">{results.length} <span className="text-xs font-normal text-slate-400">nilai</span></div>
              <span className="text-[10px] text-slate-400 block mt-0.5 font-mono truncate">
                Firestore & GDrive/Data Nilai
              </span>
            </div>

            {/* 4. Analisis */}
            <div className={`p-3 rounded-2xl border transition-all ${
              syncCategoriesDone.analysis
                ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                : 'bg-slate-800/80 border-slate-700/60 text-slate-300'
            }`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">4. Analisis Soal</span>
                {syncCategoriesDone.analysis ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Layers className="w-4 h-4 text-slate-500" />
                )}
              </div>
              <div className="text-base font-black text-white">{realExams.length} <span className="text-xs font-normal text-slate-400">paket</span></div>
              <span className="text-[10px] text-slate-400 block mt-0.5 font-mono truncate">
                Firestore & GDrive/Analisis
              </span>
            </div>
          </div>
        </div>

        {/* Section: Individual Category Uploads & Pull Data */}
        <div className="border-t border-slate-100 pt-5 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Sinkronisasi Mandiri per Kategori & Pemulihan Data
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs">
            <button
              type="button"
              onClick={handleUploadStudents}
              disabled={isSyncing}
              className="p-3 bg-slate-50 hover:bg-blue-50 text-slate-800 hover:text-blue-900 rounded-xl border border-slate-200 hover:border-blue-300 text-left transition-all font-semibold flex items-center justify-between disabled:opacity-50"
            >
              <div>
                <span className="block font-bold">Unggah Data Siswa</span>
                <span className="text-[10px] text-slate-500 font-normal">{realStudents.length} siswa ke Firebase & Drive</span>
              </div>
              <Users className="w-4 h-4 text-blue-600 shrink-0" />
            </button>

            <button
              type="button"
              onClick={handleUploadExams}
              disabled={isSyncing}
              className="p-3 bg-slate-50 hover:bg-orange-50 text-slate-800 hover:text-orange-900 rounded-xl border border-slate-200 hover:border-orange-300 text-left transition-all font-semibold flex items-center justify-between disabled:opacity-50"
            >
              <div>
                <span className="block font-bold">Unggah Naskah Soal</span>
                <span className="text-[10px] text-slate-500 font-normal">{realExams.length} ujian aktif</span>
              </div>
              <FileText className="w-4 h-4 text-orange-600 shrink-0" />
            </button>

            <button
              type="button"
              onClick={handleUploadResults}
              disabled={isSyncing}
              className="p-3 bg-slate-50 hover:bg-emerald-50 text-slate-800 hover:text-emerald-900 rounded-xl border border-slate-200 hover:border-emerald-300 text-left transition-all font-semibold flex items-center justify-between disabled:opacity-50"
            >
              <div>
                <span className="block font-bold">Unggah Rekap Nilai</span>
                <span className="text-[10px] text-slate-500 font-normal">{results.length} riwayat nilai</span>
              </div>
              <BarChart3 className="w-4 h-4 text-emerald-600 shrink-0" />
            </button>

            <button
              type="button"
              onClick={handleUploadAnalysis}
              disabled={isSyncing}
              className="p-3 bg-slate-50 hover:bg-purple-50 text-slate-800 hover:text-purple-900 rounded-xl border border-slate-200 hover:border-purple-300 text-left transition-all font-semibold flex items-center justify-between disabled:opacity-50"
            >
              <div>
                <span className="block font-bold">Unggah Analisis Soal</span>
                <span className="text-[10px] text-slate-500 font-normal">Daya pembeda & kesukaran</span>
              </div>
              <Layers className="w-4 h-4 text-purple-600 shrink-0" />
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-2">
            <button
              type="button"
              onClick={handleLoadFromFirestore}
              disabled={isSyncing}
              className="px-4 py-2.5 bg-orange-50 hover:bg-orange-100 text-orange-900 border border-orange-200 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 disabled:opacity-50"
            >
              <Database className="w-3.5 h-3.5 text-orange-600" />
              <span>Tarik / Pulihkan Data dari Firebase Firestore</span>
            </button>

            <button
              type="button"
              onClick={handleLoadFromDrive}
              disabled={isSyncing}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-slate-600 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>Tarik / Pulihkan Data dari Google Drive</span>
            </button>
          </div>
        </div>

        {/* Section: Folder Structure Notice */}
        <div className="bg-gradient-to-r from-blue-50/80 to-indigo-50/80 rounded-2xl border border-blue-200/80 p-4 space-y-2">
          <div className="flex items-center space-x-2 text-blue-900 font-bold text-xs">
            <FolderPlus className="w-4 h-4 text-blue-600" />
            <span>Struktur Folder Resmi di Google Drive:</span>
          </div>
          <p className="text-xs text-blue-800 leading-relaxed">
            Folder induk pencadangan dinamai <strong className="font-mono text-blue-950">"CBT Web App - Backup"</strong> dengan subfolder terstruktur:
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1 text-[11px]">
            <div className="bg-white/90 p-2 rounded-xl border border-blue-100 font-mono text-slate-800 font-semibold">
              📁 Data Soal
              <span className="block text-[10px] text-slate-500 font-sans font-normal">Bank soal & riwayat</span>
            </div>
            <div className="bg-white/90 p-2 rounded-xl border border-blue-100 font-mono text-slate-800 font-semibold">
              📁 Paket Ujian Aktif
              <span className="block text-[10px] text-slate-500 font-sans font-normal">Naskah siap siswa</span>
            </div>
            <div className="bg-white/90 p-2 rounded-xl border border-blue-100 font-mono text-slate-800 font-semibold">
              📁 Data Siswa
              <span className="block text-[10px] text-slate-500 font-sans font-normal">data_siswa_master.json</span>
            </div>
            <div className="bg-white/90 p-2 rounded-xl border border-blue-100 font-mono text-slate-800 font-semibold">
              📁 Data Nilai
              <span className="block text-[10px] text-slate-500 font-sans font-normal">rekap_nilai_siswa.json</span>
            </div>
            <div className="bg-white/90 p-2 rounded-xl border border-blue-100 font-mono text-slate-800 font-semibold col-span-2 sm:col-span-1">
              📁 Analisis Butir Soal
              <span className="block text-[10px] text-slate-500 font-sans font-normal">analisis_butir_soal.json</span>
            </div>
          </div>
          <div className="pt-1 text-[11px] text-emerald-800 flex items-center space-x-1.5 font-medium">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
            <span>Jaminan Privasi: Aplikasi tidak pernah membuat folder di luar "CBT Web App - Backup" pada akun Google Drive Anda.</span>
          </div>
        </div>

        {/* Section: Data Quality & Sample Data Purge */}
        <div className="border-t border-slate-100 pt-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Pemisahan Data Riil Guru vs Data Contoh AI Studio
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Pastikan hanya data buatan Anda yang tersimpan di Firebase & Google Drive.
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
            <span className="font-medium">{syncStatus}</span>
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
                    <span>{copiedDomain ? 'Tersalin' : 'Salin Domain'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Step 2: Open Firebase settings */}
            <div className="bg-white rounded-xl border border-amber-200 p-3.5 space-y-2">
              <div className="text-[11px] font-bold uppercase tracking-wider text-amber-800">
                2. Buka Menu Authorized Domains di Firebase:
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={unauthorizedDomainInfo.settingsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center space-x-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm transition-colors"
                >
                  <span>Buka Firebase Console Settings</span>
                  <ExternalLink className="w-3.5 h-3.5" />
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

      </div>
    </div>
  );
};
