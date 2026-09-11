import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import { initialExams, initialStudents, initialSchoolSettings, initialSavedPackages, EDUCATIONAL_IMAGE_PRESETS } from "./src/initialData";
import { Exam, Student, SchoolSettings, MonitoringStudent, ExamResult, Question, SavedQuestionPackage, QuestionType, ExamType } from "./src/types";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "25mb" }));

// In-Memory Database
let exams: Exam[] = [...initialExams];
let students: Student[] = [...initialStudents];
let schoolSettings: SchoolSettings = { ...initialSchoolSettings };
let savedPackages: SavedQuestionPackage[] = [...initialSavedPackages];
let monitoringList: Map<string, MonitoringStudent> = new Map();
let examResults: ExamResult[] = [];

// Initialize AI Client
const apiKey = process.env.GEMINI_API_KEY;
const ai = new GoogleGenAI({
  apiKey: apiKey,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Initial state
app.get("/api/initial-state", (req, res) => {
  res.json({
    exams,
    students,
    schoolSettings,
    savedPackages,
    monitoring: Array.from(monitoringList.values()),
    results: examResults,
  });
});

// Update school settings
app.put("/api/settings", (req, res) => {
  try {
    const updated = req.body;
    schoolSettings = { ...schoolSettings, ...updated };
    res.json({ success: true, schoolSettings });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ========================
// MANAJEMEN DATA SISWA APIs
// ========================

// Route paths supporting plural, singular, and Indonesian names
const STUDENT_BASE_ROUTES = ["/api/students", "/api/student", "/api/siswa", "/api/data-siswa"];
const STUDENT_BULK_ROUTES = ["/api/students/bulk", "/api/student/bulk", "/api/siswa/bulk", "/api/data-siswa/bulk"];
const STUDENT_ID_ROUTES = ["/api/students/:id", "/api/student/:id", "/api/siswa/:id", "/api/data-siswa/:id"];
const STUDENT_BULK_DELETE_ROUTES = ["/api/students/bulk-delete", "/api/student/bulk-delete", "/api/siswa/bulk-delete", "/api/data-siswa/bulk-delete"];

// Get all students
app.get(STUDENT_BASE_ROUTES, (req, res) => {
  res.json({ success: true, count: students.length, students });
});

// Add single student
app.post(STUDENT_BASE_ROUTES, (req, res) => {
  try {
    const body = req.body || {};
    const rawName = body.name ? String(body.name).trim() : "";
    if (!rawName) {
      return res.status(400).json({ success: false, error: "Nama siswa wajib diisi" });
    }
    const newStudent: Student = {
      id: body.id || ("std-" + Date.now() + "-" + Math.floor(Math.random() * 1000)),
      name: rawName,
      nisn: (body.nisn ? String(body.nisn) : "00" + Math.floor(10000000 + Math.random() * 90000000)).trim(),
      class: body.className || body.class || "X-MIPA 1",
      gender: body.gender === "P" ? "P" : "L",
      noAbsen: body.noAbsen ? Number(body.noAbsen) : students.length + 1,
      status: body.status || "Aktif",
    };
    // Avoid duplicate if existing ID
    const existingIndex = students.findIndex((s) => s.id === newStudent.id);
    if (existingIndex >= 0) {
      students[existingIndex] = newStudent;
    } else {
      students.push(newStudent);
    }
    res.json({ success: true, student: newStudent });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || "Gagal menyimpan data siswa" });
  }
});

// Bulk import students
app.post(STUDENT_BULK_ROUTES, (req, res) => {
  try {
    const body = req.body || {};
    const rawList = body.students;
    if (!Array.isArray(rawList) || rawList.length === 0) {
      return res.status(400).json({ success: false, error: "Data siswa massal tidak valid atau kosong" });
    }

    const createdList: Student[] = [];
    rawList.forEach((item: any, idx: number) => {
      if (item && item.name) {
        const std: Student = {
          id: item.id || ("std-" + Date.now() + "-" + idx + "-" + Math.floor(Math.random() * 1000)),
          name: String(item.name).trim(),
          nisn: (item.nisn ? String(item.nisn) : "00" + Math.floor(10000000 + Math.random() * 90000000)).trim(),
          class: item.class || item.className || "X-MIPA 1",
          gender: item.gender === "P" ? "P" : "L",
          noAbsen: item.noAbsen ? Number(item.noAbsen) : idx + 1,
          status: item.status || "Aktif",
        };
        const existingIdx = students.findIndex((s) => s.id === std.id);
        if (existingIdx >= 0) {
          students[existingIdx] = std;
        } else {
          students.push(std);
        }
        createdList.push(std);
      }
    });

    res.json({ success: true, count: createdList.length, students: createdList });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || "Gagal mengimpor siswa massal" });
  }
});

// Update student (with upsert if not found to prevent 404)
app.put(STUDENT_ID_ROUTES, (req, res) => {
  try {
    const { id } = req.params;
    const { name, nisn, className, gender, noAbsen, status } = req.body;
    const index = students.findIndex((s) => s.id === id);
    if (index === -1) {
      // Upsert student gracefully
      const upserted: Student = {
        id,
        name: name !== undefined ? String(name).trim() : "Siswa",
        nisn: nisn !== undefined ? String(nisn).trim() : "00" + Math.floor(10000000 + Math.random() * 90000000),
        class: className !== undefined ? className : "X-MIPA 1",
        gender: gender === "P" ? "P" : "L",
        noAbsen: noAbsen !== undefined ? Number(noAbsen) : students.length + 1,
        status: status !== undefined ? status : "Aktif",
      };
      students.push(upserted);
      return res.json({ success: true, student: upserted });
    }
    students[index] = {
      ...students[index],
      name: name !== undefined ? name.trim() : students[index].name,
      nisn: nisn !== undefined ? nisn.trim() : students[index].nisn,
      class: className !== undefined ? className : students[index].class,
      gender: gender !== undefined ? gender : students[index].gender,
      noAbsen: noAbsen !== undefined ? Number(noAbsen) : students[index].noAbsen,
      status: status !== undefined ? status : students[index].status,
    };
    res.json({ success: true, student: students[index] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete student
app.delete(STUDENT_ID_ROUTES, (req, res) => {
  try {
    const { id } = req.params;
    students = students.filter((s) => s.id !== id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Bulk delete students
app.post(STUDENT_BULK_DELETE_ROUTES, (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids)) {
      return res.status(400).json({ error: "Daftar ID siswa tidak valid" });
    }
    const idSet = new Set(ids);
    const beforeCount = students.length;
    students = students.filter((s) => !idSet.has(s.id));
    const deletedCount = beforeCount - students.length;
    res.json({ success: true, count: deletedCount });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ========================
// RIWAYAT SOAL & DEPLOYMENT APIs
// ========================

// Get question history
app.get("/api/question-history", (req, res) => {
  res.json({ success: true, packages: savedPackages });
});

// Save question package to history
app.post("/api/question-history", (req, res) => {
  try {
    const {
      title,
      subject,
      grade,
      examType,
      topic,
      difficulty,
      questionType,
      questions,
    } = req.body;

    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ error: "Daftar butir soal tidak boleh kosong" });
    }

    const newPackage: SavedQuestionPackage = {
      id: "pkg-" + Date.now(),
      title: title || `Paket Soal: ${subject || "Umum"} (${examType || "Penilaian"})`,
      subject: subject || "Umum",
      grade: grade || "Kelas X",
      examType: examType || "Penilaian Akhir Bab",
      topic: topic || "-",
      difficulty: difficulty || "Sedang",
      questionCount: questions.length,
      questionType: questionType || "pilihan_ganda",
      questions: questions.map((q: any, idx: number) => ({
        id: q.id || `q-${Date.now()}-${idx}`,
        number: idx + 1,
        question: q.question,
        questionType: q.questionType || questionType || "pilihan_ganda",
        imageUrl: q.imageUrl || undefined,
        options: q.options || { a: "", b: "", c: "", d: "" },
        correctAnswer: q.correctAnswer || "a",
        correctAnswers: q.correctAnswers || undefined,
        explanation: q.explanation || "",
        category: q.category || subject || "Umum",
      })),
      savedAt: new Date().toISOString(),
      isDeployed: false,
    };

    savedPackages.unshift(newPackage);
    res.json({ success: true, package: newPackage });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete package from history
app.delete("/api/question-history/:id", (req, res) => {
  try {
    const { id } = req.params;
    savedPackages = savedPackages.filter((p) => p.id !== id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Deploy questions from history directly into active exams
app.post("/api/question-history/deploy", (req, res) => {
  try {
    const { packageId, code, token, durationMinutes, title, examType } = req.body;
    const pkg = savedPackages.find((p) => p.id === packageId);
    if (!pkg) {
      return res.status(404).json({ error: "Paket soal tidak ditemukan dalam riwayat" });
    }

    // Generate smart exam code e.g. "PAN201", "IPS305", "JAW102"
    const prefix = (pkg.subject || "CBT")
      .replace(/[^a-zA-Z]/g, "")
      .slice(0, 3)
      .toUpperCase();
    const generatedCode = code || `${prefix}${Math.floor(100 + Math.random() * 900)}`;
    const generatedToken = (token || `CBT${new Date().getFullYear()}`).trim().toUpperCase();

    const deployedExam: Exam = {
      id: "exam-" + Date.now(),
      code: generatedCode.trim().toUpperCase(),
      title: title || pkg.title,
      subject: pkg.subject,
      grade: pkg.grade,
      examType: examType || pkg.examType || "Penilaian Akhir Bab",
      token: generatedToken,
      durationMinutes: Number(durationMinutes) || (pkg.questionCount > 25 ? 60 : 30),
      questions: pkg.questions,
      isActive: true,
      createdAt: new Date().toISOString(),
    };

    exams.unshift(deployedExam);

    // Update package status in history
    pkg.isDeployed = true;
    pkg.deployedExamCode = deployedExam.code;

    res.json({ success: true, exam: deployedExam, package: pkg });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create exam
app.post("/api/exams", (req, res) => {
  try {
    const newExam: Exam = req.body;
    if (!newExam.code || !newExam.token || !newExam.title) {
      return res.status(400).json({ error: "Kode soal, token, dan judul wajib diisi" });
    }
    newExam.id = "exam-" + Date.now();
    newExam.createdAt = new Date().toISOString();
    newExam.isActive = true;
    exams.unshift(newExam);
    res.json({ success: true, exam: newExam });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Real-time monitoring ping
app.post("/api/monitoring/ping", (req, res) => {
  try {
    const { studentName, examCode, progress, answeredCount, totalQuestions, status } = req.body;
    const key = `${studentName}_${examCode}`;
    const existing = monitoringList.get(key);

    const updated: MonitoringStudent = {
      studentName,
      examCode,
      progress: typeof progress === "number" ? Math.min(100, Math.max(0, Math.round(progress))) : 0,
      answeredCount: answeredCount || 0,
      totalQuestions: totalQuestions || 0,
      status: status || (existing?.status === "Terdiskualifikasi" ? "Terdiskualifikasi" : "Mengerjakan"),
      tabSwitches: existing ? existing.tabSwitches : 0,
      lastPing: new Date().toLocaleTimeString("id-ID"),
      violationsLog: existing ? existing.violationsLog : [],
    };

    monitoringList.set(key, updated);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Anti-Cheat: Record violation
app.post("/api/monitoring/violation", (req, res) => {
  try {
    const { studentName, examCode, violationType, detail } = req.body;
    const key = `${studentName}_${examCode}`;
    let student = monitoringList.get(key);

    const now = new Date();
    const timeStr = now.toLocaleTimeString("id-ID");

    const violation = {
      id: "v-" + Date.now(),
      timestamp: timeStr,
      type: violationType || "Keluar Tab",
      detail: detail || "Terdeteksi beralih dari jendela/tab ujian CBT",
    };

    if (student) {
      student.tabSwitches += 1;
      student.status = "Terdeteksi Keluar Tab";
      student.lastPing = timeStr;
      student.violationsLog.unshift(violation);
    } else {
      student = {
        studentName,
        examCode,
        progress: 0,
        answeredCount: 0,
        totalQuestions: 0,
        status: "Terdeteksi Keluar Tab",
        tabSwitches: 1,
        lastPing: timeStr,
        violationsLog: [violation],
      };
      monitoringList.set(key, student);
    }

    res.json({ success: true, tabSwitches: student.tabSwitches, violation });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Admin reset or clear monitoring
app.post("/api/monitoring/reset", (req, res) => {
  try {
    const { studentName, examCode } = req.body;
    const key = `${studentName}_${examCode}`;
    const student = monitoringList.get(key);
    if (student) {
      student.status = "Mengerjakan";
      res.json({ success: true, student });
    } else {
      res.status(404).json({ error: "Siswa tidak ditemukan dalam monitoring" });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get active monitoring
app.get("/api/monitoring", (req, res) => {
  res.json({
    students: Array.from(monitoringList.values()),
    timestamp: new Date().toISOString(),
  });
});

// Submit Exam & Remedial Recommendation (Gemini AI)
app.post("/api/submit-exam", async (req, res) => {
  try {
    const {
      studentName,
      nisn,
      className,
      examCode,
      examTitle,
      score,
      totalQuestions,
      correctCount,
      wrongCount,
      percentage,
      wrongAnswers,
      tabSwitches,
    } = req.body;

    let remedialReport = "";

    // Generate AI Remedial Analysis if there are wrong answers and API key exists
    if (wrongAnswers && wrongAnswers.length > 0 && apiKey) {
      try {
        const wrongListText = wrongAnswers
          .map(
            (w: any, idx: number) =>
              `${idx + 1}. Soal: "${w.question}" | Jawaban Siswa: "${w.studentAnswer}" | Jawaban Benar: "${w.correctAnswer}" | Konsep: "${w.explanation || ''}"`
          )
          .join("\n");

        const prompt = `Sebagai Guru & Pakar Evaluasi Pendidikan Indonesia, buatlah analisis remedial dan pengayaan yang mendalam, edukatif, dan menyemangati untuk siswa berikut:
Nama Siswa: ${studentName}
Mata Pelajaran / Ujian: ${examTitle} (${examCode})
Skor: ${score} / 100 (${correctCount} benar dari ${totalQuestions} soal)

Daftar Soal yang Salah Dijawab oleh Siswa:
${wrongListText}

Berikan respon terstruktur dengan format Markdown yang rapi dalam Bahasa Indonesia:
### 1. 🔍 Diagnosa Kelemahan Konsep
(Analisis letak miskonsepsi atau materi yang belum dikuasai)

### 2. 📖 Rangkuman Materi Kunci & Trik Pemahaman
(Jelaskan secara ringkas konsep esensial dan rumus/cara pengerjaan yang benar agar siswa mengerti mengapa jawaban aslinya keliru)

### 3. ✍️ 2 Contoh Soal Remedial Mandiri + Kunci & Pembahasan Singkat
(Buatkan 2 soal baru yang setara untuk latihan pemulihan mandiri)

### 4. 🌟 Pesan Motivasi Guru
(Kalimat apresiasi atas usaha siswa dan motivasi positif untuk terus belajar)`;

// Remedial Analysis with multi-model fallback cascade
        let geminiResText = "";
        const remedialModels = ["gemini-3.8-flash", "gemini-3.1-flash-lite", "gemini-flash-latest"];
        for (const modelName of remedialModels) {
          try {
            const geminiRes = await ai.models.generateContent({
              model: modelName,
              contents: prompt,
            });
            geminiResText = geminiRes.text || "";
            if (geminiResText) break;
          } catch (mErr: any) {
            console.warn(`Remedial model ${modelName} failed, trying next fallback:`, mErr.message || mErr);
          }
        }

        remedialReport = geminiResText || `Catatan Guru: Siswa perlu mengulang konsep pada ${wrongAnswers.length} soal yang belum tepat, khususnya materi dasar dan ketelitian pengerjaan.`;
      } catch (aiErr: any) {
        console.error("Gemini Remedial error:", aiErr);
        remedialReport = `Catatan Guru: Siswa perlu mengulang konsep pada ${wrongAnswers.length} soal yang belum tepat, khususnya materi dasar dan ketelitian pengerjaan.`;
      }
    } else if (wrongAnswers && wrongAnswers.length === 0) {
      remedialReport = `🎉 Selamat ${studentName}! Nilai Anda sempurna (100). Pertahankan prestasi ini dan silakan pelajari materi pengayaan tingkat lanjut untuk memperluas wawasan!`;
    }

    const result: ExamResult = {
      id: "res-" + Date.now(),
      timestamp: new Date().toLocaleString("id-ID"),
      studentName,
      nisn: nisn || "-",
      className: className || "-",
      examCode,
      examTitle,
      score,
      totalQuestions,
      correctCount,
      wrongCount,
      percentage: percentage || `${Math.round((correctCount / totalQuestions) * 100)}%`,
      wrongAnswers: wrongAnswers || [],
      remedialReport,
      tabSwitches: tabSwitches || 0,
    };

    examResults.unshift(result);

    // Update monitoring status to 'Selesai'
    const key = `${studentName}_${examCode}`;
    const mon = monitoringList.get(key);
    if (mon) {
      mon.status = "Selesai";
      mon.progress = 100;
      mon.answeredCount = totalQuestions;
    }

    res.json({ success: true, result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get Exam Results
app.get("/api/results", (req, res) => {
  res.json({ results: examResults });
});

// Gemini AI: Generate Exam Questions (with alias)
app.post(["/api/gemini/generate-questions", "/api/generate-questions"], async (req, res) => {
  try {
    const {
      topic,
      grade,
      subject = "Umum",
      count = 5,
      difficulty = "Sedang",
      questionType = "pilihan_ganda",
      examType = "Penilaian Akhir Bab",
    } = req.body;

    if (!topic) {
      return res.status(400).json({ error: "Topik atau kisi-kisi soal wajib diisi" });
    }

    if (!apiKey) {
      return res.status(500).json({ error: "GEMINI_API_KEY tidak ditemukan di environment" });
    }

    const safeCount = Math.min(50, Math.max(1, Number(count) || 5));

    let typeGuideline = "";
    if (questionType === "pilihan_ganda") {
      typeGuideline = `Seluruh soal harus berbentuk Pilihan Ganda dengan 4 pilihan (a, b, c, d) dan 1 jawaban benar mutlak. correctAnswer harus berupa salah satu dari 'a', 'b', 'c', atau 'd'.`;
    } else if (questionType === "pilihan_ganda_kompleks") {
      typeGuideline = `Seluruh soal berbentuk Pilihan Ganda Kompleks (Multi-Jawaban). Berikan 4 pilihan (a, b, c, d) di mana terdapat 2 atau lebih jawaban yang benar. Sertakan 'correctAnswers' berupa array huruf kecil (contoh: ["a", "c"]). 'correctAnswer' diisi huruf pertama jawaban benar.`;
    } else if (questionType === "benar_salah") {
      typeGuideline = `Seluruh soal berbentuk Benar / Salah. Teks pertanyaan menyajikan stimulus dan sebuah pernyataan logis. options a diisi "Benar" dan options b diisi "Salah" (options c dan d beri "-"). correctAnswer diisi "a" jika pernyataan Benar, atau "b" jika Salah.`;
    } else if (questionType === "isian_singkat") {
      typeGuideline = `Seluruh soal berbentuk Isian Singkat. Pertanyaan menguji istilah, rumus, nama konsep, atau angka penting. options beri teks alternatif pengecoh singkat, correctAnswer diisi kata kunci atau jawaban eksak singkat (1-3 kata).`;
    } else if (questionType === "uraian") {
      typeGuideline = `Seluruh soal berbentuk Soal Uraian / Essay Terbuka yang mendalam. options beri aspek penilaian (a: Aspek Pemahaman, b: Analisis, c: Solusi, d: Kesimpulan), correctAnswer diisi ringkasan jawaban inti, dan explanation diisi rubrik penilaian lengkap beserta poin-poin jawaban yang diharapkan.`;
    } else {
      typeGuideline = `Variasikan butir soal dengan proporsi: sebagian Pilihan Ganda (PG), sebagian Benar/Salah, dan sebagian Isian Singkat.`;
    }

    // Determine matching preset image for subject if appropriate
    const matchingPreset = EDUCATIONAL_IMAGE_PRESETS.find(
      (p) =>
        p.category.toLowerCase().includes(subject.toLowerCase()) ||
        subject.toLowerCase().includes(p.category.toLowerCase())
    );

    // Function to generate a batch of questions to prevent timeout for large counts
    const generateSingleBatch = async (batchCount: number, batchOffset: number): Promise<any[]> => {
      const prompt = `Anda adalah pakar pembuat instrumen asesmen dan kisi-kisi naskah ujian standar Kurikulum Merdeka Indonesia dan Taksonomi Bloom & Anderson.
Tugas Anda adalah merumuskan butir naskah soal berkualitas tinggi untuk:
- Jenis Ujian: ${examType}
- Mata Pelajaran: ${subject}
- Jenjang / Tingkat Kelas: ${grade || "Semua Jenjang (SD, SMP, atau SMA/SMK)"}
- Topik / Instruksi Pembagian Bentuk Soal: ${topic}
- Tingkat Kesulitan: ${difficulty}
- Pilihan Bentuk Soal: ${questionType} (${typeGuideline})
- Jumlah Butir Soal untuk bagian ini: ${batchCount} soal (Mulai butir #${batchOffset + 1})

PANDUAN TAKSONOMI BLOOM & ANDERSON (C1 - C6):
- Setiap butir soal WAJIB ditentukan level kognitifnya: C1 (Mengingat), C2 (Memahami), C3 (Menerapkan), C4 (Menganalisis), C5 (Mengevaluasi), atau C6 (Mencipta).
- Berikan deskripsi level kognitif pada 'cognitiveDescription' (contoh: "C4 - Menganalisis hubungan sebab-akibat").
- Tuliskan indikator pencapaian kompetensi pada 'competencyIndicator'.

PANDUAN PENSKORAN & KATA KUNCI:
- Untuk soal 'isian_singkat' dan 'uraian', sertakan 2-5 kata kunci penting (field 'keywords') untuk penskoran otomatis AI!
- Berikan bobot skor (field 'scoreWeight'): PG = 1, Isian = 2, Uraian = 4.
- Berikan rubrik penskoran pada field 'rubricGuide'.

Format Output: HANYA JSON array sesuai responseSchema tanpa format markdown block.`;

      // Multi-model fallback cascade for high demand spikes (503/429)
      const modelsToTry = ["gemini-3.8-flash", "gemini-3.1-flash-lite", "gemini-flash-latest"];
      let lastErr: any = null;

      for (const modelName of modelsToTry) {
        let maxAttemptsForModel = 2;
        for (let attempt = 1; attempt <= maxAttemptsForModel; attempt++) {
          try {
            const response = await ai.models.generateContent({
              model: modelName,
              contents: prompt,
              config: {
                maxOutputTokens: 8192,
                responseMimeType: "application/json",
                responseSchema: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      question: { type: Type.STRING, description: "Teks pertanyaan lengkap beserta stimulus" },
                      questionType: { type: Type.STRING, description: "pilihan_ganda, isian_singkat, uraian, pilihan_ganda_kompleks, atau benar_salah" },
                      cognitiveLevel: { type: Type.STRING, description: "C1, C2, C3, C4, C5, atau C6" },
                      cognitiveDescription: { type: Type.STRING, description: "Deskripsi level kognitif" },
                      competencyIndicator: { type: Type.STRING, description: "Indikator capaian soal" },
                      scoreWeight: { type: Type.NUMBER, description: "Bobot skor butir soal" },
                      keywords: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Kata kunci penskoran AI" },
                      rubricGuide: { type: Type.STRING, description: "Panduan rubrik penskoran" },
                      options: {
                        type: Type.OBJECT,
                        properties: {
                          a: { type: Type.STRING, description: "Opsi A" },
                          b: { type: Type.STRING, description: "Opsi B" },
                          c: { type: Type.STRING, description: "Opsi C" },
                          d: { type: Type.STRING, description: "Opsi D" },
                        },
                        required: ["a", "b", "c", "d"],
                      },
                      correctAnswer: { type: Type.STRING, description: "Kunci jawaban utama" },
                      correctAnswers: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Array kunci jawaban benar jika PG kompleks" },
                      explanation: { type: Type.STRING, description: "Pembahasan konsep edukatif" },
                      category: { type: Type.STRING, description: "Materi pokok atau subtopik" },
                    },
                    required: ["question", "questionType", "options", "correctAnswer", "explanation", "cognitiveLevel"],
                  },
                },
              },
            });

            const rawText = response.text || "[]";
            try {
              return JSON.parse(rawText);
            } catch {
              const match = rawText.match(/\[[\s\S]*\]/);
              if (match) {
                return JSON.parse(match[0]);
              }
              return [];
            }
          } catch (err: any) {
            lastErr = err;
            const errMsg = String(err?.message || err || "");
            const isHighDemand = errMsg.includes("503") || errMsg.includes("high demand") || errMsg.includes("UNAVAILABLE");

            if (isHighDemand) {
              // Immediately proceed to the next fallback model without repeating attempt
              console.warn(`Model ${modelName} experiencing high demand (503). Switching to fallback model immediately...`);
              break;
            } else {
              console.warn(`Attempt ${attempt} with model ${modelName} failed:`, errMsg);
              if (attempt < maxAttemptsForModel) {
                await new Promise((r) => setTimeout(r, 1000));
              }
            }
          }
        }
      }

      console.error("All AI model attempts exhausted for batch:", lastErr);
      return [];
    };

    // Partition count into batches of up to 10 items for high efficiency
    const BATCH_SIZE = 10;
    const batchSizes: number[] = [];
    let remaining = safeCount;
    while (remaining > 0) {
      const take = Math.min(remaining, BATCH_SIZE);
      batchSizes.push(take);
      remaining -= take;
    }

    let offset = 0;
    const results: any[][] = [];
    for (let i = 0; i < batchSizes.length; i++) {
      const size = batchSizes[i];
      const batchRes = await generateSingleBatch(size, offset);
      offset += size;
      results.push(batchRes);
      if (i < batchSizes.length - 1) {
        // Brief breather to avoid hitting burst rate limits
        await new Promise((r) => setTimeout(r, 400));
      }
    }
    const questionsRaw = results.flat();

    const formattedQuestions: Question[] = questionsRaw.map((q, idx) => {
      const hasImage = matchingPreset && idx === 0;
      const qType = (q.questionType as QuestionType) || (questionType !== "campuran" ? (questionType as QuestionType) : "pilihan_ganda");

      let defaultWeight = 1;
      if (qType === "uraian") defaultWeight = 4;
      else if (qType === "isian_singkat") defaultWeight = 2;

      const cLevel = q.cognitiveLevel ? q.cognitiveLevel.toUpperCase() : "C3";

      return {
        id: "q-gen-" + Date.now() + "-" + idx,
        number: idx + 1,
        question: q.question,
        questionType: qType,
        imageUrl: hasImage ? matchingPreset.url : undefined,
        cognitiveLevel: cLevel,
        cognitiveDescription: q.cognitiveDescription || `Level ${cLevel}`,
        competencyIndicator: q.competencyIndicator || `Disajikan materi ${q.category || topic}, siswa mampu menyelesaikan soal terkait.`,
        scoreWeight: q.scoreWeight && q.scoreWeight > 0 ? q.scoreWeight : defaultWeight,
        keywords: Array.isArray(q.keywords) && q.keywords.length > 0 
          ? q.keywords 
          : (qType === "isian_singkat" ? [q.correctAnswer || ""] : undefined),
        rubricGuide: q.rubricGuide || undefined,
        options: {
          a: q.options?.a || "",
          b: q.options?.b || "",
          c: q.options?.c || "",
          d: q.options?.d || "",
        },
        correctAnswer: (q.correctAnswer || "a").toString().trim(),
        correctAnswers: Array.isArray(q.correctAnswers) ? q.correctAnswers.map((x: string) => x.toLowerCase()) : undefined,
        explanation: q.explanation || "",
        category: q.category || topic,
      };
    });

    // If AI failed to return questions due to API outage or rate limits, generate structured curriculum fallback questions
    if (formattedQuestions.length === 0) {
      console.warn("AI generation returned 0 questions, generating curriculum fallback questions");
      for (let i = 0; i < safeCount; i++) {
        const qNum = i + 1;
        const cognitiveLevels: ("C1" | "C2" | "C3" | "C4" | "C5" | "C6")[] = ["C1", "C2", "C3", "C4", "C5", "C6"];
        const cLevel = cognitiveLevels[i % cognitiveLevels.length];
        const qType: QuestionType = questionType === "campuran" 
          ? (i % 3 === 0 ? "pilihan_ganda" : i % 3 === 1 ? "isian_singkat" : "uraian")
          : (questionType as QuestionType);

        formattedQuestions.push({
          id: "q-gen-fb-" + Date.now() + "-" + i,
          number: qNum,
          question: `[Asesmen ${subject}] Terkait materi "${topic || subject}", analisislah indikator capaian kompetensi utama pada butir ke-${qNum}.`,
          questionType: qType,
          imageUrl: (matchingPreset && i === 0) ? matchingPreset.url : undefined,
          cognitiveLevel: cLevel,
          cognitiveDescription: `Level ${cLevel} - Pemahaman dan analisis materi ${subject}`,
          competencyIndicator: `Disajikan stimulus konsep ${topic || subject}, peserta didik mampu menyelesaikan permasalahan terkait dengan tepat.`,
          scoreWeight: qType === "uraian" ? 4 : qType === "isian_singkat" ? 2 : 1,
          keywords: [topic || subject, "konsep", "prinsip"],
          rubricGuide: "Ketepatan penjelasan konsep (2 poin), kelengkapan contoh penerapan (2 poin).",
          options: {
            a: `Konsep dasar dan prinsip utama terkait ${topic || subject}`,
            b: `Penerapan praktis dalam kehidupan sehari-hari`,
            c: `Faktor pendukung dan metode evaluasi konsep`,
            d: `Analisis perbandingan dengan teori terkait`,
          },
          correctAnswer: "a",
          explanation: `Pembahasan: Pemahaman mendalam tentang materi ${topic || subject} memerlukan penguasaan konsep dasar dan penerapannya secara bertahap.`,
          category: topic || subject,
        });
      }
    }

    res.setHeader("Content-Type", "application/json");
    res.json({ success: true, count: formattedQuestions.length, questions: formattedQuestions });
  } catch (err: any) {
    console.error("Gemini Question Generator error:", err);
    res.setHeader("Content-Type", "application/json");
    res.status(500).json({ error: err.message || "Gagal membuat soal dengan AI" });
  }
});

// Explicit 404 for unmatched /api routes so they always return JSON, never HTML
app.all("/api/*", (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.status(404).json({
    error: `Endpoint API tidak ditemukan: ${req.method} ${req.originalUrl}`,
    status: 404,
  });
});

// Explicit Global JSON Error Handler for Express
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("Express App Error:", err);
  if (req.path.startsWith("/api/")) {
    res.setHeader("Content-Type", "application/json");
    return res.status(err.status || 500).json({
      error: err.message || "Terjadi kesalahan internal server.",
      status: err.status || 500,
    });
  }
  next(err);
});

// Vite middleware for development & static fallback for production
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`CBT Web App Sekolah running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
