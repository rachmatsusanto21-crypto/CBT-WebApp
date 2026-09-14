import React, { useState } from 'react';
import {
  BarChart3,
  Award,
  Download,
  Eye,
  CheckCircle,
  AlertTriangle,
  Printer,
  Sparkles,
  Search,
  BookOpen,
  Cloud,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import { ExamResult, SchoolSettings, Exam } from '../types';
import { Letterhead } from './Letterhead';
import { syncResultsToFirestore, syncAnalysisToFirestore, generateExamsAnalysis } from '../services/firestoreSyncService';
import { saveResultsToDrive, saveAnalysisToDrive } from '../services/googleDriveService';
import { getAccessToken, googleSignIn } from '../services/firebaseAuth';

interface ResultsTableProps {
  results: ExamResult[];
  exams?: Exam[];
  schoolSettings: SchoolSettings;
}

export const ResultsTable: React.FC<ResultsTableProps> = ({ results, exams = [], schoolSettings }) => {
  const [selectedResult, setSelectedResult] = useState<ExamResult | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSyncingCloud, setIsSyncingCloud] = useState<boolean>(false);
  const [cloudFeedback, setCloudFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Upload results & item analysis to Firebase Firestore and Google Drive
  const handleUploadResultsAndAnalysisCloud = async () => {
    if (results.length === 0) return;
    setIsSyncingCloud(true);
    setCloudFeedback(null);
    try {
      // 1. Sync to Firebase Firestore
      const resCount = await syncResultsToFirestore(results);
      const analysisData = generateExamsAnalysis(exams, results);
      const anaCount = await syncAnalysisToFirestore(analysisData);

      // 2. Sync to Google Drive
      let driveNote = '';
      let token = await getAccessToken();
      if (!token) {
        try {
          const res = await googleSignIn();
          if (res) token = res.accessToken;
        } catch {
          driveNote = ' (Google Drive dapat dihubungkan di menu Cloud Sync)';
        }
      }
      if (token) {
        await saveResultsToDrive(results, token);
        await saveAnalysisToDrive(analysisData, token);
        driveNote = ' & Google Drive (Data Nilai + Analisis Butir Soal)';
      }

      setCloudFeedback({
        type: 'success',
        text: `Berhasil mengunggah ${resCount} nilai & ${anaCount} analisis butir soal ke Firebase Firestore${driveNote}!`,
      });
    } catch (err: any) {
      setCloudFeedback({
        type: 'error',
        text: err.message || 'Gagal mengunggah data nilai & analisis ke Cloud.',
      });
    } finally {
      setIsSyncingCloud(false);
    }
  };

  const filtered = results.filter(
    (r) =>
      r.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.examCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.examTitle.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalSubmissions = results.length;
  const avgScore =
    totalSubmissions > 0
      ? Math.round(results.reduce((acc, r) => acc + r.score, 0) / totalSubmissions)
      : 0;
  const highestScore = totalSubmissions > 0 ? Math.max(...results.map((r) => r.score)) : 0;
  const passedCount = results.filter((r) => r.score >= 75).length;
  const passRate = totalSubmissions > 0 ? Math.round((passedCount / totalSubmissions) * 100) : 0;

  // Export to CSV
  const handleExportCSV = () => {
    if (results.length === 0) return;
    const headers = [
      'Timestamp',
      'Nama Siswa',
      'NISN',
      'Kelas',
      'Kode Soal',
      'Judul Ujian',
      'Nilai',
      'Benar',
      'Salah',
      'Persentase',
      'Pelanggaran Keluar Tab',
      'Status',
    ];

    const rows = results.map((r) => [
      `"${r.timestamp}"`,
      `"${r.studentName}"`,
      `"${r.nisn || '-'}"`,
      `"${r.className || '-'}"`,
      `"${r.examCode}"`,
      `"${r.examTitle}"`,
      r.score,
      r.correctCount,
      r.wrongCount,
      `"${r.percentage}"`,
      r.tabSwitches,
      r.score >= 75 ? '"Tuntas"' : '"Remedial"',
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Rekap_Nilai_CBT_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header & Export Button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center space-x-2">
            <BarChart3 className="w-6 h-6 text-blue-600" />
            <span>Rekapitulasi Nilai & Analisis Remedial</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Hasil ujian seluruh siswa yang terintegrasi otomatis dengan analisis butir salah dan rekomendasi AI.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleUploadResultsAndAnalysisCloud}
            disabled={isSyncingCloud || results.length === 0}
            className="flex items-center space-x-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white text-xs sm:text-sm font-bold px-4 py-2 rounded-xl shadow-sm transition-all disabled:opacity-50"
            title="Unggah rekap nilai dan analisis butir soal ke Firebase Firestore & Google Drive"
          >
            <Cloud className="w-4 h-4" />
            <span>{isSyncingCloud ? 'Mengunggah...' : 'Unggah Nilai & Analisis ke Cloud'}</span>
          </button>

          <button
            onClick={handleExportCSV}
            disabled={results.length === 0}
            className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold px-4 py-2 rounded-xl shadow transition-all disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            <span>Export Excel / CSV</span>
          </button>
        </div>
      </div>

      {cloudFeedback && (
        <div
          className={`p-3.5 rounded-2xl text-xs flex items-center space-x-2 border ${
            cloudFeedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : 'bg-rose-50 border-rose-300 text-rose-900'
          }`}
        >
          {cloudFeedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{cloudFeedback.text}</span>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase">Rata-Rata Kelas</span>
          <p className="text-2xl sm:text-3xl font-black text-blue-600 mt-2">{avgScore}</p>
          <p className="text-xs text-slate-500 mt-1">Skor rata-rata siswa</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase">Nilai Tertinggi</span>
          <p className="text-2xl sm:text-3xl font-black text-emerald-600 mt-2">{highestScore}</p>
          <p className="text-xs text-slate-500 mt-1">Skor maksimal tercapai</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase">Tingkat Ketuntasan</span>
          <p className="text-2xl sm:text-3xl font-black text-indigo-600 mt-2">{passRate}%</p>
          <p className="text-xs text-slate-500 mt-1">{passedCount} dari {totalSubmissions} siswa tuntas</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase">Perlu Remedial</span>
          <p className="text-2xl sm:text-3xl font-black text-amber-600 mt-2">{totalSubmissions - passedCount}</p>
          <p className="text-xs text-slate-500 mt-1">Siswa di bawah KKM (75)</p>
        </div>
      </div>

      {/* Results Table Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari siswa, kelas, atau kode soal..."
              className="w-full bg-white border border-slate-300 rounded-xl pl-9 pr-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="text-xs text-slate-500">
            Total <span className="font-bold text-slate-800">{filtered.length}</span> data nilai tercatat
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                <th className="py-3 px-4">Waktu Submit</th>
                <th className="py-3 px-4">Nama Siswa</th>
                <th className="py-3 px-3">Kode Soal</th>
                <th className="py-3 px-3">Nilai</th>
                <th className="py-3 px-3">Benar / Salah</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3">Pelanggaran Tab</th>
                <th className="py-3 px-4 text-right">Rekomendasi AI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <BookOpen className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    <p className="font-medium text-slate-600">Belum ada hasil ujian yang diserahkan.</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Ketika siswa menyelesaikan ujian pada Mode Siswa, rekap nilai dan hasil remedial otomatis muncul di sini.
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map((r, idx) => {
                  const isPassed = r.score >= 75;

                  return (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4 text-slate-500 whitespace-nowrap font-mono text-[11px]">
                        {r.timestamp}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        {r.studentName}
                        <span className="block text-[10px] text-slate-400 font-normal">
                          {r.className} • NISN: {r.nisn}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-mono bg-slate-100 text-slate-800 px-2 py-0.5 rounded font-bold border border-slate-200">
                          {r.examCode}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-bold text-sm">
                        <span className={isPassed ? 'text-emerald-700' : 'text-rose-700'}>
                          {r.score}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-600">
                        <span className="text-emerald-700 font-semibold">{r.correctCount}B</span> / <span className="text-rose-700 font-semibold">{r.wrongCount}S</span>
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            isPassed
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {isPassed ? 'TUNTAS' : 'REMEDIAL'}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        {r.tabSwitches > 0 ? (
                          <span className="px-2 py-0.5 text-[11px] font-bold bg-rose-100 text-rose-800 rounded-full">
                            {r.tabSwitches}x
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">0x (Aman)</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => setSelectedResult(r)}
                          className="inline-flex items-center space-x-1 px-3 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-lg text-xs font-semibold transition-colors"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Lihat Analisis AI</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Detailed Remedial & Result View */}
      {selectedResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-3xl w-full shadow-2xl border border-slate-200 my-8">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-purple-700 bg-purple-100 px-2.5 py-0.5 rounded-md">
                  Analisis Remedial Siswa
                </span>
                <h3 className="text-lg font-black text-slate-900 mt-1">
                  {selectedResult.studentName} ({selectedResult.className})
                </h3>
              </div>
              <button
                onClick={() => setSelectedResult(null)}
                className="text-slate-400 hover:text-slate-600 text-base font-bold px-2 py-1"
              >
                ✕
              </button>
            </div>

            {/* Score Pill Details */}
            <div className="grid grid-cols-3 gap-3 my-4 text-center">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <span className="text-[11px] font-semibold text-slate-500 uppercase">Nilai CBT</span>
                <p className="text-2xl font-black text-blue-900 mt-0.5">{selectedResult.score}</p>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <span className="text-[11px] font-semibold text-slate-500 uppercase">Akurasi</span>
                <p className="text-2xl font-black text-emerald-800 mt-0.5">{selectedResult.percentage}</p>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <span className="text-[11px] font-semibold text-slate-500 uppercase">Pelanggaran Tab</span>
                <p className="text-2xl font-black text-slate-800 mt-0.5">{selectedResult.tabSwitches}x</p>
              </div>
            </div>

            {/* Gemini Remedial Text */}
            <div className="bg-purple-50/70 border border-purple-200 p-5 rounded-2xl text-xs sm:text-sm text-slate-800 max-h-72 overflow-y-auto space-y-2 whitespace-pre-line leading-relaxed">
              <div className="flex items-center space-x-2 text-purple-900 font-bold border-b border-purple-200 pb-2 mb-2">
                <Sparkles className="w-4 h-4 text-purple-700" />
                <span>Rekomendasi Diagnostik & Materi Pengayaan (Gemini AI)</span>
              </div>
              {selectedResult.remedialReport}
            </div>

            {/* Wrong Answers List */}
            {selectedResult.wrongAnswers && selectedResult.wrongAnswers.length > 0 && (
              <div className="mt-4">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Soal yang Dijawab Keliru ({selectedResult.wrongAnswers.length} Soal)
                </h4>
                <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                  {selectedResult.wrongAnswers.map((w, idx) => (
                    <div key={idx} className="bg-slate-50 border border-slate-200 p-3 rounded-xl text-xs">
                      <p className="font-semibold text-slate-900">
                        {w.questionNumber}. {w.question}
                      </p>
                      <p className="text-rose-700 mt-1 font-medium">
                        Jawaban Siswa: {w.studentAnswer}
                      </p>
                      <p className="text-emerald-700 font-medium">
                        Kunci Tepat: {w.correctAnswer}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end pt-5 border-t border-slate-200 mt-5">
              <button
                onClick={() => setSelectedResult(null)}
                className="bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold px-5 py-2 rounded-xl"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
