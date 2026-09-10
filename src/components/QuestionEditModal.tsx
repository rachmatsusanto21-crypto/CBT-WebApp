import React, { useState } from 'react';
import { X, Check, Image as ImageIcon, Sparkles, HelpCircle, Upload, Trash2, Award } from 'lucide-react';
import { Question, QuestionType } from '../types';
import { BLOOM_COGNITIVE_LEVELS, QUESTION_TYPE_OPTIONS, EDUCATIONAL_IMAGE_PRESETS } from '../initialData';

interface QuestionEditModalProps {
  question: Question;
  questionIndex: number;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedQuestion: Question) => void;
}

export const QuestionEditModal: React.FC<QuestionEditModalProps> = ({
  question,
  questionIndex,
  isOpen,
  onClose,
  onSave,
}) => {
  if (!isOpen) return null;

  // Form State
  const [questionText, setQuestionText] = useState<string>(question.question || '');
  const [questionType, setQuestionType] = useState<QuestionType>(question.questionType || 'pilihan_ganda');
  const [imageUrl, setImageUrl] = useState<string>(question.imageUrl || '');
  const [options, setOptions] = useState<{ a: string; b: string; c: string; d: string; e?: string }>({
    a: question.options?.a || '',
    b: question.options?.b || '',
    c: question.options?.c || '',
    d: question.options?.d || '',
  });
  const [correctAnswer, setCorrectAnswer] = useState<string>(question.correctAnswer || 'a');
  const [correctAnswers, setCorrectAnswers] = useState<string[]>(
    question.correctAnswers || (question.correctAnswer ? [question.correctAnswer] : ['a'])
  );
  const [explanation, setExplanation] = useState<string>(question.explanation || '');
  const [category, setCategory] = useState<string>(question.category || '');
  
  // Taksonomi Bloom & Penskoran
  const [cognitiveLevel, setCognitiveLevel] = useState<string>(question.cognitiveLevel || 'C2');
  const [cognitiveDescription, setCognitiveDescription] = useState<string>(
    question.cognitiveDescription || ''
  );
  const [scoreWeight, setScoreWeight] = useState<number>(
    question.scoreWeight || (question.questionType === 'uraian' ? 4 : question.questionType === 'isian_singkat' ? 2 : 1)
  );
  const [keywordsString, setKeywordsString] = useState<string>(
    (question.keywords || []).join(', ')
  );
  const [competencyIndicator, setCompetencyIndicator] = useState<string>(
    question.competencyIndicator || ''
  );
  const [rubricGuide, setRubricGuide] = useState<string>(question.rubricGuide || '');

  // Active tab inside edit modal
  const [activeTab, setActiveTab] = useState<'konten' | 'kunci' | 'kisi_kisi'>('konten');

  // Handle local file upload for question image
  const handleImageFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert('Ukuran gambar maksimal 2MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result) {
        setImageUrl(reader.result.toString());
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    if (!questionText.trim()) {
      alert('Teks soal tidak boleh kosong.');
      return;
    }

    // Parse keywords from comma-separated string
    const parsedKeywords = keywordsString
      .split(',')
      .map((k) => k.trim())
      .filter((k) => k.length > 0);

    const updated: Question = {
      ...question,
      question: questionText.trim(),
      questionType,
      imageUrl: imageUrl.trim() || undefined,
      options,
      correctAnswer: questionType === 'pilihan_ganda_kompleks' ? correctAnswers[0] || 'a' : correctAnswer,
      correctAnswers: questionType === 'pilihan_ganda_kompleks' ? correctAnswers : undefined,
      explanation: explanation.trim(),
      category: category.trim() || question.category,
      cognitiveLevel,
      cognitiveDescription:
        cognitiveDescription.trim() ||
        BLOOM_COGNITIVE_LEVELS.find((b) => b.level === cognitiveLevel)?.desc ||
        `Level ${cognitiveLevel}`,
      scoreWeight: Math.max(1, Number(scoreWeight) || 1),
      keywords: parsedKeywords.length > 0 ? parsedKeywords : (questionType === 'isian_singkat' ? [correctAnswer] : undefined),
      competencyIndicator: competencyIndicator.trim() || undefined,
      rubricGuide: rubricGuide.trim() || undefined,
    };

    onSave(updated);
    onClose();
  };

  const toggleComplexAnswer = (optKey: string) => {
    if (correctAnswers.includes(optKey)) {
      if (correctAnswers.length > 1) {
        setCorrectAnswers(correctAnswers.filter((k) => k !== optKey));
      }
    } else {
      setCorrectAnswers([...correctAnswers, optKey]);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-3xl w-full border border-slate-200 shadow-2xl flex flex-col max-h-[90vh] my-auto overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="w-8 h-8 rounded-xl bg-purple-600 text-white font-bold flex items-center justify-center text-sm shadow-sm">
              #{questionIndex + 1}
            </span>
            <div>
              <h3 className="font-black text-slate-900 text-base">Edit Butir Soal Ujian</h3>
              <p className="text-xs text-slate-500">
                Sesuaikan teks soal, opsi stimulus gambar, kunci jawaban, level Taksonomi Bloom, dan kata kunci penskoran.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 bg-white px-6 pt-2 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('konten')}
            className={`pb-2.5 px-3 border-b-2 transition-all ${
              activeTab === 'konten'
                ? 'border-purple-600 text-purple-700 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            1. Teks Soal & Gambar
          </button>
          <button
            onClick={() => setActiveTab('kunci')}
            className={`pb-2.5 px-3 border-b-2 transition-all ${
              activeTab === 'kunci'
                ? 'border-purple-600 text-purple-700 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            2. Bentuk Soal & Kunci Jawaban
          </button>
          <button
            onClick={() => setActiveTab('kisi_kisi')}
            className={`pb-2.5 px-3 border-b-2 transition-all ${
              activeTab === 'kisi_kisi'
                ? 'border-purple-600 text-purple-700 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            3. Taksonomi Bloom, Kisi-Kisi & Kata Kunci AI
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* TAB 1: KONTEN & GAMBAR */}
          {activeTab === 'konten' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Materi Pokok / Subtopik
                </label>
                <input
                  type="text"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="Contoh: Penerapan Nilai Pancasila, Ekosistem, Aljabar Linear"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Teks Soal / Pertanyaan Lengkap (Mendukung Stimulus Narasi)
                </label>
                <textarea
                  rows={4}
                  value={questionText}
                  onChange={(e) => setQuestionText(e.target.value)}
                  placeholder="Tuliskan stimulus bacaan atau pertanyaan lengkap..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500 leading-relaxed font-sans"
                />
              </div>

              {/* Gambar Soal */}
              <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/60 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <ImageIcon className="w-4 h-4 text-purple-600" />
                    <span className="text-xs font-bold text-slate-800">
                      Gambar / Ilustrasi Stimulus Soal (Opsional)
                    </span>
                  </div>
                  {imageUrl && (
                    <button
                      type="button"
                      onClick={() => setImageUrl('')}
                      className="text-xs text-rose-600 hover:text-rose-700 font-semibold flex items-center space-x-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Hapus Gambar</span>
                    </button>
                  )}
                </div>

                {imageUrl && (
                  <div className="bg-white p-2 border border-slate-200 rounded-xl flex items-center justify-center max-h-48 overflow-hidden">
                    <img
                      src={imageUrl}
                      alt="Preview Stimulus"
                      className="max-h-44 object-contain rounded-lg"
                    />
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Unggah File Gambar (PNG / JPG)
                    </label>
                    <label className="flex items-center justify-center space-x-1.5 px-3 py-2 bg-white border border-dashed border-slate-300 hover:border-purple-500 text-slate-600 rounded-xl cursor-pointer text-xs transition-colors">
                      <Upload className="w-3.5 h-3.5 text-purple-600" />
                      <span>Pilih Berkas dari Komputer</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageFileUpload}
                        className="hidden"
                      />
                    </label>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Atau Masukkan Tautan URL Gambar
                    </label>
                    <input
                      type="text"
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      placeholder="https://example.com/gambar.png"
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>

                {/* Quick Presets */}
                <div className="pt-2">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                    Preset Gambar Pendidikan Siap Pakai:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {EDUCATIONAL_IMAGE_PRESETS.slice(0, 5).map((preset) => (
                      <button
                        key={preset.name}
                        type="button"
                        onClick={() => setImageUrl(preset.url)}
                        className="text-[11px] px-2 py-1 bg-white hover:bg-purple-50 hover:text-purple-700 hover:border-purple-300 border border-slate-200 rounded-lg text-slate-600 transition-colors"
                      >
                        {preset.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: BENTUK SOAL & KUNCI JAWABAN */}
          {activeTab === 'kunci' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Bentuk Soal
                  </label>
                  <select
                    value={questionType}
                    onChange={(e) => {
                      const newType = e.target.value as QuestionType;
                      setQuestionType(newType);
                      if (newType === 'uraian') {
                        setScoreWeight(4);
                      } else if (newType === 'isian_singkat') {
                        setScoreWeight(2);
                      } else {
                        setScoreWeight(1);
                      }
                    }}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    {QUESTION_TYPE_OPTIONS.map((qt) => (
                      <option key={qt.id} value={qt.id}>
                        {qt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Bobot Skor Maksimal Butir Soal
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={scoreWeight}
                    onChange={(e) => setScoreWeight(Number(e.target.value) || 1)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">
                    Standar: PG = 1, Isian Singkat = 2, Uraian / Essay = 4 atau 5.
                  </span>
                </div>
              </div>

              {/* Opsi Jawaban Sesuai Bentuk Soal */}
              {questionType === 'pilihan_ganda' && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700">
                      Pilihan Jawaban (Klik lingkaran untuk memilih Kunci Jawaban Benar)
                    </label>
                    <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded">
                      Kunci: {correctAnswer.toUpperCase()}
                    </span>
                  </div>

                  {(['a', 'b', 'c', 'd'] as const).map((opt) => (
                    <div
                      key={opt}
                      className={`flex items-center space-x-2.5 p-2 rounded-xl border transition-all ${
                        correctAnswer === opt
                          ? 'bg-emerald-50/80 border-emerald-300 ring-1 ring-emerald-400'
                          : 'bg-white border-slate-200'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setCorrectAnswer(opt)}
                        className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs uppercase transition-colors ${
                          correctAnswer === opt
                            ? 'bg-emerald-600 text-white shadow-sm'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {opt}
                      </button>
                      <input
                        type="text"
                        value={options[opt]}
                        onChange={(e) => setOptions({ ...options, [opt]: e.target.value })}
                        placeholder={`Teks pilihan jawaban ${opt.toUpperCase()}...`}
                        className="flex-1 bg-transparent border-none text-xs text-slate-900 focus:outline-none font-medium"
                      />
                      {correctAnswer === opt && (
                        <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full flex items-center space-x-1">
                          <Check className="w-3 h-3" />
                          <span>Kunci Benar</span>
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {questionType === 'pilihan_ganda_kompleks' && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700">
                      Pilihan Ganda Kompleks (Centang satu atau lebih jawaban yang benar)
                    </label>
                    <span className="text-xs bg-purple-100 text-purple-800 font-bold px-2 py-0.5 rounded">
                      Kunci: {correctAnswers.map((x) => x.toUpperCase()).join(', ')}
                    </span>
                  </div>

                  {(['a', 'b', 'c', 'd'] as const).map((opt) => (
                    <div
                      key={opt}
                      className={`flex items-center space-x-2.5 p-2 rounded-xl border transition-all ${
                        correctAnswers.includes(opt)
                          ? 'bg-purple-50/80 border-purple-300 ring-1 ring-purple-400'
                          : 'bg-white border-slate-200'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => toggleComplexAnswer(opt)}
                        className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs uppercase transition-colors ${
                          correctAnswers.includes(opt)
                            ? 'bg-purple-600 text-white shadow-sm'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {opt}
                      </button>
                      <input
                        type="text"
                        value={options[opt]}
                        onChange={(e) => setOptions({ ...options, [opt]: e.target.value })}
                        placeholder={`Pernyataan / opsi ${opt.toUpperCase()}...`}
                        className="flex-1 bg-transparent border-none text-xs text-slate-900 focus:outline-none font-medium"
                      />
                      {correctAnswers.includes(opt) && (
                        <span className="text-[11px] font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full flex items-center space-x-1">
                          <Check className="w-3 h-3" />
                          <span>Benar</span>
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {questionType === 'benar_salah' && (
                <div className="space-y-3 pt-2">
                  <label className="text-xs font-bold text-slate-700 block">
                    Kunci Kebenaran Pernyataan
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setCorrectAnswer('a')}
                      className={`p-3 rounded-xl border flex items-center justify-center space-x-2 text-xs font-bold transition-all ${
                        correctAnswer === 'a'
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-md'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <Check className="w-4 h-4" />
                      <span>Pernyataan BENAR (Opsi A)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setCorrectAnswer('b')}
                      className={`p-3 rounded-xl border flex items-center justify-center space-x-2 text-xs font-bold transition-all ${
                        correctAnswer === 'b'
                          ? 'bg-rose-600 text-white border-rose-600 shadow-md'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <X className="w-4 h-4" />
                      <span>Pernyataan SALAH (Opsi B)</span>
                    </button>
                  </div>
                </div>
              )}

              {questionType === 'isian_singkat' && (
                <div className="space-y-3 pt-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Kunci Jawaban Eksak / Singkat
                    </label>
                    <input
                      type="text"
                      value={correctAnswer}
                      onChange={(e) => setCorrectAnswer(e.target.value)}
                      placeholder="Contoh: Fotosintesis, 14, Jakarta, Soekarno"
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Jawaban siswa akan dicocokkan dengan kunci ini dan variasi kata kunci penskoran pada tab berikutnya.
                  </p>
                </div>
              )}

              {questionType === 'uraian' && (
                <div className="space-y-3 pt-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Ringkasan Kunci / Jawaban Inti yang Diharapkan
                    </label>
                    <textarea
                      rows={3}
                      value={correctAnswer}
                      onChange={(e) => setCorrectAnswer(e.target.value)}
                      placeholder="Tuliskan poin-poin utama jawaban esai yang benar..."
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500 leading-relaxed"
                    />
                  </div>
                </div>
              )}

              {/* Pembahasan Soal */}
              <div className="pt-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Pembahasan Edukatif & Penjelasan Konsep
                </label>
                <textarea
                  rows={2}
                  value={explanation}
                  onChange={(e) => setExplanation(e.target.value)}
                  placeholder="Jelaskan mengapa kunci tersebut benar dan konsep pendukungnya..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500 leading-relaxed"
                />
              </div>
            </div>
          )}

          {/* TAB 3: TAKSONOMI BLOOM & KISI-KISI & KATA KUNCI PENSKORAN AI */}
          {activeTab === 'kisi_kisi' && (
            <div className="space-y-4">
              {/* Level Kognitif Taksonomi Bloom & Anderson */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Level Kognitif Taksonomi Bloom & Anderson
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {BLOOM_COGNITIVE_LEVELS.map((bloom) => (
                    <button
                      key={bloom.level}
                      type="button"
                      onClick={() => {
                        setCognitiveLevel(bloom.level);
                        setCognitiveDescription(`${bloom.level} - ${bloom.label.split(' - ')[1]}`);
                      }}
                      className={`p-2.5 rounded-xl border text-left transition-all ${
                        cognitiveLevel === bloom.level
                          ? 'bg-purple-50 border-purple-500 ring-2 ring-purple-200 text-purple-950'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="font-bold text-xs">{bloom.level}</span>
                        {cognitiveLevel === bloom.level && (
                          <Check className="w-3.5 h-3.5 text-purple-600" />
                        )}
                      </div>
                      <span className="text-[11px] block font-medium leading-tight">
                        {bloom.label.split(' - ')[1]}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Deskripsi Level Kognitif untuk Dokumen Kisi-Kisi
                </label>
                <input
                  type="text"
                  value={cognitiveDescription}
                  onChange={(e) => setCognitiveDescription(e.target.value)}
                  placeholder="Contoh: C4 - Menganalisis interaksi antar makhluk hidup dalam ekosistem"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Indikator Soal Resmi (Capaian Pembelajaran)
                </label>
                <textarea
                  rows={2}
                  value={competencyIndicator}
                  onChange={(e) => setCompetencyIndicator(e.target.value)}
                  placeholder="Contoh: Disajikan teks narasi stimulus, siswa mampu menganalisis solusi mengatasi pencemaran lingkungan..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              {/* Kata Kunci Penskoran AI (Keywords untuk Isian & Uraian) */}
              <div className="bg-indigo-50/70 border border-indigo-200 rounded-2xl p-4 space-y-2">
                <div className="flex items-center space-x-2">
                  <Sparkles className="w-4 h-4 text-indigo-600" />
                  <span className="text-xs font-bold text-indigo-900">
                    Kata Kunci Penskoran Otomatis AI (Keywords Scoring)
                  </span>
                </div>
                <p className="text-[11px] text-indigo-800 leading-relaxed">
                  Pada soal Isian Pendek & Uraian, sistem AI memeriksa ketercakupan kata kunci penting berikut dalam jawaban siswa untuk memberikan skor proporsional secara otomatis.
                </p>
                <input
                  type="text"
                  value={keywordsString}
                  onChange={(e) => setKeywordsString(e.target.value)}
                  placeholder="Pisahkan dengan koma, contoh: klorofil, fotosintesis, cahaya matahari, glukosa"
                  className="w-full bg-white border border-indigo-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                />
                <span className="text-[10px] text-indigo-600 block">
                  💡 Tips: Masukkan 3-5 istilah esensial atau frasa yang wajib disertakan siswa.
                </span>
              </div>

              {/* Rubrik Panduan Penskoran Uraian */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Pedoman Penskoran & Rubrik Penilaian (Untuk Kisi-Kisi)
                </label>
                <textarea
                  rows={2}
                  value={rubricGuide}
                  onChange={(e) => setRubricGuide(e.target.value)}
                  placeholder="Contoh: Skor 4 jika menyebutkan 4 kata kunci lengkap; Skor 2 jika menyebutkan 2 kata kunci; Skor 0 jika tidak relevan."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors"
          >
            Batal
          </button>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center space-x-1.5"
            >
              <Check className="w-4 h-4" />
              <span>Simpan Perubahan Soal</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
