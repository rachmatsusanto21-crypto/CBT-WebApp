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
  Plus
} from 'lucide-react';
import { Exam, Question, QuestionType, ExamType, SavedQuestionPackage } from '../types';
import { SUBJECT_OPTIONS, EXAM_TYPE_OPTIONS, QUESTION_TYPE_OPTIONS, EDUCATIONAL_IMAGE_PRESETS } from '../initialData';

interface ExamManagerProps {
  exams: Exam[];
  onExamCreated: (newExam: Exam) => void;
  onSelectPrintExam: (exam: Exam) => void;
  onSaveToHistory?: (pkg: SavedQuestionPackage) => void;
  onOpenHistory?: () => void;
}

export const ExamManager: React.FC<ExamManagerProps> = ({
  exams,
  onExamCreated,
  onSelectPrintExam,
  onSaveToHistory,
  onOpenHistory,
}) => {
  // AI Generator Form State
  const [subject, setSubject] = useState<string>('Pendidikan Pancasila');
  const [examType, setExamType] = useState<ExamType>('Penilaian Tengah Semester');
  const [questionType, setQuestionType] = useState<QuestionType | 'campuran'>('pilihan_ganda');
  const [grade, setGrade] = useState<string>('Kelas X SMA/SMK');
  const [topic, setTopic] = useState<string>('Penerapan Nilai-Nilai Pancasila dalam Kehidupan Berbangsa, Norma Hukum, dan Gotong Royong');
  const [count, setCount] = useState<number>(5);
  const [difficulty, setDifficulty] = useState<string>('Sedang / HOTS');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [genError, setGenError] = useState<string>('');

  // Generated Questions Preview & Config
  const [previewQuestions, setPreviewQuestions] = useState<Question[] | null>(null);
  const [newExamTitle, setNewExamTitle] = useState<string>('');
  const [newExamCode, setNewExamCode] = useState<string>('');
  const [newExamToken, setNewExamToken] = useState<string>('');
  const [newExamDuration, setNewExamDuration] = useState<number>(30);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string>('');

  // Image insertion modal for preview question
  const [editingImageIndex, setEditingImageIndex] = useState<number | null>(null);
  const [customImageUrl, setCustomImageUrl] = useState<string>('');

  // Call Gemini API to generate questions
  const handleGenerateAI = async () => {
    setGenError('');
    setIsGenerating(true);
    setSaveSuccessMessage('');

    try {
      const res = await fetch('/api/gemini/generate-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic,
          subject,
          grade,
          count,
          difficulty,
          questionType,
          examType,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Gagal memanggil Gemini AI');
      }

      setPreviewQuestions(data.questions);
      setNewExamTitle(`${examType}: ${subject} (${topic.slice(0, 35)}...)`);
      const prefix = subject.replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase();
      const randomCodeSuffix = Math.floor(100 + Math.random() * 900);
      setNewExamCode(`${prefix}${randomCodeSuffix}`);
      setNewExamToken(`CBT${new Date().getFullYear()}`);
      setNewExamDuration(count > 25 ? 60 : count > 10 ? 45 : 30);
    } catch (err: any) {
      console.error('Generate questions error:', err);
      setGenError(err.message || 'Terjadi kesalahan saat membuat soal AI.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Deploy directly as active exam
  const handleDeployExam = async () => {
    if (!previewQuestions || previewQuestions.length === 0) return;
    if (!newExamTitle || !newExamCode || !newExamToken) {
      setGenError('Judul ujian, kode soal, dan token wajib diisi.');
      return;
    }

    setIsSaving(true);
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

      const res = await fetch('/api/exams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newExam),
      });

      const data = await res.json();
      if (data.success && data.exam) {
        onExamCreated(data.exam);
        setSaveSuccessMessage(`Berhasil mendeploy paket ujian ${newExam.code}! Siswa dapat login menggunakan token "${newExam.token}".`);
        setPreviewQuestions(null);
      }
    } catch (err: any) {
      setGenError('Gagal mendeploy paket soal.');
    } finally {
      setIsSaving(false);
    }
  };

  // Save to question history archive
  const handleSaveToHistory = async () => {
    if (!previewQuestions || previewQuestions.length === 0) return;
    setIsSaving(true);
    try {
      const payload = {
        title: newExamTitle || `${examType}: ${subject}`,
        subject,
        grade,
        examType,
        topic,
        difficulty,
        questionType: questionType === 'campuran' ? 'pilihan_ganda' : questionType,
        questions: previewQuestions,
      };

      const res = await fetch('/api/question-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success && data.package) {
        if (onSaveToHistory) onSaveToHistory(data.package);
        setSaveSuccessMessage(`Paket soal berhasil disimpan ke dalam Riwayat Soal! Anda dapat mendeploy soal ini kapan saja.`);
        setPreviewQuestions(null);
      } else {
        throw new Error(data.error || 'Gagal menyimpan ke riwayat');
      }
    } catch (err: any) {
      setGenError(err.message || 'Gagal menyimpan paket soal ke riwayat.');
    } finally {
      setIsSaving(false);
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
            Buat naskah ujian standar Kurikulum Merdeka otomatis (hingga 50 soal) dengan AI, dukung penyisipan gambar, dan simpan ke riwayat soal.
          </p>
        </div>

        {onOpenHistory && (
          <button
            onClick={onOpenHistory}
            className="flex items-center space-x-1.5 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-xl transition-all border border-indigo-200 shadow-sm"
          >
            <Archive className="w-4 h-4" />
            <span>Buka Riwayat & Deploy Soal</span>
          </button>
        )}
      </div>

      {saveSuccessMessage && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 p-4 rounded-2xl flex items-center justify-between text-xs sm:text-sm">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <span className="font-semibold">{saveSuccessMessage}</span>
          </div>
          <button onClick={() => setSaveSuccessMessage('')} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>
      )}

      {/* 2-Column: Generator Form & Active Exams List */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: AI Question Generator Form */}
        <div className="lg:col-span-7 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
          <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
            <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
              AI
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Perumusan Soal Pintar dengan Gemini AI</h3>
              <p className="text-xs text-slate-400">Dukungan Hingga 50 Soal • Ragam Bentuk Soal • Gambar & Kop Surat</p>
            </div>
          </div>

          {genError && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded-xl text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{genError}</span>
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
                    // Helpful defaults per subject
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
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
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
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  {EXAM_TYPE_OPTIONS.map((et) => (
                    <option key={et} value={et}>
                      {et}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Topic Input */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Topik / Materi / Capaian Pembelajaran <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={2}
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Tuliskan materi pokok, indikator soal, atau kompetensi dasar yang ingin diujikan..."
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            {/* Question Type & Grade */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Bentuk Soal
                </label>
                <select
                  value={questionType}
                  onChange={(e) => setQuestionType(e.target.value as any)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  {QUESTION_TYPE_OPTIONS.map((qt) => (
                    <option key={qt.id} value={qt.id}>
                      {qt.label}
                    </option>
                  ))}
                  <option value="campuran">Campuran (PG, Benar/Salah & Isian)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Jenjang / Kelas
                </label>
                <select
                  value={grade}
                  onChange={(e) => setGrade(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="Kelas X SMA/SMK">Kelas X SMA/SMK (Fase E)</option>
                  <option value="Kelas XI SMA/SMK">Kelas XI SMA/SMK (Fase F)</option>
                  <option value="Kelas XII SMA/SMK">Kelas XII SMA/SMK (Fase F)</option>
                  <option value="Kelas VII SMP">Kelas VII SMP/MTs (Fase D)</option>
                  <option value="Kelas VIII SMP">Kelas VIII SMP/MTs (Fase D)</option>
                  <option value="Kelas IX SMP">Kelas IX SMP/MTs (Fase D)</option>
                  <option value="Fase A/B/C Sekolah Dasar">Sekolah Dasar (SD)</option>
                </select>
              </div>
            </div>

            {/* Question Count (Up to 50!) & Difficulty */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Jumlah Soal: <strong className="text-purple-700 font-bold">{count} Butir</strong>
                  </label>
                  <span className="text-[11px] text-slate-400">Maks. 50</span>
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

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Tingkat Kesulitan
                </label>
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="Mudah">Mudah (Mengingat & Memahami)</option>
                  <option value="Sedang / HOTS">Sedang / HOTS (Aplikasi & Analisis)</option>
                  <option value="Sulit / Olimpiade">Sulit (Evaluasi & Kreasi Analitis)</option>
                </select>
              </div>
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
                  ? `Gemini AI sedang menyusun ${count} butir soal ${subject}...`
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
            {exams.map((ex) => (
              <div
                key={ex.id}
                className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm hover:border-blue-300 transition-all space-y-2"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-mono bg-blue-100 text-blue-800 text-xs font-black px-2.5 py-0.5 rounded-lg border border-blue-200">
                        {ex.code}
                      </span>
                      <span className="text-xs text-slate-500 font-medium">
                        Token: <span className="font-mono font-bold text-slate-900">{ex.token}</span>
                      </span>
                    </div>
                    <h4 className="font-bold text-sm text-slate-900 mt-2 leading-snug">
                      {ex.title}
                    </h4>
                    <p className="text-xs text-slate-500 mt-1">
                      {ex.subject} • {ex.questions.length} Butir Soal • {ex.durationMinutes} Menit
                    </p>
                  </div>

                  <button
                    onClick={() => onSelectPrintExam(ex)}
                    className="flex-shrink-0 flex items-center space-x-1 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-xl font-semibold transition-colors"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Cetak Kop</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Generated Questions Preview & Config Section */}
      {previewQuestions && (
        <div className="bg-white border-2 border-purple-300 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-slate-200 pb-4 gap-4">
            <div>
              <span className="bg-purple-100 text-purple-800 text-xs font-bold px-3 py-1 rounded-full uppercase">
                Hasil AI ({previewQuestions.length} Butir Soal • {subject})
              </span>
              <h3 className="text-lg font-black text-slate-900 mt-1">
                Tinjau, Sisipkan Gambar & Simpan Paket Soal
              </h3>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setPreviewQuestions(null)}
                className="px-3 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Batal
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
              <div key={q.id || idx} className="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-5 text-xs sm:text-sm space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="flex items-center space-x-2">
                    <span className="w-6 h-6 rounded-md bg-purple-600 text-white font-bold flex items-center justify-center text-xs">
                      {idx + 1}
                    </span>
                    <span className="font-bold text-slate-800">{q.category || subject}</span>
                    <span className="bg-slate-200 text-slate-700 px-2 py-0.5 rounded text-[10px] font-semibold uppercase">
                      {q.questionType?.replace('_', ' ') || 'Pilihan Ganda'}
                    </span>
                  </div>

                  <div className="flex items-center space-x-2">
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
                      <span>{q.imageUrl ? 'Ubah Gambar' : '+ Sisipkan Gambar'}</span>
                    </button>

                    <span className="bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded text-xs">
                      Kunci: {q.correctAnswer.toUpperCase()}
                    </span>
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

                <p className="font-medium text-slate-900 whitespace-pre-line text-sm leading-relaxed">{q.question}</p>

                {/* Options display */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {(['a', 'b', 'c', 'd'] as const).map((opt) => (
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
                  ))}
                </div>

                {q.explanation && (
                  <p className="mt-2 text-xs text-slate-600 bg-white p-2.5 rounded-xl border border-slate-200">
                    <span className="font-bold text-slate-800">💡 Pembahasan:</span> {q.explanation}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
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
    </div>
  );
};
