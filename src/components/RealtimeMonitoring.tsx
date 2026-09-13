import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Users,
  Activity,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Clock,
  Eye,
  RotateCcw,
  Sparkles,
  Search,
  Filter,
  Trash2,
  AlertOctagon,
  BellRing,
  CheckCircle2,
  Send,
} from 'lucide-react';
import { MonitoringStudent, ViolationLog } from '../types';
import { safeFetchJson } from '../utils/apiHelper';

interface RealtimeMonitoringProps {
  initialStudents: MonitoringStudent[];
  onRefreshRequest?: () => void;
  onCleanNoiseRequest?: () => void;
}

export const RealtimeMonitoring: React.FC<RealtimeMonitoringProps> = ({
  initialStudents,
  onRefreshRequest,
  onCleanNoiseRequest,
}) => {
  const [students, setStudents] = useState<MonitoringStudent[]>(initialStudents);
  const [isAutoRefresh, setIsAutoRefresh] = useState<boolean>(true);
  const [selectedStudentLogs, setSelectedStudentLogs] = useState<{
    name: string;
    examCode: string;
    logs: ViolationLog[];
    count: number;
  } | null>(null);
  const [warningTarget, setWarningTarget] = useState<{
    name: string;
    examCode: string;
  } | null>(null);
  const [customWarningText, setCustomWarningText] = useState<string>(
    'Peringatan Pengawas: Harap fokus pada layar CBT dan jangan berpindah ke aplikasi/tab lain!'
  );
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isCleaning, setIsCleaning] = useState<boolean>(false);

  // Poll backend monitoring data safely
  const fetchMonitoringData = async () => {
    try {
      setIsRefreshing(true);
      const { ok, data } = await safeFetchJson('/api/monitoring');
      if (ok && data?.students) {
        setStudents(data.students);
      }
    } catch (err) {
      console.error('Failed to fetch monitoring data:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchMonitoringData();

    if (!isAutoRefresh) return;
    const interval = setInterval(fetchMonitoringData, 3000);
    return () => clearInterval(interval);
  }, [isAutoRefresh]);

  // Update when prop changes
  useEffect(() => {
    if (initialStudents.length > 0) {
      setStudents(initialStudents);
    }
  }, [initialStudents]);

  const showNotification = (msg: string) => {
    setActionSuccessMsg(msg);
    setTimeout(() => setActionSuccessMsg(null), 3500);
  };

  // Send Direct Warning to Student Screen
  const handleSendWarning = async () => {
    if (!warningTarget) return;
    try {
      const { ok } = await safeFetchJson('/api/monitoring/warn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentName: warningTarget.name,
          examCode: warningTarget.examCode,
          message: customWarningText,
        }),
      });
      if (ok) {
        showNotification(`Peringatan terkirim ke gawai ${warningTarget.name}!`);
        setWarningTarget(null);
        fetchMonitoringData();
      }
    } catch (err) {
      console.error('Send warning error:', err);
    }
  };

  // Disqualify Student
  const handleDisqualify = async (studentName: string, examCode: string) => {
    if (!confirm(`Apakah Anda yakin ingin MENDISKUALIFIKASI ${studentName}? Lembar ujiannya akan otomatis dihentikan.`)) {
      return;
    }
    try {
      const { ok } = await safeFetchJson('/api/monitoring/disqualify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentName, examCode }),
      });
      if (ok) {
        showNotification(`${studentName} telah didiskualifikasi dari ujian.`);
        fetchMonitoringData();
      }
    } catch (err) {
      console.error('Disqualify error:', err);
    }
  };

  // Reset student status action
  const handleResetStudentStatus = async (studentName: string, examCode: string) => {
    try {
      const { ok } = await safeFetchJson('/api/monitoring/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentName, examCode }),
      });
      if (ok) {
        showNotification(`Status ${studentName} berhasil direset ke normal.`);
        fetchMonitoringData();
      }
    } catch (err) {
      console.error('Reset status error:', err);
    }
  };

  // Remove single student from monitoring
  const handleRemoveStudent = async (studentName: string, examCode: string) => {
    try {
      await safeFetchJson('/api/monitoring/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentName, examCode }),
      });
      showNotification(`Sesi ${studentName} dihapus dari daftar pengawasan.`);
      fetchMonitoringData();
    } catch (err) {
      console.error('Remove error:', err);
    }
  };

  // Clear all monitoring logs
  const handleClearAll = async () => {
    if (!confirm('Kosongkan semua sesi pengawasan real-time?')) return;
    try {
      await safeFetchJson('/api/monitoring/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      setStudents([]);
      showNotification('Seluruh riwayat pengawasan telah dikosongkan.');
    } catch (err) {
      console.error('Clear all error:', err);
    }
  };

  // Clean Noise AI Studio
  const handleCleanNoise = async () => {
    if (!confirm('Bersihkan seluruh soal contoh bawaan AI Studio dan data dummy?')) return;
    setIsCleaning(true);
    try {
      const { ok, data } = await safeFetchJson('/api/clean-ai-noise', { method: 'POST' });
      if (ok) {
        showNotification('Database dibersihkan dari seluruh naskah contoh & dummy!');
        if (onCleanNoiseRequest) onCleanNoiseRequest();
        fetchMonitoringData();
      }
    } catch (err) {
      console.error('Clean noise error:', err);
    } finally {
      setIsCleaning(false);
    }
  };

  // Add dummy active test students for demonstration if list is empty
  const handleSimulateActiveStudent = async () => {
    const dummyNames = ['Budi Santoso', 'Siti Nurhaliza Putri', 'Rizky Alamsyah', 'Nabila Zahra Khairunnisa'];
    const randomName = dummyNames[Math.floor(Math.random() * dummyNames.length)];
    const randomProgress = Math.floor(Math.random() * 80) + 15;

    try {
      await safeFetchJson('/api/monitoring/ping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentName: randomName,
          examCode: 'PENILAIAN-1',
          className: 'X-MIPA 1',
          deviceInfo: 'Smartphone Android',
          currentQuestion: Math.floor(Math.random() * 10) + 1,
          progress: randomProgress,
          answeredCount: Math.round((randomProgress / 100) * 10),
          totalQuestions: 10,
          status: Math.random() > 0.6 ? 'Terdeteksi Keluar Tab' : 'Mengerjakan',
        }),
      });

      if (Math.random() > 0.5) {
        await safeFetchJson('/api/monitoring/violation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            studentName: randomName,
            examCode: 'PENILAIAN-1',
            className: 'X-MIPA 1',
            deviceInfo: 'Smartphone Android',
            violationType: 'Keluar Tab Browser',
            detail: 'Terdeteksi beralih dari jendela CBT ke tab lain',
          }),
        });
      }

      fetchMonitoringData();
      showNotification(`Simulasi sesi ${randomName} ditambahkan.`);
    } catch (err) {
      console.error('Simulate student error:', err);
    }
  };

  // Filtered students
  const filtered = students.filter(
    (s) =>
      s.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.examCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.className && s.className.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const totalActive = students.length;
  const onlineCount = students.filter((s) => s.isOnline && s.status !== 'Selesai' && s.status !== 'Terdiskualifikasi').length;
  const inProgressCount = students.filter((s) => s.status === 'Mengerjakan' || s.status === 'Terdeteksi Keluar Tab').length;
  const finishedCount = students.filter((s) => s.status === 'Selesai').length;
  const violationCount = students.filter((s) => s.tabSwitches > 0).length;

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {actionSuccessMsg && (
        <div className="bg-emerald-600 text-white px-4 py-2.5 rounded-xl shadow-lg text-xs font-semibold flex items-center justify-between animate-fade-in">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>{actionSuccessMsg}</span>
          </div>
          <button onClick={() => setActionSuccessMsg(null)} className="text-white/80 hover:text-white">✕</button>
        </div>
      )}

      {/* Top Header & Stat Cards */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center space-x-2">
            <ShieldAlert className="w-6 h-6 text-blue-600" />
            <span>Pengawasan Real-Time (Anti-Cheat)</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Pantau pergerakan gawai siswa, peringatkan langsung dari layar pengawas, dan deteksi kecurangan secara langsung.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsAutoRefresh(!isAutoRefresh)}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
              isAutoRefresh
                ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                : 'bg-slate-100 text-slate-600 border-slate-300'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${isAutoRefresh ? 'bg-emerald-500 animate-ping' : 'bg-slate-400'}`}></span>
            <span>{isAutoRefresh ? 'Live Auto-Sync (3s)' : 'Sync Manual'}</span>
          </button>

          <button
            onClick={fetchMonitoringData}
            disabled={isRefreshing}
            className="flex items-center space-x-1 px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 shadow-sm transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={handleSimulateActiveStudent}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Simulasi Siswa</span>
          </button>

          {students.length > 0 && (
            <button
              onClick={handleClearAll}
              className="flex items-center space-x-1 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-semibold transition-all"
              title="Bersihkan tabel monitor"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Kosongkan Log</span>
            </button>
          )}
        </div>
      </div>

      {/* 4 Summary Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase">Siswa Terpantau</span>
            <Users className="w-4 h-4 text-blue-600" />
          </div>
          <div className="flex items-baseline space-x-2 mt-2">
            <p className="text-2xl sm:text-3xl font-black text-slate-900">{totalActive}</p>
            <span className="text-xs font-bold text-emerald-600 flex items-center">
              <span className="w-2 h-2 rounded-full bg-emerald-500 mr-1 animate-pulse"></span>
              {onlineCount} Online
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">Gawai terhubung ke sistem</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase">Sedang Ujian</span>
            <Activity className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-amber-600 mt-2">{inProgressCount}</p>
          <p className="text-xs text-slate-500 mt-1">Aktif di layar lembar soal</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase">Telah Selesai</span>
            <CheckCircle className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-emerald-600 mt-2">{finishedCount}</p>
          <p className="text-xs text-slate-500 mt-1">Sudah submit & ternilai</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase">Pelanggaran Tab</span>
            <AlertTriangle className="w-4 h-4 text-rose-600" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-rose-600 mt-2">{violationCount}</p>
          <p className="text-xs text-rose-500 mt-1">Terdeteksi keluar jendela CBT</p>
        </div>
      </div>

      {/* Student Monitoring Table Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Table Search & Filter Bar */}
        <div className="p-4 border-b border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari siswa, kelas, atau kode soal..."
              className="w-full bg-white border border-slate-300 rounded-xl pl-9 pr-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
            />
          </div>

          <div className="flex items-center space-x-3 text-xs text-slate-500">
            <span>
              Menampilkan <b className="text-slate-800">{filtered.length}</b> siswa
            </span>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                <th className="py-3 px-4">Nama Siswa & Kelas</th>
                <th className="py-3 px-3">Kode Soal</th>
                <th className="py-3 px-4">Progres & Nomor</th>
                <th className="py-3 px-3">Status Gawai</th>
                <th className="py-3 px-3">Pelanggaran</th>
                <th className="py-3 px-3">Ping Terakhir</th>
                <th className="py-3 px-4 text-right">Tindakan Pengawas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <Users className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    <p className="font-medium text-slate-600">Belum ada siswa yang sedang aktif ujian saat ini.</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Bagikan tautan pengerjaan kepada siswa atau klik "Simulasi Siswa" untuk mencoba fitur anti-cheat.
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map((s, idx) => {
                  const hasViolations = s.tabSwitches > 0;
                  const isOnline = s.isOnline !== false;

                  return (
                    <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        <div className="flex items-center space-x-2">
                          <span
                            className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                              isOnline ? 'bg-emerald-500 animate-pulse ring-2 ring-emerald-200' : 'bg-slate-300'
                            }`}
                            title={isOnline ? 'Terhubung (Online)' : 'Terputus / Idle'}
                          />
                          <div>
                            <p className="font-bold text-slate-900">{s.studentName}</p>
                            <p className="text-[11px] text-slate-500 font-normal">
                              Kelas: {s.className || '-'} • {s.deviceInfo || 'Gawai'}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-mono bg-slate-100 text-slate-800 px-2 py-0.5 rounded font-bold border border-slate-200">
                          {s.examCode}
                        </span>
                      </td>
                      <td className="py-3 px-4 min-w-[160px]">
                        <div className="flex items-center space-x-2">
                          <div className="flex-1 bg-slate-200 rounded-full h-2 overflow-hidden">
                            <div
                              className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                              style={{ width: `${s.progress}%` }}
                            ></div>
                          </div>
                          <span className="font-mono text-slate-600 text-[11px] font-bold w-12 text-right">
                            {s.progress}%
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-[10px] text-slate-400 mt-0.5">
                          <span>{s.answeredCount} dari {s.totalQuestions} terjawab</span>
                          {s.currentQuestion && (
                            <span className="text-blue-600 font-semibold">No. {s.currentQuestion}</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        {s.status === 'Selesai' ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                            <CheckCircle className="w-3 h-3 mr-1" /> Selesai {typeof s.score === 'number' ? `(${s.score})` : ''}
                          </span>
                        ) : s.status === 'Terdiskualifikasi' ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-900 text-white">
                            <AlertOctagon className="w-3 h-3 mr-1" /> Didiskualifikasi
                          </span>
                        ) : s.status === 'Terdeteksi Keluar Tab' ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300 animate-pulse">
                            <AlertTriangle className="w-3 h-3 mr-1 text-rose-600" /> Pindah Tab
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-blue-100 text-blue-800">
                            <Activity className="w-3 h-3 mr-1 text-blue-600" /> Mengerjakan
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        {hasViolations ? (
                          <span className="px-2 py-0.5 text-xs font-bold bg-rose-100 text-rose-800 rounded-full border border-rose-200">
                            {s.tabSwitches}x Pelanggaran
                          </span>
                        ) : (
                          <span className="text-slate-400 font-mono text-[11px]">0x (Aman)</span>
                        )}
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-500 text-[11px]">
                        {s.lastPing || '-'}
                      </td>
                      <td className="py-3 px-4 text-right space-x-1 whitespace-nowrap">
                        {/* Send Warning Alert directly to student screen */}
                        <button
                          onClick={() => {
                            setWarningTarget({ name: s.studentName, examCode: s.examCode });
                          }}
                          title="Kirim Peringatan Langsung ke Layar Siswa"
                          className="inline-flex items-center space-x-1 px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-lg text-xs font-semibold transition-colors"
                        >
                          <BellRing className="w-3 h-3 text-amber-600" />
                          <span>Peringatkan</span>
                        </button>

                        {hasViolations && (
                          <button
                            onClick={() =>
                              setSelectedStudentLogs({
                                name: s.studentName,
                                examCode: s.examCode,
                                logs: s.violationsLog || [],
                                count: s.tabSwitches,
                              })
                            }
                            className="inline-flex items-center space-x-1 px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition-colors"
                          >
                            <Eye className="w-3 h-3" />
                            <span>Log ({s.tabSwitches})</span>
                          </button>
                        )}

                        {s.status !== 'Selesai' && s.status !== 'Terdiskualifikasi' && (
                          <button
                            onClick={() => handleDisqualify(s.studentName, s.examCode)}
                            title="Hentikan dan diskualifikasi ujian siswa"
                            className="inline-flex items-center space-x-1 px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-medium transition-colors"
                          >
                            <AlertOctagon className="w-3 h-3" />
                            <span>Stop</span>
                          </button>
                        )}

                        <button
                          onClick={() => handleResetStudentStatus(s.studentName, s.examCode)}
                          title="Reset status ke 'Mengerjakan'"
                          className="inline-flex items-center px-1.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs transition-colors"
                        >
                          <RotateCcw className="w-3 h-3" />
                        </button>

                        <button
                          onClick={() => handleRemoveStudent(s.studentName, s.examCode)}
                          title="Hapus dari daftar monitor"
                          className="inline-flex items-center px-1.5 py-1 text-slate-400 hover:text-rose-600 rounded-lg text-xs transition-colors"
                        >
                          <Trash2 className="w-3 h-3" />
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

      {/* Warning Alert Modal */}
      {warningTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200">
            <div className="flex items-center space-x-3 text-amber-600 mb-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-100 flex items-center justify-center">
                <BellRing className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">Kirim Peringatan Langsung</h3>
                <p className="text-xs text-slate-500">Pesan akan muncul di tengah layar ujian {warningTarget.name}</p>
              </div>
            </div>

            <div className="space-y-3 my-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Pilih Template Cepat:
                </label>
                <div className="grid grid-cols-1 gap-1.5 text-xs">
                  <button
                    type="button"
                    onClick={() =>
                      setCustomWarningText(
                        'Peringatan Pengawas: Harap fokus pada layar CBT dan jangan berpindah ke aplikasi/tab lain!'
                      )
                    }
                    className="p-2 text-left bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-slate-700"
                  >
                    ⚠️ Jangan berpindah aplikasi/tab lain!
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setCustomWarningText(
                        'Pengawas mendeteksi aktivitas mencurigakan. Jika berulang ujian akan dihentikan.'
                      )
                    }
                    className="p-2 text-left bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-slate-700"
                  >
                    🚨 Peringatan keras: Ujian akan dihentikan jika berulang!
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setCustomWarningText(
                        'Waktu pengerjaan tersisa sebentar lagi. Mohon segera periksa dan selesaikan jawaban.'
                      )
                    }
                    className="p-2 text-left bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-slate-700"
                  >
                    ⏳ Waktu tersisa sedikit, segera selesaikan!
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Teks Pesan Peringatan:
                </label>
                <textarea
                  rows={3}
                  value={customWarningText}
                  onChange={(e) => setCustomWarningText(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs text-slate-900 focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setWarningTarget(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSendWarning}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 shadow-sm flex items-center space-x-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Kirim Peringatan</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Violation Detail Modal */}
      {selectedStudentLogs && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center space-x-2 text-rose-600">
                <ShieldAlert className="w-5 h-5" />
                <h3 className="font-bold text-base text-slate-900">
                  Log Pelanggaran: {selectedStudentLogs.name}
                </h3>
              </div>
              <button
                onClick={() => setSelectedStudentLogs(null)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="my-4">
              <p className="text-xs text-slate-600">
                Kode Ujian: <span className="font-bold text-slate-900">{selectedStudentLogs.examCode}</span> • Total Pelanggaran: <span className="font-bold text-rose-600">{selectedStudentLogs.count} kali</span>
              </p>

              <div className="mt-3 max-h-64 overflow-y-auto space-y-2 pr-1">
                {selectedStudentLogs.logs.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-4">Belum ada detail log terperinci.</p>
                ) : (
                  selectedStudentLogs.logs.map((log, lIdx) => (
                    <div
                      key={lIdx}
                      className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-slate-800"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-rose-700">{log.type}</span>
                        <span className="text-[10px] text-slate-500 font-mono flex items-center space-x-1">
                          <Clock className="w-3 h-3" />
                          <span>{log.timestamp}</span>
                        </span>
                      </div>
                      <p className="text-slate-600 mt-1 text-[11px]">{log.detail}</p>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-200">
              <button
                onClick={() => setSelectedStudentLogs(null)}
                className="bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold px-4 py-2 rounded-xl"
              >
                Tutup Log
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
