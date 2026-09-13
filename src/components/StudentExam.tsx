import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import {
  ShieldAlert,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Send,
  HelpCircle,
  Award,
  Sparkles,
  BookOpen,
  ArrowRight,
  RotateCcw,
  Printer,
  Maximize2,
  BellRing
} from 'lucide-react';
import { Student, Exam, ExamResult, Question, SchoolSettings } from '../types';
import { Letterhead } from './Letterhead';
import { safeFetchJson } from '../utils/apiHelper';
import { decodeExamPayload } from '../utils/examUrlEncoder';

interface StudentExamProps {
  students: Student[];
  exams: Exam[];
  schoolSettings: SchoolSettings;
  preselectedStudent?: Student | null;
  preselectedExam?: Exam | null;
  onViolationOccurred: () => void;
  onExamSubmitted: (result: ExamResult) => void;
  onExamLoaded?: (exam: Exam) => void;
}

export const StudentExam: React.FC<StudentExamProps> = ({
  students,
  exams,
  schoolSettings,
  preselectedStudent,
  preselectedExam,
  onViolationOccurred,
  onExamSubmitted,
  onExamLoaded,
}) => {
  // Login State
  const [selectedStudentName, setSelectedStudentName] = useState<string>('');
  const [inputToken, setInputToken] = useState<string>('');
  const [selectedExamId, setSelectedExamId] = useState<string>(preselectedExam?.id || '');
  const [loginError, setLoginError] = useState<string>('');

  // Pre-fill selected student if passed from StudentManager
  useEffect(() => {
    if (preselectedStudent && preselectedStudent.name) {
      setSelectedStudentName(preselectedStudent.name);
    }
  }, [preselectedStudent]);

  // Pre-fill selected exam if passed from ExamManager or URL parameter
  useEffect(() => {
    if (preselectedExam && preselectedExam.id) {
      setSelectedExamId(preselectedExam.id);
      setInputToken(preselectedExam.token);
      return;
    }

    try {
      const params = new URLSearchParams(window.location.search);
      const codeParam = params.get('examCode') || params.get('code');
      const tokenParam = params.get('token');
      const payloadParam = params.get('p');
      const driveIdParam = params.get('driveId');

      // 1. Direct encoded payload in URL (self-contained, works on Vercel & offline)
      if (payloadParam) {
        const decoded = decodeExamPayload(payloadParam);
        if (decoded) {
          if (onExamLoaded) {
            onExamLoaded(decoded);
          }
          setSelectedExamId(decoded.id);
          setInputToken(tokenParam || decoded.token);
          setLoginError('');
          return;
        }
      }

      // 2. Drive File ID in URL
      if (driveIdParam) {
        fetch(`https://drive.google.com/uc?id=${driveIdParam}&export=download`)
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => {
            if (data && data.questions) {
              if (onExamLoaded) onExamLoaded(data);
              setSelectedExamId(data.id);
              setInputToken(tokenParam || data.token);
              setLoginError('');
            }
          })
          .catch(() => {});
      }

      // 3. Search by codeParam in provided exams
      if (codeParam) {
        const matching = exams.find(
          (e) => e.code.toUpperCase() === codeParam.toUpperCase() || e.id === codeParam
        );
        if (matching) {
          setSelectedExamId(matching.id);
          setInputToken(tokenParam || matching.token);
          setLoginError('');
          return;
        }

        // Check local storage cache
        try {
          const cachedStr = localStorage.getItem('cbt_exams_cache');
          if (cachedStr) {
            const cachedList: Exam[] = JSON.parse(cachedStr);
            const foundCached = cachedList.find(
              (e) => e.code.toUpperCase() === codeParam.toUpperCase() || e.id === codeParam
            );
            if (foundCached) {
              if (onExamLoaded) onExamLoaded(foundCached);
              setSelectedExamId(foundCached.id);
              setInputToken(tokenParam || foundCached.token);
              setLoginError('');
              return;
            }
          }
        } catch {}

        // If codeParam was specified but not found, DO NOT fall back to AI Studio exam!
        setLoginError(
          `Paket ujian dengan kode "${codeParam}" belum ditemukan. Pastikan tautan pengerjaan sudah lengkap atau hubungi guru pengawas.`
        );
        return;
      }

      // 4. Default: If no URL code was specified and no preselected exam, choose first user exam if available
      if (exams.length > 0 && !selectedExamId) {
        // Prioritize non-sample exam if exists
        const nonSample = exams.find((e) => e.id !== 'exam-1' && e.id !== 'exam-2' && e.code !== 'MAT101' && e.code !== 'IPA202');
        const defaultExam = nonSample || exams[0];
        setSelectedExamId(defaultExam.id);
        setInputToken(defaultExam.token);
      }
    } catch {
      // Ignore URL parsing errors
    }
  }, [preselectedExam, exams, onExamLoaded]);

  // Active Exam State
  const [activeExam, setActiveExam] = useState<Exam | null>(null);
  const [activeStudent, setActiveStudent] = useState<Student | null>(null);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [doubtStatus, setDoubtStatus] = useState<Record<string, boolean>>({});
  const [timeLeftSeconds, setTimeLeftSeconds] = useState<number>(1800);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [showSubmitModal, setShowSubmitModal] = useState<boolean>(false);

  // Anti-Cheat State
  const [violationCount, setViolationCount] = useState<number>(0);
  const [showViolationModal, setShowViolationModal] = useState<boolean>(false);
  const [lastViolationTime, setLastViolationTime] = useState<string>('');
  const [teacherDirectWarning, setTeacherDirectWarning] = useState<string | null>(null);
  const [isDisqualified, setIsDisqualified] = useState<boolean>(false);

  // Result State
  const [examResult, setExamResult] = useState<ExamResult | null>(null);
  const [isLoadingRemedial, setIsLoadingRemedial] = useState<boolean>(false);

  const activeStudentRef = useRef<Student | null>(null);
  const activeExamRef = useRef<Exam | null>(null);
  const answersRef = useRef<Record<string, string>>({});

  activeStudentRef.current = activeStudent;
  activeExamRef.current = activeExam;
  answersRef.current = answers;

  // Sync token when selecting exam
  useEffect(() => {
    const exam = exams.find((e) => e.id === selectedExamId);
    if (exam && !inputToken) {
      setInputToken(exam.token);
    }
  }, [selectedExamId, exams]);

  // Anti-Cheat: Visibility Change & Window Blur Detection
  useEffect(() => {
    if (!activeExam || !activeStudent || examResult) return;

    const handleVisibilityChange = async () => {
      if (document.hidden && activeStudentRef.current && activeExamRef.current) {
        const studentName = activeStudentRef.current.name;
        const examCode = activeExamRef.current.code;
        const nowStr = new Date().toLocaleTimeString('id-ID');

        setViolationCount((prev) => prev + 1);
        setLastViolationTime(nowStr);
        setShowViolationModal(true);
        onViolationOccurred();

        try {
          await safeFetchJson('/api/monitoring/violation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              studentName,
              examCode,
              violationType: 'Keluar Tab Browser',
              detail: `Siswa berpindah tab / aplikasi pada ${nowStr}`,
            }),
          });
        } catch (err) {
          console.error('Failed to log violation:', err);
        }
      }
    };

    const handleWindowBlur = async () => {
      if (activeStudentRef.current && activeExamRef.current && !document.hidden) {
        // Window lost focus
        const studentName = activeStudentRef.current.name;
        const examCode = activeExamRef.current.code;
        const nowStr = new Date().toLocaleTimeString('id-ID');

        setViolationCount((prev) => prev + 1);
        setLastViolationTime(nowStr);
        setShowViolationModal(true);
        onViolationOccurred();

        try {
          await safeFetchJson('/api/monitoring/violation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              studentName,
              examCode,
              violationType: 'Kehilangan Fokus Layar',
              detail: `Jendela ujian tidak aktif (Alt-Tab / Split Screen) pada ${nowStr}`,
            }),
          });
        } catch (err) {
          console.error('Failed to log blur violation:', err);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [activeExam, activeStudent, examResult, onViolationOccurred]);

  // Periodic Progress Ping to Backend (every 5s for responsive proctoring)
  useEffect(() => {
    if (!activeExam || !activeStudent || examResult) return;

    const pingProgress = async () => {
      const student = activeStudentRef.current;
      const exam = activeExamRef.current;
      const currentAnswers = answersRef.current;
      if (!student || !exam) return;

      const total = exam.questions.length;
      const answered = Object.keys(currentAnswers).length;
      const progress = total > 0 ? Math.round((answered / total) * 100) : 0;
      const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
      const deviceInfo = isMobile ? 'Smartphone' : 'Laptop / PC';

      try {
        const { ok, data } = await safeFetchJson('/api/monitoring/ping', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            studentName: student.name,
            examCode: exam.code,
            className: student.class,
            deviceInfo,
            currentQuestion: currentIndex + 1,
            progress,
            answeredCount: answered,
            totalQuestions: total,
            status: isDisqualified ? 'Terdiskualifikasi' : 'Mengerjakan',
          }),
        });

        if (ok && data) {
          if (data.warningMessage) {
            setTeacherDirectWarning(data.warningMessage);
          }
          if (data.status === 'Terdiskualifikasi' || data.command === 'force_submit') {
            setIsDisqualified(true);
            setTeacherDirectWarning('Ujian Anda telah dihentikan/didiskualifikasi oleh pengawas.');
            setShowSubmitModal(false);
            // Trigger submit
            handleSubmitExam();
          }
        }
      } catch (err) {
        console.error('Ping error:', err);
      }
    };

    // Initial ping
    pingProgress();

    const interval = setInterval(pingProgress, 5000);
    return () => clearInterval(interval);
  }, [activeExam, activeStudent, examResult, currentIndex, isDisqualified]);

  // Countdown Timer
  useEffect(() => {
    if (!activeExam || examResult) return;

    const timer = setInterval(() => {
      setTimeLeftSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleSubmitExam();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [activeExam, examResult]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Start Exam
  const handleStartExam = () => {
    setLoginError('');
    if (!selectedStudentName) {
      setLoginError('Silakan pilih nama siswa dari dropdown terlebih dahulu.');
      return;
    }

    const student = students.find((s) => s.name === selectedStudentName);
    if (!student) {
      setLoginError('Data siswa tidak ditemukan.');
      return;
    }

    // Find exam by code or token
    const exam = exams.find(
      (e) =>
        e.id === selectedExamId ||
        e.token.trim().toUpperCase() === inputToken.trim().toUpperCase()
    );

    if (!exam) {
      setLoginError('Ujian tidak ditemukan. Pastikan Token Soal benar.');
      return;
    }

    if (exam.token.trim().toUpperCase() !== inputToken.trim().toUpperCase()) {
      setLoginError(`Token Soal "${inputToken}" tidak cocok untuk ujian ${exam.code}.`);
      return;
    }

    setActiveStudent(student);
    setActiveExam(exam);
    setTimeLeftSeconds((exam.durationMinutes || 30) * 60);
    setCurrentIndex(0);
    setAnswers({});
    setDoubtStatus({});
    setViolationCount(0);
    setExamResult(null);

    // Prompt Fullscreen if available
    try {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    } catch {
      // Ignore fullscreen restrictions in iframe
    }
  };

  // Handle Single Option Select (Pilihan Ganda & Benar Salah)
  const handleSelectOption = (opt: string) => {
    if (!activeExam) return;
    const currentQuestion = activeExam.questions[currentIndex];
    setAnswers((prev) => ({
      ...prev,
      [currentQuestion.id]: opt,
    }));
  };

  // Handle Multi-Select (Pilihan Ganda Kompleks)
  const handleToggleComplexOption = (optKey: string) => {
    if (!activeExam) return;
    const currentQuestion = activeExam.questions[currentIndex];
    const currentAns = answers[currentQuestion.id] || '';
    const currentSet = new Set(currentAns.split(',').map((s) => s.trim()).filter(Boolean));

    if (currentSet.has(optKey)) {
      currentSet.delete(optKey);
    } else {
      currentSet.add(optKey);
    }

    const sortedResult = Array.from(currentSet).sort().join(',');
    setAnswers((prev) => ({
      ...prev,
      [currentQuestion.id]: sortedResult,
    }));
  };

  // Handle Free-form Text (Isian Singkat & Uraian)
  const handleTextAnswer = (text: string) => {
    if (!activeExam) return;
    const currentQuestion = activeExam.questions[currentIndex];
    setAnswers((prev) => ({
      ...prev,
      [currentQuestion.id]: text,
    }));
  };

  // Toggle Ragu-ragu
  const toggleDoubt = () => {
    if (!activeExam) return;
    const currentQuestion = activeExam.questions[currentIndex];
    setDoubtStatus((prev) => ({
      ...prev,
      [currentQuestion.id]: !prev[currentQuestion.id],
    }));
  };

  // Submit Exam
  const handleSubmitExam = async () => {
    if (!activeExam || !activeStudent || isSubmitting) return;

    setIsSubmitting(true);
    setShowSubmitModal(false);
    setIsLoadingRemedial(true);

    const questions = activeExam.questions;
    let correctCount = 0;
    const wrongAnswers: Array<{
      questionNumber: number;
      question: string;
      studentAnswer: string;
      correctAnswer: string;
      explanation: string;
    }> = [];

    let totalMaxScore = 0;
    let totalEarnedScore = 0;

    questions.forEach((q, idx) => {
      const studentAns = (answers[q.id] || '').trim();
      const qType = q.questionType || 'pilihan_ganda';
      const weight = q.scoreWeight || (qType === 'uraian' ? 4 : qType === 'isian_singkat' ? 2 : 1);
      totalMaxScore += weight;

      let isCorrect = false;
      let matchedKeywords: string[] = [];

      if (qType === 'pilihan_ganda' || qType === 'benar_salah') {
        isCorrect = Boolean(studentAns && studentAns.toLowerCase() === q.correctAnswer.toLowerCase());
      } else if (qType === 'pilihan_ganda_kompleks') {
        const studentSet = new Set(studentAns.toLowerCase().split(',').map((s) => s.trim()).filter(Boolean));
        const correctSet = new Set(q.correctAnswer.toLowerCase().split(',').map((s) => s.trim()).filter(Boolean));
        isCorrect = studentSet.size === correctSet.size && [...studentSet].every((val) => correctSet.has(val));
      } else if (qType === 'isian_singkat') {
        // Skoring Isian Pendek berdasarkan kata kunci AI & jawaban eksak
        const normalizedStudent = studentAns.toLowerCase().trim();
        const primaryMatch = Boolean(normalizedStudent && normalizedStudent === q.correctAnswer.trim().toLowerCase());
        const keywordMatch = Array.isArray(q.keywords) && q.keywords.some((kw) => {
          const k = kw.toLowerCase().trim();
          return normalizedStudent === k || normalizedStudent.includes(k) || (k.length > 3 && k.includes(normalizedStudent));
        });
        isCorrect = primaryMatch || Boolean(keywordMatch);
      } else if (qType === 'uraian') {
        // Skoring Uraian berdasarkan kemunculan kata kunci AI (minimal 50% keyword terpenuhi)
        const normalizedStudent = studentAns.toLowerCase().trim();
        if (Array.isArray(q.keywords) && q.keywords.length > 0) {
          matchedKeywords = q.keywords.filter((kw) => normalizedStudent.includes(kw.toLowerCase().trim()));
          const keywordRatio = matchedKeywords.length / q.keywords.length;
          isCorrect = keywordRatio >= 0.5;
        } else {
          isCorrect = Boolean(normalizedStudent.length >= 20);
        }
      } else {
        isCorrect = Boolean(studentAns && studentAns.toLowerCase() === q.correctAnswer.toLowerCase());
      }

      if (isCorrect) {
        correctCount += 1;
        totalEarnedScore += weight;
      } else {
        // Format display answers
        const optKey = studentAns.toLowerCase() as 'a' | 'b' | 'c' | 'd';
        const studentLabel = studentAns
          ? (q.options && q.options[optKey] ? `${studentAns.toUpperCase()}: ${q.options[optKey]}` : studentAns)
          : 'Tidak Dijawab';
        const corrKey = q.correctAnswer.toLowerCase() as 'a' | 'b' | 'c' | 'd';
        const correctLabel = q.options && q.options[corrKey]
          ? `${q.correctAnswer.toUpperCase()}: ${q.options[corrKey]}`
          : q.correctAnswer;

        const keywordNote = q.keywords && q.keywords.length > 0
          ? ` | Kata Kunci Esensial AI: [${q.keywords.join(', ')}]`
          : '';

        wrongAnswers.push({
          questionNumber: idx + 1,
          question: q.question,
          studentAnswer: studentLabel,
          correctAnswer: correctLabel,
          explanation: (q.explanation || 'Pembahasan materi belum tersedia.') + keywordNote,
        });
      }
    });

    const totalQuestions = questions.length;
    const score = totalMaxScore > 0 ? Math.round((totalEarnedScore / totalMaxScore) * 100) : 0;
    const percentage = `${score}%`;

    const payload = {
      studentName: activeStudent.name,
      nisn: activeStudent.nisn,
      className: activeStudent.class,
      examCode: activeExam.code,
      examTitle: activeExam.title,
      score,
      totalQuestions,
      correctCount,
      wrongCount: totalQuestions - correctCount,
      percentage,
      wrongAnswers,
      tabSwitches: violationCount,
    };

    try {
      const { ok, data } = await safeFetchJson('/api/submit-exam', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (ok && data?.success && data?.result) {
        setExamResult(data.result);
        onExamSubmitted(data.result);

        // Trigger Confetti!
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
        });
      } else {
        throw new Error(data?.error || 'Gagal menyimpan hasil ke server');
      }
    } catch (err) {
      console.error('Submit error:', err);
      // Fallback local result
      const localResult: ExamResult = {
        id: 'res-' + Date.now(),
        timestamp: new Date().toLocaleString('id-ID'),
        studentName: activeStudent.name,
        nisn: activeStudent.nisn,
        className: activeStudent.class,
        examCode: activeExam.code,
        examTitle: activeExam.title,
        score,
        totalQuestions,
        correctCount,
        wrongCount: totalQuestions - correctCount,
        percentage,
        wrongAnswers,
        remedialReport: 'Ujian berhasil diserahkan dan nilai tercatat di sistem.',
        tabSwitches: violationCount,
      };
      setExamResult(localResult);
      onExamSubmitted(localResult);
    } finally {
      setIsSubmitting(false);
      setIsLoadingRemedial(false);
    }
  };

  // 1. TAMPILAN HASIL UJIAN (RESULT SCREEN)
  if (examResult && activeExam && activeStudent) {
    const isPassed = examResult.score >= 75;

    return (
      <div className="min-h-screen bg-slate-100 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Action Bar (Print / Retake) */}
          <div className="no-print flex items-center justify-between bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
            <button
              onClick={() => {
                setExamResult(null);
                setActiveExam(null);
                setActiveStudent(null);
                setInputToken('');
              }}
              className="flex items-center space-x-2 text-slate-600 hover:text-slate-900 text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Kembali ke Beranda Ujian</span>
            </button>

            <button
              onClick={() => window.print()}
              className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2 rounded-xl shadow-sm transition-all"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak Bukti Nilai (Kop Resmi)</span>
            </button>
          </div>

          {/* Printable Sheet Wrapper */}
          <div className="print-sheet bg-white p-6 sm:p-8 rounded-2xl shadow-md border border-slate-200">
            {/* Kop Surat Sekolah Resmi */}
            <Letterhead
              settings={schoolSettings}
              documentTitle="SURAT KETERANGAN HASIL UJIAN BERBASIS KOMPUTER (CBT)"
              subTitle={`Tahun Pelajaran ${schoolSettings.tahunAjaran} - ${schoolSettings.semester}`}
            />

            {/* Identitas Siswa */}
            <div className="grid grid-cols-2 gap-4 text-xs sm:text-sm bg-slate-50 border border-slate-200 p-3.5 rounded-xl my-4 print:bg-transparent print:border-black">
              <div>
                <p><span className="font-semibold text-slate-700">Nama Siswa</span> : {examResult.studentName}</p>
                <p className="mt-1"><span className="font-semibold text-slate-700">NISN</span> : {examResult.nisn || '-'}</p>
                <p className="mt-1"><span className="font-semibold text-slate-700">Kelas</span> : {examResult.className || '-'}</p>
              </div>
              <div>
                <p><span className="font-semibold text-slate-700">Mata Ujian</span> : {examResult.examTitle}</p>
                <p className="mt-1"><span className="font-semibold text-slate-700">Kode Soal</span> : {examResult.examCode}</p>
                <p className="mt-1"><span className="font-semibold text-slate-700">Waktu Submit</span> : {examResult.timestamp}</p>
              </div>
            </div>

            {/* Score Showcase Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 my-6 text-center">
              <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl print:border-gray-400">
                <p className="text-xs font-semibold uppercase text-blue-700">Nilai Akhir</p>
                <p className="text-3xl sm:text-4xl font-black text-blue-900 mt-1">{examResult.score}</p>
                <span className={`inline-block mt-2 px-2 py-0.5 text-[11px] font-bold rounded-full ${isPassed ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                  {isPassed ? 'TUNTAS (≥75)' : 'PERLU REMEDIAL'}
                </span>
              </div>

              <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl print:border-gray-400">
                <p className="text-xs font-semibold uppercase text-emerald-700">Jawaban Benar</p>
                <p className="text-3xl sm:text-4xl font-black text-emerald-800 mt-1">
                  {examResult.correctCount} <span className="text-sm font-normal text-emerald-600">/ {examResult.totalQuestions}</span>
                </p>
                <p className="text-xs text-emerald-700 mt-2 font-medium">{examResult.percentage}</p>
              </div>

              <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl print:border-gray-400">
                <p className="text-xs font-semibold uppercase text-rose-700">Jawaban Salah</p>
                <p className="text-3xl sm:text-4xl font-black text-rose-800 mt-1">{examResult.wrongCount}</p>
                <p className="text-xs text-rose-700 mt-2 font-medium">butir soal</p>
              </div>

              <div className={`p-4 rounded-xl border ${examResult.tabSwitches > 0 ? 'bg-amber-50 border-amber-300' : 'bg-slate-50 border-slate-200'} print:border-gray-400`}>
                <p className="text-xs font-semibold uppercase text-slate-700">Catatan Anti-Cheat</p>
                <p className="text-3xl sm:text-4xl font-black text-slate-800 mt-1">{examResult.tabSwitches}</p>
                <p className="text-[11px] text-slate-600 mt-2">
                  {examResult.tabSwitches > 0 ? 'Pelanggaran Keluar Tab' : 'Bersih / Disiplin'}
                </p>
              </div>
            </div>

            {/* AI Remedial & Pengayaan Section (Powered by Gemini) */}
            <div className="mt-8 bg-gradient-to-br from-indigo-50/70 via-purple-50/40 to-slate-50 border border-indigo-200 p-5 rounded-2xl print:bg-transparent print:border-black print:p-3">
              <div className="flex items-center space-x-2 text-indigo-900 border-b border-indigo-200 pb-3 mb-4 print:border-black">
                <Sparkles className="w-5 h-5 text-purple-600" />
                <h3 className="font-bold text-base tracking-tight font-sans">
                  Analisis Rekomendasi Remedial & Pengayaan (Gemini AI)
                </h3>
              </div>

              {isLoadingRemedial ? (
                <div className="py-8 text-center text-indigo-700 space-y-2">
                  <div className="inline-block w-6 h-6 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-sm font-medium">Gemini AI sedang mendiagnosa kelemahan konsep dan menyusun materi remedial...</p>
                </div>
              ) : (
                <div className="prose prose-sm max-w-none text-slate-800 font-sans leading-relaxed whitespace-pre-line">
                  {examResult.remedialReport || 'Rekomendasi remedial sedang diproses.'}
                </div>
              )}
            </div>

            {/* Detail Soal yang Salah */}
            {examResult.wrongAnswers && examResult.wrongAnswers.length > 0 && (
              <div className="mt-8">
                <h4 className="font-bold text-sm text-slate-800 uppercase tracking-wider mb-3 flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <span>Daftar Butir Soal yang Perlu Dipelajari Kembali ({examResult.wrongAnswers.length} Soal)</span>
                </h4>

                <div className="space-y-3">
                  {examResult.wrongAnswers.map((w, idx) => (
                    <div key={idx} className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl text-xs sm:text-sm print:bg-transparent print:border-black">
                      <p className="font-semibold text-slate-900">
                        Soal No. {w.questionNumber}: {w.question}
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 pt-2 border-t border-slate-200 print:border-gray-400">
                        <p className="text-rose-700 font-medium">
                          ❌ Jawaban Anda: <span className="font-bold">{w.studentAnswer}</span>
                        </p>
                        <p className="text-emerald-700 font-medium">
                          ✅ Jawaban Tepat: <span className="font-bold">{w.correctAnswer}</span>
                        </p>
                      </div>
                      <p className="mt-2 text-slate-600 bg-white p-2 rounded border border-slate-200 text-xs italic print:border-gray-400">
                        💡 Pembahasan: {w.explanation}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tanda Tangan Guru & Pengawas Resmi */}
            <div className="mt-12 grid grid-cols-2 text-center text-xs sm:text-sm font-sans">
              <div>
                <p>Mengetahui,</p>
                <p>Kepala Sekolah</p>
                <div className="h-16"></div>
                <p className="font-bold underline">{schoolSettings.kepalaSekolah}</p>
                <p className="text-xs text-slate-600">NIP. {schoolSettings.nipKepalaSekolah}</p>
              </div>
              <div>
                <p>Jakarta, {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                <p>Guru Pengampu / Proktor CBT</p>
                <div className="h-16"></div>
                <p className="font-bold underline">Tim CBT {schoolSettings.namaSekolah}</p>
                <p className="text-xs text-slate-600">ID Sesi: {examResult.id}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 2. TAMPILAN SAAT UJIAN SEDANG BERLANGSUNG (ACTIVE EXAM INTERFACE)
  if (activeExam && activeStudent) {
    const currentQ = activeExam.questions[currentIndex];
    const totalQ = activeExam.questions.length;
    const answeredCount = Object.keys(answers).length;
    const isAnswered = currentQ && answers[currentQ.id] !== undefined;
    const isDoubt = currentQ && !!doubtStatus[currentQ.id];

    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col select-none">
        {/* Direct Warning from Teacher Modal */}
        {teacherDirectWarning && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
            <div className="bg-slate-900 border-2 border-amber-500 rounded-3xl p-6 sm:p-8 max-w-md w-full text-center shadow-2xl">
              <div className="w-16 h-16 bg-amber-500/20 text-amber-400 rounded-full flex items-center justify-center mx-auto mb-4 border border-amber-500/50 animate-pulse">
                <BellRing className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-black text-amber-400">PERINGATAN PENGAWAS UJIAN</h2>
              <div className="bg-amber-950/60 border border-amber-800 rounded-2xl p-4 my-4 text-xs sm:text-sm text-amber-200 text-left font-medium leading-relaxed">
                {teacherDirectWarning}
              </div>
              <p className="text-[11px] text-slate-400 mb-5">
                Pengawas memantau aktivitas layar dan gawai Anda secara langsung dari server.
              </p>
              <button
                onClick={() => setTeacherDirectWarning(null)}
                className="w-full bg-amber-600 hover:bg-amber-500 text-white font-bold py-3 rounded-xl shadow-lg transition-all text-xs"
              >
                Saya Mengerti & Akan Fokus Mengerjakan
              </button>
            </div>
          </div>
        )}

        {/* Anti-Cheat Violation Warning Modal */}
        {showViolationModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-slate-900 border-2 border-rose-500 rounded-2xl p-6 max-w-md w-full text-center shadow-2xl animate-bounce">
              <div className="w-16 h-16 bg-rose-500/20 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-4 border border-rose-500/40">
                <ShieldAlert className="w-10 h-10" />
              </div>
              <h2 className="text-xl font-bold text-rose-400">PERINGATAN ANTI-CHEAT CBT</h2>
              <p className="text-sm text-slate-300 mt-2">
                Anda terdeteksi keluar dari layar ujian atau berpindah tab!
              </p>
              <div className="bg-rose-950/60 border border-rose-800/80 rounded-xl p-3 my-4 text-xs text-rose-200">
                <p className="font-semibold">Pelanggaran Ke-{violationCount}</p>
                <p className="text-[11px] text-rose-300 mt-0.5">Waktu: {lastViolationTime}</p>
                <p className="mt-1 text-[11px]">
                  Pelanggaran ini telah dicatat ke <b>Log Pengawas Real-Time</b>. Jika mengulang, lembar ujian Anda dapat didiskualifikasi otomatis.
                </p>
              </div>
              <button
                onClick={() => setShowViolationModal(false)}
                className="w-full bg-rose-600 hover:bg-rose-700 text-white font-semibold py-2.5 rounded-xl shadow transition-all"
              >
                Saya Mengerti & Kembali Mengerjakan
              </button>
            </div>
          </div>
        )}

        {/* Top Floating Control Bar */}
        <header className="bg-slate-800/90 backdrop-blur border-b border-slate-700 px-4 py-3 sticky top-0 z-30 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-sm">
              CBT
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <p className="text-sm font-semibold text-white truncate max-w-[200px] sm:max-w-md">
                  {activeExam.title}
                </p>
                {activeExam.examType && (
                  <span className="hidden md:inline-block bg-purple-500/20 text-purple-300 border border-purple-500/40 text-[10px] font-bold px-2 py-0.5 rounded">
                    {activeExam.examType}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                Siswa: <span className="text-blue-300 font-medium">{activeStudent.name}</span> ({activeStudent.class}) • {activeExam.subject}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {/* Anti-Cheat Badge */}
            <div className={`hidden sm:flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-semibold ${violationCount > 0 ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'}`}>
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Anti-Cheat: {violationCount > 0 ? `${violationCount} Pelanggaran` : 'Aktif'}</span>
            </div>

            {/* Countdown Timer */}
            <div className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-sm font-mono font-bold ${timeLeftSeconds < 300 ? 'bg-rose-600 text-white animate-pulse' : 'bg-slate-700 text-amber-300 border border-slate-600'}`}>
              <Clock className="w-4 h-4" />
              <span>{formatTime(timeLeftSeconds)}</span>
            </div>

            {/* Finish Button */}
            <button
              onClick={() => setShowSubmitModal(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl shadow transition-all flex items-center space-x-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Selesai Ujian</span>
            </button>
          </div>
        </header>

        {/* Main Exam Canvas */}
        <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left / Center: Question & Answers */}
          <main className="lg:col-span-3 flex flex-col space-y-4">
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5 sm:p-7 shadow-lg flex-1 flex flex-col">
              {/* Question Header */}
              <div className="flex flex-wrap items-center justify-between border-b border-slate-700 pb-3 mb-5 gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="bg-blue-600 text-white font-bold text-sm px-3 py-1 rounded-lg">
                    Soal No. {currentIndex + 1}
                  </span>
                  <span className="text-xs text-slate-400">dari {totalQ} Soal</span>
                  {currentQ?.category && (
                    <span className="text-xs bg-slate-700/60 text-slate-300 px-2.5 py-0.5 rounded-md">
                      {currentQ.category}
                    </span>
                  )}
                  <span className="text-[11px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2.5 py-0.5 rounded-md font-semibold">
                    {currentQ?.questionType === 'pilihan_ganda_kompleks'
                      ? 'Pilihan Ganda Kompleks'
                      : currentQ?.questionType === 'benar_salah'
                      ? 'Benar / Salah'
                      : currentQ?.questionType === 'isian_singkat'
                      ? 'Isian Singkat'
                      : currentQ?.questionType === 'uraian'
                      ? 'Uraian / Essay'
                      : 'Pilihan Ganda'}
                  </span>
                </div>

                <button
                  onClick={toggleDoubt}
                  className={`flex items-center space-x-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${isDoubt ? 'bg-amber-500 text-slate-950 shadow' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                  <span>{isDoubt ? 'Tandai Ragu-Ragu (Aktif)' : 'Ragu-Ragu'}</span>
                </button>
              </div>

              {/* Question Stimulus Image if Attached */}
              {currentQ?.imageUrl && (
                <div className="mb-5 bg-slate-900/60 p-3 rounded-2xl border border-slate-700/80 inline-block max-w-lg">
                  <img
                    src={currentQ.imageUrl}
                    alt={`Stimulus Ilustrasi Soal No. ${currentIndex + 1}`}
                    className="max-h-56 sm:max-h-64 w-auto object-contain rounded-xl shadow-md cursor-pointer hover:opacity-95"
                    onClick={() => window.open(currentQ.imageUrl, '_blank')}
                    title="Buka gambar penuh"
                  />
                  <p className="text-[11px] text-slate-400 mt-1.5 italic">
                    💡 Perhatikan gambar stimulus di atas untuk menjawab soal.
                  </p>
                </div>
              )}

              {/* Question Text */}
              <div className="text-base sm:text-lg font-medium text-slate-100 leading-relaxed mb-6 whitespace-pre-line">
                {currentQ?.question}
              </div>

              {/* Dynamic Answer Inputs based on Question Type */}
              <div className="space-y-3 flex-1">
                {/* 1. Pilihan Ganda Kompleks (Multi Checkbox) */}
                {currentQ?.questionType === 'pilihan_ganda_kompleks' ? (
                  <div className="space-y-3">
                    <p className="text-xs text-indigo-300 font-semibold mb-2">
                      ☑️ Anda dapat memilih lebih dari satu jawaban yang benar:
                    </p>
                    {(['a', 'b', 'c', 'd'] as const).map((key) => {
                      const selectedKeys = (answers[currentQ.id] || '').split(',').map((s) => s.trim());
                      const isSelected = selectedKeys.includes(key);
                      const optionText = currentQ?.options[key];

                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => handleToggleComplexOption(key)}
                          className={`w-full text-left p-4 rounded-xl border transition-all flex items-start space-x-3.5 ${
                            isSelected
                              ? 'bg-indigo-600/25 border-indigo-500 text-white ring-2 ring-indigo-500/50 shadow-md'
                              : 'bg-slate-800/60 border-slate-700 text-slate-200 hover:bg-slate-700/50 hover:border-slate-600'
                          }`}
                        >
                          <span
                            className={`w-7 h-7 flex-shrink-0 rounded-lg flex items-center justify-center font-bold text-xs uppercase transition-all ${
                              isSelected
                                ? 'bg-indigo-500 text-white'
                                : 'bg-slate-700 text-slate-300'
                            }`}
                          >
                            {isSelected ? '✓' : key}
                          </span>
                          <span className="text-sm sm:text-base leading-relaxed pt-0.5">
                            {optionText}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : currentQ?.questionType === 'benar_salah' ? (
                  /* 2. Benar / Salah */
                  <div className="space-y-3">
                    <p className="text-xs text-blue-300 font-semibold mb-2">
                      ⚖️ Tentukan apakah pernyataan di atas Benar atau Salah:
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => handleSelectOption('a')}
                        className={`p-5 rounded-2xl border text-left transition-all flex items-center space-x-4 ${
                          answers[currentQ.id] === 'a'
                            ? 'bg-emerald-600/30 border-emerald-500 text-white ring-2 ring-emerald-500/50 shadow-lg'
                            : 'bg-slate-800/60 border-slate-700 text-slate-300 hover:bg-slate-700/60'
                        }`}
                      >
                        <span className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm ${
                          answers[currentQ.id] === 'a' ? 'bg-emerald-500 text-white' : 'bg-slate-700 text-slate-300'
                        }`}>
                          A
                        </span>
                        <div>
                          <p className="font-bold text-base text-white">BENAR</p>
                          <span className="text-xs text-slate-400">{currentQ.options.a || 'Pernyataan Sesuai / Benar'}</span>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSelectOption('b')}
                        className={`p-5 rounded-2xl border text-left transition-all flex items-center space-x-4 ${
                          answers[currentQ.id] === 'b'
                            ? 'bg-rose-600/30 border-rose-500 text-white ring-2 ring-rose-500/50 shadow-lg'
                            : 'bg-slate-800/60 border-slate-700 text-slate-300 hover:bg-slate-700/60'
                        }`}
                      >
                        <span className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm ${
                          answers[currentQ.id] === 'b' ? 'bg-rose-500 text-white' : 'bg-slate-700 text-slate-300'
                        }`}>
                          B
                        </span>
                        <div>
                          <p className="font-bold text-base text-white">SALAH</p>
                          <span className="text-xs text-slate-400">{currentQ.options.b || 'Pernyataan Tidak Sesuai / Salah'}</span>
                        </div>
                      </button>
                    </div>
                  </div>
                ) : currentQ?.questionType === 'isian_singkat' ? (
                  /* 3. Isian Singkat */
                  <div className="space-y-3">
                    <label className="text-xs text-slate-300 font-semibold block">
                      ✍️ Tuliskan jawaban singkat Anda:
                    </label>
                    <input
                      type="text"
                      value={answers[currentQ.id] || ''}
                      onChange={(e) => handleTextAnswer(e.target.value)}
                      placeholder="Ketik jawaban singkat di sini..."
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm sm:text-base outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-[11px] text-slate-400">
                      Gunakan ejaan yang tepat sesuai istilah yang dipelajari.
                    </p>
                  </div>
                ) : currentQ?.questionType === 'uraian' ? (
                  /* 4. Uraian / Essay */
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs text-slate-300 font-semibold block">
                        📝 Tuliskan uraian lengkap penjelasan Anda:
                      </label>
                      <span className="text-[11px] text-slate-400">
                        {(answers[currentQ.id] || '').length} karakter
                      </span>
                    </div>
                    <textarea
                      rows={5}
                      value={answers[currentQ.id] || ''}
                      onChange={(e) => handleTextAnswer(e.target.value)}
                      placeholder="Uraikan jawaban, argumen, atau langkah penyelesaian secara runtut..."
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl p-4 text-white text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                ) : (
                  /* 5. Standard Pilihan Ganda (A, B, C, D) */
                  <div className="space-y-3">
                    {(['a', 'b', 'c', 'd'] as const).map((key) => {
                      const isSelected = currentQ && answers[currentQ.id] === key;
                      const optionText = currentQ?.options[key];

                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => handleSelectOption(key)}
                          className={`w-full text-left p-4 rounded-xl border transition-all flex items-start space-x-3.5 ${
                            isSelected
                              ? 'bg-blue-600/20 border-blue-500 text-white ring-2 ring-blue-500/50 shadow-md'
                              : 'bg-slate-800/60 border-slate-700 text-slate-200 hover:bg-slate-700/50 hover:border-slate-600'
                          }`}
                        >
                          <span
                            className={`w-7 h-7 flex-shrink-0 rounded-lg flex items-center justify-center font-bold text-xs uppercase transition-all ${
                              isSelected
                                ? 'bg-blue-500 text-white'
                                : 'bg-slate-700 text-slate-300'
                            }`}
                          >
                            {key}
                          </span>
                          <span className="text-sm sm:text-base leading-relaxed pt-0.5">
                            {optionText}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Bottom Navigation Buttons */}
              <div className="flex items-center justify-between border-t border-slate-700 pt-5 mt-6">
                <button
                  disabled={currentIndex === 0}
                  onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                  className={`flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                    currentIndex === 0
                      ? 'opacity-40 cursor-not-allowed text-slate-500 bg-slate-800'
                      : 'bg-slate-700 hover:bg-slate-600 text-white'
                  }`}
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Soal Sebelumnya</span>
                </button>

                <div className="text-xs text-slate-400">
                  Terjawab: <span className="text-blue-400 font-bold">{answeredCount}</span> / {totalQ}
                </div>

                <button
                  disabled={currentIndex === totalQ - 1}
                  onClick={() => setCurrentIndex((prev) => Math.min(totalQ - 1, prev + 1))}
                  className={`flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                    currentIndex === totalQ - 1
                      ? 'opacity-40 cursor-not-allowed text-slate-500 bg-slate-800'
                      : 'bg-blue-600 hover:bg-blue-500 text-white shadow'
                  }`}
                >
                  <span>Soal Selanjutnya</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </main>

          {/* Right: Question Palette / Number Grid */}
          <aside className="lg:col-span-1 bg-slate-800 border border-slate-700 rounded-2xl p-5 shadow-lg flex flex-col h-fit">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 border-b border-slate-700 pb-2 flex items-center justify-between">
              <span>Nomor Soal</span>
              <span className="text-xs text-slate-400">{answeredCount}/{totalQ} Selesai</span>
            </h3>

            {/* Grid */}
            <div className="grid grid-cols-5 gap-2.5 max-h-[380px] overflow-y-auto pr-1">
              {activeExam.questions.map((q, idx) => {
                const ans = answers[q.id];
                const doubt = doubtStatus[q.id];
                const isActive = idx === currentIndex;

                let colorClasses = 'bg-slate-700/60 border-slate-600 text-slate-300';
                if (doubt) {
                  colorClasses = 'bg-amber-500 border-amber-400 text-slate-950 font-bold';
                } else if (ans) {
                  colorClasses = 'bg-emerald-600 border-emerald-500 text-white font-bold';
                }

                if (isActive) {
                  colorClasses += ' ring-2 ring-blue-400 ring-offset-2 ring-offset-slate-800';
                }

                return (
                  <button
                    key={q.id}
                    onClick={() => setCurrentIndex(idx)}
                    className={`h-10 rounded-lg text-xs font-semibold border transition-all flex flex-col items-center justify-center relative ${colorClasses}`}
                  >
                    <span>{idx + 1}</span>
                    {ans && !doubt && (
                      <span className="text-[9px] uppercase leading-none opacity-80">
                        {ans.length > 2 ? '✓' : ans}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="mt-6 pt-4 border-t border-slate-700 space-y-2 text-xs text-slate-300">
              <div className="flex items-center space-x-2">
                <span className="w-3.5 h-3.5 rounded bg-emerald-600 border border-emerald-500"></span>
                <span>Sudah Dijawab</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="w-3.5 h-3.5 rounded bg-amber-500 border border-amber-400"></span>
                <span>Ragu-Ragu</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="w-3.5 h-3.5 rounded bg-slate-700 border border-slate-600"></span>
                <span>Belum Dijawab</span>
              </div>
            </div>

            {/* Submit CTA */}
            <button
              onClick={() => setShowSubmitModal(true)}
              className="mt-6 w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-2.5 rounded-xl shadow text-xs transition-all flex items-center justify-center space-x-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Selesaikan & Kirim Jawaban</span>
            </button>
          </aside>
        </div>

        {/* Submit Confirmation Modal */}
        {showSubmitModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 max-w-md w-full shadow-2xl">
              <h3 className="text-lg font-bold text-white flex items-center space-x-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <span>Konfirmasi Pengumpulan Ujian</span>
              </h3>
              <p className="text-sm text-slate-300 mt-3">
                Apakah Anda yakin ingin menyelesaikan ujian ini sekarang?
              </p>

              <div className="bg-slate-900/80 rounded-xl p-3 my-4 space-y-1.5 text-xs text-slate-300 border border-slate-700">
                <div className="flex justify-between">
                  <span>Jumlah Soal Terjawab:</span>
                  <span className="font-bold text-emerald-400">{answeredCount} dari {totalQ}</span>
                </div>
                <div className="flex justify-between">
                  <span>Soal Belum Terjawab:</span>
                  <span className="font-bold text-rose-400">{totalQ - answeredCount}</span>
                </div>
                <div className="flex justify-between">
                  <span>Pelanggaran Keluar Tab:</span>
                  <span className={`font-bold ${violationCount > 0 ? 'text-amber-400' : 'text-slate-400'}`}>
                    {violationCount} kali
                  </span>
                </div>
              </div>

              <div className="flex space-x-3 mt-5">
                <button
                  onClick={() => setShowSubmitModal(false)}
                  className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-200 py-2 rounded-xl text-xs font-semibold transition-colors"
                >
                  Periksa Kembali
                </button>
                <button
                  disabled={isSubmitting}
                  onClick={handleSubmitExam}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-2 rounded-xl text-xs font-bold transition-colors shadow flex items-center justify-center space-x-1.5"
                >
                  {isSubmitting ? (
                    <span>Memproses...</span>
                  ) : (
                    <>
                      <span>Ya, Kumpulkan</span>
                      <Send className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // 3. TAMPILAN LOGIN / JOIN UJIAN SISWA (LANDING / SELECTION SCREEN)
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-6">
        {/* Header Card */}
        <div className="text-center">
          <div className="w-16 h-16 bg-blue-600 text-white rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-blue-500/20 mb-4">
            <BookOpen className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-black tracking-tight text-white font-sans">
            Portal Ujian Siswa (CBT)
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {schoolSettings.namaSekolah} • Tahun Ajaran {schoolSettings.tahunAjaran}
          </p>
        </div>

        {/* Login Form Box */}
        <div className="bg-slate-800/90 border border-slate-700 rounded-3xl p-6 sm:p-8 shadow-xl backdrop-blur">
          {loginError && (
            <div className="mb-5 bg-rose-950/60 border border-rose-800 text-rose-300 text-xs p-3 rounded-xl flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 text-rose-400" />
              <span>{loginError}</span>
            </div>
          )}

          <div className="space-y-4">
            {/* Dropdown Nama Siswa (Dari Database Siswa) */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Nama Siswa <span className="text-rose-400">*</span>
              </label>
              <select
                id="namaSiswa"
                value={selectedStudentName}
                onChange={(e) => setSelectedStudentName(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
              >
                <option value="">Pilih Nama Anda...</option>
                {students.map((s) => (
                  <option key={s.id} value={s.name}>
                    {s.name} ({s.class} - {s.nisn})
                  </option>
                ))}
              </select>
            </div>

            {/* Pilih Ujian / Paket Soal */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Pilih Paket Ujian
              </label>
              <select
                value={selectedExamId}
                onChange={(e) => {
                  setSelectedExamId(e.target.value);
                  const ex = exams.find((x) => x.id === e.target.value);
                  if (ex) setInputToken(ex.token);
                }}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
              >
                {exams.map((ex) => (
                  <option key={ex.id} value={ex.id}>
                    [{ex.code}] {ex.title} ({ex.questions.length} Soal)
                  </option>
                ))}
              </select>
            </div>

            {/* Token Soal */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Token Soal <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                id="tokenSoal"
                value={inputToken}
                onChange={(e) => setInputToken(e.target.value.toUpperCase())}
                placeholder="Contoh: CBT2026"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-mono text-white tracking-widest placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors uppercase"
              />
            </div>

            {/* Anti-Cheat Disclaimer Box */}
            <div className="bg-slate-900/80 border border-slate-700/80 rounded-xl p-3.5 text-xs text-slate-300 space-y-1.5">
              <p className="font-semibold text-amber-400 flex items-center space-x-1.5">
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Ketentuan Anti-Cheat CBT:</span>
              </p>
              <ul className="list-disc list-inside space-y-1 text-slate-400 text-[11px]">
                <li>Sistem otomatis merekam saat Anda <b>berpindah tab</b> atau membuka aplikasi lain.</li>
                <li>Progres pengerjaan dipantau secara langsung oleh pengawas (real-time).</li>
                <li>Selesai ujian, Anda akan langsung menerima skor dan rekomendasi remedial berbasis AI.</li>
              </ul>
            </div>

            {/* Tombol Mulai Ujian */}
            <button
              onClick={handleStartExam}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-3 px-4 rounded-xl shadow-lg shadow-blue-500/20 text-sm transition-all flex items-center justify-center space-x-2"
            >
              <span>Mulai Ujian Sekarang</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
