import React, { useState, useEffect } from 'react';
import {
  Cloud,
  CloudCheck,
  FolderPlus,
  RefreshCw,
  Share2,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Lock,
  Globe,
  Database,
  FileText,
  Users,
  LogOut,
  LogIn,
} from 'lucide-react';
import {
  googleSignIn,
  logout,
  subscribeAuth,
  getAccessToken,
  getCurrentUser,
} from '../services/firebaseAuth';
import {
  ensureDriveStructure,
  saveFullBackupToDrive,
  saveAllQuestionPackagesToDrive,
  saveActiveExamsToDrive,
  loadQuestionHistoryFromDrive,
  loadActiveExamsFromDrive,
  DriveFolderStructure,
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
  onSyncSuccess?: (message: string) => void;
}

export const GoogleDriveManager: React.FC<GoogleDriveManagerProps> = ({
  exams,
  savedPackages,
  students,
  schoolSettings,
  onExamsLoaded,
  onPackagesLoaded,
  onSyncSuccess,
}) => {
  const [currentUser, setCurrentUser] = useState(getCurrentUser());
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [folderStructure, setFolderStructure] = useState<DriveFolderStructure | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeAuth((user, token) => {
      setCurrentUser(user);
      setAccessToken(token);
    });
    return () => unsubscribe();
  }, []);

  const handleConnectDrive = async () => {
    setIsConnecting(true);
    setErrorMessage(null);
    try {
      const result = await googleSignIn();
      if (result) {
        setSyncStatus('Terhubung ke Google Drive! Menyiapkan struktur folder...');
        const structure = await ensureDriveStructure(result.accessToken);
        setFolderStructure(structure);
        setSyncStatus('Struktur folder "CBT Web App - Backup" & "Data Soal" siap di Google Drive.');
        setTimeout(() => setSyncStatus(null), 4000);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal menghubungkan akun Google Drive');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await logout();
      setFolderStructure(null);
      setSyncStatus('Google Drive terputus.');
      setTimeout(() => setSyncStatus(null), 3000);
    } catch (err: any) {
      setErrorMessage(err.message);
    }
  };

  const handleSyncAllToDrive = async () => {
    setErrorMessage(null);
    let token = accessToken;

    if (!token) {
      // Prompt user to connect
      try {
        const res = await googleSignIn();
        if (res) {
          token = res.accessToken;
        } else {
          return;
        }
      } catch (e: any) {
        setErrorMessage(e.message || 'Harap hubungkan Google Drive terlebih dahulu');
        return;
      }
    }

    setIsSyncing(true);
    setSyncStatus('Sedang menyimpan semua data ke folder "CBT Web App - Backup" & subfolder...');

    try {
      // 1. Save full backup and subfolders in Google Drive with anyone-with-link read permission
      const backupInfo = await saveFullBackupToDrive(
        {
          exams,
          savedPackages,
          students,
          schoolSettings,
          timestamp: new Date().toISOString(),
        },
        token!
      );

      // 2. Also sync to persistent server store so student devices can load instantly
      await safeFetchJson('/api/sync-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exams,
          savedPackages,
          students,
          schoolSettings,
        }),
      });

      const msg = `Semua data berhasil disimpan ke Google Drive folder "CBT Web App - Backup" dan subfolder "Data Soal"! Hak akses "Anyone with link (Reader)" aktif untuk pengerjaan siswa.`;
      setSyncStatus(msg);
      if (onSyncSuccess) onSyncSuccess(msg);
      setTimeout(() => setSyncStatus(null), 6000);
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
        if (res) token = res.accessToken;
        else return;
      } catch (e: any) {
        setErrorMessage(e.message);
        return;
      }
    }

    setIsSyncing(true);
    setSyncStatus('Memuat data paket soal dari subfolder "Data Soal" di Google Drive...');
    try {
      const [drivePackages, driveExams] = await Promise.all([
        loadQuestionHistoryFromDrive(token!),
        loadActiveExamsFromDrive(token!),
      ]);

      let loadedCount = 0;
      if (drivePackages && drivePackages.length > 0 && onPackagesLoaded) {
        onPackagesLoaded(drivePackages);
        loadedCount += drivePackages.length;
      }

      if (driveExams && driveExams.length > 0 && onExamsLoaded) {
        onExamsLoaded(driveExams);
      }

      setSyncStatus(`Berhasil memuat ${loadedCount} paket soal langsung dari Google Drive!`);
      setTimeout(() => setSyncStatus(null), 4000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal memuat data dari Google Drive');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <Cloud className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="font-bold text-slate-900 text-sm">Penyimpanan & Integrasi Google Drive</h3>
              {currentUser ? (
                <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full flex items-center space-x-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Terhubung</span>
                </span>
              ) : (
                <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                  Belum Terhubung
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">
              Folder: <code className="text-blue-600 font-mono font-bold">CBT Web App - Backup</code> • Subfolder: <code className="text-indigo-600 font-mono font-bold">Data Soal</code> & <code className="text-purple-600 font-mono font-bold">Paket Ujian Aktif</code>
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {currentUser ? (
            <div className="flex items-center space-x-2">
              <span className="text-xs text-slate-600 hidden md:inline truncate max-w-[180px]">
                {currentUser.email}
              </span>
              <button
                type="button"
                onClick={handleDisconnect}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center space-x-1 transition-colors"
                title="Putuskan sambungan Google Drive"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Keluar</span>
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleConnectDrive}
              disabled={isConnecting}
              className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center space-x-1.5 disabled:opacity-50"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>{isConnecting ? 'Menghubungkan...' : 'Hubungkan Google Drive'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Info Card on Permissions & Folders */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
        <div className="bg-blue-50/70 p-3 rounded-2xl border border-blue-100 flex items-start space-x-2.5">
          <FolderPlus className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <strong className="block text-blue-950 font-bold">Struktur Otomatis</strong>
            <span className="text-blue-800 text-[11px]">
              Tersimpan di folder khusus <strong className="font-mono">CBT Web App - Backup</strong> dan subfolder <strong className="font-mono">Data Soal</strong>.
            </span>
          </div>
        </div>

        <div className="bg-emerald-50/70 p-3 rounded-2xl border border-emerald-100 flex items-start space-x-2.5">
          <Globe className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
          <div>
            <strong className="block text-emerald-950 font-bold">Akses Siswa (Read)</strong>
            <span className="text-emerald-800 text-[11px]">
              Setiap soal diberi izin <em>"Anyone with link can read"</em> agar siswa di gawai manapun dapat mengakses.
            </span>
          </div>
        </div>

        <div className="bg-purple-50/70 p-3 rounded-2xl border border-purple-100 flex items-start space-x-2.5">
          <ShieldCheck className="w-4 h-4 text-purple-600 flex-shrink-0 mt-0.5" />
          <div>
            <strong className="block text-purple-950 font-bold">Data Asli Guru</strong>
            <span className="text-purple-800 text-[11px]">
              Soal yang terkirim ke gawai siswa adalah soal buatan Anda, bukan data contoh AI Studio.
            </span>
          </div>
        </div>
      </div>

      {syncStatus && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 p-3 rounded-2xl text-xs flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>{syncStatus}</span>
        </div>
      )}

      {errorMessage && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-2xl text-xs flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button
          type="button"
          onClick={handleSyncAllToDrive}
          disabled={isSyncing}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow transition-all flex items-center space-x-1.5 disabled:opacity-50"
        >
          <CloudCheck className="w-4 h-4" />
          <span>
            {isSyncing ? 'Menyinkronkan ke Google Drive...' : 'Simpan & Sinkronkan Semua ke GDrive'}
          </span>
        </button>

        <button
          type="button"
          onClick={handleLoadFromDrive}
          disabled={isSyncing}
          className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors flex items-center space-x-1.5 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
          <span>Muat Soal dari Google Drive</span>
        </button>
      </div>
    </div>
  );
};
