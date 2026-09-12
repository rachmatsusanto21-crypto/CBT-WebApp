import React, { useState } from 'react';
import {
  Sparkles,
  PlusCircle,
  BookOpen,
  CheckCircle2,
  Trash2,
  Printer,
  Clock,
  KeyRound,
  FileText,
  AlertCircle,
  Image as ImageIcon,
  Archive,
  Layers,
  HelpCircle,
  ExternalLink,
  Upload,
  X,
  Plus,
  Edit3,
  Sliders,
  Award,
  Copy,
  Check,
  Cloud,
  CloudCheck,
  Share2,
} from 'lucide-react';
import { Exam, Question, QuestionType, ExamType, SavedQuestionPackage } from '../types';
import { safeFetchJson } from '../utils/apiHelper';
import { generateExamQuestionsWithFallback } from '../utils/geminiGenerator';
import {
  SUBJECT_OPTIONS,
  EXAM_TYPE_OPTIONS,
  QUESTION_TYPE_OPTIONS,
  EDUCATIONAL_IMAGE_PRESETS,
  GRADE_LEVEL_OPTIONS,
  BLOOM_COGNITIVE_LEVELS
} from '../initialData';
import { QuestionEditModal } from './QuestionEditModal';
import { ExamEditModal } from './ExamEditModal';
import { getAccessToken, getCachedAccessToken, googleSignIn } from '../services/firebaseAuth';
import { saveActiveExamToDrive, saveQuestionPackageToDrive } from '../services/googleDriveService';
import { buildStudentExamUrl } from '../utils/examUrlEncoder';

interface ExamManagerProps {
  exams: Exam[];
  onExamCreated: (newExam: Exam) => void;
  onSelectPrintExam: (exam: Exam) => void;
  onUpdateExam?: (updatedExam: Exam) => void;
  onDeleteExam?: (examId: string) => void;
  onSelectExamForStudent?: (exam: Exam) => void;
  onSaveToHistory?: (pkg: SavedQuestionPackage) => void;
  onOpenHistory?: () => void;
  onNavigateToSettings?: () => void;
}

export const ExamManager: React.FC<ExamManagerProps> = ({
  exams,
  onExamCreated,
  onSelectPrintExam,
  onUpdateExam,
  onDeleteExam,
  onSelectExamForStudent,
  onSaveToHistory,
  onOpenHistory,
  onNavigateToSettings,
}) => {
  // Active Exam CRUD Modal States
  const [editingExam, setEditingExam] = useState<Exam | null>(null);
  const [deletingExam, setDeletingExam] = useState<Exam | null>(null);
  const [selectingExam, setSelectingExam] = useState<Exam | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [copiedStudentLink, setCopiedStudentLink] = useState<string | null>(null);
  const [isDriveSyncing, setIsDriveSyncing] = useState<boolean>(false);
  const [driveToast, setDriveToast] = useState<string | null>(null);

  // Copy direct student link for this specific exam
  const handleCopyStudentLink = (ex: Exam) => {
    let driveFileId: string | undefined;
    try {
      const storedMapStr = localStorage.getItem('cbt_gdrive_exam_file_ids') || '{}';
      const map = JSON.parse(storedMapStr);
      driveFileId = map[ex.id] || map[ex.code];
    } catch {}

    const link = buildStudentExamUrl(ex, driveFileId);
    navigator.clipboard.writeText(link);
    setCopiedStudentLink(ex.id);
    setTimeout(() => setCopiedStudentLink(null), 2500);
  };

  // Upload active exam to Google Drive folder "Paket Ujian Aktif" with public reader permission
  const handleSaveActiveExamToDrive = async (ex: Exam) => {
    setIsDriveSyncing(true);
    setDriveToast(null);
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

      await saveActiveExamToDrive(ex, token);
      setDriveToast(`Paket ujian [${ex.code}] berhasil disimpan ke folder "Paket Ujian Aktif" di Google Drive! Akses publik (read) aktif.`);
      setTimeout(() => setDriveToast(null), 5000);
    } catch (err: any) {
      setDriveToast(`Gagal menyimpan ke Google Drive: ${err.message}`);
      setTimeout(() => setDriveToast(null), 5000);
    } finally {
      setIsDriveSyncing(false);
    }
  };
  // AI Generator Form State
  const [subject, setSubject] = useState<string>('Pendidikan Pancasila');
  const [examType, setExamType] = useState<ExamType>('Penilaian Tengah Semester');
  const [questionType, setQuestionType] = useState<QuestionType | 'campuran'>('pilihan_ganda');
  const [grade, setGrade] = useState<string>('Kelas X SMA/SMK (Fase E)');
  const [topic, setTopic] = useState<string>(
    'Penerapan Nilai-Nilai Pancasila dalam Kehidupan Berbangsa, Norma Hukum, dan Gotong Royong'
  );
  const [count, setCount] = useState<number>(5);
  const [difficulty, setDifficulty] = useState<string>('Sedang / HOTS');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [genError, setGenError] = useState<string>('');

  // Multi-format distribution helper state
  const [showMultiDistribution, setShowMultiDistribution] = useState<boolean>(false);
  const [distPg, setDistPg] = useState<number>(10);
  const [distIsian, setDistIsian] = useState<number>(10);
  const [distUraian, setDistUraian] = useState<number>(5);

  // Generated Questions Preview & Config
  const [previewQuestions, setPreviewQuestions] = useState<Question[] | null>(null);
  const [newExamTitle, setNewExamTitle] = useState<string>('');
  const [newExamCode, setNewExamCode] = useState<string>('');
  const [newExamToken, setNewExamToken] = useState<string>('');
  const [newExamDuration, setNewExamDuration] = useState<number>(30);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string>('');

  // Question editing modal state
  const [editingQuestionItem, setEditingQuestionItem] = useState<{
    question: Question;
    index: number;
    targetExamId?: string;
  } | null>(null);

  // Image insertion modal for preview question
  const [editingImageIndex, setEditingImageIndex] = useState<number | null>(null);
  const [customImageUrl, setCustomImageUrl] = useState<string>('');

  // Active exam inspection
  const [expandedExamId, setExpandedExamId] = useState<string | null>(null);

  // Apply multi-format distribution into topic and count
  const handleApplyDistribution = (pg: number, isian: number, uraian: number) => {
    setDistPg(pg);
    setDistIsian(isian);
    setDistUraian(uraian);
    const total = pg + isian + uraian;
    setCount(total);
    setQuestionType('campuran');

    const cleanTopic = topic.replace(/\n?\[Komposisi:.*?\]/gi, '').trim();
    const compositionTag = `\n[Komposisi: ${pg} soal pilihan ganda, ${isian} isian pendek, dan ${uraian} soal uraian]`;
    setTopic(cleanTopic + compositionTag);
  };

  // Call Gemini API to generate questions (with auto-fallback for Vercel 404 & high demand)
  const handleGenerateAI = async () => {
    setGenError('');
    setIsGenerating(true);
    setSaveSuccessMessage('');

    try {
      const { questions, generatedVia } = await generateExamQuestionsWithFallback({
        topic,
        subject,
        grade,
        count,
        difficulty,
        questionType,
        examType,
      });

      if (!questions || questions.length === 0) {
        throw new Error('Tidak ada butir soal yang berhasil dirumuskan. Coba ulangi kembali.');
      }

      setPreviewQuestions(questions);
      setNewExamTitle(`${examType}: ${subject} (${topic.slice(0, 35)}...)`);
      const prefix = subject.replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase();
      const randomCodeSuffix = Math.floor(100 + Math.random() * 900);
      setNewExamCode(`${prefix}${randomCodeSuffix}`);
      setNewExamToken(`CBT${new Date().getFullYear()}`);
      setNewExamDuration(count > 25 ? 60 : count > 10 ? 45 : 30);

      // Auto-save generated questions to history so they are NEVER lost
      const autoPackage: SavedQuestionPackage = {
        id: 'pkg-' + Date.now(),
        title: `${examType}: ${subject} (${topic.slice(0, 35)}...)`,
        subject,
        grade,
        examType,
        topic,
        difficulty,
        questionCount: questions.length,
        questionType: questionType === 'campuran' ? 'pilihan_ganda' : questionType,
        questions,
        savedAt: new Date().toISOString(),
        isDeployed: false,
      };
      if (onSaveToHistory) {
        onSaveToHistory(autoPackage);
      }
      safeFetchJson('/api/question-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(autoPackage),
      }).catch((e) => console.warn('Background history auto-save:', e));

      if (generatedVia === 'client') {
        setSaveSuccessMessage('Berhasil membuat soal menggunakan Gemini AI Engine langsung di peramban (Client Mode) & otomatis tersimpan di Riwayat Soal!');
      } else {
        setSaveSuccessMessage('Berhasil membuat soal menggunakan Gemini AI & otomatis tersimpan di Riwayat Soal!');
      }
    } catch (err: any) {
      console.error('Generate questions error:', err);
      setGenError(err.message || 'Terjadi kesalahan saat membuat soal AI.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Deploy directly as active exam (fail-safe with client persistence)
  const handleDeployExam = async () => {
    if (!previewQuestions || previewQuestions.length === 0) return;
    if (!newExamTitle || !newExamCode || !newExamToken) {
      setGenError('Judul ujian, kode soal, dan token wajib diisi.');
      return;
    }

    setIsSaving(true);
    setGenError('');
    try {
      const newExam: Exam = {
        id: 'exam-' + Date.now(),
        code: newExamCode.trim().toUpperCase(),
        title: newExamTitle.trim(),
        subject,
        grade,
        examType,
        token: newExamToken.trim().toUpperCase(),
        durationMinutes: Number(newExamDuration) || 30,
        questions: previewQuestions,
        isActive: true,
        createdAt: new Date().toISOString(),
      };

      // 1. Immediately create exam in React state & local storage (guaranteed success)
      onExamCreated(newExam);

      // 2. Also register in SavedQuestionPackage history as deployed
      const deployedPackage: SavedQuestionPackage = {
        id: 'pkg-' + Date.now(),
        title: newExam.title,
        subject: newExam.subject,
        grade: newExam.grade,
        examType: newExam.examType || examType,
        topic: topic || newExam.title,
        difficulty: difficulty || 'Sedang',
        questionCount: newExam.questions.length,
        questionType: questionType === 'campuran' ? 'pilihan_ganda' : questionType,
        questions: newExam.questions,
        savedAt: new Date().toISOString(),
        isDeployed: true,
        deployedExamCode: newExam.code,
      };
      if (onSaveToHistory) {
        onSaveToHistory(deployedPackage);
      }

      // 3. Persist to Express backend in background (graceful if backend offline or 404)
      safeFetchJson('/api/exams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newExam),
      }).catch((e) => console.warn('Server sync exam warning:', e));

      safeFetchJson('/api/question-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(deployedPackage),
      }).catch((e) => console.warn('Server sync package warning:', e));

      // 4. If Google Drive is connected, save directly to Google Drive folders with public read access
      const token = getCachedAccessToken();
      if (token) {
        saveActiveExamToDrive(newExam, token).catch((e) => console.warn('Drive sync exam warning:', e));
        saveQuestionPackageToDrive(deployedPackage, token).catch((e) => console.warn('Drive sync package warning:', e));
      }

      setSaveSuccessMessage(
        `Berhasil mendeploy paket ujian ${newExam.code}! Paket ujian aktif di CBT, tersimpan di Riwayat Soal, dan disinkronkan ke Google Drive.`
      );
      setPreviewQuestions(null);
    } catch (err: any) {
      setGenError(err.message || 'Gagal mendeploy paket soal.');
    } finally {
      setIsSaving(false);
    }
  };

  // Save to question history archive
  const handleSaveToHistory = async () => {
    if (!previewQuestions || previewQuestions.length === 0) return;
    setIsSaving(true);
    setGenError('');
    try {
      const payload: SavedQuestionPackage = {
        id: 'pkg-' + Date.now(),
        title: newExamTitle || `${examType}: ${subject} (${topic.slice(0, 35)}...)`,
        subject,
        grade,
        examType,
        topic,
        difficulty,
        questionCount: previewQuestions.length,
        questionType: questionType === 'campuran' ? 'pilihan_ganda' : questionType,
        questions: previewQuestions,
        savedAt: new Date().toISOString(),
        isDeployed: false,
      };

      if (onSaveToHistory) {
        onSaveToHistory(payload);
      }

      safeFetchJson('/api/question-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).catch((e) => console.warn('Server sync history warning:', e));

      // If Google Drive is connected, save directly to Google Drive subfolder "Data Soal"
      const token = getCachedAccessToken();
      if (token) {
        saveQuestionPackageToDrive(payload, token).catch((e) => console.warn('Drive sync package warning:', e));
      }

      setSaveSuccessMessage(
        `Paket soal berhasil disimpan ke dalam Riwayat Soal dan disinkronkan ke Google Drive folder "Data Soal"!`
      );
      setPreviewQuestions(null);
    } catch (err: any) {
      setGenError(err.message || 'Gagal menyimpan paket soal ke riwayat.');
    } finally {
      setIsSaving(false);
    }
  };

  // Update question after editing in QuestionEditModal
  const handleSaveEditedQuestion = (updatedQuestion: Question) => {
    if (!editingQuestionItem) return;

    if (editingQuestionItem.targetExamId) {
      const targetExam = exams.find((e) => e.id === editingQuestionItem.targetExamId);
      if (targetExam) {
        const updatedQuestions = [...targetExam.questions];
        updatedQuestions[editingQuestionItem.index] = updatedQuestion;
        const updatedExam: Exam = { ...targetExam, questions: updatedQuestions };
        if (onUpdateExam) {
          onUpdateExam(updatedExam);
        }
      }
    } else if (previewQuestions) {
      const updated = [...previewQuestions];
      updated[editingQuestionItem.index] = updatedQuestion;
      setPreviewQuestions(updated);
    }

    setEditingQuestionItem(null);
  };

  // Delete question from preview
  const handleDeletePreviewQuestion = (index: number) => {
    if (!previewQuestions) return;
    const updated = previewQuestions.filter((_, i) => i !== index);
    setPreviewQuestions(updated.map((q, idx) => ({ ...q, number: idx + 1 })));
  };

  // Add a new empty question manually to preview
  const handleAddNewManualQuestion = () => {
    const newQ: Question = {
      id: 'q-manual-' + Date.now(),
      number: (previewQuestions?.length || 0) + 1,
      question: 'Tuliskan teks pertanyaan soal baru di sini...',
      questionType: 'pilihan_ganda',
      cognitiveLevel: 'C3',
      cognitiveDescription: 'C3 - Menerapkan konsep pada kasus',
      competencyIndicator: `Disajikan materi ${subject}, siswa mampu menyelesaikan masalah dengan benar.`,
      scoreWeight: 1,
      options: {
        a: 'Pilihan jawaban A',
        b: 'Pilihan jawaban B',
        c: 'Pilihan jawaban C',
        d: 'Pilihan jawaban D',
      },
      correctAnswer: 'a',
      explanation: 'Pembahasan materi jawaban.',
      category: subject,
    };

    if (previewQuestions) {
      setPreviewQuestions([...previewQuestions, newQ]);
      setEditingQuestionItem({ question: newQ, index: previewQuestions.length });
    } else {
      setPreviewQuestions([newQ]);
      setEditingQuestionItem({ question: newQ, index: 0 });
    }
  };

  // Attach image to question
  const handleSetQuestionImage = (url: string) => {
    if (editingImageIndex === null || !previewQuestions) return;
    const updated = [...previewQuestions];
    updated[editingImageIndex] = {
      ...updated[editingImageIndex],
      imageUrl: url.trim() ? url.trim() : undefined,
    };
    setPreviewQuestions(updated);
    setEditingImageIndex(null);
    setCustomImageUrl('');
  };

  return (
    <div className="space-y-8">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center space-x-2">
            <Sparkles className="w-6 h-6 text-purple-600" />
            <span>Bank Soal & Gemini AI Generator</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Buat naskah ujian standar Kurikulum Merdeka (hingga 50 soal), multi bentuk soal (PG, Isian, Uraian), Taksonomi Bloom (C1-C6), dan edit soal interaktif.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleAddNewManualQuestion}
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-bold rounded-xl transition-all border border-purple-200 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>+ Buat Soal Manual</span>
          </button>

          {onOpenHistory && (
            <button
              onClick={onOpenHistory}
              className="flex items-center space-x-1.5 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-xl transition-all border border-indigo-200 shadow-sm"
            >
              <Archive className="w-4 h-4" />
              <span>Riwayat Soal</span>
            </button>
          )}
        </div>
      </div>

      {driveToast && (
        <div className="bg-blue-50 border border-blue-300 text-blue-900 p-4 rounded-2xl flex items-center justify-between text-xs sm:text-sm">
          <div className="flex items-center space-x-2">
            <CloudCheck className="w-5 h-5 text-blue-600 flex-shrink-0" />
            <span className="font-semibold">{driveToast}</span>
          </div>
          <button onClick={() => setDriveToast(null)} className="text-slate-400 hover:text-slate-600">
            ✕
          </button>
        </div>
      )}

      {saveSuccessMessage && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 p-4 rounded-2xl flex items-center justify-between text-xs sm:text-sm">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <span className="font-semibold">{saveSuccessMessage}</span>
          </div>
          <button onClick={() => setSaveSuccessMessage('')} className="text-slate-400 hover:text-slate-600">
            ✕
          </button>
        </div>
      )}

      {/* 2-Column: Generator Form & Active Exams List */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: AI Question Generator Form */}
        <div className="lg:col-span-7 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-5">
          <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
            <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
              AI
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Perumusan Soal Pintar dengan Gemini AI</h3>
              <p className="text-xs text-slate-400">
                Taksonomi Bloom (C1-C6) • Multi Bentuk Soal • Kata Kunci Penskoran AI
              </p>
            </div>
          </div>

          {genError && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-2xl text-xs space-y-2">
              <div className="flex items-start space-x-2.5">
                <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <strong className="font-bold block text-rose-900 mb-0.5">Kendala Pembuatan Soal AI:</strong>
                  <span className="leading-relaxed">{genError}</span>
                </div>
              </div>
              {onNavigateToSettings && (
                <div className="pt-2 border-t border-rose-200/80 flex items-center justify-between">
                  <span className="text-[11px] text-rose-600">
                    Perlu mengatur atau memverifikasi API Key?
                  </span>
                  <button
                    type="button"
                    onClick={onNavigateToSettings}
                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-xs shadow-sm transition-all"
                  >
                    Buka Pengaturan & API Key
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="space-y-4">
            {/* Subject & Exam Type Selection */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Mata Pelajaran <span className="text-rose-500">*</span>
                </label>
                <select
                  value={subject}
                  onChange={(e) => {
                    const s = e.target.value;
                    setSubject(s);
                    if (s === 'Pendidikan Pancasila') {
                      setTopic('Penerapan Nilai-Nilai Pancasila dalam Kehidupan Berbangsa, Norma Hukum, dan Gotong Royong');
                    } else if (s.includes('IPAS')) {
                      setTopic('Interaksi Makhluk Hidup dengan Lingkungan, Siklus Rantai Makanan, dan Pencemaran');
                    } else if (s === 'Bahasa Jawa') {
                      setTopic('Unggah-Ungguh Basa Jawa (Krama Alus), Serat Wulangreh, dan Tokoh Wayang');
                    } else if (s === 'Seni Budaya') {
                      setTopic('Apresiasi Seni Rupa Tradisional Nusantara, Alat Musik Daerah, dan Motif Batik');
                    } else if (s.includes('Kokurikuler')) {
                      setTopic('Tema Gaya Hidup Berkelanjutan: Pengelolaan Sampah dan Pembuatan Kompos');
                    }
                  }}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500 font-medium"
                >
                  {SUBJECT_OPTIONS.map((sub) => (
                    <option key={sub} value={sub}>
                      {sub}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Jenis Ujian <span className="text-rose-500">*</span>
                </label>
                <select
                  value={examType}
                  onChange={(e) => setExamType(e.target.value as ExamType)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500 font-medium"
                >
                  {EXAM_TYPE_OPTIONS.map((et) => (
                    <option key={et} value={et}>
                      {et}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Jenjang / Tingkat Kelas (SD, SMP, SMA/SMK) */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Tingkat Satuan Pendidikan & Kelas (SD s.d. SMA/SMK) <span className="text-rose-500">*</span>
              </label>
              <select
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500 font-medium"
              >
                {Array.from(new Set(GRADE_LEVEL_OPTIONS.map((item) => item.group))).map((groupName) => (
                  <optgroup key={groupName} label={groupName}>
                    {GRADE_LEVEL_OPTIONS.filter((item) => item.group === groupName).map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.value}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            {/* Topic Input with Prompt Guidance */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Topik / Capaian Pembelajaran / Prompt Proporsi Soal <span className="text-rose-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowMultiDistribution(!showMultiDistribution)}
                  className="text-[11px] text-purple-700 font-bold hover:underline flex items-center space-x-1"
                >
                  <Sliders className="w-3 h-3" />
                  <span>{showMultiDistribution ? 'Sembunyikan Distribusi' : 'Atur Multi Bentuk Soal'}</span>
                </button>
              </div>

              <textarea
                rows={3}
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Contoh: Ekosistem dan rantai makanan, atau tentukan proporsi: 10 soal pilihan ganda, 10 isian pendek, dan 5 soal uraian..."
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            {/* Multi-Format Distribution Helper Panel */}
            {showMultiDistribution && (
              <div className="bg-purple-50/70 border border-purple-200 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-purple-900 uppercase tracking-wider flex items-center space-x-1.5">
                    <Sliders className="w-3.5 h-3.5 text-purple-700" />
                    <span>Konfigurasi Multi Bentuk Soal Sesuai Permintaan</span>
                  </h4>
                  <span className="text-[11px] font-bold text-purple-800 bg-purple-100 px-2 py-0.5 rounded-full">
                    Total: {distPg + distIsian + distUraian} Soal
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3 text-xs">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Pilihan Ganda (PG)</label>
                    <input
                      type="number"
                      min={0}
                      max={50}
                      value={distPg}
                      onChange={(e) => setDistPg(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 font-bold text-slate-900 text-center"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Isian Pendek/Singkat</label>
                    <input
                      type="number"
                      min={0}
                      max={50}
                      value={distIsian}
                      onChange={(e) => setDistIsian(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 font-bold text-slate-900 text-center"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Uraian / Esai</label>
                    <input
                      type="number"
                      min={0}
                      max={50}
                      value={distUraian}
                      onChange={(e) => setDistUraian(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 font-bold text-slate-900 text-center"
                    />
                  </div>
                </div>

                {/* Preset Distribution Quick Buttons */}
                <div className="pt-1 flex flex-wrap gap-1.5 items-center">
                  <span className="text-[11px] font-semibold text-slate-600 mr-1">Preset Populer:</span>
                  <button
                    type="button"
                    onClick={() => handleApplyDistribution(10, 10, 5)}
                    className="px-2.5 py-1 bg-white border border-purple-300 hover:bg-purple-100 text-purple-800 text-[11px] font-bold rounded-lg shadow-sm"
                  >
                    10 PG + 10 Isian + 5 Uraian (25 Soal)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyDistribution(20, 5, 5)}
                    className="px-2.5 py-1 bg-white border border-purple-300 hover:bg-purple-100 text-purple-800 text-[11px] font-bold rounded-lg shadow-sm"
                  >
                    20 PG + 5 Isian + 5 Uraian (30 Soal)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyDistribution(35, 10, 5)}
                    className="px-2.5 py-1 bg-white border border-purple-300 hover:bg-purple-100 text-purple-800 text-[11px] font-bold rounded-lg shadow-sm"
                  >
                    35 PG + 10 Isian + 5 Uraian (50 Soal)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyDistribution(distPg, distIsian, distUraian)}
                    className="ml-auto px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white text-[11px] font-bold rounded-lg shadow"
                  >
                    Terapkan Proporsi Ini
                  </button>
                </div>
              </div>
            )}

            {/* Question Type & Difficulty */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Bentuk Soal Utama
                </label>
                <select
                  value={questionType}
                  onChange={(e) => setQuestionType(e.target.value as any)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500 font-medium"
                >
                  <option value="campuran">Multi Bentuk / Campuran (PG, Isian & Uraian)</option>
                  {QUESTION_TYPE_OPTIONS.map((qt) => (
                    <option key={qt.id} value={qt.id}>
                      {qt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Tingkat Kesulitan / HOTS
                </label>
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500 font-medium"
                >
                  <option value="Mudah">Mudah (LOTS: C1 Mengingat & C2 Memahami)</option>
                  <option value="Sedang / HOTS">Sedang / HOTS (MOTS: C3 Menerapkan & HOTS: C4 Menganalisis)</option>
                  <option value="Sulit / Olimpiade">Sulit (HOTS: C5 Mengevaluasi & C6 Mencipta)</option>
                </select>
              </div>
            </div>

            {/* Question Count (Up to 50) */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Total Jumlah Soal: <strong className="text-purple-700 font-bold">{count} Butir</strong>
                </label>
                <span className="text-[11px] text-slate-400">Maks. 50 Soal</span>
              </div>

              <div className="flex items-center space-x-1.5 mb-2">
                {[5, 10, 20, 25, 40, 50].map((presetNum) => (
                  <button
                    key={presetNum}
                    type="button"
                    onClick={() => setCount(presetNum)}
                    className={`flex-1 py-1 text-xs rounded-lg font-bold border transition-colors ${
                      count === presetNum
                        ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {presetNum}
                  </button>
                ))}
              </div>

              <input
                type="range"
                min={1}
                max={50}
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
                className="w-full accent-purple-600"
              />
            </div>

            {/* Generate Button */}
            <button
              onClick={handleGenerateAI}
              disabled={isGenerating || !topic.trim()}
              className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold py-3.5 px-4 rounded-xl shadow-md text-xs sm:text-sm transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              <span>
                {isGenerating
                  ? `Gemini AI sedang merumuskan ${count} butir soal ${subject}...`
                  : `Generate ${count} Butir Soal dengan Gemini AI`}
              </span>
            </button>
          </div>
        </div>

        {/* Right Column: List of Existing Active Exams */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
              <BookOpen className="w-5 h-5 text-blue-600" />
              <span>Paket Ujian Aktif di CBT ({exams.length})</span>
            </h3>
          </div>

          <div className="space-y-3">
            {exams.length === 0 ? (
              <div className="bg-white p-8 rounded-3xl border border-dashed border-slate-300 text-center space-y-2">
                <BookOpen className="w-8 h-8 text-slate-400 mx-auto" />
                <p className="text-sm font-bold text-slate-700">Belum Ada Paket Ujian Aktif di CBT</p>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Gunakan form AI Generator di sebelah kiri atau pilih paket dari Riwayat Soal untuk mengaktifkan ujian di CBT.
                </p>
              </div>
            ) : (
              exams.map((ex) => {
                const isExpanded = expandedExamId === ex.id;
                return (
                  <div
                    key={ex.id}
                    className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200 shadow-sm hover:border-blue-300 transition-all space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-mono bg-blue-100 text-blue-800 text-xs font-black px-2.5 py-0.5 rounded-lg border border-blue-200">
                            {ex.code}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              ex.isActive !== false
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {ex.isActive !== false ? 'AKTIF' : 'NON-AKTIF'}
                          </span>
                        </div>
                        <h4 className="font-bold text-slate-900 text-sm mt-1">{ex.title}</h4>
                        <p className="text-xs text-slate-500">
                          {ex.subject} • {ex.grade}
                        </p>
                      </div>

                      {/* Action Buttons: Pilih, Edit, Hapus, Cetak */}
                      <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
                        {/* Tombol Pilih */}
                        <button
                          type="button"
                          onClick={() => setSelectingExam(ex)}
                          title="Pilih dan Uji Paket Ujian Ini"
                          className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl transition-colors border border-blue-200 text-xs font-bold flex items-center space-x-1"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Pilih</span>
                        </button>

                        {/* Tombol Bagikan Link Siswa */}
                        <button
                          type="button"
                          onClick={() => handleCopyStudentLink(ex)}
                          title="Salin tautan ujian untuk siswa"
                          className="px-2.5 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-xl transition-colors border border-purple-200 text-xs font-bold flex items-center space-x-1"
                        >
                          {copiedStudentLink === ex.id ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                              <span className="text-emerald-700">Tersalin!</span>
                            </>
                          ) : (
                            <>
                              <Share2 className="w-3.5 h-3.5" />
                              <span>Link Siswa</span>
                            </>
                          )}
                        </button>

                        {/* Tombol Simpan ke GDrive */}
                        <button
                          type="button"
                          onClick={() => handleSaveActiveExamToDrive(ex)}
                          disabled={isDriveSyncing}
                          title="Simpan paket ujian ini ke Google Drive (Paket Ujian Aktif)"
                          className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl transition-colors border border-indigo-200 text-xs font-bold flex items-center space-x-1"
                        >
                          <Cloud className="w-3.5 h-3.5" />
                          <span>GDrive</span>
                        </button>

                        {/* Tombol Edit */}
                        <button
                          type="button"
                          onClick={() => setEditingExam(ex)}
                          title="Edit Paket Ujian & Butir Soal"
                          className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-xl transition-colors border border-amber-200 text-xs font-bold flex items-center space-x-1"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </button>

                        {/* Tombol Hapus */}
                        <button
                          type="button"
                          onClick={() => setDeletingExam(ex)}
                          title="Hapus Paket Ujian dari CBT"
                          className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl transition-colors border border-rose-200 text-xs font-bold flex items-center space-x-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Hapus</span>
                        </button>

                        {/* Tombol Cetak */}
                        <button
                          type="button"
                          onClick={() => onSelectPrintExam(ex)}
                          title="Cetak Naskah & Kisi-Kisi"
                          className="p-1.5 sm:px-2.5 sm:py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl transition-colors border border-emerald-200 text-xs font-bold flex items-center space-x-1"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Cetak</span>
                        </button>
                      </div>
                    </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs pt-1 border-t border-slate-100">
                    <span className="flex items-center space-x-1 text-slate-600">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>{ex.durationMinutes} Menit</span>
                    </span>
                    <span className="flex items-center space-x-1 text-slate-600">
                      <KeyRound className="w-3.5 h-3.5 text-slate-400" />
                      <span>Token: <strong className="font-mono text-purple-700">{ex.token}</strong></span>
                    </span>
                    <span className="flex items-center space-x-1 text-slate-600">
                      <FileText className="w-3.5 h-3.5 text-slate-400" />
                      <span>{ex.questions.length} Butir Soal</span>
                    </span>

                    <button
                      onClick={() => setExpandedExamId(isExpanded ? null : ex.id)}
                      className="ml-auto text-[11px] font-bold text-blue-600 hover:underline flex items-center space-x-1"
                    >
                      <span>{isExpanded ? 'Tutup Butir Soal' : 'Lihat & Edit Soal'}</span>
                    </button>
                  </div>

                  {/* Expanded Questions inside Active Exam */}
                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-slate-200 space-y-2 bg-slate-50 p-3 rounded-2xl max-h-72 overflow-y-auto">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-1">
                        <span>Daftar Butir Soal ({ex.questions.length}):</span>
                        <span className="text-[10px] text-slate-400">Klik "Edit" untuk mengubah soal</span>
                      </div>
                      {ex.questions.map((q, qIdx) => (
                        <div
                          key={q.id || qIdx}
                          className="bg-white p-2.5 rounded-xl border border-slate-200 flex items-center justify-between text-xs"
                        >
                          <div className="flex items-center space-x-2 truncate pr-2">
                            <span className="w-5 h-5 bg-purple-100 text-purple-800 rounded font-bold flex items-center justify-center text-[10px] flex-shrink-0">
                              {qIdx + 1}
                            </span>
                            <span className="truncate text-slate-800 font-medium">
                              {q.question.slice(0, 50)}...
                            </span>
                            <span className="text-[9px] bg-amber-100 text-amber-900 font-bold px-1.5 py-0.5 rounded flex-shrink-0">
                              {q.cognitiveLevel || 'C3'}
                            </span>
                          </div>

                          <button
                            onClick={() =>
                              setEditingQuestionItem({
                                question: q,
                                index: qIdx,
                                targetExamId: ex.id,
                              })
                            }
                            className="px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg font-bold text-[11px] flex items-center space-x-1 flex-shrink-0"
                          >
                            <Edit3 className="w-3 h-3" />
                            <span>Edit</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            }))}
          </div>
        </div>
      </div>

      {/* Generated Questions Preview & Config Section */}
      {previewQuestions && (
        <div className="bg-white border-2 border-purple-300 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-slate-200 pb-4 gap-4">
            <div>
              <div className="flex items-center space-x-2">
                <span className="bg-purple-100 text-purple-800 text-xs font-bold px-3 py-1 rounded-full uppercase">
                  Hasil AI ({previewQuestions.length} Butir Soal • {subject})
                </span>
                <span className="bg-blue-100 text-blue-800 text-xs font-bold px-3 py-1 rounded-full">
                  {grade}
                </span>
              </div>
              <h3 className="text-lg font-black text-slate-900 mt-1">
                Tinjau, Edit Soal, Sisipkan Gambar & Simpan Paket Soal
              </h3>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleAddNewManualQuestion}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl flex items-center space-x-1"
              >
                <Plus className="w-3.5 h-3.5 text-purple-600" />
                <span>+ Tambah Butir Soal</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setPreviewQuestions(null);
                  setSaveSuccessMessage('');
                }}
                className="px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-xl flex items-center space-x-1 transition-colors"
                title="Tutup & Hapus Tinjauan Preview Soal Ini"
              >
                <X className="w-3.5 h-3.5" />
                <span>Tutup Preview</span>
              </button>

              <button
                disabled={isSaving}
                onClick={handleSaveToHistory}
                className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold px-4 py-2 rounded-xl shadow-sm transition-all flex items-center space-x-1.5"
              >
                <Archive className="w-4 h-4" />
                <span>{isSaving ? 'Menyimpan...' : 'Simpan ke Riwayat Soal'}</span>
              </button>

              <button
                disabled={isSaving}
                onClick={handleDeployExam}
                className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-4 py-2 rounded-xl shadow transition-all flex items-center space-x-1.5"
              >
                <PlusCircle className="w-4 h-4" />
                <span>{isSaving ? 'Menyimpan...' : 'Deploy Langsung ke Ujian Siswa'}</span>
              </button>
            </div>
          </div>

          {/* Exam Configuration Parameters */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 bg-purple-50/50 p-4 rounded-2xl border border-purple-100 text-xs">
            <div className="sm:col-span-2">
              <label className="font-semibold text-slate-700 block mb-1">Judul Ujian Resmi</label>
              <input
                type="text"
                value={newExamTitle}
                onChange={(e) => setNewExamTitle(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 font-medium"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Kode Soal CBT</label>
              <input
                type="text"
                value={newExamCode}
                onChange={(e) => setNewExamCode(e.target.value.toUpperCase())}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-mono uppercase text-slate-900 font-bold"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Token Akses Siswa</label>
              <input
                type="text"
                value={newExamToken}
                onChange={(e) => setNewExamToken(e.target.value.toUpperCase())}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-mono uppercase text-slate-900 font-bold"
              />
            </div>
          </div>

          {/* Questions List & Image Management */}
          <div className="space-y-4">
            {previewQuestions.map((q, idx) => (
              <div
                key={q.id || idx}
                className="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-5 text-xs sm:text-sm space-y-3 relative group"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="w-6 h-6 rounded-md bg-purple-600 text-white font-bold flex items-center justify-center text-xs">
                      {idx + 1}
                    </span>
                    <span className="font-bold text-slate-800">{q.category || subject}</span>
                    <span className="bg-slate-200 text-slate-700 px-2 py-0.5 rounded text-[10px] font-semibold uppercase">
                      {q.questionType?.replace('_', ' ') || 'Pilihan Ganda'}
                    </span>
                    <span className="bg-amber-100 text-amber-900 px-2 py-0.5 rounded text-[10px] font-bold">
                      {q.cognitiveLevel || 'C3'} - {q.cognitiveDescription || 'Taksonomi Bloom'}
                    </span>
                    <span className="bg-blue-100 text-blue-900 px-2 py-0.5 rounded text-[10px] font-bold">
                      Bobot: {q.scoreWeight || (q.questionType === 'uraian' ? 4 : q.questionType === 'isian_singkat' ? 2 : 1)} Poin
                    </span>
                  </div>

                  <div className="flex items-center space-x-2">
                    {/* Edit Soal Button */}
                    <button
                      type="button"
                      onClick={() => setEditingQuestionItem({ question: q, index: idx })}
                      className="flex items-center space-x-1 px-3 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold shadow-sm transition-colors"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Edit Soal</span>
                    </button>

                    {/* Insert / Change Image Button */}
                    <button
                      type="button"
                      onClick={() => {
                        setEditingImageIndex(idx);
                        setCustomImageUrl(q.imageUrl || '');
                      }}
                      className="flex items-center space-x-1 px-2.5 py-1 bg-white border border-slate-300 hover:border-purple-400 text-slate-700 rounded-lg text-xs font-semibold"
                    >
                      <ImageIcon className="w-3.5 h-3.5 text-purple-600" />
                      <span>{q.imageUrl ? 'Ubah Gambar' : '+ Gambar'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeletePreviewQuestion(idx)}
                      title="Hapus Butir Soal"
                      className="p-1 text-slate-400 hover:text-rose-600 rounded-md"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Display Question Image if attached */}
                {q.imageUrl && (
                  <div className="bg-white p-2.5 rounded-xl border border-slate-200 inline-block max-w-md">
                    <img
                      src={q.imageUrl}
                      alt={`Ilustrasi Soal ${idx + 1}`}
                      className="max-h-48 rounded-lg object-contain"
                    />
                    <div className="flex items-center justify-between mt-1 text-[11px] text-slate-500">
                      <span>Gambar terpasang</span>
                      <button
                        type="button"
                        onClick={() => {
                          const updated = [...previewQuestions];
                          updated[idx] = { ...updated[idx], imageUrl: undefined };
                          setPreviewQuestions(updated);
                        }}
                        className="text-rose-600 hover:underline font-semibold"
                      >
                        Hapus Gambar
                      </button>
                    </div>
                  </div>
                )}

                <p className="font-medium text-slate-900 whitespace-pre-line text-sm leading-relaxed">
                  {q.question}
                </p>

                {/* Options display for multiple choice */}
                {(q.questionType === 'pilihan_ganda' ||
                  q.questionType === 'benar_salah' ||
                  !q.questionType) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {(['a', 'b', 'c', 'd'] as const).map((opt) => {
                      if (q.questionType === 'benar_salah' && (opt === 'c' || opt === 'd')) return null;
                      return (
                        <div
                          key={opt}
                          className={`p-2.5 rounded-xl border flex items-center space-x-2 ${
                            q.correctAnswer === opt
                              ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-semibold'
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
                )}

                {/* Isian Singkat & Uraian Keyword and Rubric Badges */}
                {(q.questionType === 'isian_singkat' || q.questionType === 'uraian') && (
                  <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-1.5">
                    <div className="flex items-center space-x-2 text-xs font-semibold text-slate-800">
                      <span>Kunci Jawaban:</span>
                      <span className="text-emerald-800 font-bold">{q.correctAnswer}</span>
                    </div>

                    {q.keywords && q.keywords.length > 0 && (
                      <div className="flex items-center space-x-1.5 text-xs text-indigo-700">
                        <Sparkles className="w-3.5 h-3.5 text-indigo-600 flex-shrink-0" />
                        <span className="font-bold">Kata Kunci Penskoran AI:</span>
                        <div className="flex flex-wrap gap-1">
                          {q.keywords.map((kw, kwIdx) => (
                            <span
                              key={kwIdx}
                              className="px-2 py-0.5 bg-indigo-50 border border-indigo-200 rounded text-[11px] font-semibold text-indigo-900"
                            >
                              "{kw}"
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {q.rubricGuide && (
                      <p className="text-[11px] text-slate-600 italic">
                        <strong>Pedoman Rubrik:</strong> {q.rubricGuide}
                      </p>
                    )}
                  </div>
                )}

                {q.explanation && (
                  <p className="mt-2 text-xs text-slate-600 bg-white p-2.5 rounded-xl border border-slate-200">
                    <span className="font-bold text-slate-800">💡 Pembahasan:</span> {q.explanation}
                  </p>
                )}
              </div>
            ))}

            <button
              onClick={handleAddNewManualQuestion}
              className="w-full py-3 bg-purple-50 hover:bg-purple-100 border border-dashed border-purple-300 text-purple-700 rounded-2xl text-xs font-bold transition-all flex items-center justify-center space-x-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>+ Tambah Butir Soal Baru Secara Manual</span>
            </button>
          </div>
        </div>
      )}

      {/* Edit Question Modal */}
      {editingQuestionItem && (
        <QuestionEditModal
          question={editingQuestionItem.question}
          questionIndex={editingQuestionItem.index}
          isOpen={true}
          onClose={() => setEditingQuestionItem(null)}
          onSave={handleSaveEditedQuestion}
        />
      )}

      {/* Image Picker / Inserter Modal */}
      {editingImageIndex !== null && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-xl w-full border border-slate-200 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <ImageIcon className="w-5 h-5 text-purple-600" />
                <h3 className="font-black text-slate-900 text-base">
                  Sisipkan Gambar ke Soal #{editingImageIndex + 1}
                </h3>
              </div>
              <button
                onClick={() => setEditingImageIndex(null)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                ✕
              </button>
            </div>

            {/* Preset Educational Images */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                Pilih Dari Ilustrasi Edukasi Populer:
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-56 overflow-y-auto p-1">
                {EDUCATIONAL_IMAGE_PRESETS.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => handleSetQuestionImage(preset.url)}
                    className="p-2 border border-slate-200 rounded-xl hover:border-purple-500 text-left bg-slate-50 hover:bg-purple-50 transition-colors group"
                  >
                    <img
                      src={preset.url}
                      alt={preset.name}
                      className="w-full h-16 object-cover rounded-lg mb-1.5"
                    />
                    <div className="text-[11px] font-bold text-slate-800 truncate group-hover:text-purple-700">
                      {preset.name}
                    </div>
                    <span className="text-[9px] text-slate-500 block truncate">{preset.category}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Custom URL Input */}
            <div className="pt-2 border-t border-slate-100 space-y-2 text-xs">
              <label className="font-semibold text-slate-700 block">
                Atau Masukkan URL Gambar Mandiri:
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="url"
                  value={customImageUrl}
                  onChange={(e) => setCustomImageUrl(e.target.value)}
                  placeholder="https://example.com/gambar-soal.png"
                  className="flex-1 bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 outline-none focus:ring-2 focus:ring-purple-500"
                />
                <button
                  type="button"
                  onClick={() => handleSetQuestionImage(customImageUrl)}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl shadow"
                >
                  Terapkan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Active Exam Modal */}
      {editingExam && (
        <ExamEditModal
          exam={editingExam}
          isOpen={true}
          onClose={() => setEditingExam(null)}
          onSave={(updated) => {
            if (onUpdateExam) {
              onUpdateExam(updated);
            }
            setSaveSuccessMessage(`Paket ujian ${updated.code} berhasil diperbarui!`);
            setEditingExam(null);
          }}
        />
      )}

      {/* Delete Exam Confirmation Modal */}
      {deletingExam && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-slate-200 overflow-hidden p-6 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-slate-900">Hapus Paket Ujian CBT?</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Apakah Anda yakin ingin menghapus paket ujian{' '}
                <strong className="text-slate-900 font-mono">
                  [{deletingExam.code}] {deletingExam.title}
                </strong>
                ?
              </p>
              <p className="text-[11px] text-rose-600 bg-rose-50 p-2.5 rounded-xl border border-rose-100 text-left mt-2">
                Paket ini akan dihapus dari daftar ujian aktif CBT dan tidak akan ter-load lagi saat aplikasi di-refresh/reload.
              </p>
            </div>
            <div className="flex items-center space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingExam(null)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onDeleteExam) {
                    onDeleteExam(deletingExam.id);
                  }
                  setSaveSuccessMessage(`Paket ujian ${deletingExam.code} berhasil dihapus.`);
                  setDeletingExam(null);
                }}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition-all shadow-md"
              >
                Ya, Hapus Permanen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Select Exam Action Modal */}
      {selectingExam && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-slate-200 overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Pilih Paket Ujian</h3>
                  <span className="font-mono text-xs text-blue-600 font-bold">{selectingExam.code}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectingExam(null)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                ✕
              </button>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-xs space-y-2">
              <p className="font-bold text-slate-900">{selectingExam.title}</p>
              <div className="grid grid-cols-2 gap-2 text-slate-600 text-[11px]">
                <div>Mapel: <strong>{selectingExam.subject}</strong></div>
                <div>Kelas: <strong>{selectingExam.grade}</strong></div>
                <div>Durasi: <strong>{selectingExam.durationMinutes} Menit</strong></div>
                <div>Soal: <strong>{selectingExam.questions.length} Butir</strong></div>
              </div>
              <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Token Akses Siswa</span>
                  <span className="font-mono font-bold text-purple-700 text-sm tracking-wider">{selectingExam.token}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(
                      `Kode Soal: ${selectingExam.code} | Token Ujian: ${selectingExam.token}`
                    );
                    setCopiedToken(selectingExam.id);
                    setTimeout(() => setCopiedToken(null), 2000);
                  }}
                  className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-xl text-xs font-bold flex items-center space-x-1 transition-colors"
                >
                  {copiedToken === selectingExam.id ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-700">Tersalin!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Salin Token & Kode</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="space-y-2 pt-1">
              {/* Tombol Salin Link Ujian Siswa */}
              <button
                type="button"
                onClick={() => handleCopyStudentLink(selectingExam)}
                className="w-full py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center space-x-2"
              >
                {copiedStudentLink === selectingExam.id ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-300" />
                    <span>Link Siswa Berhasil Disalin!</span>
                  </>
                ) : (
                  <>
                    <Share2 className="w-4 h-4" />
                    <span>Salin Link Pengerjaan Siswa (Mode Siswa + Kode)</span>
                  </>
                )}
              </button>

              {/* Tombol Simpan ke GDrive */}
              <button
                type="button"
                onClick={() => handleSaveActiveExamToDrive(selectingExam)}
                disabled={isDriveSyncing}
                className="w-full py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold border border-indigo-200 transition-colors flex items-center justify-center space-x-2 disabled:opacity-50"
              >
                <Cloud className="w-4 h-4" />
                <span>Simpan ke GDrive (Paket Ujian Aktif - Akses Reader)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (onSelectExamForStudent) {
                    onSelectExamForStudent(selectingExam);
                  }
                  setSelectingExam(null);
                }}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center space-x-2"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Mulai Uji Coba di Mode Siswa</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setEditingExam(selectingExam);
                  setSelectingExam(null);
                }}
                className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors flex items-center justify-center space-x-1.5"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Buka Form Edit Paket Ini</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
