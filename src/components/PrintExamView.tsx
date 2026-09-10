import React, { useState } from 'react';
import { Printer, Settings2, FileText, CheckCircle, HelpCircle } from 'lucide-react';
import { Exam, SchoolSettings } from '../types';
import { Letterhead } from './Letterhead';

interface PrintExamViewProps {
  exams: Exam[];
  schoolSettings: SchoolSettings;
  onUpdateSettings: (newSettings: SchoolSettings) => void;
  defaultSelectedExam?: Exam | null;
}

export const PrintExamView: React.FC<PrintExamViewProps> = ({
  exams,
  schoolSettings,
  onUpdateSettings,
  defaultSelectedExam,
}) => {
  const [selectedExamId, setSelectedExamId] = useState<string>(
    defaultSelectedExam?.id || exams[0]?.id || ''
  );
  const [showAnswerKey, setShowAnswerKey] = useState<boolean>(false);
  const [isEditingSettings, setIsEditingSettings] = useState<boolean>(false);
  const [tempSettings, setTempSettings] = useState<SchoolSettings>(schoolSettings);

  const currentExam = exams.find((e) => e.id === selectedExamId) || exams[0];

  const handleSaveSettings = () => {
    onUpdateSettings(tempSettings);
    setIsEditingSettings(false);
  };

  return (
    <div className="space-y-6">
      {/* Top Toolbar (Hidden when printing via .no-print) */}
      <div className="no-print bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center space-x-2">
            <Printer className="w-6 h-6 text-emerald-600" />
            <span>Cetak Soal dengan Kop Surat Resmi</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Format standar kertas A4 lengkap dengan kop surat kedinasan, petunjuk umum, dan opsi cetak kunci jawaban.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Select Exam Dropdown */}
          <select
            value={selectedExamId}
            onChange={(e) => setSelectedExamId(e.target.value)}
            className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            {exams.map((ex) => (
              <option key={ex.id} value={ex.id}>
                [{ex.code}] {ex.title}
              </option>
            ))}
          </select>

          {/* Toggle Answer Key */}
          <button
            onClick={() => setShowAnswerKey(!showAnswerKey)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
              showAnswerKey
                ? 'bg-emerald-100 text-emerald-800 border-emerald-300 font-bold'
                : 'bg-slate-100 text-slate-600 border-slate-300'
            }`}
          >
            {showAnswerKey ? '✓ Kunci Jawaban Aktif' : 'Tanpa Kunci (Lembar Siswa)'}
          </button>

          {/* Edit Letterhead */}
          <button
            onClick={() => setIsEditingSettings(!isEditingSettings)}
            className="flex items-center space-x-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
          >
            <Settings2 className="w-3.5 h-3.5" />
            <span>Ubah Kop Surat</span>
          </button>

          {/* Print Button */}
          <button
            onClick={() => window.print()}
            className="flex items-center space-x-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow transition-all"
          >
            <Printer className="w-4 h-4" />
            <span>Cetak Soal (Ctrl+P)</span>
          </button>
        </div>
      </div>

      {/* Letterhead Configuration Drawer */}
      {isEditingSettings && (
        <div className="no-print bg-slate-50 border border-slate-300 rounded-2xl p-5 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
            Pengaturan Kop Surat Kedinasan & Tanda Tangan
          </h3>

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
          </div>

          <div className="flex justify-end space-x-2 pt-2">
            <button
              onClick={() => setIsEditingSettings(false)}
              className="px-3 py-1 text-xs text-slate-600 hover:bg-slate-200 rounded-lg"
            >
              Batal
            </button>
            <button
              onClick={handleSaveSettings}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 py-1.5 rounded-lg"
            >
              Simpan Pengaturan Kop
            </button>
          </div>
        </div>
      )}

      {/* Official Printable Exam Paper Document */}
      <div className="print-sheet bg-white p-8 sm:p-12 rounded-2xl shadow-md border border-slate-200 max-w-4xl mx-auto font-serif text-black leading-relaxed">
        {/* Kop Surat Resmi */}
        <Letterhead
          settings={schoolSettings}
          documentTitle="NASKAH SOAL PENILAIAN HASIL BELAJAR"
          subTitle={currentExam ? currentExam.title : 'UJIAN AKHIR SEMESTER'}
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

        {/* Petunjuk Umum Pengerjaan Ujian */}
        <div className="border border-black p-3 my-4 text-xs font-sans">
          <p className="font-bold uppercase tracking-wider mb-1">PETUNJUK UMUM:</p>
          <ol className="list-decimal list-inside space-y-0.5 text-gray-800">
            <li>Tuliskan nama lengkap, nomor peserta, dan kelas pada lembar jawaban yang telah disediakan.</li>
            <li>Periksa dan bacalah setiap butir soal dengan saksama sebelum Anda menjawabnya.</li>
            <li>Pilihlah salah satu jawaban yang paling tepat dengan memberi tanda silang (X) atau menghitamkan bulatan pada huruf A, B, C, atau D.</li>
            <li>Dilarang menggunakan kalkulator, tabel matematika, atau alat bantu elektronik lainnya kecuali diperkenankan.</li>
            <li>Laporkan kepada pengawas ujian jika terdapat tulisan yang kurang jelas, rusak, atau jumlah soal tidak lengkap.</li>
          </ol>
        </div>

        {/* Butir Soal Ujian Pilihan Ganda */}
        {currentExam && (
          <div className="space-y-6 mt-6">
            <h4 className="text-center font-bold text-sm uppercase tracking-wide border-b border-black pb-1 mb-4">
              I. PILIHAN GANDA
            </h4>

            {currentExam.questions.map((q, idx) => (
              <div key={q.id} className="print-break-inside-avoid text-xs sm:text-[13px] leading-relaxed">
                <div className="flex items-start space-x-2">
                  <span className="font-bold w-6 text-right flex-shrink-0">{idx + 1}.</span>
                  <div className="flex-1">
                    <p className="text-gray-900 font-medium whitespace-pre-line">{q.question}</p>

                    {/* Options (A, B, C, D) in 2-column print layout */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 mt-2 pl-2">
                      {(['a', 'b', 'c', 'd'] as const).map((opt) => {
                        const isKey = q.correctAnswer === opt;
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

                    {/* Pembahasan jika mode kunci aktif */}
                    {showAnswerKey && q.explanation && (
                      <div className="mt-2 text-[11px] font-sans bg-gray-100 p-2 rounded border border-gray-300">
                        <span className="font-bold">Pembahasan:</span> {q.explanation}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tanda Tangan Pengesahan di Akhir Naskah */}
        <div className="mt-12 pt-6 border-t border-black grid grid-cols-2 text-center text-xs font-sans print-break-inside-avoid">
          <div>
            <p>Mengetahui,</p>
            <p className="font-bold">Kepala Sekolah</p>
            <div className="h-16"></div>
            <p className="font-bold underline">{schoolSettings.kepalaSekolah}</p>
            <p className="text-[11px]">NIP. {schoolSettings.nipKepalaSekolah}</p>
          </div>
          <div>
            <p>Jakarta, {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
            <p className="font-bold">Guru Mata Pelajaran</p>
            <div className="h-16"></div>
            <p className="font-bold underline">Tim Penyusun Soal</p>
            <p className="text-[11px]">NIP. -</p>
          </div>
        </div>
      </div>
    </div>
  );
};
