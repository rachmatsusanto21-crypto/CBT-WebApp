import React, { useState } from 'react';
import {
  Printer,
  Settings2,
  FileText,
  CheckCircle,
  HelpCircle,
  Award,
  Sparkles,
  Upload,
  Trash2,
  Table as TableIcon,
  ListOrdered,
  FileCheck
} from 'lucide-react';
import { Exam, SchoolSettings, Question } from '../types';
import { Letterhead } from './Letterhead';
import {
  BLOOM_COGNITIVE_LEVELS,
  PEMDA_LOGO_PRESETS,
  SCHOOL_LOGO_PRESETS,
} from '../initialData';

interface PrintExamViewProps {
  exams: Exam[];
  schoolSettings: SchoolSettings;
  onUpdateSettings: (newSettings: SchoolSettings) => void;
  defaultSelectedExam?: Exam | null;
}

export type PrintDocumentMode = 'naskah_soal' | 'kisi_kisi' | 'rubrik_skoring';

export const PrintExamView: React.FC<PrintExamViewProps> = ({
  exams,
  schoolSettings,
  onUpdateSettings,
  defaultSelectedExam,
}) => {
  const [selectedExamId, setSelectedExamId] = useState<string>(
    defaultSelectedExam?.id || exams[0]?.id || ''
  );
  const [printMode, setPrintMode] = useState<PrintDocumentMode>('naskah_soal');
  const [showAnswerKey, setShowAnswerKey] = useState<boolean>(false);
  const [isEditingSettings, setIsEditingSettings] = useState<boolean>(false);
  const [tempSettings, setTempSettings] = useState<SchoolSettings>(schoolSettings);

  const currentExam = exams.find((e) => e.id === selectedExamId) || exams[0];

  const handleSaveSettings = () => {
    onUpdateSettings(tempSettings);
    setIsEditingSettings(false);
  };

  // Upload handler for Logo Pemda
  const handleUploadLogoPemda = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert('Ukuran file logo maksimal 2MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result) {
        setTempSettings((prev) => ({ ...prev, logoPemdaUrl: reader.result?.toString() }));
      }
    };
    reader.readAsDataURL(file);
  };

  // Upload handler for Logo Sekolah
  const handleUploadLogoSekolah = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert('Ukuran file logo maksimal 2MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result) {
        setTempSettings((prev) => ({ ...prev, logoSekolahUrl: reader.result?.toString() }));
      }
    };
    reader.readAsDataURL(file);
  };

  // Helper to compute cognitive level statistics for Kisi-Kisi
  const computeCognitiveStats = () => {
    if (!currentExam) return { cCounts: {}, lots: 0, mots: 0, hots: 0, totalScore: 0 };
    const cCounts: Record<string, number> = { C1: 0, C2: 0, C3: 0, C4: 0, C5: 0, C6: 0 };
    let lots = 0;
    let mots = 0;
    let hots = 0;
    let totalScore = 0;

    currentExam.questions.forEach((q) => {
      const lvl = (q.cognitiveLevel || 'C2').toUpperCase();
      cCounts[lvl] = (cCounts[lvl] || 0) + 1;
      const weight = q.scoreWeight || (q.questionType === 'uraian' ? 4 : q.questionType === 'isian_singkat' ? 2 : 1);
      totalScore += weight;

      if (lvl === 'C1' || lvl === 'C2') lots++;
      else if (lvl === 'C3') mots++;
      else hots++;
    });

    return { cCounts, lots, mots, hots, totalScore };
  };

  const cognitiveStats = computeCognitiveStats();

  const getCognitiveCategoryLabel = (level?: string) => {
    const lvl = (level || 'C2').toUpperCase();
    if (lvl === 'C1' || lvl === 'C2') return { text: 'LOTS', color: 'text-blue-700 bg-blue-50 border-blue-200' };
    if (lvl === 'C3') return { text: 'MOTS', color: 'text-amber-700 bg-amber-50 border-amber-200' };
    return { text: 'HOTS', color: 'text-rose-700 bg-rose-50 border-rose-200' };
  };

  return (
    <div className="space-y-6">
      {/* Top Toolbar (Hidden when printing via .no-print) */}
      <div className="no-print bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="p-1.5 bg-emerald-100 text-emerald-800 rounded-xl">
              <Printer className="w-5 h-5" />
            </span>
            <h2 className="text-xl font-black text-slate-900 tracking-tight">
              Cetak Naskah & Dokumen Evaluasi
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Mendukung cetak Naskah Soal, Kisi-Kisi Taksonomi Bloom & Anderson, serta Pedoman Penskoran Kata Kunci AI.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Select Exam Dropdown */}
          <select
            value={selectedExamId}
            onChange={(e) => setSelectedExamId(e.target.value)}
            className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 max-w-[200px] truncate"
          >
            {exams.map((ex) => (
              <option key={ex.id} value={ex.id}>
                [{ex.code}] {ex.title}
              </option>
            ))}
          </select>

          {/* Mode Selector Tabs */}
          <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200 text-xs font-semibold">
            <button
              onClick={() => setPrintMode('naskah_soal')}
              className={`px-3 py-1.5 rounded-xl transition-all flex items-center space-x-1.5 ${
                printMode === 'naskah_soal'
                  ? 'bg-white text-slate-900 font-bold shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileText className="w-3.5 h-3.5 text-blue-600" />
              <span>Naskah Soal</span>
            </button>

            <button
              onClick={() => setPrintMode('kisi_kisi')}
              className={`px-3 py-1.5 rounded-xl transition-all flex items-center space-x-1.5 ${
                printMode === 'kisi_kisi'
                  ? 'bg-white text-slate-900 font-bold shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <TableIcon className="w-3.5 h-3.5 text-purple-600" />
              <span>Kisi-Kisi (Bloom & Anderson)</span>
            </button>

            <button
              onClick={() => setPrintMode('rubrik_skoring')}
              className={`px-3 py-1.5 rounded-xl transition-all flex items-center space-x-1.5 ${
                printMode === 'rubrik_skoring'
                  ? 'bg-white text-slate-900 font-bold shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              <span>Pedoman & Kata Kunci AI</span>
            </button>
          </div>

          {/* Toggle Answer Key (Only for Naskah Soal) */}
          {printMode === 'naskah_soal' && (
            <button
              onClick={() => setShowAnswerKey(!showAnswerKey)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
                showAnswerKey
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300 font-bold'
                  : 'bg-slate-50 text-slate-600 border-slate-300'
              }`}
            >
              {showAnswerKey ? '✓ Tampilkan Kunci' : 'Lembar Siswa'}
            </button>
          )}

          {/* Edit Letterhead & Logo */}
          <button
            onClick={() => setIsEditingSettings(!isEditingSettings)}
            className="flex items-center space-x-1 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
          >
            <Settings2 className="w-3.5 h-3.5" />
            <span>Kop & Logo</span>
          </button>

          {/* Print Button */}
          <button
            onClick={() => window.print()}
            className="flex items-center space-x-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow transition-all"
          >
            <Printer className="w-4 h-4" />
            <span>Cetak Dokumen (Ctrl+P)</span>
          </button>
        </div>
      </div>

      {/* Letterhead & Logo Configuration Drawer */}
      {isEditingSettings && (
        <div className="no-print bg-slate-50 border border-slate-300 rounded-3xl p-6 shadow-md space-y-5 animate-fade-in">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div>
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                Pengaturan Kop Surat Kedinasan, Logo Sekolah & Logo Pemda
              </h3>
              <p className="text-xs text-slate-500">
                Data ini akan tampil otomatis pada bagian atas naskah soal resmi dan tabel kisi-kisi.
              </p>
            </div>
            <button
              onClick={() => setIsEditingSettings(false)}
              className="text-xs text-slate-500 hover:text-slate-800 font-bold"
            >
              Tutup
            </button>
          </div>

          {/* Upload Logo Pemda & Logo Sekolah */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-white p-4 rounded-2xl border border-slate-200">
            {/* Logo Kiri / Logo Pemda */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800">
                  Logo Kiri: Lambang Pemda / Garuda
                </label>
                {tempSettings.logoPemdaUrl && (
                  <button
                    type="button"
                    onClick={() => setTempSettings({ ...tempSettings, logoPemdaUrl: undefined })}
                    className="text-[11px] text-rose-600 font-semibold hover:underline flex items-center space-x-1"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Hapus Logo</span>
                  </button>
                )}
              </div>

              <div className="flex items-center space-x-3">
                <div className="w-16 h-16 rounded-xl border border-slate-200 flex items-center justify-center bg-slate-50 overflow-hidden flex-shrink-0">
                  {tempSettings.logoPemdaUrl ? (
                    <img
                      src={tempSettings.logoPemdaUrl}
                      alt="Logo Pemda"
                      className="max-h-14 max-w-14 object-contain"
                    />
                  ) : (
                    <span className="text-[10px] text-slate-400 text-center px-1">Tanpa Logo</span>
                  )}
                </div>
                <div className="space-y-1.5 flex-1">
                  <label className="flex items-center justify-center space-x-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl cursor-pointer transition-colors border border-slate-200">
                    <Upload className="w-3.5 h-3.5 text-blue-600" />
                    <span>Unggah Logo Pemda</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleUploadLogoPemda}
                      className="hidden"
                    />
                  </label>
                  <input
                    type="text"
                    value={tempSettings.logoPemdaUrl || ''}
                    onChange={(e) => setTempSettings({ ...tempSettings, logoPemdaUrl: e.target.value })}
                    placeholder="Atau tempelkan URL logo pemda..."
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1 text-[11px] text-slate-800"
                  />
                </div>
              </div>

              {/* Preset Pemda */}
              <div className="flex flex-wrap gap-1 pt-1">
                {PEMDA_LOGO_PRESETS.map((p) => (
                  <button
                    key={p.name}
                    type="button"
                    onClick={() => setTempSettings({ ...tempSettings, logoPemdaUrl: p.url })}
                    className="text-[10px] px-2 py-0.5 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 rounded-md border border-slate-200"
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Logo Kanan / Logo Sekolah */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800">
                  Logo Kanan: Logo Sekolah / Tut Wuri Handayani
                </label>
                {tempSettings.logoSekolahUrl && (
                  <button
                    type="button"
                    onClick={() => setTempSettings({ ...tempSettings, logoSekolahUrl: undefined })}
                    className="text-[11px] text-rose-600 font-semibold hover:underline flex items-center space-x-1"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Hapus Logo</span>
                  </button>
                )}
              </div>

              <div className="flex items-center space-x-3">
                <div className="w-16 h-16 rounded-xl border border-slate-200 flex items-center justify-center bg-slate-50 overflow-hidden flex-shrink-0">
                  {tempSettings.logoSekolahUrl ? (
                    <img
                      src={tempSettings.logoSekolahUrl}
                      alt="Logo Sekolah"
                      className="max-h-14 max-w-14 object-contain"
                    />
                  ) : (
                    <span className="text-[10px] text-slate-400 text-center px-1">Tanpa Logo</span>
                  )}
                </div>
                <div className="space-y-1.5 flex-1">
                  <label className="flex items-center justify-center space-x-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl cursor-pointer transition-colors border border-slate-200">
                    <Upload className="w-3.5 h-3.5 text-blue-600" />
                    <span>Unggah Logo Sekolah</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleUploadLogoSekolah}
                      className="hidden"
                    />
                  </label>
                  <input
                    type="text"
                    value={tempSettings.logoSekolahUrl || ''}
                    onChange={(e) => setTempSettings({ ...tempSettings, logoSekolahUrl: e.target.value })}
                    placeholder="Atau tempelkan URL logo sekolah..."
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1 text-[11px] text-slate-800"
                  />
                </div>
              </div>

              {/* Preset Sekolah */}
              <div className="flex flex-wrap gap-1 pt-1">
                {SCHOOL_LOGO_PRESETS.map((s) => (
                  <button
                    key={s.name}
                    type="button"
                    onClick={() => setTempSettings({ ...tempSettings, logoSekolahUrl: s.url })}
                    className="text-[10px] px-2 py-0.5 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 rounded-md border border-slate-200"
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Form Teks Kop */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Pemerintah Daerah / Provinsi</label>
              <input
                type="text"
                value={tempSettings.namaPemerintah}
                onChange={(e) => setTempSettings({ ...tempSettings, namaPemerintah: e.target.value })}
                className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-900"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Dinas Pendidikan</label>
              <input
                type="text"
                value={tempSettings.namaDinas}
                onChange={(e) => setTempSettings({ ...tempSettings, namaDinas: e.target.value })}
                className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-900"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Nama Satuan Pendidikan (Sekolah)</label>
              <input
                type="text"
                value={tempSettings.namaSekolah}
                onChange={(e) => setTempSettings({ ...tempSettings, namaSekolah: e.target.value })}
                className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-900 font-bold"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="font-semibold text-slate-700 block mb-1">Alamat Lengkap Sekolah</label>
              <input
                type="text"
                value={tempSettings.alamatSekolah}
                onChange={(e) => setTempSettings({ ...tempSettings, alamatSekolah: e.target.value })}
                className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-900"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Kontak & Website</label>
              <input
                type="text"
                value={tempSettings.teleponEmail}
                onChange={(e) => setTempSettings({ ...tempSettings, teleponEmail: e.target.value })}
                className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-900"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Nama Kepala Sekolah</label>
              <input
                type="text"
                value={tempSettings.kepalaSekolah}
                onChange={(e) => setTempSettings({ ...tempSettings, kepalaSekolah: e.target.value })}
                className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-900"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-1">NIP Kepala Sekolah</label>
              <input
                type="text"
                value={tempSettings.nipKepalaSekolah}
                onChange={(e) => setTempSettings({ ...tempSettings, nipKepalaSekolah: e.target.value })}
                className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-900"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Tahun Pelajaran</label>
              <input
                type="text"
                value={tempSettings.tahunAjaran}
                onChange={(e) => setTempSettings({ ...tempSettings, tahunAjaran: e.target.value })}
                className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-900"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Guru Pengampu / Penyusun</label>
              <input
                type="text"
                value={tempSettings.guruPengampu || ''}
                onChange={(e) => setTempSettings({ ...tempSettings, guruPengampu: e.target.value })}
                placeholder="Nama Guru Pengampu, S.Pd."
                className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-900"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-1">NIP Guru Pengampu</label>
              <input
                type="text"
                value={tempSettings.nipGuruPengampu || ''}
                onChange={(e) => setTempSettings({ ...tempSettings, nipGuruPengampu: e.target.value })}
                placeholder="19850101 201001 1 001"
                className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-900"
              />
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-2 border-t border-slate-200">
            <button
              onClick={() => setIsEditingSettings(false)}
              className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200 rounded-xl"
            >
              Batal
            </button>
            <button
              onClick={handleSaveSettings}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 py-1.5 rounded-xl shadow"
            >
              Simpan Pengaturan Kop & Logo
            </button>
          </div>
        </div>
      )}

      {/* Official Printable Document Container */}
      <div className="print-sheet bg-white p-8 sm:p-12 rounded-2xl shadow-md border border-slate-200 max-w-5xl mx-auto font-serif text-black leading-relaxed">
        {/* Kop Surat Resmi */}
        <Letterhead
          settings={schoolSettings}
          documentTitle={
            printMode === 'kisi_kisi'
              ? 'KISI-KISI PENULISAN SOAL ASESMEN SUMATIF'
              : printMode === 'rubrik_skoring'
              ? 'PEDOMAN PENSKORAN & RUBRIK KATA KUNCI SOAL'
              : currentExam?.examType
              ? `NASKAH SOAL ${currentExam.examType.toUpperCase()}`
              : 'NASKAH SOAL PENILAIAN HASIL BELAJAR'
          }
          subTitle={currentExam ? `${currentExam.title} • KODE: ${currentExam.code}` : 'UJIAN AKHIR SEMESTER'}
          examInfo={
            currentExam
              ? {
                  mataPelajaran: currentExam.subject,
                  kelas: currentExam.grade,
                  alokasiWaktu: `${currentExam.durationMinutes} Menit`,
                  hariTanggal: new Date().toLocaleDateString('id-ID', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  }),
                  tahunAjaran: schoolSettings.tahunAjaran,
                }
              : undefined
          }
        />

        {/* ========================================================= */}
        {/* DOKUMEN 1: NASKAH SOAL UJIAN (LEMBAR SISWA / SOAL)        */}
        {/* ========================================================= */}
        {printMode === 'naskah_soal' && currentExam && (
          <div>
            {/* Petunjuk Umum Pengerjaan Ujian */}
            <div className="border border-black p-3 my-4 text-xs font-sans">
              <p className="font-bold uppercase tracking-wider mb-1">PETUNJUK UMUM:</p>
              <ol className="list-decimal list-inside space-y-0.5 text-gray-800">
                <li>Tuliskan nama lengkap, nomor peserta, dan kelas pada lembar jawaban yang telah disediakan.</li>
                <li>Periksa dan bacalah setiap butir soal dengan saksama sebelum Anda menjawabnya.</li>
                <li>Pilihlah salah satu jawaban yang paling tepat dengan memberi tanda silang (X) atau menghitamkan bulatan pada huruf A, B, C, atau D.</li>
                <li>Untuk soal isian singkat dan uraian, tulislah jawaban yang jelas, runut, dan tepat pada ruang yang disediakan.</li>
                <li>Dilarang menggunakan kalkulator atau alat bantu elektronik lainnya kecuali diperkenankan pengawas.</li>
              </ol>
            </div>

            {/* Butir Soal Ujian */}
            <div className="space-y-6 mt-6">
              <div className="flex items-center justify-between border-b border-black pb-1 mb-4">
                <h4 className="font-bold text-sm uppercase tracking-wide">
                  I. BUTIR SOAL UJIAN ({currentExam.questions.length} SOAL)
                </h4>
                <span className="text-xs font-sans font-semibold">
                  Total Bobot: {cognitiveStats.totalScore} Poin
                </span>
              </div>

              {currentExam.questions.map((q, idx) => (
                <div
                  key={q.id || idx}
                  className="print-break-inside-avoid text-xs sm:text-[13px] leading-relaxed border-b border-gray-100 pb-4"
                >
                  <div className="flex items-start space-x-2">
                    <span className="font-bold w-6 text-right flex-shrink-0">{idx + 1}.</span>
                    <div className="flex-1">
                      {/* Badge Tipe & Level Kognitif jika mode kunci aktif */}
                      {showAnswerKey && (
                        <div className="flex items-center space-x-2 mb-1.5 font-sans text-[10px]">
                          <span className="bg-purple-100 text-purple-900 font-bold px-2 py-0.5 rounded">
                            {q.cognitiveLevel || 'C3'} - {q.cognitiveDescription || 'Kognitif'}
                          </span>
                          <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                            {q.questionType?.replace('_', ' ').toUpperCase() || 'PILIHAN GANDA'}
                          </span>
                          <span className="bg-blue-100 text-blue-900 font-semibold px-2 py-0.5 rounded">
                            Bobot: {q.scoreWeight || 1} Poin
                          </span>
                        </div>
                      )}

                      {/* Render Image if exists */}
                      {q.imageUrl && (
                        <div className="my-2 p-1 border border-gray-300 inline-block max-w-sm">
                          <img
                            src={q.imageUrl}
                            alt={`Gambar Soal ${idx + 1}`}
                            className="max-h-44 w-auto object-contain"
                          />
                          <span className="block text-[10px] text-gray-500 italic mt-0.5">
                            Gambar Stimulus #{idx + 1}
                          </span>
                        </div>
                      )}

                      <p className="text-gray-900 font-medium whitespace-pre-line">{q.question}</p>

                      {/* Bentuk: Pilihan Ganda & Benar/Salah */}
                      {(q.questionType === 'pilihan_ganda' ||
                        q.questionType === 'benar_salah' ||
                        !q.questionType) && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 mt-2 pl-2">
                          {(['a', 'b', 'c', 'd'] as const).map((opt) => {
                            const isKey = q.correctAnswer?.toLowerCase() === opt;
                            if (q.questionType === 'benar_salah' && (opt === 'c' || opt === 'd')) return null;
                            return (
                              <div
                                key={opt}
                                className={`flex items-start space-x-2 ${
                                  showAnswerKey && isKey ? 'font-bold text-emerald-900 underline' : ''
                                }`}
                              >
                                <span className="w-4 font-semibold uppercase">{opt}.</span>
                                <span>{q.options[opt]}</span>
                                {showAnswerKey && isKey && (
                                  <span className="text-[10px] font-mono text-emerald-700 ml-1">
                                    [KUNCI]
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Bentuk: Pilihan Ganda Kompleks */}
                      {q.questionType === 'pilihan_ganda_kompleks' && (
                        <div className="grid grid-cols-1 gap-y-1.5 mt-2 pl-2">
                          {(['a', 'b', 'c', 'd'] as const).map((opt) => {
                            const isKey = (q.correctAnswers || [q.correctAnswer]).includes(opt);
                            return (
                              <div
                                key={opt}
                                className={`flex items-start space-x-2 ${
                                  showAnswerKey && isKey ? 'font-bold text-purple-900 underline' : ''
                                }`}
                              >
                                <span className="w-4 font-semibold uppercase">[ ] {opt}.</span>
                                <span>{q.options[opt]}</span>
                                {showAnswerKey && isKey && (
                                  <span className="text-[10px] font-mono text-purple-700 ml-1">
                                    [KUNCI BENAR]
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Bentuk: Isian Singkat */}
                      {q.questionType === 'isian_singkat' && (
                        <div className="mt-3 pl-2 font-sans">
                          {showAnswerKey ? (
                            <div className="p-2 bg-emerald-50 border border-emerald-300 rounded text-xs text-emerald-950 font-medium">
                              <span className="font-bold">Kunci Jawaban Singkat:</span> {q.correctAnswer}
                              {q.keywords && q.keywords.length > 0 && (
                                <div className="mt-1 text-[11px] text-emerald-800">
                                  <strong>Kata Kunci Penskoran AI:</strong> {q.keywords.join(', ')}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="border-b border-dashed border-gray-400 h-8 max-w-md mt-1 flex items-end text-gray-400 text-xs italic">
                              Jawaban: ................................................................
                            </div>
                          )}
                        </div>
                      )}

                      {/* Bentuk: Uraian */}
                      {q.questionType === 'uraian' && (
                        <div className="mt-3 pl-2 font-sans">
                          {showAnswerKey ? (
                            <div className="p-2.5 bg-indigo-50 border border-indigo-300 rounded text-xs text-indigo-950 space-y-1">
                              <p>
                                <strong>Kunci Jawaban Esensial:</strong> {q.correctAnswer}
                              </p>
                              {q.keywords && q.keywords.length > 0 && (
                                <p className="text-[11px] text-indigo-900">
                                  <strong>Kata Kunci Penskoran Otomatis AI:</strong> {q.keywords.join(', ')}
                                </p>
                              )}
                              {q.rubricGuide && (
                                <p className="text-[11px] text-slate-700 italic">
                                  <strong>Rubrik:</strong> {q.rubricGuide}
                                </p>
                              )}
                            </div>
                          ) : (
                            <div className="space-y-3 py-2">
                              <div className="border-b border-dotted border-gray-400 h-6"></div>
                              <div className="border-b border-dotted border-gray-400 h-6"></div>
                              <div className="border-b border-dotted border-gray-400 h-6"></div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Pembahasan jika mode kunci aktif */}
                      {showAnswerKey && q.explanation && (
                        <div className="mt-2 text-[11px] font-sans bg-gray-100 p-2 rounded border border-gray-300">
                          <span className="font-bold">Pembahasan & Penjelasan Konsep:</span> {q.explanation}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* DOKUMEN 2: KISI-KISI SOAL (TAKSONOMI BLOOM & ANDERSON)     */}
        {/* ========================================================= */}
        {printMode === 'kisi_kisi' && currentExam && (
          <div className="space-y-6">
            <div className="text-center my-3">
              <h3 className="font-bold text-sm sm:text-base uppercase tracking-wider underline">
                MATRIKS KISI-KISI PENULISAN BUTIR SOAL
              </h3>
              <p className="text-xs text-gray-700 font-sans mt-0.5">
                Berdasarkan Taksonomi Bloom & Anderson (C1 - C6) serta Kurikulum Standar Nasional
              </p>
            </div>

            {/* Tabel Kisi-Kisi Resmi Kedinasan */}
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-black text-xs font-sans">
                <thead>
                  <tr className="bg-gray-100 text-center font-bold text-[11px]">
                    <th className="border border-black p-2 w-8">No</th>
                    <th className="border border-black p-2 text-left w-48">Materi Pokok / Lingkup Materi</th>
                    <th className="border border-black p-2 text-left">Indikator Soal</th>
                    <th className="border border-black p-2 w-24">Bentuk Soal</th>
                    <th className="border border-black p-2 w-16">Level Kognitif</th>
                    <th className="border border-black p-2 w-14">Kategori</th>
                    <th className="border border-black p-2 w-14">Bobot Skor</th>
                    <th className="border border-black p-2 text-left w-44">Kunci / Kata Kunci Penskoran AI</th>
                  </tr>
                </thead>
                <tbody>
                  {currentExam.questions.map((q, idx) => {
                    const catBadge = getCognitiveCategoryLabel(q.cognitiveLevel);
                    return (
                      <tr key={q.id || idx} className="print-break-inside-avoid align-top hover:bg-gray-50">
                        <td className="border border-black p-2 text-center font-bold">{idx + 1}</td>
                        <td className="border border-black p-2 font-medium">
                          {q.category || currentExam.subject}
                        </td>
                        <td className="border border-black p-2 leading-relaxed">
                          {q.competencyIndicator ||
                            `Disajikan stimulus materi ${q.category || currentExam.subject}, peserta didik mampu menyelesaikan permasalahan yang diberikan secara tepat.`}
                        </td>
                        <td className="border border-black p-2 text-center capitalize text-[11px]">
                          {q.questionType === 'isian_singkat'
                            ? 'Isian Singkat'
                            : q.questionType === 'uraian'
                            ? 'Uraian'
                            : q.questionType === 'benar_salah'
                            ? 'Benar / Salah'
                            : q.questionType === 'pilihan_ganda_kompleks'
                            ? 'PG Kompleks'
                            : 'Pilihan Ganda'}
                        </td>
                        <td className="border border-black p-2 text-center font-bold text-[11px]">
                          {q.cognitiveLevel || 'C3'}
                        </td>
                        <td className="border border-black p-2 text-center font-bold text-[10px]">
                          <span className={`px-1.5 py-0.5 rounded border ${catBadge.color}`}>
                            {catBadge.text}
                          </span>
                        </td>
                        <td className="border border-black p-2 text-center font-bold">
                          {q.scoreWeight || (q.questionType === 'uraian' ? 4 : q.questionType === 'isian_singkat' ? 2 : 1)}
                        </td>
                        <td className="border border-black p-2 text-[11px]">
                          {q.questionType === 'pilihan_ganda' || q.questionType === 'benar_salah' ? (
                            <span className="font-bold text-emerald-900 uppercase">
                              Kunci: {q.correctAnswer}
                            </span>
                          ) : (
                            <div className="space-y-0.5">
                              <span className="font-semibold block">{q.correctAnswer}</span>
                              {q.keywords && q.keywords.length > 0 && (
                                <span className="text-[10px] text-indigo-700 block italic">
                                  Keywords AI: {q.keywords.join(', ')}
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Rekapitulasi Distribusi Level Kognitif Taksonomi Bloom & Anderson */}
            <div className="border border-black p-4 mt-6 print-break-inside-avoid font-sans text-xs space-y-3">
              <h4 className="font-bold text-sm uppercase tracking-wide border-b border-black pb-1">
                II. REKAPITULASI DISTRIBUSI LEVEL KOGNITIF TAKSONOMI BLOOM & ANDERSON
              </h4>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 pt-1">
                {BLOOM_COGNITIVE_LEVELS.map((bloom) => {
                  const cnt = cognitiveStats.cCounts[bloom.level] || 0;
                  const pct =
                    currentExam.questions.length > 0
                      ? Math.round((cnt / currentExam.questions.length) * 100)
                      : 0;
                  return (
                    <div
                      key={bloom.level}
                      className="border border-slate-300 p-2 rounded-lg text-center bg-slate-50"
                    >
                      <span className="font-black text-xs block text-purple-900">{bloom.level}</span>
                      <span className="text-[10px] text-slate-600 block leading-tight">
                        {bloom.label.split(' - ')[1]}
                      </span>
                      <span className="text-sm font-bold text-slate-900 mt-1 block">
                        {cnt} Soal <span className="text-[10px] font-normal text-slate-500">({pct}%)</span>
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Rekap LOTS, MOTS, HOTS & Total Skor */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-200 text-center font-bold">
                <div className="p-2 bg-blue-50 rounded border border-blue-200 text-blue-900">
                  <span className="text-[10px] block uppercase">LOTS (C1 - C2)</span>
                  <span className="text-sm">{cognitiveStats.lots} Butir Soal</span>
                </div>
                <div className="p-2 bg-amber-50 rounded border border-amber-200 text-amber-900">
                  <span className="text-[10px] block uppercase">MOTS (C3)</span>
                  <span className="text-sm">{cognitiveStats.mots} Butir Soal</span>
                </div>
                <div className="p-2 bg-rose-50 rounded border border-rose-200 text-rose-900">
                  <span className="text-[10px] block uppercase">HOTS (C4 - C6)</span>
                  <span className="text-sm">{cognitiveStats.hots} Butir Soal</span>
                </div>
                <div className="p-2 bg-emerald-50 rounded border border-emerald-200 text-emerald-900">
                  <span className="text-[10px] block uppercase">Total Bobot Skor</span>
                  <span className="text-sm">{cognitiveStats.totalScore} Poin Maksimal</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* DOKUMEN 3: PEDOMAN PENSKORAN & RUBRIK KATA KUNCI AI       */}
        {/* ========================================================= */}
        {printMode === 'rubrik_skoring' && currentExam && (
          <div className="space-y-6 font-sans text-xs">
            <div className="text-center my-3 font-serif">
              <h3 className="font-bold text-sm sm:text-base uppercase tracking-wider underline">
                PEDOMAN PENSKORAN & SISTEM KATA KUNCI OTOMATIS (AI SCORING)
              </h3>
              <p className="text-xs text-gray-700 font-sans mt-0.5">
                Acuan Penilaian Objektif Guru dan Verifikasi Algoritma Kecerdasan Buatan CBT Sekolah
              </p>
            </div>

            {/* Aturan Penskoran Umum */}
            <div className="border border-black p-3 space-y-1.5">
              <h4 className="font-bold text-xs uppercase tracking-wider">A. Ketentuan Umum Penskoran:</h4>
              <ul className="list-disc list-inside space-y-1 text-slate-800">
                <li>
                  <strong>Soal Pilihan Ganda:</strong> Jawaban benar bernilai skor penuh (Bobot = 1), jawaban salah bernilai 0.
                </li>
                <li>
                  <strong>Soal Isian Singkat:</strong> Sistem AI memeriksa kecocokan kata kunci esensial (toleransi sinonim dan huruf besar/kecil).
                </li>
                <li>
                  <strong>Soal Uraian / Esai:</strong> Sistem AI menghitung rasio ketercakupan kata kunci (keywords) dan kelengkapan argumen sesuai panduan rubrik berjenjang.
                </li>
                <li>
                  <strong>Rumus Nilai Akhir (Skala 0 - 100):</strong>{' '}
                  <span className="font-mono font-bold bg-gray-100 px-1.5 py-0.5 rounded border border-gray-300">
                    Nilai Akhir = (Total Skor Diperoleh / {cognitiveStats.totalScore}) × 100
                  </span>
                </li>
              </ul>
            </div>

            {/* Rincian Kunci Jawaban & Rubrik per Butir Soal */}
            <div className="space-y-4">
              <h4 className="font-bold text-sm uppercase tracking-wide border-b border-black pb-1">
                B. Rincian Kunci Jawaban, Kata Kunci Penskoran & Rubrik Penilaian:
              </h4>

              {currentExam.questions.map((q, idx) => (
                <div
                  key={q.id || idx}
                  className="print-break-inside-avoid border border-slate-300 rounded-xl p-3.5 bg-slate-50/50 space-y-2"
                >
                  <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                    <div className="flex items-center space-x-2">
                      <span className="w-5 h-5 rounded bg-slate-800 text-white font-bold flex items-center justify-center text-[11px]">
                        {idx + 1}
                      </span>
                      <span className="font-bold text-slate-800">
                        {q.category || currentExam.subject}
                      </span>
                      <span className="text-[10px] bg-purple-100 text-purple-800 font-bold px-1.5 py-0.5 rounded">
                        {q.cognitiveLevel || 'C3'}
                      </span>
                      <span className="text-[10px] uppercase text-slate-500 font-semibold">
                        ({q.questionType?.replace('_', ' ') || 'Pilihan Ganda'})
                      </span>
                    </div>

                    <span className="font-bold text-emerald-800 text-xs bg-emerald-100 px-2 py-0.5 rounded">
                      Bobot: {q.scoreWeight || (q.questionType === 'uraian' ? 4 : q.questionType === 'isian_singkat' ? 2 : 1)} Poin
                    </span>
                  </div>

                  <p className="font-medium text-slate-900 text-xs">{q.question}</p>

                  {/* Kunci Jawaban Utama */}
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200 space-y-1">
                    <div className="flex items-start space-x-1.5">
                      <span className="font-bold text-slate-700 min-w-[120px]">Kunci Jawaban:</span>
                      <span className="font-bold text-emerald-800 uppercase">
                        {q.questionType === 'pilihan_ganda_kompleks'
                          ? (q.correctAnswers || [q.correctAnswer]).join(', ')
                          : q.correctAnswer}
                      </span>
                    </div>

                    {/* Kata Kunci Penskoran AI (Khusus Isian & Uraian) */}
                    {(q.questionType === 'isian_singkat' || q.questionType === 'uraian') && (
                      <div className="flex items-start space-x-1.5 pt-1 border-t border-slate-100">
                        <span className="font-bold text-indigo-700 min-w-[120px] flex items-center space-x-1">
                          <Sparkles className="w-3 h-3 text-indigo-600" />
                          <span>Kata Kunci AI:</span>
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {(q.keywords && q.keywords.length > 0
                            ? q.keywords
                            : [q.correctAnswer]
                          ).map((kw, kwIdx) => (
                            <span
                              key={kwIdx}
                              className="px-1.5 py-0.5 bg-indigo-50 text-indigo-900 border border-indigo-200 rounded text-[10px] font-semibold"
                            >
                              "{kw}"
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Panduan Rubrik Berjenjang */}
                    {q.rubricGuide && (
                      <div className="flex items-start space-x-1.5 pt-1 border-t border-slate-100 text-[11px] text-slate-700">
                        <span className="font-bold text-slate-600 min-w-[120px]">Pedoman Rubrik:</span>
                        <span>{q.rubricGuide}</span>
                      </div>
                    )}
                  </div>

                  {q.explanation && (
                    <p className="text-[11px] text-slate-600 italic">
                      <strong>Penjelasan Konseptual:</strong> {q.explanation}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tanda Tangan Pengesahan di Akhir Naskah Dokumen */}
        <div className="mt-12 pt-6 border-t-2 border-black grid grid-cols-2 text-center text-xs font-sans print-break-inside-avoid">
          <div>
            <p>Mengetahui,</p>
            <p className="font-bold">Kepala Sekolah</p>
            <div className="h-16"></div>
            <p className="font-bold underline">{schoolSettings.kepalaSekolah}</p>
            <p className="text-[11px]">NIP. {schoolSettings.nipKepalaSekolah}</p>
          </div>
          <div>
            <p>
              Jakarta,{' '}
              {new Date().toLocaleDateString('id-ID', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </p>
            <p className="font-bold">Guru Mata Pelajaran / Tim Penyusun</p>
            <div className="h-16"></div>
            <p className="font-bold underline">
              {schoolSettings.guruPengampu || 'Tim MGMP / Guru Pengampu'}
            </p>
            <p className="text-[11px]">
              NIP. {schoolSettings.nipGuruPengampu || '19850315 201001 1 012'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
