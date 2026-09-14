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
  GraduationCap,
  CheckSquare,
  Square,
  UserCheck,
  Eye,
  ArrowRight,
  AlertTriangle,
  Sparkles,
  RotateCcw,
  Cloud,
  RefreshCw,
} from 'lucide-react';
import { Student } from '../types';
import { CLASS_ROSTER_OPTIONS } from '../initialData';
import { safeFetchJson } from '../utils/apiHelper';
import { getAccessToken, getCachedAccessToken, googleSignIn } from '../services/firebaseAuth';
import { saveStudentsToDrive, loadStudentsFromDrive } from '../services/googleDriveService';
import { syncStudentsToFirestore } from '../services/firestoreSyncService';

interface StudentManagerProps {
  students: Student[];
  onAddStudent: (student: Student) => void;
  onUpdateStudent: (student: Student) => void;
  onDeleteStudent: (id: string) => void;
  onBulkAddStudents: (newStudents: Student[]) => void;
  onSelectStudentForExam?: (student: Student) => void;
  onRefreshStudents?: () => Promise<void>;
  onStudentsLoaded?: (students: Student[]) => void;
}

export const StudentManager: React.FC<StudentManagerProps> = ({
  students,
  onAddStudent,
  onUpdateStudent,
  onDeleteStudent,
  onBulkAddStudents,
  onSelectStudentForExam,
  onRefreshStudents,
  onStudentsLoaded,
}) => {
  // Sync state
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClass, setSelectedClass] = useState<string>('Semua');

  // Single Student Form State (Tambah)
  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    nisn: '',
    className: 'X-MIPA 1',
    gender: 'L' as 'L' | 'P',
    noAbsen: '',
    status: 'Aktif',
  });

  // Selected Students (Multi-selection)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Modal: Detail Siswa Terpilih ("Pilih")
  const [selectedDetailStudent, setSelectedDetailStudent] = useState<Student | null>(null);

  // Modal: Edit Data Siswa ("Edit")
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    nisn: '',
    className: '',
    gender: 'L' as 'L' | 'P',
    noAbsen: '',
    status: 'Aktif',
  });

  // Modal: Konfirmasi Hapus ("Hapus" tunggal atau massal)
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    ids: string[];
    names: string[];
    isBulk: boolean;
  } | null>(null);

  // Bulk Import State
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [bulkError, setBulkError] = useState('');

  // Status notification message
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isDriveSyncing, setIsDriveSyncing] = useState<boolean>(false);

  // Sync students directly to Firebase Firestore & Google Drive
  const handleSyncStudentsToDrive = async () => {
    setIsDriveSyncing(true);
    setFeedback(null);
    try {
      // 1. Sync to Firebase Firestore
      await syncStudentsToFirestore(students);

      // 2. Sync to Google Drive
      let driveNote = '';
      let token = await getAccessToken();
      if (!token) {
        try {
          const res = await googleSignIn();
          if (res) token = res.accessToken;
        } catch {
          driveNote = ' (Google Drive dapat dihubungkan di menu Google Drive)';
        }
      }
      if (token) {
        await saveStudentsToDrive(students, token);
        driveNote = ' & Google Drive folder "Data Siswa"';
      }

      setFeedback({
        type: 'success',
        text: `Berhasil menyimpan data ${students.length} siswa ke Firebase Firestore${driveNote}!`,
      });
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Gagal menyimpan data siswa ke Firebase / Google Drive.' });
    } finally {
      setIsDriveSyncing(false);
    }
  };

  // Load students directly from Google Drive subfolder "Data Siswa"
  const handleLoadStudentsFromDrive = async () => {
    setIsDriveSyncing(true);
    setFeedback(null);
    try {
      let token = await getAccessToken();
      if (!token) {
        const res = await googleSignIn();
        if (res) token = res.accessToken;
        else {
          setIsDriveSyncing(false);
          return;
        }
      }
      const driveStudents = await loadStudentsFromDrive(token);
      if (driveStudents && driveStudents.length > 0 && onStudentsLoaded) {
        onStudentsLoaded(driveStudents);
        setFeedback({
          type: 'success',
          text: `Berhasil memuat ${driveStudents.length} data siswa langsung dari Google Drive!`,
        });
      } else {
        setFeedback({
          type: 'error',
          text: 'Belum ada file data siswa yang tersimpan di Google Drive folder "Data Siswa".',
        });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Gagal memuat data siswa dari Google Drive.' });
    } finally {
      setIsDriveSyncing(false);
    }
  };

  // Available classes computed from standard SD, SMP, SMA options + student list
  const defaultClasses = CLASS_ROSTER_OPTIONS.flatMap((g) => g.classes);
  const classList = Array.from(
    new Set([...defaultClasses, ...students.map((s) => s.class)])
  ).filter(Boolean);

  const renderClassSelectOptions = () => (
    <>
      {CLASS_ROSTER_OPTIONS.map((grp) => (
        <optgroup key={grp.category} label={grp.category}>
          {grp.classes.map((cls) => (
            <option key={cls} value={cls}>
              {cls}
            </option>
          ))}
        </optgroup>
      ))}
      {students.some((s) => !defaultClasses.includes(s.class)) && (
        <optgroup label="Kelas Tambahan / Khusus">
          {Array.from<string>(new Set(students.map((s) => s.class)))
            .filter((c: string) => !defaultClasses.includes(c))
            .map((cls: string) => (
              <option key={cls} value={cls}>
                {cls}
              </option>
            ))}
        </optgroup>
      )}
    </>
  );

  // Filtered students
  const filteredStudents = students.filter((s) => {
    const matchQuery =
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.nisn.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.class.toLowerCase().includes(searchQuery.toLowerCase());
    const matchClass = selectedClass === 'Semua' || s.class === selectedClass;
    return matchQuery && matchClass;
  });

  // Check if all filtered students are selected
  const isAllFilteredSelected =
    filteredStudents.length > 0 &&
    filteredStudents.every((s) => selectedIds.has(s.id));

  // Toggle selection for single student
  const handleToggleSelect = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Toggle select all filtered
  const handleToggleSelectAll = () => {
    if (isAllFilteredSelected) {
      // Unselect all filtered
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filteredStudents.forEach((s) => next.delete(s.id));
        return next;
      });
    } else {
      // Select all filtered
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filteredStudents.forEach((s) => next.add(s.id));
        return next;
      });
    }
  };

  // Clear all selections
  const handleClearSelection = () => {
    setSelectedIds(new Set());
  };

  // Open "Pilih" Detail Modal
  const handleOpenDetail = (student: Student) => {
    setSelectedDetailStudent(student);
    // Also ensure this student is selected in the set
    setSelectedIds((prev) => new Set(prev).add(student.id));
  };

  // Open "Edit" Modal
  const handleOpenEditModal = (student: Student, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingStudent(student);
    setEditForm({
      name: student.name,
      nisn: student.nisn,
      className: student.class,
      gender: (student.gender as 'L' | 'P') || 'L',
      noAbsen: student.noAbsen !== undefined ? String(student.noAbsen) : '',
      status: student.status || 'Aktif',
    });
  };

  // Save Edit Modal
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;
    if (!editForm.name.trim()) {
      setFeedback({ type: 'error', text: 'Nama siswa tidak boleh kosong.' });
      return;
    }

    try {
      const updated: Student = {
        ...editingStudent,
        name: editForm.name.trim(),
        nisn: editForm.nisn.trim() || editingStudent.nisn,
        class: editForm.className || editingStudent.class,
        gender: editForm.gender,
        noAbsen: editForm.noAbsen ? Number(editForm.noAbsen) : editingStudent.noAbsen,
        status: editForm.status,
      };

      onUpdateStudent(updated);
      setFeedback({ type: 'success', text: `Data siswa "${updated.name}" berhasil diperbarui.` });
      setEditingStudent(null);
      if (selectedDetailStudent?.id === editingStudent.id) {
        setSelectedDetailStudent(updated);
      }
    } catch (err: any) {
      setFeedback({ type: 'error', text: 'Gagal memperbarui data siswa.' });
    }
  };

  // Open Delete Confirmation Modal
  const handleOpenDeleteModal = (ids: string[], names: string[], isBulk: boolean, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setDeleteModal({
      isOpen: true,
      ids,
      names,
      isBulk,
    });
  };

  // Confirm Delete Handler (Single or Bulk)
  const handleConfirmDelete = async () => {
    if (!deleteModal) return;

    try {
      if (deleteModal.isBulk) {
        // Bulk delete
        deleteModal.ids.forEach((id) => onDeleteStudent(id));

        // Unselect deleted
        setSelectedIds((prev) => {
          const next = new Set(prev);
          deleteModal.ids.forEach((id) => next.delete(id));
          return next;
        });

        setFeedback({
          type: 'success',
          text: `Berhasil menghapus ${deleteModal.ids.length} data siswa terpilih.`,
        });
      } else {
        // Single delete
        const idToDelete = deleteModal.ids[0];
        const nameToDelete = deleteModal.names[0];

        onDeleteStudent(idToDelete);

        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.delete(idToDelete);
          return next;
        });

        if (selectedDetailStudent?.id === idToDelete) {
          setSelectedDetailStudent(null);
        }

        setFeedback({
          type: 'success',
          text: `Data siswa "${nameToDelete}" berhasil dihapus dari sistem.`,
        });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', text: 'Gagal menghapus data siswa.' });
    } finally {
      setDeleteModal(null);
    }
  };

  // Add single student handler
  const handleSaveSingle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setFeedback({ type: 'error', text: 'Nama siswa tidak boleh kosong.' });
      return;
    }

    try {
      const newStudent: Student = {
        id: 'std-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
        name: formData.name.trim(),
        nisn: formData.nisn.trim() || '00' + Math.floor(10000000 + Math.random() * 90000000),
        class: formData.className || 'X-MIPA 1',
        gender: formData.gender || 'L',
        noAbsen: formData.noAbsen ? Number(formData.noAbsen) : students.length + 1,
        status: formData.status || 'Aktif',
      };

      onAddStudent(newStudent);
      setFeedback({ type: 'success', text: `Siswa "${newStudent.name}" berhasil ditambahkan!` });
      setFormData({
        name: '',
        nisn: '',
        className: formData.className,
        gender: 'L',
        noAbsen: '',
        status: 'Aktif',
      });
      setIsAdding(false);
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Gagal menambahkan siswa' });
    }
  };

  // Bulk import processor
  const handleProcessBulk = () => {
    setBulkError('');
    if (!bulkText.trim()) {
      setBulkError('Masukkan data siswa terlebih dahulu.');
      return;
    }

    const lines = bulkText.split('\n').map((l) => l.trim()).filter(Boolean);
    const parsedList: Student[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const parts = line.split(/[,\t;]/).map((p) => p.trim());
      const name = parts[0];
      if (!name) continue;

      const nisn = parts[1] || '00' + Math.floor(10000000 + Math.random() * 90000000);
      const className = parts[2] || 'X-MIPA 1';
      const gender = (parts[3] || 'L').toUpperCase() === 'P' ? 'P' : 'L';
      const noAbsen = parts[4] ? Number(parts[4]) : students.length + i + 1;

      parsedList.push({
        id: 'std-' + Date.now() + '-' + i + '-' + Math.floor(Math.random() * 1000),
        name,
        nisn,
        class: className,
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
      onBulkAddStudents(parsedList);
      setFeedback({ type: 'success', text: `Berhasil mengimpor ${parsedList.length} siswa sekaligus!` });
      setIsBulkOpen(false);
      setBulkText('');
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

  // Export to CSV (Semua atau yang dipilih)
  const handleExportCSV = (onlySelected = false) => {
    const targetStudents = onlySelected
      ? students.filter((s) => selectedIds.has(s.id))
      : students;

    if (targetStudents.length === 0) {
      setFeedback({ type: 'error', text: 'Tidak ada data siswa untuk diekspor.' });
      return;
    }

    const headers = 'ID,Nama Lengkap,NISN,Kelas,Jenis Kelamin,No Absen,Status\n';
    const rows = targetStudents
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
    a.download = `data_siswa_${onlySelected ? 'terpilih_' : ''}${new Date().toISOString().slice(0, 10)}.csv`;
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
            Pilih, edit, dan kelola peserta ujian. Dilengkapi tombol aksi cepat untuk setiap data siswa.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={async () => {
              setIsSyncing(true);
              try {
                if (onRefreshStudents) {
                  await onRefreshStudents();
                }
                setFeedback({ type: 'success', text: 'Data siswa tersinkronisasi sempurna.' });
              } catch {
                setFeedback({ type: 'success', text: 'Data siswa lokal siap dan tersimpan aman.' });
              } finally {
                setIsSyncing(false);
              }
            }}
            disabled={isSyncing}
            className="flex items-center space-x-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition-all border border-slate-200 shadow-sm disabled:opacity-60"
            title="Sinkronkan data siswa dengan server dan penyimpanan lokal"
          >
            <RotateCcw className={`w-4 h-4 text-slate-600 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Sinkron...' : 'Sinkronkan'}</span>
          </button>

          <button
            onClick={() => setIsBulkOpen(true)}
            className="flex items-center space-x-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition-all border border-slate-200 shadow-sm"
          >
            <Upload className="w-4 h-4 text-slate-600" />
            <span>Impor Massal</span>
          </button>

          <button
            onClick={handleSyncStudentsToDrive}
            disabled={isDriveSyncing || students.length === 0}
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-xl transition-all border border-blue-200 shadow-sm disabled:opacity-50"
            title="Simpan data siswa ke Firebase Firestore dan Google Drive folder 'CBT Web App - Backup / Data Siswa'"
          >
            <Cloud className="w-4 h-4" />
            <span>{isDriveSyncing ? 'Menyimpan...' : 'Unggah ke Cloud (Firebase & GDrive)'}</span>
          </button>

          <button
            onClick={handleLoadStudentsFromDrive}
            disabled={isDriveSyncing}
            className="flex items-center space-x-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all border border-slate-200 shadow-sm disabled:opacity-50"
            title="Muat data siswa langsung dari folder Data Siswa di Google Drive"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isDriveSyncing ? 'animate-spin' : ''}`} />
            <span>Muat dari GDrive</span>
          </button>

          <button
            onClick={() => handleExportCSV(false)}
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
                {renderClassSelectOptions()}
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

      {/* Floating / Top Multi-Select Action Bar */}
      {selectedIds.size > 0 && (
        <div className="bg-gradient-to-r from-blue-700 to-indigo-700 text-white px-5 py-3.5 rounded-2xl shadow-lg flex flex-col sm:flex-row items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-center space-x-3">
            <span className="bg-white/20 text-white font-black text-xs px-3 py-1 rounded-full border border-white/30">
              {selectedIds.size} Siswa Terpilih
            </span>
            <span className="text-xs text-blue-100 hidden md:inline">
              Gunakan tombol di sebelah kanan untuk aksi massal.
            </span>
          </div>

          <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
            <button
              onClick={() => handleExportCSV(true)}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-white/15 hover:bg-white/25 text-white text-xs font-semibold rounded-xl border border-white/20 transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Ekspor Terpilih</span>
            </button>

            <button
              onClick={() => {
                const selectedList = students.filter((s) => selectedIds.has(s.id));
                handleOpenDeleteModal(
                  Array.from(selectedIds),
                  selectedList.map((s) => s.name),
                  true
                );
              }}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl shadow transition-all"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Hapus ({selectedIds.size}) Siswa</span>
            </button>

            <button
              onClick={handleClearSelection}
              className="p-1.5 text-blue-200 hover:text-white hover:bg-white/10 rounded-xl"
              title="Batalkan Semua Pilihan"
            >
              <X className="w-4 h-4" />
            </button>
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

        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
          <div className="flex items-center space-x-2">
            <span className="text-slate-500 font-semibold whitespace-nowrap">Filter Kelas:</span>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-medium text-slate-700 outline-none"
            >
              <option value="Semua">Semua Kelas ({students.length})</option>
              {renderClassSelectOptions()}
            </select>
          </div>

          {selectedIds.size > 0 && (
            <button
              onClick={handleClearSelection}
              className="text-xs font-medium text-slate-500 hover:text-slate-800 underline"
            >
              Reset Pilihan ({selectedIds.size})
            </button>
          )}
        </div>
      </div>

      {/* Students Data Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-black text-slate-800 uppercase tracking-wider">
              Daftar Siswa Terdaftar: {filteredStudents.length} Siswa
            </span>
            {selectedIds.size > 0 && (
              <span className="bg-blue-100 text-blue-800 text-[11px] font-bold px-2 py-0.5 rounded-full">
                {selectedIds.size} dipilih
              </span>
            )}
          </div>
          <span className="text-[11px] text-slate-400">
            Klik tombol <b>Pilih</b>, <b>Edit</b>, atau <b>Hapus</b> pada setiap baris siswa di bawah
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-600 uppercase font-bold text-[11px] tracking-wider border-b border-slate-200">
                {/* Checkbox Select All */}
                <th className="py-3.5 px-3 w-10 text-center">
                  <button
                    type="button"
                    onClick={handleToggleSelectAll}
                    title={isAllFilteredSelected ? 'Batalkan Semua Pilihan' : 'Pilih Semua Siswa'}
                    className="text-slate-400 hover:text-blue-600 flex items-center justify-center mx-auto"
                  >
                    {isAllFilteredSelected ? (
                      <CheckSquare className="w-4 h-4 text-blue-600" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>
                </th>
                <th className="py-3.5 px-3 w-12 text-center">No</th>
                <th className="py-3.5 px-4">Nama Siswa</th>
                <th className="py-3.5 px-4">NISN</th>
                <th className="py-3.5 px-4">Kelas</th>
                <th className="py-3.5 px-4 text-center">L/P</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4 text-right min-w-[210px]">Aksi Siswa</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="font-semibold text-slate-600">Tidak ada data siswa ditemukan</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Coba ubah kata kunci pencarian atau klik tombol Tambah Siswa di atas.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredStudents.map((std, idx) => {
                  const isSelected = selectedIds.has(std.id);

                  return (
                    <tr
                      key={std.id}
                      className={`transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-blue-50/70 hover:bg-blue-50'
                          : 'hover:bg-slate-50/80'
                      }`}
                      onClick={() => handleToggleSelect(std.id)}
                    >
                      {/* Checkbox Single */}
                      <td className="py-3 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => handleToggleSelect(std.id)}
                          className="text-slate-400 hover:text-blue-600 flex items-center justify-center mx-auto"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-blue-600" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </td>

                      {/* Nomor Urut */}
                      <td className="py-3 px-3 text-center font-mono text-slate-400 font-semibold">
                        {idx + 1}
                      </td>

                      {/* Nama Siswa */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 flex items-center space-x-1.5">
                          <span>{std.name}</span>
                          {isSelected && (
                            <span className="bg-blue-600 text-white text-[9px] font-extrabold px-1.5 py-0.2 rounded">
                              DIPILIH
                            </span>
                          )}
                        </div>
                        {std.noAbsen && (
                          <span className="text-[10px] text-slate-400">Absen: #{std.noAbsen}</span>
                        )}
                      </td>

                      {/* NISN */}
                      <td className="py-3 px-4 font-mono text-slate-600 font-semibold">{std.nisn}</td>

                      {/* Kelas */}
                      <td className="py-3 px-4">
                        <span className="bg-blue-50 text-blue-700 font-semibold px-2 py-0.5 rounded-md border border-blue-200">
                          {std.class}
                        </span>
                      </td>

                      {/* Gender */}
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

                      {/* Status */}
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`font-semibold px-2 py-0.5 rounded-full text-[10px] border ${
                            std.status === 'Aktif'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}
                        >
                          {std.status || 'Aktif'}
                        </span>
                      </td>

                      {/* Tombol Aksi Siswa (PILIH, EDIT, HAPUS) */}
                      <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end space-x-1.5">
                          {/* TOMBOL PILIH */}
                          <button
                            type="button"
                            onClick={() => handleOpenDetail(std)}
                            className={`px-2.5 py-1.5 text-xs font-bold rounded-xl transition-all flex items-center space-x-1 border shadow-xs ${
                              isSelected
                                ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700'
                                : 'bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200'
                            }`}
                            title="Pilih data siswa dan lihat profil lengkap"
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                            <span>Pilih</span>
                          </button>

                          {/* TOMBOL EDIT */}
                          <button
                            type="button"
                            onClick={(e) => handleOpenEditModal(std, e)}
                            className="px-2.5 py-1.5 text-xs font-bold rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 transition-all flex items-center space-x-1 shadow-xs"
                            title="Edit identitas data siswa"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                            <span>Edit</span>
                          </button>

                          {/* TOMBOL HAPUS */}
                          <button
                            type="button"
                            onClick={(e) => handleOpenDeleteModal([std.id], [std.name], false, e)}
                            className="px-2.5 py-1.5 text-xs font-bold rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-all flex items-center space-x-1 shadow-xs"
                            title="Hapus data siswa dari sistem"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Hapus</span>
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

      {/* MODAL 1: DETAIL SISWA TERPILIH ("PILIH") */}
      {selectedDetailStudent && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-md w-full border border-slate-200 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2 text-blue-600">
                <UserCheck className="w-5 h-5" />
                <h3 className="font-black text-slate-900 text-base">Detail Siswa Terpilih</h3>
              </div>
              <button
                onClick={() => setSelectedDetailStudent(null)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Kartu Profil Siswa */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-4.5 space-y-3">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-black text-lg shadow-md">
                  {selectedDetailStudent.name.charAt(0)}
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-base leading-tight">
                    {selectedDetailStudent.name}
                  </h4>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">
                    NISN: {selectedDetailStudent.nisn}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-blue-200/60">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Kelas</span>
                  <span className="font-bold text-slate-800">{selectedDetailStudent.class}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Nomor Absen</span>
                  <span className="font-bold text-slate-800">
                    {selectedDetailStudent.noAbsen ? `#${selectedDetailStudent.noAbsen}` : '-'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Jenis Kelamin</span>
                  <span className="font-bold text-slate-800">
                    {selectedDetailStudent.gender === 'P' ? 'Perempuan (P)' : 'Laki-Laki (L)'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Status Akun</span>
                  <span className="inline-flex items-center text-emerald-700 font-bold bg-emerald-100/80 px-2 py-0.5 rounded-full text-[10px]">
                    {selectedDetailStudent.status || 'Aktif'}
                  </span>
                </div>
              </div>
            </div>

            {/* Aksi Cepat dari Modal Detail */}
            <div className="space-y-2 pt-1">
              {onSelectStudentForExam && (
                <button
                  type="button"
                  onClick={() => {
                    onSelectStudentForExam(selectedDetailStudent);
                    setSelectedDetailStudent(null);
                  }}
                  className="w-full py-2.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-xl shadow text-xs flex items-center justify-center space-x-2 transition-all"
                >
                  <GraduationCap className="w-4 h-4" />
                  <span>Mulai Ujian Sebagai Siswa Ini</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const std = selectedDetailStudent;
                    setSelectedDetailStudent(null);
                    handleOpenEditModal(std);
                  }}
                  className="py-2 px-3 bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold rounded-xl border border-amber-200 text-xs flex items-center justify-center space-x-1.5 transition-all"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Edit Data</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const std = selectedDetailStudent;
                    setSelectedDetailStudent(null);
                    handleOpenDeleteModal([std.id], [std.name], false);
                  }}
                  className="py-2 px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-xl border border-rose-200 text-xs flex items-center justify-center space-x-1.5 transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Hapus Siswa</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setSelectedDetailStudent(null)}
                className="w-full py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-all"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: EDIT DATA SISWA ("EDIT") */}
      {editingStudent && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-lg w-full border border-slate-200 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2 text-amber-600">
                <Edit2 className="w-5 h-5" />
                <h3 className="font-black text-slate-900 text-base">Edit Data Siswa</h3>
              </div>
              <button
                onClick={() => setEditingStudent(null)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Nama Lengkap Siswa <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-900 focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">NISN</label>
                  <input
                    type="text"
                    value={editForm.nisn}
                    onChange={(e) => setEditForm({ ...editForm, nisn: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-mono text-xs text-slate-900 focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Kelas</label>
                  <select
                    value={editForm.className}
                    onChange={(e) => setEditForm({ ...editForm, className: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:ring-2 focus:ring-amber-500 outline-none"
                  >
                    {renderClassSelectOptions()}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Jenis Kelamin</label>
                  <select
                    value={editForm.gender}
                    onChange={(e) => setEditForm({ ...editForm, gender: e.target.value as 'L' | 'P' })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:ring-2 focus:ring-amber-500 outline-none"
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
                    value={editForm.noAbsen}
                    onChange={(e) => setEditForm({ ...editForm, noAbsen: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Status</label>
                  <select
                    value={editForm.status}
                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:ring-2 focus:ring-amber-500 outline-none"
                  >
                    <option value="Aktif">Aktif</option>
                    <option value="Mutasi">Mutasi</option>
                    <option value="Cuti">Cuti</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingStudent(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-xl shadow transition-all flex items-center space-x-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Simpan Perubahan</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: KONFIRMASI HAPUS DATA SISWA ("HAPUS") */}
      {deleteModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-md w-full border border-slate-200 shadow-2xl space-y-4">
            <div className="flex items-center space-x-3 text-rose-600">
              <div className="p-2.5 bg-rose-100 rounded-2xl">
                <AlertTriangle className="w-6 h-6 text-rose-600" />
              </div>
              <div>
                <h3 className="font-black text-slate-900 text-base">Konfirmasi Hapus Data</h3>
                <p className="text-xs text-slate-500">Tindakan ini permanen dan tidak dapat dibatalkan.</p>
              </div>
            </div>

            <div className="bg-rose-50/70 border border-rose-200/80 rounded-2xl p-4 text-xs space-y-2">
              <p className="text-rose-900 font-medium">
                {deleteModal.isBulk ? (
                  <>
                    Apakah Anda yakin ingin menghapus <b>{deleteModal.ids.length} data siswa terpilih</b>?
                  </>
                ) : (
                  <>
                    Apakah Anda yakin ingin menghapus data siswa <b>"{deleteModal.names[0]}"</b>?
                  </>
                )}
              </p>
              <p className="text-slate-500 text-[11px]">
                Seluruh data identitas siswa ini akan dihapus dari basis data sistem CBT sekolah.
              </p>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteModal(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl shadow transition-all flex items-center space-x-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>Ya, Hapus Data</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Import Modal */}
      {isBulkOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
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
    </div>
  );
};
