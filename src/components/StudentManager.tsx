import React, { useState } from 'react';
import {
  Users,
  UserPlus,
  Search,
  Upload,
  Download,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Check,
  X,
  GraduationCap
} from 'lucide-react';
import { Student } from '../types';

interface StudentManagerProps {
  students: Student[];
  onAddStudent: (student: Student) => void;
  onUpdateStudent: (student: Student) => void;
  onDeleteStudent: (id: string) => void;
  onBulkAddStudents: (newStudents: Student[]) => void;
}

export const StudentManager: React.FC<StudentManagerProps> = ({
  students,
  onAddStudent,
  onUpdateStudent,
  onDeleteStudent,
  onBulkAddStudents,
}) => {
  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClass, setSelectedClass] = useState<string>('Semua');

  // Single Student Form State
  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    nisn: '',
    className: 'X-MIPA 1',
    gender: 'L' as 'L' | 'P',
    noAbsen: '',
    status: 'Aktif',
  });

  // Editing State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<Student>>({});

  // Bulk Import State
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [bulkError, setBulkError] = useState('');

  // Status message
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Available classes computed from student list + defaults
  const classList = Array.from(
    new Set(['X-MIPA 1', 'X-MIPA 2', 'X-IPS 1', 'XI-MIPA 1', 'XII-MIPA 1', ...students.map((s) => s.class)])
  ).filter(Boolean);

  // Filtered students
  const filteredStudents = students.filter((s) => {
    const matchQuery =
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.nisn.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.class.toLowerCase().includes(searchQuery.toLowerCase());
    const matchClass = selectedClass === 'Semua' || s.class === selectedClass;
    return matchQuery && matchClass;
  });

  // Add single student handler
  const handleSaveSingle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setFeedback({ type: 'error', text: 'Nama siswa tidak boleh kosong.' });
      return;
    }

    try {
      const payload = {
        name: formData.name.trim(),
        nisn: formData.nisn.trim() || '00' + Math.floor(10000000 + Math.random() * 90000000),
        className: formData.className,
        gender: formData.gender,
        noAbsen: formData.noAbsen ? Number(formData.noAbsen) : students.length + 1,
        status: formData.status,
      };

      const res = await fetch('/api/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success && data.student) {
        onAddStudent(data.student);
        setFeedback({ type: 'success', text: `Siswa "${data.student.name}" berhasil ditambahkan!` });
        setFormData({
          name: '',
          nisn: '',
          className: formData.className,
          gender: 'L',
          noAbsen: '',
          status: 'Aktif',
        });
        setIsAdding(false);
      } else {
        throw new Error(data.error || 'Gagal menyimpan siswa');
      }
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Gagal menambahkan siswa' });
    }
  };

  // Update student handler
  const handleUpdate = async (id: string) => {
    try {
      const res = await fetch(`/api/students/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editFormData.name,
          nisn: editFormData.nisn,
          className: editFormData.class,
          gender: editFormData.gender,
          noAbsen: editFormData.noAbsen,
          status: editFormData.status,
        }),
      });

      const data = await res.json();
      if (data.success && data.student) {
        onUpdateStudent(data.student);
        setEditingId(null);
        setFeedback({ type: 'success', text: `Data ${data.student.name} berhasil diperbarui.` });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', text: 'Gagal memperbarui data siswa.' });
    }
  };

  // Delete student handler
  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Hapus data siswa "${name}" dari sistem?`)) return;

    try {
      const res = await fetch(`/api/students/${id}`, { method: 'DELETE' });
      if (res.ok) {
        onDeleteStudent(id);
        setFeedback({ type: 'success', text: `Siswa "${name}" berhasil dihapus.` });
      }
    } catch (err) {
      setFeedback({ type: 'error', text: 'Gagal menghapus siswa.' });
    }
  };

  // Bulk import processor
  const handleProcessBulk = async () => {
    setBulkError('');
    if (!bulkText.trim()) {
      setBulkError('Masukkan data siswa terlebih dahulu.');
      return;
    }

    // Parse lines: Nama, NISN (optional), Kelas (optional), L/P (optional), No Absen (optional)
    const lines = bulkText.split('\n').map((l) => l.trim()).filter(Boolean);
    const parsedList: any[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // support tab or comma or semicolon separated
      const parts = line.split(/[,\t;]/).map((p) => p.trim());
      const name = parts[0];
      if (!name) continue;

      const nisn = parts[1] || '00' + Math.floor(10000000 + Math.random() * 90000000);
      const className = parts[2] || 'X-MIPA 1';
      const gender = (parts[3] || 'L').toUpperCase() === 'P' ? 'P' : 'L';
      const noAbsen = parts[4] ? Number(parts[4]) : i + 1;

      parsedList.push({
        name,
        nisn,
        className,
        gender,
        noAbsen,
        status: 'Aktif',
      });
    }

    if (parsedList.length === 0) {
      setBulkError('Format data tidak dikenali. Gunakan format: Nama, NISN, Kelas');
      return;
    }

    try {
      const res = await fetch('/api/students/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ students: parsedList }),
      });

      const data = await res.json();
      if (data.success && data.students) {
        onBulkAddStudents(data.students);
        setFeedback({ type: 'success', text: `Berhasil mengimpor ${data.count} siswa sekaligus!` });
        setIsBulkOpen(false);
        setBulkText('');
      } else {
        throw new Error(data.error || 'Gagal impor data');
      }
    } catch (err: any) {
      setBulkError(err.message || 'Terjadi kesalahan saat memproses data massal');
    }
  };

  // Sample data insertion for quick testing
  const insertSampleBulk = () => {
    const sample = [
      'Alifia Nurul Aini, 0072938101, X-MIPA 1, P, 1',
      'Bima Sakti Nugraha, 0072938102, X-MIPA 1, L, 2',
      'Cantika Dewi Maharani, 0072938103, X-MIPA 1, P, 3',
      'Doni Satria Utama, 0072938104, X-MIPA 1, L, 4',
      'Eka Putri Lestari, 0072938105, X-MIPA 1, P, 5',
      'Farel Arya Pratama, 0072938106, X-MIPA 2, L, 1',
      'Gita Savitri Kirana, 0072938107, X-MIPA 2, P, 2',
      'Hanif Syahputra, 0072938108, X-MIPA 2, L, 3',
    ].join('\n');
    setBulkText(sample);
  };

  // Export to CSV
  const handleExportCSV = () => {
    const headers = 'ID,Nama Lengkap,NISN,Kelas,Jenis Kelamin,No Absen,Status\n';
    const rows = students
      .map(
        (s) =>
          `"${s.id}","${s.name}","${s.nisn}","${s.class}","${s.gender || 'L'}","${s.noAbsen || '-'}","${
            s.status || 'Aktif'
          }"`
      )
      .join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `data_siswa_cbt_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center space-x-2">
            <Users className="w-6 h-6 text-blue-600" />
            <span>Manajemen Data Siswa</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Kelola data peserta ujian, registrasi siswa baru, impor data kelas massal, dan nomor induk siswa (NISN).
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setIsBulkOpen(true)}
            className="flex items-center space-x-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition-all border border-slate-200 shadow-sm"
          >
            <Upload className="w-4 h-4 text-slate-600" />
            <span>Impor Massal (CSV/Excel)</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="flex items-center space-x-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition-all border border-slate-200 shadow-sm"
          >
            <Download className="w-4 h-4 text-slate-600" />
            <span>Unduh CSV</span>
          </button>

          <button
            onClick={() => setIsAdding(!isAdding)}
            className="flex items-center space-x-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition-all shadow-md"
          >
            <UserPlus className="w-4 h-4" />
            <span>{isAdding ? 'Tutup Form' : 'Tambah Siswa'}</span>
          </button>
        </div>
      </div>

      {/* Feedback Alert */}
      {feedback && (
        <div
          className={`p-4 rounded-2xl flex items-center justify-between text-xs sm:text-sm transition-all ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border border-rose-200 text-rose-900'
          }`}
        >
          <div className="flex items-center space-x-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
            )}
            <span className="font-medium">{feedback.text}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-slate-400 hover:text-slate-700 p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Single Add Form */}
      {isAdding && (
        <form
          onSubmit={handleSaveSingle}
          className="bg-white p-5 sm:p-6 rounded-2xl border-2 border-blue-200 shadow-sm space-y-4 transition-all"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
              <UserPlus className="w-4 h-4 text-blue-600" />
              <span>Input Data Siswa Baru</span>
            </h3>
            <span className="text-xs text-slate-400">Data otomatis sinkron dengan login siswa CBT</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="sm:col-span-2">
              <label className="font-semibold text-slate-700 block mb-1">
                Nama Lengkap Siswa <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Contoh: Muhammad Rizky Ramadhan"
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                Nomor Induk Siswa Nasional (NISN)
              </label>
              <input
                type="text"
                value={formData.nisn}
                onChange={(e) => setFormData({ ...formData, nisn: e.target.value })}
                placeholder="10 digit NISN (opsional)"
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs sm:text-sm font-mono text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Kelas</label>
              <select
                value={formData.className}
                onChange={(e) => setFormData({ ...formData, className: e.target.value })}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
              >
                {classList.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Jenis Kelamin</label>
              <select
                value={formData.gender}
                onChange={(e) => setFormData({ ...formData, gender: e.target.value as 'L' | 'P' })}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="L">Laki-Laki (L)</option>
                <option value="P">Perempuan (P)</option>
              </select>
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Nomor Absen</label>
              <input
                type="number"
                min={1}
                value={formData.noAbsen}
                onChange={(e) => setFormData({ ...formData, noAbsen: e.target.value })}
                placeholder="No urut absen"
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="Aktif">Aktif</option>
                <option value="Mutasi">Mutasi</option>
                <option value="Cuti">Cuti</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-end space-x-2 pt-2">
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow transition-all"
            >
              Simpan Data Siswa
            </button>
          </div>
        </form>
      )}

      {/* Bulk Import Modal */}
      {isBulkOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-2xl w-full border border-slate-200 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                <h3 className="font-black text-slate-900 text-base">Impor Data Siswa Massal (CSV/Teks)</h3>
              </div>
              <button
                onClick={() => setIsBulkOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Tempel (paste) daftar nama siswa langsung dari Microsoft Excel atau Google Sheets. Satu baris per siswa dengan format:
              <br />
              <code className="font-mono bg-slate-100 px-2 py-0.5 rounded text-blue-700 text-[11px]">
                Nama Lengkap, NISN, Kelas, L/P, No Absen
              </code>
            </p>

            {bulkError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded-xl text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{bulkError}</span>
              </div>
            )}

            <textarea
              rows={8}
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              placeholder="Contoh:&#10;Ahmad Fauzi Pratama, 0071829101, X-MIPA 1, L, 1&#10;Siti Nurhaliza Putri, 0071829102, X-MIPA 1, P, 2&#10;Budi Santoso, 0071829103, X-MIPA 1, L, 3"
              className="w-full bg-slate-50 border border-slate-300 rounded-2xl p-3 font-mono text-xs text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none"
            />

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={insertSampleBulk}
                className="text-xs font-semibold text-emerald-700 hover:underline"
              >
                + Muat Contoh Data (8 Siswa)
              </button>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setIsBulkOpen(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Batal
                </button>
                <button
                  onClick={handleProcessBulk}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow transition-all flex items-center space-x-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Proses & Simpan Semua</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nama, NISN, atau kelas..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-900"
          />
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <span className="text-slate-500 font-semibold whitespace-nowrap">Filter Kelas:</span>
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-medium text-slate-700 outline-none"
          >
            <option value="Semua">Semua Kelas ({students.length})</option>
            {classList.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Students Data Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Total Terdaftar: {filteredStudents.length} Siswa
          </span>
          <span className="text-[11px] text-slate-400">
            Siswa dapat langsung memilih namanya saat login mode siswa CBT
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-600 uppercase font-bold text-[11px] tracking-wider border-b border-slate-200">
                <th className="py-3.5 px-4 w-12 text-center">No</th>
                <th className="py-3.5 px-4">Nama Siswa</th>
                <th className="py-3.5 px-4">NISN</th>
                <th className="py-3.5 px-4">Kelas</th>
                <th className="py-3.5 px-4 text-center">L/P</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    Tidak ada data siswa yang cocok dengan kriteria pencarian.
                  </td>
                </tr>
              ) : (
                filteredStudents.map((std, idx) => {
                  const isEditing = editingId === std.id;

                  if (isEditing) {
                    return (
                      <tr key={std.id} className="bg-blue-50/60">
                        <td className="py-3 px-4 text-center font-bold text-slate-400">{idx + 1}</td>
                        <td className="py-3 px-4">
                          <input
                            type="text"
                            value={editFormData.name ?? std.name}
                            onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                            className="w-full bg-white border border-blue-400 rounded-lg px-2.5 py-1 text-xs text-slate-900 outline-none"
                          />
                        </td>
                        <td className="py-3 px-4">
                          <input
                            type="text"
                            value={editFormData.nisn ?? std.nisn}
                            onChange={(e) => setEditFormData({ ...editFormData, nisn: e.target.value })}
                            className="w-full bg-white border border-blue-400 rounded-lg px-2.5 py-1 text-xs font-mono text-slate-900 outline-none"
                          />
                        </td>
                        <td className="py-3 px-4">
                          <select
                            value={editFormData.class ?? std.class}
                            onChange={(e) => setEditFormData({ ...editFormData, class: e.target.value })}
                            className="bg-white border border-blue-400 rounded-lg px-2 py-1 text-xs text-slate-900 outline-none"
                          >
                            {classList.map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <select
                            value={editFormData.gender ?? std.gender ?? 'L'}
                            onChange={(e) => setEditFormData({ ...editFormData, gender: e.target.value as any })}
                            className="bg-white border border-blue-400 rounded-lg px-1.5 py-1 text-xs text-slate-900 outline-none"
                          >
                            <option value="L">L</option>
                            <option value="P">P</option>
                          </select>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <select
                            value={editFormData.status ?? std.status ?? 'Aktif'}
                            onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
                            className="bg-white border border-blue-400 rounded-lg px-2 py-1 text-xs text-slate-900 outline-none"
                          >
                            <option value="Aktif">Aktif</option>
                            <option value="Mutasi">Mutasi</option>
                            <option value="Cuti">Cuti</option>
                          </select>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end space-x-1">
                            <button
                              onClick={() => handleUpdate(std.id)}
                              className="p-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg shadow-sm"
                              title="Simpan"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="p-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg"
                              title="Batal"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  }

                  return (
                    <tr key={std.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 text-center font-mono text-slate-400">{idx + 1}</td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{std.name}</div>
                        {std.noAbsen && (
                          <span className="text-[10px] text-slate-400">Absen: #{std.noAbsen}</span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600 font-semibold">{std.nisn}</td>
                      <td className="py-3 px-4">
                        <span className="bg-blue-50 text-blue-700 font-semibold px-2 py-0.5 rounded-md border border-blue-200">
                          {std.class}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`font-bold px-2 py-0.5 rounded text-[11px] ${
                            std.gender === 'P'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                          }`}
                        >
                          {std.gender || 'L'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="bg-emerald-50 text-emerald-700 font-semibold px-2 py-0.5 rounded-full text-[10px] border border-emerald-200">
                          {std.status || 'Aktif'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          <button
                            onClick={() => {
                              setEditingId(std.id);
                              setEditFormData(std);
                            }}
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Edit Data Siswa"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(std.id, std.name)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Hapus Siswa"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
