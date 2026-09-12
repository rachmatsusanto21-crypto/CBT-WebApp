import React, { useState } from 'react';
import {
  Archive,
  Rocket,
  Trash2,
  Eye,
  CheckCircle2,
  Clock,
  KeyRound,
  FileText,
  Search,
  Filter,
  Layers,
  Image as ImageIcon,
  Printer,
  ChevronDown,
  ChevronUp,
  Sparkles,
  AlertCircle,
  BookOpen,
  Cloud,
  CloudCheck,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { SavedQuestionPackage, Exam, QuestionType, ExamType } from '../types';
import { SUBJECT_OPTIONS, EXAM_TYPE_OPTIONS } from '../initialData';
import { googleSignIn, getAccessToken } from '../services/firebaseAuth';
import {
  saveQuestionPackageToDrive,
  saveAllQuestionPackagesToDrive,
  loadQuestionHistoryFromDrive,
} from '../services/googleDriveService';

interface QuestionHistoryViewProps {
  packages: SavedQuestionPackage[];
  onDeployPackage: (pkg: SavedQuestionPackage, config: { token: string; code: string; duration: number; title: string; examType: ExamType }) => Promise<void>;
  onDeletePackage: (id: string) => Promise<void>;
  onSelectPrintExam?: (exam: Exam) => void;
  onNavigateToAI?: () => void;
  onPackagesUpdated?: (packages: SavedQuestionPackage[]) => void;
}

export const QuestionHistoryView: React.FC<QuestionHistoryViewProps> = ({
  packages,
  onDeployPackage,
  onDeletePackage,
  onSelectPrintExam,
  onNavigateToAI,
  onPackagesUpdated,
}) => {
  // Filter & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubject, setSelectedSubject] = useState<string>('Semua');
  const [selectedExamType, setSelectedExamType] = useState<string>('Semua');

  // Preview / Expand
  const [expandedPkgId, setExpandedPkgId] = useState<string | null>(null);

  // Deploy Modal
  const [deployingPkg, setDeployingPkg] = useState<SavedQuestionPackage | null>(null);
  const [deployToken, setDeployToken] = useState('');
  const [deployCode, setDeployCode] = useState('');
  const [deployDuration, setDeployDuration] = useState(30);
  const [deployTitle, setDeployTitle] = useState('');
  const [deployExamType, setDeployExamType] = useState<ExamType>('Penilaian Akhir Bab');
  const [isDeploying, setIsDeploying] = useState(false);
  const [deploySuccess, setDeploySuccess] = useState<string>('');
  const [deployError, setDeployError] = useState<string>('');

  // Google Drive State
  const [isSyncingDrive, setIsSyncingDrive] = useState(false);
  const [driveSyncMessage, setDriveSyncMessage] = useState<string>('');
  const [driveErrorMessage, setDriveErrorMessage] = useState<string>('');
  const [packageDriveLinks, setPackageDriveLinks] = useState<Record<string, string>>(() => {
    try {
      const raw = localStorage.getItem('cbt_gdrive_package_links');
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  // Save single question package to Google Drive under "Data Soal" with public reader access
  const handleSavePackageToDrive = async (pkg: SavedQuestionPackage) => {
    setIsSyncingDrive(true);
    setDriveErrorMessage('');
    setDriveSyncMessage('');
    try {
      let token = await getAccessToken();
      if (!token) {
        const authRes = await googleSignIn();
        if (authRes) {
          token = authRes.accessToken;
        } else {
          return;
        }
      }

      const fileRes = await saveQuestionPackageToDrive(pkg, token);
      const updatedLinks = { ...packageDriveLinks, [pkg.id]: fileRes.webViewLink || fileRes.fileId };
      setPackageDriveLinks(updatedLinks);
      try {
        localStorage.setItem('cbt_gdrive_package_links', JSON.stringify(updatedLinks));
      } catch {}

      setDriveSyncMessage(
        `Paket "${pkg.title}" berhasil disimpan di Google Drive folder "Data Soal"! Hak akses "Anyone with link (Reader)" telah aktif.`
      );
      setTimeout(() => setDriveSyncMessage(''), 5000);
    } catch (err: any) {
      setDriveErrorMessage(err.message || 'Gagal menyimpan paket ke Google Drive');
    } finally {
      setIsSyncingDrive(false);
    }
  };

  // Save all packages to Google Drive folder "Data Soal"
  const handleSyncAllPackagesToDrive = async () => {
    if (packages.length === 0) return;
    setIsSyncingDrive(true);
    setDriveErrorMessage('');
    setDriveSyncMessage('Menyimpan seluruh paket soal ke Google Drive folder "Data Soal"...');
    try {
      let token = await getAccessToken();
      if (!token) {
        const authRes = await googleSignIn();
        if (authRes) {
          token = authRes.accessToken;
        } else {
          return;
        }
      }

      await saveAllQuestionPackagesToDrive(packages, token);

      setDriveSyncMessage(
        `Berhasil menyimpan ${packages.length} paket soal ke Google Drive subfolder "Data Soal"! Siswa dapat mengakses soal dengan izin reader.`
      );
      setTimeout(() => setDriveSyncMessage(''), 6000);
    } catch (err: any) {
      setDriveErrorMessage(err.message || 'Gagal menyimpan semua paket ke Google Drive');
    } finally {
      setIsSyncingDrive(false);
    }
  };

  // Load packages directly from Google Drive
  const handleLoadFromDrive = async () => {
    setIsSyncingDrive(true);
    setDriveErrorMessage('');
    setDriveSyncMessage('Memuat data paket soal dari Google Drive subfolder "Data Soal"...');
    try {
      let token = await getAccessToken();
      if (!token) {
        const authRes = await googleSignIn();
        if (authRes) {
          token = authRes.accessToken;
        } else {
          return;
        }
      }

      const drivePackages = await loadQuestionHistoryFromDrive(token);
      if (drivePackages.length > 0) {
        if (onPackagesUpdated) {
          onPackagesUpdated(drivePackages);
        }
        setDriveSyncMessage(`Berhasil memuat ${drivePackages.length} paket soal dari Google Drive!`);
      } else {
        setDriveSyncMessage('Tidak ditemukan file paket soal di folder "Data Soal" Google Drive.');
      }
      setTimeout(() => setDriveSyncMessage(''), 5000);
    } catch (err: any) {
      setDriveErrorMessage(err.message || 'Gagal memuat paket soal dari Google Drive');
    } finally {
      setIsSyncingDrive(false);
    }
  };

  // Open deploy modal
  const openDeployModal = (pkg: SavedQuestionPackage) => {
    setDeployingPkg(pkg);
    setDeployTitle(pkg.title);
    setDeployExamType(pkg.examType || 'Penilaian Akhir Bab');
    const prefix = (pkg.subject || 'CBT').replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase();
    setDeployCode(`${prefix}${Math.floor(100 + Math.random() * 900)}`);
    setDeployToken(`CBT${new Date().getFullYear()}`);
    setDeployDuration(pkg.questionCount > 25 ? 60 : 30);
    setDeployError('');
  };

  // Submit deploy
  const handleConfirmDeploy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deployingPkg) return;
    if (!deployToken.trim() || !deployCode.trim()) {
      setDeployError('Token dan Kode Soal wajib diisi.');
      return;
    }

    setIsDeploying(true);
    setDeployError('');
    try {
      await onDeployPackage(deployingPkg, {
        token: deployToken.trim().toUpperCase(),
        code: deployCode.trim().toUpperCase(),
        duration: Number(deployDuration) || 30,
        title: deployTitle.trim() || deployingPkg.title,
        examType: deployExamType,
      });

      setDeploySuccess(`Paket "${deployingPkg.title}" berhasil di-deploy! Kode: ${deployCode.toUpperCase()} • Token: ${deployToken.toUpperCase()}`);
      setDeployingPkg(null);
    } catch (err: any) {
      setDeployError(err.message || 'Gagal melakukan deploy paket soal');
    } finally {
      setIsDeploying(false);
    }
  };

  // Filtered packages
  const filteredPackages = packages.filter((p) => {
    const matchQuery =
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.topic && p.topic.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchSubject = selectedSubject === 'Semua' || p.subject === selectedSubject;
    const matchExamType = selectedExamType === 'Semua' || p.examType === selectedExamType;
    return matchQuery && matchSubject && matchExamType;
  });

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center space-x-2">
            <Archive className="w-6 h-6 text-indigo-600" />
            <span>Riwayat & Deploy Soal Ujian</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Kelola arsip soal yang tersimpan, pratinjau butir soal lengkap bergambar, dan aktifkan (deploy) langsung ke sistem CBT siswa.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleSyncAllPackagesToDrive}
            disabled={isSyncingDrive || packages.length === 0}
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-xl transition-all border border-blue-200 shadow-sm disabled:opacity-50"
            title="Simpan semua paket soal ke folder Google Drive 'CBT Web App - Backup / Data Soal'"
          >
            <Cloud className="w-4 h-4" />
            <span>{isSyncingDrive ? 'Menyimpan...' : 'Simpan ke GDrive (Data Soal)'}</span>
          </button>

          <button
            type="button"
            onClick={handleLoadFromDrive}
            disabled={isSyncingDrive}
            className="flex items-center space-x-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all border border-slate-200 shadow-sm disabled:opacity-50"
            title="Muat paket soal langsung dari subfolder Data Soal di Google Drive"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncingDrive ? 'animate-spin' : ''}`} />
            <span>Muat dari GDrive</span>
          </button>

          {onNavigateToAI && (
            <button
              onClick={onNavigateToAI}
              className="flex items-center space-x-1.5 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold rounded-xl transition-all shadow-md"
            >
              <Sparkles className="w-4 h-4" />
              <span>Buat Paket Soal Baru (AI)</span>
            </button>
          )}
        </div>
      </div>

      {/* Google Drive Status Messages */}
      {driveSyncMessage && (
        <div className="bg-blue-50 border border-blue-300 text-blue-900 p-4 rounded-2xl flex items-center justify-between text-xs sm:text-sm shadow-sm">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-5 h-5 text-blue-600 flex-shrink-0" />
            <span className="font-semibold">{driveSyncMessage}</span>
          </div>
          <button onClick={() => setDriveSyncMessage('')} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>
      )}

      {driveErrorMessage && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-2xl flex items-center justify-between text-xs sm:text-sm">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
            <span>{driveErrorMessage}</span>
          </div>
          <button onClick={() => setDriveErrorMessage('')} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>
      )}

      {deploySuccess && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 p-4 rounded-2xl flex items-center justify-between text-xs sm:text-sm">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <span className="font-semibold">{deploySuccess}</span>
          </div>
          <button onClick={() => setDeploySuccess('')} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari materi, topik, atau mata pelajaran..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <div className="flex items-center space-x-1.5">
            <span className="text-slate-500 font-semibold whitespace-nowrap">Mata Pelajaran:</span>
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 font-medium text-slate-700 outline-none max-w-[180px]"
            >
              <option value="Semua">Semua Mapel</option>
              {SUBJECT_OPTIONS.map((sub) => (
                <option key={sub} value={sub}>
                  {sub}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center space-x-1.5">
            <span className="text-slate-500 font-semibold whitespace-nowrap">Jenis Ujian:</span>
            <select
              value={selectedExamType}
              onChange={(e) => setSelectedExamType(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 font-medium text-slate-700 outline-none"
            >
              <option value="Semua">Semua Jenis Ujian</option>
              {EXAM_TYPE_OPTIONS.map((et) => (
                <option key={et} value={et}>
                  {et}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Packages Grid / List */}
      <div className="space-y-4">
        {filteredPackages.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 shadow-sm space-y-3">
            <Archive className="w-12 h-12 text-slate-300 mx-auto" />
            <h3 className="font-bold text-slate-700 text-base">Belum Ada Paket Soal di Riwayat</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Paket soal yang Anda buat dari Gemini AI Generator atau manual dapat disimpan ke dalam riwayat ini untuk digunakan berulang kali.
            </p>
          </div>
        ) : (
          filteredPackages.map((pkg) => {
            const isExpanded = expandedPkgId === pkg.id;
            const imagesCount = pkg.questions.filter((q) => Boolean(q.imageUrl)).length;

            return (
              <div
                key={pkg.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:border-indigo-300 transition-all overflow-hidden"
              >
                <div className="p-5 sm:p-6 space-y-4">
                  {/* Top Badges & Actions */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="bg-indigo-50 text-indigo-700 font-bold px-3 py-1 rounded-lg text-xs border border-indigo-200">
                        {pkg.subject}
                      </span>
                      <span className="bg-purple-50 text-purple-700 font-semibold px-2.5 py-1 rounded-lg text-xs border border-purple-200">
                        {pkg.examType || 'Penilaian Akhir Bab'}
                      </span>
                      <span className="bg-slate-100 text-slate-700 font-medium px-2 py-0.5 rounded text-xs">
                        {pkg.grade}
                      </span>
                      <span className="bg-blue-50 text-blue-700 font-medium px-2 py-0.5 rounded text-xs flex items-center space-x-1">
                        <Layers className="w-3 h-3" />
                        <span>{pkg.questionCount} Soal</span>
                      </span>
                      {imagesCount > 0 && (
                        <span className="bg-amber-50 text-amber-700 font-semibold px-2 py-0.5 rounded text-xs flex items-center space-x-1 border border-amber-200">
                          <ImageIcon className="w-3 h-3 text-amber-600" />
                          <span>{imagesCount} Gambar</span>
                        </span>
                      )}
                      {pkg.isDeployed ? (
                        <span className="bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded text-xs flex items-center space-x-1 border border-emerald-300">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>Aktif (Kode: {pkg.deployedExamCode})</span>
                        </span>
                      ) : (
                        <span className="bg-slate-100 text-slate-500 font-medium px-2 py-0.5 rounded text-xs">
                          Tersimpan di Arsip
                        </span>
                      )}
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={() => handleSavePackageToDrive(pkg)}
                        disabled={isSyncingDrive}
                        className="flex items-center space-x-1 text-xs font-bold text-blue-700 hover:text-blue-800 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 rounded-xl border border-blue-200 transition-colors"
                        title="Simpan ke Google Drive folder 'Data Soal' (Akses: Anyone with link can read)"
                      >
                        <Cloud className="w-3.5 h-3.5" />
                        <span>GDrive</span>
                      </button>

                      <button
                        onClick={() => setExpandedPkgId(isExpanded ? null : pkg.id)}
                        className="flex items-center space-x-1 text-xs font-semibold text-slate-600 hover:text-indigo-600 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>{isExpanded ? 'Tutup Detail' : 'Lihat Butir Soal'}</span>
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>

                      <button
                        onClick={() => openDeployModal(pkg)}
                        className="flex items-center space-x-1.5 text-xs font-bold text-white px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow transition-all"
                      >
                        <Rocket className="w-3.5 h-3.5" />
                        <span>{pkg.isDeployed ? 'Deploy Ulang' : 'Deploy Soal'}</span>
                      </button>

                      <button
                        onClick={async () => {
                          if (window.confirm(`Hapus paket soal "${pkg.title}" dari riwayat?`)) {
                            await onDeletePackage(pkg.id);
                          }
                        }}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        title="Hapus dari Riwayat"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Title & Topic Description */}
                  <div>
                    <h3 className="font-bold text-base text-slate-900 leading-snug">
                      {pkg.title}
                    </h3>
                    {pkg.topic && (
                      <p className="text-xs text-slate-500 mt-1">
                        <span className="font-semibold text-slate-700">Topik / Kisi-Kisi:</span> {pkg.topic}
                      </p>
                    )}
                    <div className="flex items-center space-x-3 text-[11px] text-slate-400 mt-2">
                      <span>Tingkat: <strong className="text-slate-600">{pkg.difficulty || 'Sedang'}</strong></span>
                      <span>•</span>
                      <span>Disimpan: {new Date(pkg.savedAt).toLocaleDateString('id-ID', { dateStyle: 'medium' })}</span>
                    </div>
                  </div>

                  {/* Expanded Questions Details */}
                  {isExpanded && (
                    <div className="pt-4 border-t border-slate-100 space-y-4">
                      <h4 className="font-bold text-xs text-slate-700 uppercase tracking-wider flex items-center space-x-2">
                        <BookOpen className="w-4 h-4 text-indigo-600" />
                        <span>Daftar Butir Soal ({pkg.questions.length})</span>
                      </h4>

                      <div className="space-y-3">
                        {pkg.questions.map((q, idx) => (
                          <div
                            key={q.id || idx}
                            className="bg-slate-50 rounded-2xl p-4 border border-slate-200 text-xs space-y-3"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center space-x-2">
                                <span className="w-6 h-6 rounded-lg bg-indigo-600 text-white font-bold flex items-center justify-center text-xs">
                                  {idx + 1}
                                </span>
                                <span className="font-bold text-slate-800">
                                  {q.category || pkg.subject}
                                </span>
                                <span className="bg-slate-200 text-slate-700 px-2 py-0.5 rounded text-[10px] font-semibold uppercase">
                                  {q.questionType?.replace('_', ' ') || 'Pilihan Ganda'}
                                </span>
                              </div>

                              <span className="bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded text-[11px]">
                                Kunci: {q.correctAnswer.toUpperCase()}
                              </span>
                            </div>

                            {/* Question Image if present */}
                            {q.imageUrl && (
                              <div className="bg-white p-2 rounded-xl border border-slate-200 inline-block max-w-md">
                                <img
                                  src={q.imageUrl}
                                  alt={`Ilustrasi Soal ${idx + 1}`}
                                  className="max-h-48 rounded-lg object-contain"
                                />
                                <span className="block text-[10px] text-slate-400 mt-1 italic">
                                  Lampiran Gambar Soal #{idx + 1}
                                </span>
                              </div>
                            )}

                            <p className="font-medium text-slate-900 whitespace-pre-line text-xs sm:text-sm leading-relaxed">
                              {q.question}
                            </p>

                            {/* Options */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                              {(['a', 'b', 'c', 'd'] as const).map((opt) => {
                                const isCorrect = q.correctAnswer === opt;
                                return (
                                  <div
                                    key={opt}
                                    className={`p-2.5 rounded-xl border flex items-center space-x-2 ${
                                      isCorrect
                                        ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-bold'
                                        : 'bg-white border-slate-200 text-slate-700'
                                    }`}
                                  >
                                    <span className="w-5 h-5 rounded flex items-center justify-center font-bold uppercase text-[10px] bg-slate-200 text-slate-700">
                                      {opt}
                                    </span>
                                    <span>{q.options[opt]}</span>
                                  </div>
                                );
                              })}
                            </div>

                            {/* Explanation */}
                            {q.explanation && (
                              <div className="p-2.5 rounded-xl bg-white border border-slate-200 text-slate-600">
                                <strong className="text-slate-800">💡 Pembahasan:</strong> {q.explanation}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Deploy Modal */}
      {deployingPkg && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleConfirmDeploy}
            className="bg-white rounded-3xl p-6 sm:p-7 max-w-xl w-full border border-slate-200 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                  <Rocket className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base">Deploy Paket Soal ke Ujian CBT</h3>
                  <p className="text-xs text-slate-400">Atur kode ujian dan token akses untuk siswa</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDeployingPkg(null)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                ✕
              </button>
            </div>

            {deployError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded-xl text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{deployError}</span>
              </div>
            )}

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Judul Ujian Resmi</label>
                <input
                  type="text"
                  required
                  value={deployTitle}
                  onChange={(e) => setDeployTitle(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-medium outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Jenis Ujian</label>
                  <select
                    value={deployExamType}
                    onChange={(e) => setDeployExamType(e.target.value as ExamType)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-medium outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {EXAM_TYPE_OPTIONS.map((et) => (
                      <option key={et} value={et}>
                        {et}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Durasi Pengerjaan (Menit)</label>
                  <input
                    type="number"
                    min={5}
                    max={180}
                    required
                    value={deployDuration}
                    onChange={(e) => setDeployDuration(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-medium outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Kode Soal CBT</label>
                  <input
                    type="text"
                    required
                    value={deployCode}
                    onChange={(e) => setDeployCode(e.target.value.toUpperCase())}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-mono uppercase text-slate-900 font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Token Akses Siswa</label>
                  <input
                    type="text"
                    required
                    value={deployToken}
                    onChange={(e) => setDeployToken(e.target.value.toUpperCase())}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-mono uppercase text-slate-900 font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </div>

            <div className="bg-indigo-50 p-3 rounded-2xl border border-indigo-100 text-xs text-indigo-900">
              💡 Setelah di-deploy, soal ini langsung muncul di <strong>Mode Siswa</strong> dan dapat dikerjakan menggunakan token di atas, serta siap dicetak dengan kop surat resmi.
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setDeployingPkg(null)}
                className="px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isDeploying}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow transition-all flex items-center space-x-1.5"
              >
                <Rocket className="w-4 h-4" />
                <span>{isDeploying ? 'Deploying...' : 'Deploy Sekarang'}</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
