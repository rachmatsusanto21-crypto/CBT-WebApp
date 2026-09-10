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
  AlertCircle
} from 'lucide-react';
import { Exam, Question } from '../types';

interface ExamManagerProps {
  exams: Exam[];
  onExamCreated: (newExam: Exam) => void;
  onSelectPrintExam: (exam: Exam) => void;
}

export const ExamManager: React.FC<ExamManagerProps> = ({
  exams,
  onExamCreated,
  onSelectPrintExam,
}) => {
  // AI Generator Form State
  const [topic, setTopic] = useState<string>('Sistem Persamaan Linear Dua Variabel (SPLDV) dan Masalah Kontekstual');
  const [subject, setSubject] = useState<string>('Matematika');
  const [grade, setGrade] = useState<string>('Kelas X SMA');
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
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Gagal memanggil Gemini API');
      }

      setPreviewQuestions(data.questions);
      setNewExamTitle(`Penilaian Sumatif: ${subject} (${topic.slice(0, 40)})`);
      const randomCodeSuffix = Math.floor(100 + Math.random() * 900);
      setNewExamCode(`${subject.slice(0, 3).toUpperCase()}${randomCodeSuffix}`);
      setNewExamToken(`CBT${new Date().getFullYear()}`);
    } catch (err: any) {
      console.error('Generate questions error:', err);
      setGenError(err.message || 'Terjadi kesalahan saat membuat soal AI.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Save as new exam package
  const handleSaveExam = async () => {
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
        setSaveSuccessMessage(`Berhasil menyimpan paket soal ${newExam.code}! Sekarang siswa dapat menggunakan token "${newExam.token}".`);
        setPreviewQuestions(null);
      }
    } catch (err: any) {
      setGenError('Gagal menyimpan paket soal.');
    } finally {
      setIsSaving(false);
    }
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
            Buat butir soal pilihan ganda berkualitas secara instan dengan AI Gemini, kelola paket ujian, dan atur token CBT.
          </p>
        </div>
      </div>

      {saveSuccessMessage && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 p-4 rounded-2xl flex items-center space-x-3 text-sm">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <span>{saveSuccessMessage}</span>
        </div>
      )}

      {/* 2-Column: Generator Form & Active Exams List */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: AI Question Generator Form */}
        <div className="lg:col-span-6 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
          <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
            <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
              AI
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Generate Soal Baru dengan Gemini AI</h3>
              <p className="text-xs text-slate-400">Model Gemini 3.8 Flash • Skema Soal Standar Kurikulum Merdeka</p>
            </div>
          </div>

          {genError && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded-xl text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{genError}</span>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Topik / Materi / Kisi-Kisi Soal <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={2}
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Contoh: Hukum Newton tentang Gerak dan Gravitasi, atau Fungsi Kuadrat..."
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-colors"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Mata Pelajaran
                </label>
                <select
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-colors"
                >
                  <option value="Matematika">Matematika</option>
                  <option value="Ilmu Pengetahuan Alam (IPA)">IPA / Fisika / Biologi</option>
                  <option value="Bahasa Indonesia">Bahasa Indonesia</option>
                  <option value="Bahasa Inggris">Bahasa Inggris</option>
                  <option value="Informatika / Komputer">Informatika / Komputer</option>
                  <option value="IPS / Sejarah / Ekonomi">IPS / Sejarah / Ekonomi</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Jenjang / Kelas
                </label>
                <select
                  value={grade}
                  onChange={(e) => setGrade(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-colors"
                >
                  <option value="Kelas X SMA">Kelas X SMA/MA</option>
                  <option value="Kelas XI SMA">Kelas XI SMA/MA</option>
                  <option value="Kelas XII SMA">Kelas XII SMA/MA</option>
                  <option value="Kelas VII SMP">Kelas VII SMP/MTs</option>
                  <option value="Kelas VIII SMP">Kelas VIII SMP/MTs</option>
                  <option value="Kelas IX SMP">Kelas IX SMP/MTs</option>
                  <option value="Sekolah Dasar (SD)">Sekolah Dasar (SD)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Jumlah Soal
                </label>
                <select
                  value={count}
                  onChange={(e) => setCount(Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-colors"
                >
                  <option value={3}>3 Butir Soal (Uji Cepat)</option>
                  <option value={5}>5 Butir Soal (Standar Quiz)</option>
                  <option value={10}>10 Butir Soal (Ulangan Harian)</option>
                  <option value={15}>15 Butir Soal (Sumatif)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Tingkat Kesulitan
                </label>
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-colors"
                >
                  <option value="Mudah">Mudah (Dasar Pemahaman)</option>
                  <option value="Sedang / HOTS">Sedang / HOTS (Aplikasi & Analisis)</option>
                  <option value="Sulit / Olimpiade">Sulit / Analitis Tingkat Tinggi</option>
                </select>
              </div>
            </div>

            <button
              onClick={handleGenerateAI}
              disabled={isGenerating || !topic}
              className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold py-3 px-4 rounded-xl shadow-md text-xs sm:text-sm transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              <span>{isGenerating ? 'Gemini Sedang Menulis Soal...' : 'Generate Butir Soal dengan Gemini AI'}</span>
            </button>
          </div>
        </div>

        {/* Right Column: List of Existing Exams */}
        <div className="lg:col-span-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
              <BookOpen className="w-5 h-5 text-blue-600" />
              <span>Daftar Paket Ujian Aktif ({exams.length})</span>
            </h3>
          </div>

          <div className="space-y-3">
            {exams.map((ex) => (
              <div
                key={ex.id}
                className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm hover:border-blue-300 transition-all"
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
                      {ex.subject} • {ex.grade} • {ex.questions.length} Butir Soal • {ex.durationMinutes} Menit
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

      {/* Generated Questions Preview Modal / Section */}
      {previewQuestions && (
        <div className="bg-white border-2 border-purple-300 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-4 gap-4">
            <div>
              <span className="bg-purple-100 text-purple-800 text-xs font-bold px-3 py-1 rounded-full uppercase">
                Hasil Pembuatan Gemini AI ({previewQuestions.length} Butir Soal)
              </span>
              <h3 className="text-lg font-black text-slate-900 mt-1">
                Tinjau & Simpan Paket Soal Ujian
              </h3>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => setPreviewQuestions(null)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Batal
              </button>
              <button
                disabled={isSaving}
                onClick={handleSaveExam}
                className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-4 py-2 rounded-xl shadow transition-all flex items-center space-x-1.5"
              >
                <PlusCircle className="w-4 h-4" />
                <span>{isSaving ? 'Menyimpan...' : 'Simpan & Buka untuk Siswa'}</span>
              </button>
            </div>
          </div>

          {/* Exam Configurations */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 bg-purple-50/50 p-4 rounded-2xl border border-purple-100 text-xs">
            <div className="sm:col-span-2">
              <label className="font-semibold text-slate-700 block mb-1">Judul Ujian Resmi</label>
              <input
                type="text"
                value={newExamTitle}
                onChange={(e) => setNewExamTitle(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Kode Soal</label>
              <input
                type="text"
                value={newExamCode}
                onChange={(e) => setNewExamCode(e.target.value.toUpperCase())}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-mono uppercase text-slate-900"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Token Akses Siswa</label>
              <input
                type="text"
                value={newExamToken}
                onChange={(e) => setNewExamToken(e.target.value.toUpperCase())}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-mono uppercase text-slate-900"
              />
            </div>
          </div>

          {/* Questions Accordion / List */}
          <div className="space-y-4">
            {previewQuestions.map((q, idx) => (
              <div key={q.id} className="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-5 text-xs sm:text-sm">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="w-6 h-6 rounded-md bg-purple-600 text-white font-bold flex items-center justify-center text-xs">
                      {idx + 1}
                    </span>
                    <span className="font-semibold text-slate-700">{q.category || 'Pilihan Ganda'}</span>
                  </div>
                  <span className="bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded text-xs">
                    Kunci: Opsi {q.correctAnswer.toUpperCase()}
                  </span>
                </div>

                <p className="font-medium text-slate-900 mt-3 text-sm">{q.question}</p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3 text-xs">
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
                  <p className="mt-2.5 text-xs text-slate-600 bg-white p-2.5 rounded-xl border border-slate-200">
                    <span className="font-bold text-slate-800">💡 Pembahasan:</span> {q.explanation}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
