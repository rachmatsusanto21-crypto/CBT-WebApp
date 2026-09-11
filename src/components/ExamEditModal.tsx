import React, { useState } from 'react';
import {
  X,
  Check,
  BookOpen,
  Clock,
  KeyRound,
  FileText,
  Trash2,
  Edit3,
  Plus,
  AlertCircle,
  GraduationCap,
  Layers,
  Sparkles
} from 'lucide-react';
import { Exam, Question, ExamType, QuestionType } from '../types';
import { SUBJECT_OPTIONS, EXAM_TYPE_OPTIONS, GRADE_LEVEL_OPTIONS } from '../initialData';
import { QuestionEditModal } from './QuestionEditModal';

interface ExamEditModalProps {
  exam: Exam | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedExam: Exam) => void;
}

export const ExamEditModal: React.FC<ExamEditModalProps> = ({
  exam,
  isOpen,
  onClose,
  onSave,
}) => {
  if (!isOpen || !exam) return null;

  // Form State
  const [title, setTitle] = useState<string>(exam.title);
  const [code, setCode] = useState<string>(exam.code);
  const [token, setToken] = useState<string>(exam.token);
  const [subject, setSubject] = useState<string>(exam.subject);
  const [grade, setGrade] = useState<string>(exam.grade);
  const [examType, setExamType] = useState<ExamType>(exam.examType || 'Penilaian Akhir Bab');
  const [durationMinutes, setDurationMinutes] = useState<number>(exam.durationMinutes || 30);
  const [isActive, setIsActive] = useState<boolean>(exam.isActive !== false);
  const [questions, setQuestions] = useState<Question[]>([...exam.questions]);

  // Tab State
  const [activeTab, setActiveTab] = useState<'info' | 'soal'>('info');

  // Sub-modal for editing a specific question
  const [editingQuestionIndex, setEditingQuestionIndex] = useState<number | null>(null);

  // Validation / Error
  const [error, setError] = useState<string>('');

  const handleSaveQuestion = (updatedQuestion: Question) => {
    if (editingQuestionIndex === null) return;
    const updated = [...questions];
    updated[editingQuestionIndex] = updatedQuestion;
    setQuestions(updated);
    setEditingQuestionIndex(null);
  };

  const handleDeleteQuestion = (indexToDelete: number) => {
    if (questions.length <= 1) {
      setError('Paket ujian harus memiliki minimal 1 butir soal.');
      return;
    }
    const updated = questions
      .filter((_, idx) => idx !== indexToDelete)
      .map((q, idx) => ({ ...q, number: idx + 1 }));
    setQuestions(updated);
  };

  const handleAddNewQuestion = () => {
    const newQ: Question = {
      id: `q-${Date.now()}`,
      number: questions.length + 1,
      question: 'Tuliskan butir soal baru di sini...',
      questionType: 'pilihan_ganda',
      options: {
        a: 'Pilihan A',
        b: 'Pilihan B',
        c: 'Pilihan C',
        d: 'Pilihan D',
      },
      correctAnswer: 'a',
      explanation: 'Penjelasan jawaban benar.',
      category: subject || 'Umum',
      cognitiveLevel: 'C2',
      cognitiveDescription: 'C2 - Memahami konsep',
      scoreWeight: 1,
    };
    const updated = [...questions, newQ];
    setQuestions(updated);
    setEditingQuestionIndex(updated.length - 1);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Judul ujian tidak boleh kosong.');
      return;
    }
    if (!code.trim()) {
      setError('Kode soal tidak boleh kosong.');
      return;
    }
    if (!token.trim()) {
      setError('Token ujian tidak boleh kosong.');
      return;
    }
    if (questions.length === 0) {
      setError('Paket ujian harus memiliki minimal 1 butir soal.');
      return;
    }

    const updated: Exam = {
      ...exam,
      title: title.trim(),
      code: code.trim().toUpperCase(),
      token: token.trim().toUpperCase(),
      subject,
      grade,
      examType,
      durationMinutes: Number(durationMinutes) || 30,
      isActive,
      questions,
    };

    onSave(updated);
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
        <div className="bg-white rounded-3xl w-full max-w-3xl shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[92vh] flex flex-col">
          {/* Header */}
          <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between flex-shrink-0">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-600/30 rounded-2xl border border-blue-500/40 flex items-center justify-center text-blue-400">
                <Edit3 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white flex items-center space-x-2">
                  <span>Edit Paket Ujian CBT</span>
                  <span className="bg-blue-500/20 text-blue-300 font-mono text-xs px-2 py-0.5 rounded border border-blue-500/30">
                    {exam.code}
                  </span>
                </h3>
                <p className="text-xs text-slate-400">
                  Ubah data umum ujian, token, durasi, serta sesuaikan butir soal aktif
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Tab Navigation */}
          <div className="flex items-center space-x-2 px-6 pt-3 border-b border-slate-200 bg-slate-50 flex-shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('info')}
              className={`pb-2.5 px-3 text-xs sm:text-sm font-bold border-b-2 transition-colors flex items-center space-x-1.5 ${
                activeTab === 'info'
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span>Informasi & Pengaturan Ujian</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('soal')}
              className={`pb-2.5 px-3 text-xs sm:text-sm font-bold border-b-2 transition-colors flex items-center space-x-1.5 ${
                activeTab === 'soal'
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Daftar Butir Soal ({questions.length})</span>
            </button>
          </div>

          {/* Form Content */}
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
            {error && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-2xl text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {activeTab === 'info' && (
              <div className="space-y-4">
                {/* Judul Ujian */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Judul Naskah Ujian <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    placeholder="Contoh: Penilaian Akhir Semester Ganjil: Matematika Wajib"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                  />
                </div>

                {/* Kode Soal & Token Ujian */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Kode Soal <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={code}
                      onChange={(e) => setCode(e.target.value.toUpperCase())}
                      required
                      placeholder="e.g. MTK101"
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono font-bold"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">Kode unik identifikasi paket ujian</p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Token Akses Siswa <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={token}
                      onChange={(e) => setToken(e.target.value.toUpperCase())}
                      required
                      placeholder="e.g. CBT2026"
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono font-bold text-purple-700"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">Token rahasia yang dimasukkan siswa untuk memulai</p>
                  </div>
                </div>

                {/* Mata Pelajaran & Jenis Ujian */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Mata Pelajaran <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                    >
                      {SUBJECT_OPTIONS.map((sub) => (
                        <option key={sub} value={sub}>
                          {sub}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Jenis Ujian <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={examType}
                      onChange={(e) => setExamType(e.target.value as ExamType)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                    >
                      {EXAM_TYPE_OPTIONS.map((et) => (
                        <option key={et} value={et}>
                          {et}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Jenjang / Kelas & Durasi */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Jenjang / Tingkat Kelas <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={grade}
                      onChange={(e) => setGrade(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
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

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Durasi Pengerjaan (Menit) <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min={5}
                        max={300}
                        value={durationMinutes}
                        onChange={(e) => setDurationMinutes(Math.max(5, parseInt(e.target.value) || 30))}
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold pr-14"
                      />
                      <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-medium">Menit</span>
                    </div>
                  </div>
                </div>

                {/* Status Aktif Toggle */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">Status Publikasi Ujian</span>
                    <span className="text-[11px] text-slate-500">
                      Jika aktif, ujian akan dapat diakses oleh siswa menggunakan token
                    </span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={(e) => setIsActive(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                  </label>
                </div>
              </div>
            )}

            {activeTab === 'soal' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div>
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Daftar Butir Soal ({questions.length})
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Kelola butir soal, kunci jawaban, dan bobot penilaian pada paket ujian ini
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddNewQuestion}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center space-x-1 shadow"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Tambah Soal</span>
                  </button>
                </div>

                <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                  {questions.map((q, idx) => (
                    <div
                      key={q.id || idx}
                      className="bg-slate-50 p-3 rounded-2xl border border-slate-200 hover:border-blue-300 transition-colors flex items-start justify-between gap-3 text-xs"
                    >
                      <div className="flex items-start space-x-2.5 flex-1 min-w-0">
                        <span className="w-6 h-6 bg-blue-100 text-blue-800 font-bold rounded-lg flex items-center justify-center text-xs flex-shrink-0">
                          {idx + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-slate-800 line-clamp-2 leading-relaxed">
                            {q.question}
                          </p>
                          <div className="flex flex-wrap items-center gap-1.5 mt-1.5 text-[10px]">
                            <span className="bg-slate-200 text-slate-700 px-2 py-0.5 rounded font-semibold">
                              {q.questionType?.replace('_', ' ') || 'Pilihan Ganda'}
                            </span>
                            <span className="bg-purple-100 text-purple-800 px-2 py-0.5 rounded font-bold">
                              Kunci: {q.correctAnswer}
                            </span>
                            <span className="bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-bold">
                              {q.cognitiveLevel || 'C2'}
                            </span>
                            <span className="text-slate-500">Bobot: {q.scoreWeight || 1}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-1 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => setEditingQuestionIndex(idx)}
                          className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg transition-colors"
                          title="Edit Butir Soal"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteQuestion(idx)}
                          className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg transition-colors"
                          title="Hapus Butir Soal"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Footer Buttons */}
            <div className="pt-4 border-t border-slate-200 flex items-center justify-end space-x-2 flex-shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition-all shadow-md flex items-center space-x-1.5"
              >
                <Check className="w-4 h-4" />
                <span>Simpan Perubahan Paket Ujian</span>
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Submodal for editing individual question */}
      {editingQuestionIndex !== null && questions[editingQuestionIndex] && (
        <QuestionEditModal
          question={questions[editingQuestionIndex]}
          questionIndex={editingQuestionIndex}
          isOpen={true}
          onClose={() => setEditingQuestionIndex(null)}
          onSave={handleSaveQuestion}
        />
      )}
    </>
  );
};
