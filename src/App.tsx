import React, { useState, useEffect, useRef } from "react";
import { 
  Volume2, 
  VolumeX, 
  Settings, 
  LogOut, 
  FolderDown, 
  Trash2, 
  Shuffle, 
  RotateCcw, 
  Sparkles, 
  Check, 
  X, 
  Eye, 
  FileText, 
  Download, 
  Users, 
  HelpCircle, 
  Trophy, 
  History,
  Lock,
  ChevronLeft,
  ChevronRight,
  RefreshCw
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

// Types
interface StudentScore {
  score: number;
  count: number;
}

interface Question {
  question: string;
  answer: string;
}

interface HistoryItem {
  name: string;
  question: string;
  answer: string;
  score: string;
  time: string;
}

// Default initial list of students for quick setup
const DEFAULT_STUDENTS = [
  "Nguyễn Văn An",
  "Trần Thị Bình",
  "Lê Hoàng Cường",
  "Phạm Hồng Dung",
  "Vũ Minh Đức",
  "Đỗ Thanh Hà",
  "Ngô Quang Hải",
  "Bùi Thị Hương",
  "Phan Văn Khánh",
  "Dương Hồng Liên"
];

// Default initial questions
const DEFAULT_QUESTIONS = [
  "Thủ đô của Việt Nam là gì? | Hà Nội",
  "Phép tính: 5 x 6 bằng bao nhiêu? | 30",
  "Ai là người tìm ra châu Mỹ? | Christopher Columbus",
  "Hành tinh nào gần Mặt Trời nhất? | Sao Thủy",
  "Nước chiếm khoảng bao nhiêu phần trăm bề mặt Trái Đất? | Khoảng 70%"
];

// Helper to encode ArrayBuffer to base64
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

export default function App() {
  // --- States ---
  const [names, setNames] = useState<string[]>(DEFAULT_STUDENTS);
  const [inputText, setInputText] = useState<string>(DEFAULT_STUDENTS.join("\n"));
  
  const [topic, setTopic] = useState<string>("Kiến thức tổng hợp lớp 6");
  const [questionBankText, setQuestionBankText] = useState<string>(DEFAULT_QUESTIONS.join("\n"));
  const [usedQuestions, setUsedQuestions] = useState<string[]>([]);
  
  const [isSpinning, setIsSpinning] = useState<boolean>(false);
  const [removeAfterWin, setRemoveAfterWin] = useState<boolean>(true);
  
  // Scoring & Results States
  const [winnerName, setWinnerName] = useState<string>("");
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [showAnswer, setShowAnswer] = useState<boolean>(false);
  const [showResultBox, setShowResultBox] = useState<boolean>(false);
  const [isAnswering, setIsAnswering] = useState<boolean>(false);
  
  const [historyData, setHistoryData] = useState<HistoryItem[]>([]);
  const [studentScores, setStudentScores] = useState<Record<string, StudentScore>>({});
  const [lastRemovedPerson, setLastRemovedPerson] = useState<string | null>(null);
  const [lastWinningIndex, setLastWinningIndex] = useState<number>(-1);
  
  // UI Preferences
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState<boolean>(false);
  const [showLoginModal, setShowLoginModal] = useState<boolean>(false);
  const [adminPassword, setAdminPassword] = useState<string>("");
  const [loginError, setLoginError] = useState<boolean>(false);
  const [isSettingsHidden, setIsSettingsHidden] = useState<boolean>(true); // Default guest mode has setting hidden
  const [activeTab, setActiveTab] = useState<"history" | "leaderboard">("history");
  
  // Loading state for AI generation
  const [isGeneratingAI, setIsGeneratingAI] = useState<boolean>(false);
  const [isFileUploading, setIsFileUploading] = useState<boolean>(false);

  // --- Supabase and Multi-Class states ---
  const [currentSessionId, setCurrentSessionId] = useState<string>("Lớp 6A");
  const [sessions, setSessions] = useState<{ id: string; topic: string; updated_at?: string }[]>([]);
  const [isTableMissing, setIsTableMissing] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isLoadingSession, setIsLoadingSession] = useState<boolean>(false);

  // --- Fetch list of sessions from Supabase ---
  const fetchSessions = async (shouldLoadFirst = false) => {
    try {
      const res = await fetch("/api/sessions");
      const data = await res.json();
      if (data.error_type === "TABLE_MISSING") {
        setIsTableMissing(true);
      } else {
        setIsTableMissing(false);
        if (data.success && Array.isArray(data.sessions)) {
          setSessions(data.sessions);
          if (shouldLoadFirst) {
            if (data.sessions.length > 0) {
              const firstSessionId = data.sessions[0].id;
              setCurrentSessionId(firstSessionId);
              loadSession(firstSessionId);
            } else {
              // No sessions in database yet. We create "Lớp 6A" as default initial database record.
              setCurrentSessionId("Lớp 6A");
              loadSession("Lớp 6A");
            }
          }
        }
      }
    } catch (err) {
      console.error("Lỗi khi lấy danh sách lớp học:", err);
    }
  };

  // --- Save specific session to Supabase ---
  const saveSession = async (
    sessionId: string,
    customNames = names,
    customInputText = inputText,
    customTopic = topic,
    customQBank = questionBankText,
    customRemove = removeAfterWin,
    customScores = studentScores,
    customHistory = historyData
  ) => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          names: customNames,
          question_bank: customQBank,
          topic: customTopic,
          remove_after_win: customRemove,
          student_scores: customScores,
          history_data: customHistory
        })
      });
      const data = await res.json();
      if (data.error_type === "TABLE_MISSING") {
        setIsTableMissing(true);
      } else {
        setIsTableMissing(false);
        fetchSessions();
      }
    } catch (err) {
      console.error("Lỗi khi lưu dữ liệu lớp học:", err);
    } finally {
      setIsSaving(false);
    }
  };

  // --- Load specific session detail from Supabase ---
  const loadSession = async (sessionId: string) => {
    setIsLoadingSession(true);
    try {
      const res = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}`);
      const data = await res.json();
      if (data.error_type === "TABLE_MISSING") {
        setIsTableMissing(true);
        return;
      }
      setIsTableMissing(false);

      if (data.success && data.session) {
        const s = data.session;
        const loadedNames = s.names || [];
        setNames(loadedNames);
        setInputText(loadedNames.join("\n"));
        setTopic(s.topic || "");
        setQuestionBankText(s.question_bank || "");
        setRemoveAfterWin(s.remove_after_win !== false);
        setStudentScores(s.student_scores || {});
        setHistoryData(s.history_data || []);
        
        // Reset local quiz display
        setShowResultBox(false);
        setWinnerName("");
        setCurrentQuestion(null);
      } else {
        // Class session doesn't exist yet, pre-populate and save default configuration
        setNames(DEFAULT_STUDENTS);
        setInputText(DEFAULT_STUDENTS.join("\n"));
        setTopic("Kiến thức tổng hợp lớp 6");
        setQuestionBankText(DEFAULT_QUESTIONS.join("\n"));
        setRemoveAfterWin(true);
        setStudentScores({});
        setHistoryData([]);
        
        await saveSession(sessionId, DEFAULT_STUDENTS, DEFAULT_STUDENTS.join("\n"), "Kiến thức tổng hợp lớp 6", DEFAULT_QUESTIONS.join("\n"), true, {}, []);
      }
    } catch (err) {
      console.error("Lỗi khi tải thông tin lớp học:", err);
    } finally {
      setIsLoadingSession(false);
    }
  };

  // --- Create a new Class Session ---
  const handleAddSession = async (newId: string) => {
    if (!newId.trim()) return;
    if (sessions.some(s => s.id.toLowerCase() === newId.toLowerCase())) {
      alert("Lớp học này đã tồn tại trên cơ sở dữ liệu!");
      return;
    }

    setCurrentSessionId(newId);
    
    // Set default empty session values
    setNames(DEFAULT_STUDENTS);
    setInputText(DEFAULT_STUDENTS.join("\n"));
    setTopic("Chủ đề bài học mới");
    setQuestionBankText(DEFAULT_QUESTIONS.join("\n"));
    setRemoveAfterWin(true);
    setStudentScores({});
    setHistoryData([]);

    await saveSession(newId, DEFAULT_STUDENTS, DEFAULT_STUDENTS.join("\n"), "Chủ đề bài học mới", DEFAULT_QUESTIONS.join("\n"), true, {}, []);
    alert(`✅ Đã thêm lớp học mới "${newId}" thành công!`);
  };

  // --- Delete a Class Session ---
  const handleDeleteSession = async (id: string) => {
    if (id === "Lớp 6A") {
      alert("Không được xóa lớp học mặc định!");
      return;
    }
    if (window.confirm(`Bạn có chắc chắn muốn xóa lớp học "${id}" khỏi cơ sở dữ liệu Supabase? Thao tác này sẽ xóa vĩnh viễn toàn bộ học sinh và điểm số của lớp này!`)) {
      try {
        const res = await fetch(`/api/sessions/${encodeURIComponent(id)}`, {
          method: "DELETE"
        });
        const data = await res.json();
        if (data.success) {
          alert(`✅ Đã xóa lớp học "${id}" khỏi hệ thống.`);
          // Switch back to "Lớp 6A"
          setCurrentSessionId("Lớp 6A");
          loadSession("Lớp 6A");
          fetchSessions();
        } else {
          alert(data.error || "Không thể xóa lớp học này.");
        }
      } catch (err) {
        console.error(err);
        alert("Lỗi kết nối khi xóa lớp học.");
      }
    }
  };

  // --- Hook to fetch sessions and current session on mount ---
  useEffect(() => {
    fetchSessions(true);
  }, []);

  // --- Refs ---
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const confettiCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const rotationRef = useRef<number>(0);
  const animationFrameRef = useRef<number | null>(null);

  // Color Palette for Wheel slices (Bright, classroom friendly)
  const sliceColors = [
    "#FF5733", "#33FF57", "#3357FF", "#F033FF", "#33FFF0", 
    "#FFB533", "#B5FF33", "#FF33B5", "#8E44AD", "#1abc9c",
    "#e67e22", "#2ecc71", "#3498db", "#9b59b6", "#e74c3c"
  ];

  // --- Sound Effects (Web Audio API Synthesizer) ---
  const initAudio = () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioCtxRef.current.state === "suspended") {
      audioCtxRef.current.resume();
    }
  };

  const playTickSound = () => {
    if (!soundEnabled) return;
    try {
      initAudio();
      const ctx = audioCtxRef.current;
      if (!ctx) return;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.type = "sine";
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.04);
      
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.04);
      
      osc.start();
      osc.stop(ctx.currentTime + 0.04);
    } catch (e) {
      console.warn("Audio error:", e);
    }
  };

  const playWinSound = () => {
    if (!soundEnabled) return;
    try {
      initAudio();
      const ctx = audioCtxRef.current;
      if (!ctx) return;

      const now = ctx.currentTime;
      // Arpeggio sound
      const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
      notes.forEach((freq, index) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq, now + index * 0.12);
        
        gain.gain.setValueAtTime(0, now + index * 0.12);
        gain.gain.linearRampToValueAtTime(0.2, now + index * 0.12 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + index * 0.12 + 0.4);
        
        osc.start(now + index * 0.12);
        osc.stop(now + index * 0.12 + 0.5);
      });
    } catch (e) {
      console.warn("Audio error:", e);
    }
  };

  // --- Confetti Canvas-based Particle Simulation ---
  const fireConfetti = () => {
    const c = confettiCanvasRef.current;
    if (!c) return;
    const cx = c.getContext("2d");
    if (!cx) return;

    c.width = window.innerWidth;
    c.height = window.innerHeight;

    const particles: any[] = [];
    const particleCount = 120;
    const colors = ["#FF6B6B", "#4ECDC4", "#45B7D1", "#FDCB6E", "#6C5CE7", "#FF8ED4", "#10B981"];

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * c.width,
        y: Math.random() * c.height - c.height, // Spawn above screen
        w: Math.random() * 8 + 6,
        h: Math.random() * 8 + 6,
        color: colors[Math.floor(Math.random() * colors.length)],
        vy: Math.random() * 4 + 3,
        vx: Math.random() * 4 - 2,
        rot: Math.random() * 360,
        rotSpeed: Math.random() * 8 - 4
      });
    }

    let frame = 0;
    const renderConfetti = () => {
      cx.clearRect(0, 0, c.width, c.height);
      let active = false;

      particles.forEach(p => {
        p.y += p.vy;
        p.x += p.vx;
        p.rot += p.rotSpeed;

        if (p.y < c.height) active = true;

        cx.save();
        cx.translate(p.x, p.y);
        cx.rotate((p.rot * Math.PI) / 180);
        cx.fillStyle = p.color;
        cx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        cx.restore();
      });

      frame++;
      if (active && frame < 240) {
        animationFrameRef.current = requestAnimationFrame(renderConfetti);
      } else {
        cx.clearRect(0, 0, c.width, c.height);
      }
    };

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    renderConfetti();
  };

  // --- Wheel Drawing ---
  const drawWheel = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = width / 2 - 15;

    ctx.clearRect(0, 0, width, height);

    if (names.length === 0) {
      // Empty wheel placeholder
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
      ctx.fillStyle = "#F3F4F6";
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = "#E5E7EB";
      ctx.stroke();

      ctx.fillStyle = "#9CA3AF";
      ctx.font = "bold 20px font-sans, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("Chưa có danh sách học sinh", centerX, centerY);
      return;
    }

    const sliceAngle = (2 * Math.PI) / names.length;

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(rotationRef.current);

    for (let i = 0; i < names.length; i++) {
      const startAngle = i * sliceAngle;
      const endAngle = startAngle + sliceAngle;

      // Draw slice background
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, radius, startAngle, endAngle);
      ctx.fillStyle = sliceColors[i % sliceColors.length];
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#FFFFFF";
      ctx.stroke();

      // Draw slice text
      ctx.save();
      ctx.rotate(startAngle + sliceAngle / 2);
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#FFFFFF";
      
      // Responsive-ish font sizing based on slice size
      let fontSize = 20;
      if (names.length > 20) fontSize = 13;
      else if (names.length > 12) fontSize = 16;
      ctx.font = `bold ${fontSize}px font-sans, sans-serif`;

      let text = names[i];
      if (text.length > 18) {
        text = text.substring(0, 16) + "...";
      }

      // Add text shadow for high-contrast readability
      ctx.shadowColor = "rgba(0, 0, 0, 0.4)";
      ctx.shadowBlur = 4;
      ctx.shadowOffsetX = 1;
      ctx.shadowOffsetY = 1;

      ctx.fillText(text, radius - 35, 0);
      ctx.restore();
    }

    // Draw central peg (3D flat style)
    ctx.restore();

    // Outermost shiny border
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    ctx.lineWidth = 10;
    ctx.strokeStyle = "#FFFFFF";
    ctx.stroke();

    // Add shadow border
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius + 5, 0, 2 * Math.PI);
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(0, 0, 0, 0.05)";
    ctx.stroke();

    // Center button frame
    ctx.beginPath();
    ctx.arc(centerX, centerY, 42, 0, 2 * Math.PI);
    ctx.fillStyle = "#FFFFFF";
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = "#F3F4F6";
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(centerX, centerY, 34, 0, 2 * Math.PI);
    ctx.fillStyle = "radial-gradient(circle, #ffeb3b, #fbc02d)";
    // Create a glossy gradient for the center peg
    const grad = ctx.createRadialGradient(centerX - 10, centerY - 10, 5, centerX, centerY, 34);
    grad.addColorStop(0, "#FFFFFF");
    grad.addColorStop(0.2, "#FCD34D");
    grad.addColorStop(1, "#D97706");
    ctx.fillStyle = grad;
    ctx.fill();
  };

  // Re-draw wheel whenever students list modifies
  useEffect(() => {
    drawWheel();
  }, [names]);

  // Handle window resizing to keep responsive structures stable
  useEffect(() => {
    const handleResize = () => {
      drawWheel();
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [names]);

  // --- Wheel Spinning Action ---
  const spin = () => {
    initAudio();
    if (isSpinning) return;
    if (names.length === 0) {
      alert("Vui lòng cập nhật danh sách học sinh!");
      return;
    }

    // Hide settings panel for complete focal engagement in presentation mode
    if (!isSettingsHidden && isAdminLoggedIn) {
      setIsSettingsHidden(true);
    }

    setIsSpinning(true);
    setShowResultBox(false);
    setIsAnswering(false);
    setShowAnswer(false);

    const spinDuration = 4500 + Math.random() * 2000; // 4.5s to 6.5s
    const startRotation = rotationRef.current;
    const sliceAngle = (2 * Math.PI) / names.length;
    
    // Choose winning index mathematical match
    const winningIndex = Math.floor(Math.random() * names.length);
    const extraSpins = 6 + Math.floor(Math.random() * 5); // 6 to 10 full spins
    
    // Smooth natural-looking stopping position within slice range
    const randomOffset = (Math.random() * 0.6 - 0.3) * sliceAngle;
    const targetElementAngle = winningIndex * sliceAngle + (sliceAngle / 2) + randomOffset;
    
    // Normalize current rotation state
    let currentRem = startRotation % (2 * Math.PI);
    if (currentRem < 0) currentRem += 2 * Math.PI;

    // We align target to pointer at top (3 * Math.PI / 2)
    const targetRotation = startRotation + (extraSpins * 2 * Math.PI) + (3 * Math.PI / 2 - currentRem - targetElementAngle);

    const startTime = performance.now();
    let lastTickSlice = -1;

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / spinDuration, 1);
      
      // Quartic ease-out for super elegant decelerations
      const easeOut = 1 - Math.pow(1 - progress, 4);
      
      rotationRef.current = startRotation + (targetRotation - startRotation) * easeOut;
      drawWheel();

      // Tick sound triggering based on current pointer crossing slices
      let pointerAngle = (3 * Math.PI / 2 - rotationRef.current) % (2 * Math.PI);
      if (pointerAngle < 0) pointerAngle += 2 * Math.PI;
      const currentSlice = Math.floor(pointerAngle / sliceAngle);

      if (currentSlice !== lastTickSlice && currentSlice >= 0 && currentSlice < names.length) {
        playTickSound();
        lastTickSlice = currentSlice;
      }

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animate);
      } else {
        rotationRef.current = targetRotation;
        drawWheel();
        finishSpin(winningIndex);
      }
    };

    animationFrameRef.current = requestAnimationFrame(animate);
  };

  // Finalize spin and draw Question from Bank
  const finishSpin = (winningIndex: number) => {
    const winner = names[winningIndex];
    setWinnerName(winner);
    setLastWinningIndex(winningIndex);

    // Get a random question from bank
    const questionObj = drawQuestionFromBank();
    setCurrentQuestion(questionObj);

    setIsSpinning(false);
    setShowResultBox(true);
    setIsAnswering(true);
    playWinSound();
    fireConfetti();
  };

  // Draw Question Logic
  const drawQuestionFromBank = (): Question => {
    const lines = questionBankText.split("\n").map(l => l.trim()).filter(l => l !== "");
    if (lines.length === 0) {
      return { question: "Không tìm thấy câu hỏi trong ngân hàng.", answer: "Không có đáp án." };
    }

    // Filter out used questions if possible
    let availableLines = lines.filter(line => !usedQuestions.includes(line));
    if (availableLines.length === 0) {
      // Recycle questions if bank exhausted
      setUsedQuestions([]);
      availableLines = lines;
    }

    const randomIndex = Math.floor(Math.random() * availableLines.length);
    const selectedLine = availableLines[randomIndex];
    
    // Mark as used
    setUsedQuestions(prev => [...prev, selectedLine]);

    const parts = selectedLine.split("|");
    const q = parts[0]?.trim() || "Câu hỏi trống.";
    const a = parts.slice(1).join("|")?.trim() || "Chưa có đáp án sẵn.";

    return { question: q, answer: a };
  };

  // --- Handlers for Admin actions ---
  const updateNamesFromInput = () => {
    const parsed = inputText.split("\n").map(n => n.trim()).filter(n => n !== "");
    setNames(parsed);
    setLastRemovedPerson(null);
    setInputText(parsed.join("\n"));
    saveSession(currentSessionId, parsed, parsed.join("\n"), topic, questionBankText, removeAfterWin, studentScores, historyData);
  };

  const shuffleNames = () => {
    const arr = [...names];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = arr[i];
      arr[i] = arr[j];
      arr[j] = temp;
    }
    setNames(arr);
    setInputText(arr.join("\n"));
    saveSession(currentSessionId, arr, arr.join("\n"), topic, questionBankText, removeAfterWin, studentScores, historyData);
  };

  const clearAllNames = () => {
    if (window.confirm("Bạn có chắc chắn muốn xóa toàn bộ danh sách học sinh?")) {
      setNames([]);
      setInputText("");
      setLastRemovedPerson(null);
      saveSession(currentSessionId, [], "", topic, questionBankText, removeAfterWin, studentScores, historyData);
    }
  };

  const resetAllScores = () => {
    if (window.confirm("Bạn có chắc chắn muốn xóa toàn bộ điểm số của tất cả học sinh?")) {
      setStudentScores({});
      setHistoryData([]);
      alert("Đã reset điểm số và lịch sử về ban đầu!");
      saveSession(currentSessionId, names, inputText, topic, questionBankText, removeAfterWin, {}, []);
    }
  };

  // --- File Upload Parsers (Excel, Word, PDF) ---
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const extension = file.name.split(".").pop()?.toLowerCase();
    setIsFileUploading(true);

    try {
      let textResult = "";

      if (extension === "xlsx" || extension === "xls") {
        textResult = await parseExcel(file);
      } else if (extension === "docx") {
        textResult = await parseWord(file);
      } else if (extension === "pdf") {
        textResult = await parsePDF(file);
      } else {
        alert("Định dạng file không được hỗ trợ! Vui lòng chọn .xlsx, .docx, hoặc .pdf");
        setIsFileUploading(false);
        return;
      }

      if (textResult.trim()) {
        const lines = textResult.split("\n").map(n => n.trim()).filter(n => n !== "");
        // Append or overwrite
        const confirmOverwrite = window.confirm(
          `Tìm thấy ${lines.length} học sinh. Bạn có muốn GHÉP THÊM vào danh sách hiện tại không?\n(Chọn 'Hủy' để GHI ĐÈ thay thế hoàn toàn danh sách cũ)`
        );

        let finalNamesList: string[] = [];
        if (confirmOverwrite) {
          finalNamesList = [...names, ...lines];
        } else {
          finalNamesList = lines;
        }

        // De-duplicate
        const uniqueNames = Array.from(new Set(finalNamesList));
        setNames(uniqueNames);
        setInputText(uniqueNames.join("\n"));
        alert("✅ Nhập danh sách từ file thành công!");
        saveSession(currentSessionId, uniqueNames, uniqueNames.join("\n"), topic, questionBankText, removeAfterWin, studentScores, historyData);
      } else {
        alert("Không đọc được dữ liệu học sinh nào từ file này.");
      }
    } catch (err) {
      console.error(err);
      alert("Có lỗi xảy ra trong quá trình đọc tài liệu. Vui lòng kiểm tra lại file của bạn.");
    } finally {
      setIsFileUploading(false);
      e.target.value = ""; // reset input file value
    }
  };

  // Excel parsing
  const parseExcel = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const XLSXLib = (window as any).XLSX;
          if (!XLSXLib) {
            reject(new Error("Thư viện Excel (XLSX) chưa được tải."));
            return;
          }
          const workbook = XLSXLib.read(data, { type: "array" });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const json: any[][] = XLSXLib.utils.sheet_to_json(worksheet, { header: 1 });
          
          const foundNames: string[] = [];
          json.forEach(row => {
            if (row && row.length > 0) {
              const cellValue = row.find(cell => cell && typeof cell === "string" && cell.trim() !== "");
              if (cellValue) foundNames.push(cellValue.trim());
              else {
                // If cell is a number (e.g. ID, but maybe we want name, let's keep search relaxed)
                const numericCell = row.find(cell => cell !== null && cell !== undefined && cell !== "");
                if (numericCell) foundNames.push(String(numericCell).trim());
              }
            }
          });
          resolve(foundNames.join("\n"));
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  };

  // Word docx parsing
  const parseWord = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const arrayBuffer = e.target?.result as ArrayBuffer;
          const mammothLib = (window as any).mammoth;
          if (!mammothLib) {
            reject(new Error("Thư viện Mammoth Word chưa được tải."));
            return;
          }
          const result = await mammothLib.extractRawText({ arrayBuffer });
          resolve(result?.value || "");
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  };

  // PDF parsing
  const parsePDF = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const typedarray = new Uint8Array(e.target?.result as ArrayBuffer);
          const pdfjsLib = (window as any).pdfjsLib;
          if (!pdfjsLib) {
            reject(new Error("Thư viện PDF.js chưa được tải."));
            return;
          }
          const pdf = await pdfjsLib.getDocument({ data: typedarray }).promise;
          let fullText = "";
          
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items
              .map((item: any) => item.str.trim())
              .filter((s: string) => s !== "")
              .join("\n");
            fullText += pageText + "\n";
          }
          resolve(fullText);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  };

  // --- AI Generated Questions handler ---
  const generateQuestionsWithAI = async () => {
    if (!topic.trim()) {
      alert("Vui lòng nhập chủ đề để AI tạo câu hỏi phù hợp.");
      return;
    }

    setIsGeneratingAI(true);
    try {
      const response = await fetch("/api/generate-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic }),
      });

      const data = await response.json();
      if (response.ok && data.success && Array.isArray(data.questions)) {
        const formatted = data.questions
          .map((item: { question: string; answer: string }) => `${item.question} | ${item.answer}`)
          .join("\n");
        setQuestionBankText(formatted);
        alert(`✅ Đã tự động tạo thành công 10 câu hỏi về chủ đề "${topic}"!`);
        saveSession(currentSessionId, names, inputText, topic, formatted, removeAfterWin, studentScores, historyData);
      } else {
        alert(data.error || "Không thể sinh câu hỏi bằng AI tại thời điểm này.");
      }
    } catch (err) {
      console.error(err);
      alert("Lỗi kết nối tới máy chủ AI. Vui lòng thử lại sau.");
    } finally {
      setIsGeneratingAI(false);
    }
  };

  // --- Password and login flows ---
  const handleAdminLogin = () => {
    if (adminPassword === "admin") {
      setIsAdminLoggedIn(true);
      setShowLoginModal(false);
      setAdminPassword("");
      setLoginError(false);
      setIsSettingsHidden(false); // Auto open config area on successful login
    } else {
      setLoginError(true);
    }
  };

  const handleAdminLogout = () => {
    setIsAdminLoggedIn(false);
    setIsSettingsHidden(true); // Close settings
  };

  // --- Answer Scoring Actions ---
  const handleScoring = (isCorrect: boolean) => {
    const pts = isCorrect ? 10 : 0;
    
    // Update Score
    const updatedScores = {
      ...studentScores,
      [winnerName]: {
        score: (studentScores[winnerName]?.score || 0) + pts,
        count: (studentScores[winnerName]?.count || 0) + 1
      }
    };
    setStudentScores(updatedScores);

    // Record History
    const timeStr = new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    const ptsText = isCorrect ? "+10đ" : "0đ";
    const historyItem: HistoryItem = {
      name: winnerName,
      question: currentQuestion?.question || "N/A",
      answer: currentQuestion?.answer || "N/A",
      score: ptsText,
      time: timeStr
    };

    const updatedHistory = [historyItem, ...historyData.slice(0, 19)];
    setHistoryData(updatedHistory);
    setShowAnswer(true);
    setIsAnswering(false);

    // If "removeAfterWin" is checked, remove student from current list
    let updatedNames = names;
    let updatedInputText = inputText;
    if (removeAfterWin && lastWinningIndex !== -1) {
      setLastRemovedPerson(winnerName);
      updatedNames = names.filter((_, idx) => idx !== lastWinningIndex);
      setNames(updatedNames);
      updatedInputText = updatedNames.join("\n");
      setInputText(updatedInputText);
    } else {
      setLastRemovedPerson(null);
    }

    // Save to Supabase
    saveSession(currentSessionId, updatedNames, updatedInputText, topic, questionBankText, removeAfterWin, updatedScores, updatedHistory);
  };

  // Undo / Respin function (Hoàn tác)
  const handleUndo = () => {
    if (historyData.length === 0) return;
    const lastRecord = historyData[0];

    // Re-adjust score
    const record = studentScores[lastRecord.name];
    const scoreDelta = lastRecord.score.includes("+10") ? 10 : 0;
    const updatedScores = {
      ...studentScores,
      [lastRecord.name]: {
        score: record ? Math.max(0, record.score - scoreDelta) : 0,
        count: record ? Math.max(0, record.count - 1) : 0
      }
    };
    setStudentScores(updatedScores);

    // Restore student into the wheel if they were removed
    let updatedNames = names;
    let updatedInputText = inputText;
    if (lastRemovedPerson && lastRemovedPerson === lastRecord.name) {
      const restored = [...names];
      // Insert back to previous location or just append
      restored.splice(lastWinningIndex, 0, lastRemovedPerson);
      updatedNames = restored;
      setNames(updatedNames);
      updatedInputText = restored.join("\n");
      setInputText(updatedInputText);
      setLastRemovedPerson(null);
    }

    // Remove first history item
    const updatedHistory = historyData.slice(1);
    setHistoryData(updatedHistory);
    setShowResultBox(false);

    // Save to Supabase
    saveSession(currentSessionId, updatedNames, updatedInputText, topic, questionBankText, removeAfterWin, updatedScores, updatedHistory);
  };

  // --- Export Data Flows ---
  const exportDataTXT = () => {
    let output = "=== KẾT QUẢ VÒNG QUAY MAY MẮN ===\n";
    output += `Thời gian xuất: ${new Date().toLocaleString("vi-VN")}\n\n`;
    
    output += "--- BẢNG ĐIỂM CHI TIẾT ---\n";
    const entries = (Object.entries(studentScores) as [string, StudentScore][]).sort((a, b) => b[1].score - a[1].score);
    if (entries.length === 0) {
      output += "Chưa có học sinh nào có điểm.\n";
    } else {
      entries.forEach(([name, val], idx) => {
        output += `${idx + 1}. ${name} - Điểm: ${val.score}đ (Đã trả lời ${val.count} câu)\n`;
      });
    }

    output += "\n--- LỊCH SỬ THAM GIA ---\n";
    if (historyData.length === 0) {
      output += "Chưa có lượt quay nào.\n";
    } else {
      historyData.forEach((item, idx) => {
        output += `[${item.time}] ${item.name} (${item.score}) \n  Q: ${item.question}\n  A: ${item.answer}\n`;
      });
    }

    const blob = new Blob([output], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `VongQuay_DiemSo_${new Date().getTime()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportDataPDF = async () => {
    const jspdfLib = (window as any).jspdf;
    if (!jspdfLib) {
      alert("Thư viện xuất PDF chưa sẵn sàng.");
      return;
    }

    try {
      const { jsPDF } = jspdfLib;
      const doc = new jsPDF();
      
      // Load standard Vietnamese-supporting font Roboto via base64 for beautiful Vietnamese printing
      const fontUrl = "https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/fonts/Roboto/Roboto-Regular.ttf";
      const response = await fetch(fontUrl);
      const buffer = await response.arrayBuffer();
      const base64Font = arrayBufferToBase64(buffer);

      doc.addFileToVFS("Roboto-Regular.ttf", base64Font);
      doc.addFont("Roboto-Regular.ttf", "Roboto", "normal");
      doc.setFont("Roboto");

      // Draw PDF Title
      doc.setFontSize(22);
      doc.setTextColor(79, 70, 229); // Primary Indigo color
      doc.text("KẾT QUẢ VÒNG QUAY MAY MẮN", 105, 20, { align: "center" });
      
      doc.setFontSize(10);
      doc.setTextColor(107, 114, 128); // Grey-muted
      doc.text(`Xuất lúc: ${new Date().toLocaleString("vi-VN")}`, 105, 27, { align: "center" });
      doc.text("Thiết kế bởi: Thầy Nghiêm Hồng Quân - Giáo viên Trường THCS Hòa Phú", 105, 32, { align: "center" });

      // Build scoreboard data
      const scoresSorted = (Object.entries(studentScores) as [string, StudentScore][]).sort((a, b) => b[1].score - a[1].score);
      const scoreboardBody = scoresSorted.map(([name, data], idx) => [
        idx + 1,
        name,
        `${data.score} điểm`,
        `${data.count} câu`
      ]);

      doc.setFontSize(14);
      doc.setTextColor(17, 24, 39);
      doc.text("1. BẢNG ĐIỂM XẾP HẠNG", 14, 45);

      (doc as any).autoTable({
        startY: 50,
        head: [["STT", "Học sinh", "Tổng điểm số", "Số câu tham gia"]],
        body: scoreboardBody.length > 0 ? scoreboardBody : [["-", "Chưa có dữ liệu", "-", "-"]],
        styles: { font: "Roboto", fontSize: 10 },
        headStyles: { fillColor: [79, 70, 229] },
        theme: "striped"
      });

      // Build history data
      const nextStartY = (doc as any).lastAutoTable.finalY + 15;
      doc.text("2. CHI TIẾT LỊCH SỬ LƯỢT QUAY", 14, nextStartY);

      const historyBody = historyData.map((item, idx) => [
        item.time,
        item.name,
        item.score,
        item.question,
        item.answer
      ]);

      (doc as any).autoTable({
        startY: nextStartY + 5,
        head: [["Thời gian", "Học sinh", "Kết quả", "Câu hỏi", "Đáp án"]],
        body: historyBody.length > 0 ? historyBody : [["-", "-", "-", "Chưa có lượt quay nào", "-"]],
        styles: { font: "Roboto", fontSize: 9 },
        headStyles: { fillColor: [16, 185, 129] }, // Green primary
        theme: "grid"
      });

      doc.save(`VongQuay_BaoCao_${new Date().getTime()}.pdf`);
    } catch (err) {
      console.error(err);
      alert("Đã xảy ra lỗi khi tạo file PDF có dấu tiếng Việt. Thử lại sau.");
    }
  };

  const exportDataWord = async () => {
    const docxLib = (window as any).docx;
    if (!docxLib) {
      alert("Thư viện xuất Word (docx) chưa sẵn sàng.");
      return;
    }

    try {
      const { Document, Packer, Paragraph, Table, TableRow, TableCell, HeadingLevel, AlignmentType, WidthType } = docxLib;

      const scoresSorted = (Object.entries(studentScores) as [string, StudentScore][]).sort((a, b) => b[1].score - a[1].score);

      // Score rows
      const scoreRows = [
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph({ text: "STT", alignment: AlignmentType.CENTER })], shading: { fill: "F3F4F6" } }),
            new TableCell({ children: [new Paragraph({ text: "Học sinh", alignment: AlignmentType.CENTER })], shading: { fill: "F3F4F6" } }),
            new TableCell({ children: [new Paragraph({ text: "Tổng điểm", alignment: AlignmentType.CENTER })], shading: { fill: "F3F4F6" } }),
            new TableCell({ children: [new Paragraph({ text: "Số câu tham gia", alignment: AlignmentType.CENTER })], shading: { fill: "F3F4F6" } }),
          ]
        })
      ];

      if (scoresSorted.length === 0) {
        scoreRows.push(
          new TableRow({
            children: [
              new TableCell({ children: [new Paragraph({ text: "-", alignment: AlignmentType.CENTER })] }),
              new TableCell({ children: [new Paragraph({ text: "Chưa có dữ liệu học sinh", alignment: AlignmentType.CENTER })] }),
              new TableCell({ children: [new Paragraph({ text: "-", alignment: AlignmentType.CENTER })] }),
              new TableCell({ children: [new Paragraph({ text: "-", alignment: AlignmentType.CENTER })] }),
            ]
          })
        );
      } else {
        scoresSorted.forEach(([name, data], idx) => {
          scoreRows.push(
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ text: String(idx + 1), alignment: AlignmentType.CENTER })] }),
                new TableCell({ children: [new Paragraph({ text: name })] }),
                new TableCell({ children: [new Paragraph({ text: `${data.score} điểm`, alignment: AlignmentType.CENTER })] }),
                new TableCell({ children: [new Paragraph({ text: String(data.count), alignment: AlignmentType.CENTER })] }),
              ]
            })
          );
        });
      }

      // History rows
      const historyRows = [
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph({ text: "Thời gian", alignment: AlignmentType.CENTER })], shading: { fill: "F3F4F6" } }),
            new TableCell({ children: [new Paragraph({ text: "Học sinh", alignment: AlignmentType.CENTER })], shading: { fill: "F3F4F6" } }),
            new TableCell({ children: [new Paragraph({ text: "Kết quả", alignment: AlignmentType.CENTER })], shading: { fill: "F3F4F6" } }),
            new TableCell({ children: [new Paragraph({ text: "Câu hỏi", alignment: AlignmentType.CENTER })], shading: { fill: "F3F4F6" } }),
            new TableCell({ children: [new Paragraph({ text: "Đáp án", alignment: AlignmentType.CENTER })], shading: { fill: "F3F4F6" } }),
          ]
        })
      ];

      if (historyData.length === 0) {
        historyRows.push(
          new TableRow({
            children: [
              new TableCell({ children: [new Paragraph({ text: "-", alignment: AlignmentType.CENTER })] }),
              new TableCell({ children: [new Paragraph({ text: "Chưa có lượt quay", alignment: AlignmentType.CENTER })] }),
              new TableCell({ children: [new Paragraph({ text: "-", alignment: AlignmentType.CENTER })] }),
              new TableCell({ children: [new Paragraph({ text: "-", alignment: AlignmentType.CENTER })] }),
              new TableCell({ children: [new Paragraph({ text: "-", alignment: AlignmentType.CENTER })] }),
            ]
          })
        );
      } else {
        historyData.forEach(item => {
          historyRows.push(
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ text: item.time, alignment: AlignmentType.CENTER })] }),
                new TableCell({ children: [new Paragraph({ text: item.name })] }),
                new TableCell({ children: [new Paragraph({ text: item.score, alignment: AlignmentType.CENTER })] }),
                new TableCell({ children: [new Paragraph({ text: item.question })] }),
                new TableCell({ children: [new Paragraph({ text: item.answer })] }),
              ]
            })
          );
        });
      }

      const doc = new Document({
        creator: "Vòng Quay May Mắn",
        title: "Báo Cáo Điểm Số",
        styles: {
          default: {
            document: {
              run: {
                font: "Arial",
              }
            }
          }
        },
        sections: [
          {
            properties: {},
            children: [
              new Paragraph({
                text: "KẾT QUẢ VÒNG QUAY MAY MẮN",
                heading: HeadingLevel.HEADING_1,
                alignment: AlignmentType.CENTER,
              }),
              new Paragraph({
                text: `Ngày xuất báo cáo: ${new Date().toLocaleDateString("vi-VN")} ${new Date().toLocaleTimeString("vi-VN")}`,
                alignment: AlignmentType.CENTER,
                spacing: { after: 250 }
              }),
              new Paragraph({
                text: "Thiết kế bởi: Thầy Nghiêm Hồng Quân - Giáo viên Trường THCS Hòa Phú",
                alignment: AlignmentType.CENTER,
                spacing: { after: 400 }
              }),
              new Paragraph({
                text: "1. BẢNG ĐIỂM CHI TIẾT",
                heading: HeadingLevel.HEADING_2,
                spacing: { before: 200, after: 150 }
              }),
              new Table({
                rows: scoreRows,
                width: { size: 100, type: WidthType.PERCENTAGE }
              }),
              new Paragraph({
                text: "2. LỊCH SỬ THAM GIA LỚP HỌC",
                heading: HeadingLevel.HEADING_2,
                spacing: { before: 400, after: 150 }
              }),
              new Table({
                rows: historyRows,
                width: { size: 100, type: WidthType.PERCENTAGE }
              }),
            ]
          }
        ]
      });

      const blob = await Packer.toBlob(doc);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `VongQuay_KetQua_${new Date().getTime()}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert("Đã xảy ra lỗi khi tạo tài liệu Word.");
    }
  };

  return (
    <div className="relative min-h-screen bg-linear-to-br from-rose-100 via-pink-100 to-sky-100 font-sans text-slate-800 selection:bg-indigo-200 selection:text-indigo-900 pb-12 animate-gradient-bg">
      {/* Background Confetti Canvas */}
      <canvas 
        ref={confettiCanvasRef} 
        id="confetti-canvas" 
        className="fixed inset-0 w-full h-full pointer-events-none z-40"
      />

      {/* Floating Control Buttons */}
      <div className="fixed top-4 right-4 flex items-center gap-3 z-50">
        <button
          onClick={() => setSoundEnabled(!soundEnabled)}
          className="p-3 bg-white/95 border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold shadow-md rounded-full cursor-pointer transition duration-200 flex items-center justify-center"
          title={soundEnabled ? "Tắt âm thanh" : "Bật âm thanh"}
        >
          {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5 text-rose-500" />}
        </button>

        {isAdminLoggedIn ? (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsSettingsHidden(!isSettingsHidden)}
              className={`px-4 py-2.5 rounded-full text-sm font-bold shadow-md flex items-center gap-2 transition duration-200 cursor-pointer ${
                isSettingsHidden 
                  ? "bg-indigo-600 hover:bg-indigo-700 text-white" 
                  : "bg-slate-600 hover:bg-slate-700 text-white"
              }`}
            >
              <Settings className="w-4 h-4" />
              {isSettingsHidden ? "Hiện Cài Đặt" : "Ẩn Cài Đặt"}
            </button>
            <button
              onClick={handleAdminLogout}
              className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-full text-sm font-bold shadow-md flex items-center gap-2 cursor-pointer transition duration-200"
            >
              <LogOut className="w-4 h-4" />
              Đăng xuất
            </button>
          </div>
        ) : (
          <button
            onClick={() => {
              setShowLoginModal(true);
              setLoginError(false);
            }}
            className="px-4 py-2.5 bg-white/90 border border-slate-200 hover:bg-slate-50 text-indigo-600 rounded-full text-sm font-bold shadow-md flex items-center gap-2 cursor-pointer transition duration-200"
          >
            <Lock className="w-4 h-4" />
            Đăng nhập Admin
          </button>
        )}
      </div>

      {/* Hero Header */}
      <header className="pt-12 pb-6 text-center max-w-4xl mx-auto px-4">
        <h1 className="font-display font-black text-4xl sm:text-6xl tracking-tight uppercase text-transparent bg-clip-text bg-linear-to-r from-indigo-600 via-pink-600 to-rose-600 drop-shadow-[0_2px_4px_rgba(0,0,0,0.1)] mb-3">
          Vòng Quay May Mắn
        </h1>
        <p className="font-designer text-2xl sm:text-3xl text-rose-600 font-bold tracking-wide drop-shadow-sm">
          Thiết kế bởi: Thầy Nghiêm Hồng Quân - Giáo viên Trường THCS Hòa Phú
        </p>
      </header>

      {/* Supabase Missing Table Banner */}
      {isTableMissing && (
        <div className="max-w-7xl mx-auto px-4 mb-6">
          <div className="bg-linear-to-r from-amber-50 to-orange-50 border-2 border-amber-300 rounded-2xl p-6 shadow-md space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-amber-500 text-white rounded-xl shrink-0">
                <HelpCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-amber-800">Cơ sở dữ liệu Supabase chưa được thiết lập bảng!</h3>
                <p className="text-sm text-slate-600 mt-1">
                  Ứng dụng cần bảng <code className="bg-amber-100 px-1.5 py-0.5 rounded text-amber-700 font-mono font-bold text-xs">lucky_wheel_sessions</code> trong Supabase của bạn để lưu trữ danh sách lớp học, học sinh, điểm số và lịch sử.
                </p>
              </div>
            </div>

            <div className="bg-slate-900 rounded-xl p-4 relative font-mono text-xs text-slate-300 overflow-x-auto max-w-full">
              <div className="absolute top-3 right-3 flex items-center gap-2">
                <span className="text-[10px] text-slate-500 font-sans">SQL Editor</span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(`CREATE TABLE IF NOT EXISTS lucky_wheel_sessions (
  id TEXT PRIMARY KEY,
  names TEXT[] NOT NULL DEFAULT '{}',
  question_bank TEXT NOT NULL DEFAULT '',
  topic TEXT NOT NULL DEFAULT '',
  remove_after_win BOOLEAN NOT NULL DEFAULT TRUE,
  student_scores JSONB NOT NULL DEFAULT '{}'::jsonb,
  history_data JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);`);
                    alert("Đã sao chép câu lệnh SQL vào clipboard!");
                  }}
                  className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded text-[11px] font-sans transition cursor-pointer"
                >
                  Sao chép
                </button>
              </div>
              <pre className="pr-16 leading-relaxed">
{`CREATE TABLE IF NOT EXISTS lucky_wheel_sessions (
  id TEXT PRIMARY KEY,
  names TEXT[] NOT NULL DEFAULT '{}',
  question_bank TEXT NOT NULL DEFAULT '',
  topic TEXT NOT NULL DEFAULT '',
  remove_after_win BOOLEAN NOT NULL DEFAULT TRUE,
  student_scores JSONB NOT NULL DEFAULT '{}'::jsonb,
  history_data JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);`}
              </pre>
            </div>

            <div className="text-xs text-slate-500 flex flex-col gap-1.5">
              <p className="font-bold text-slate-700">Hướng dẫn nhanh 4 bước:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Truy cập Supabase Dashboard: <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline font-semibold">https://supabase.com/dashboard</a></li>
                <li>Chọn dự án của bạn, nhấp mục <strong className="text-slate-700">SQL Editor</strong> bên thanh trái.</li>
                <li>Bấm nút <strong className="text-slate-700">New Query</strong>, dán đoạn lệnh SQL trên vào và nhấn nút <strong className="text-slate-700">Run</strong>.</li>
                <li>Sau đó quay lại tải lại trang web này là hoàn thành!</li>
              </ol>
            </div>
          </div>
        </div>
      )}

      {/* Supabase Class Session and Sync Selector Bar */}
      <div className="max-w-7xl mx-auto px-4 mb-4">
        <div className="bg-white/80 backdrop-blur-md rounded-2xl p-4 border border-white/60 shadow-md flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Lớp học hiện tại</h2>
              <div className="flex items-center gap-2">
                {isLoadingSession ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-indigo-600" />
                ) : (
                  <span className="text-lg font-black text-indigo-900">{currentSessionId}</span>
                )}
                {topic && <span className="text-xs font-bold bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full">{topic}</span>}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Dropdown to select session */}
            <div className="flex items-center gap-1.5">
              <label htmlFor="session-select" className="text-xs font-bold text-slate-500">Chọn lớp:</label>
              <select
                id="session-select"
                value={currentSessionId}
                onChange={(e) => {
                  setCurrentSessionId(e.target.value);
                  loadSession(e.target.value);
                }}
                disabled={isLoadingSession}
                className="bg-slate-50 border-2 border-slate-200 hover:border-slate-300 rounded-xl px-3 py-2 text-sm font-semibold focus:outline-hidden focus:border-indigo-500 transition cursor-pointer"
              >
                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.id}
                  </option>
                ))}
                {!sessions.some(s => s.id === currentSessionId) && (
                  <option value={currentSessionId}>{currentSessionId}</option>
                )}
              </select>
            </div>

            {/* Admin specific action to add a new class session */}
            {isAdminLoggedIn && (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  id="new-class-name"
                  placeholder="Tên lớp mới (vd: 7B)"
                  className="px-3 py-1.5 bg-slate-50 border-2 border-slate-200 focus:border-indigo-500 focus:outline-hidden text-sm font-semibold rounded-xl w-32"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const val = (e.target as HTMLInputElement).value.trim();
                      if (val) {
                        handleAddSession(val);
                        (e.target as HTMLInputElement).value = "";
                      }
                    }
                  }}
                />
                <button
                  onClick={() => {
                    const input = document.getElementById("new-class-name") as HTMLInputElement;
                    const val = input?.value.trim();
                    if (val) {
                      handleAddSession(val);
                      input.value = "";
                    } else {
                      alert("Vui lòng nhập tên lớp học mới.");
                    }
                  }}
                  className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm transition cursor-pointer"
                >
                  + Thêm lớp
                </button>

                {currentSessionId !== "Lớp 6A" && (
                  <button
                    onClick={() => handleDeleteSession(currentSessionId)}
                    className="p-2 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 rounded-xl transition cursor-pointer"
                    title="Xóa lớp học hiện tại khỏi Supabase"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}

            {/* Sync status indicator */}
            <div className="flex items-center gap-1.5 text-xs">
              {isSaving ? (
                <span className="text-amber-600 font-bold flex items-center gap-1">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Đang đồng bộ...
                </span>
              ) : (
                <span className="text-emerald-600 font-bold flex items-center gap-1 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                  <Check className="w-3.5 h-3.5" />
                  Đã đồng bộ Supabase
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid Content */}
      <main className="max-w-7xl mx-auto px-4 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start mt-4">
        
        {/* Left Side: Setup Panel (Admin configuration only, can be toggled) */}
        <AnimatePresence mode="popLayout">
          {isAdminLoggedIn && !isSettingsHidden && (
            <motion.div
              initial={{ opacity: 0, x: -300 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -300 }}
              transition={{ type: "spring", stiffness: 100, damping: 15 }}
              className="lg:col-span-5 bg-white/90 backdrop-blur-md rounded-2xl p-6 border border-white/50 shadow-xl space-y-6"
            >
              {/* List of Students Section */}
              <div>
                <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
                  <h2 className="font-display font-bold text-lg text-indigo-700 flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    Danh sách học sinh
                  </h2>
                  <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 text-slate-600 rounded-full font-mono">
                    {names.length} người
                  </span>
                </div>

                {/* Import File Button */}
                <div className="mb-4">
                  <input
                    type="file"
                    id="file-upload"
                    accept=".xlsx, .xls, .docx, .pdf"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                  <button
                    onClick={() => document.getElementById("file-upload")?.click()}
                    disabled={isFileUploading}
                    className="w-full py-3 px-4 bg-indigo-50 hover:bg-indigo-100 border border-dashed border-indigo-300 text-indigo-700 font-semibold rounded-xl text-sm transition duration-150 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isFileUploading ? (
                      <RefreshCw className="w-4 h-4 animate-spin text-indigo-600" />
                    ) : (
                      <FolderDown className="w-4 h-4 text-indigo-500" />
                    )}
                    {isFileUploading ? "Đang xử lý file..." : "Nhập danh sách học sinh từ file (.xlsx, .docx, .pdf)"}
                  </button>
                  <p className="text-[11px] text-slate-500 text-center mt-1">
                    Hỗ trợ file Excel, Word, hoặc PDF có chứa danh sách tên học sinh.
                  </p>
                </div>

                {/* Textarea names input */}
                <div className="space-y-2">
                  <textarea
                    rows={7}
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="Nhập tên học sinh, mỗi dòng 1 tên..."
                    className="w-full p-3.5 bg-slate-50 border-2 border-slate-200 rounded-xl focus:border-indigo-500 focus:outline-hidden text-sm font-medium transition duration-150"
                  />
                  
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={updateNamesFromInput}
                      className="py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm cursor-pointer shadow-sm transition duration-150 flex items-center justify-center gap-1.5"
                    >
                      <Check className="w-4 h-4" />
                      Cập nhật vòng
                    </button>
                    <button
                      onClick={shuffleNames}
                      className="py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-sm cursor-pointer shadow-sm transition duration-150 flex items-center justify-center gap-1.5"
                    >
                      <Shuffle className="w-4 h-4" />
                      Trộn ngẫu nhiên
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <button
                      onClick={clearAllNames}
                      className="py-2 bg-rose-500 hover:bg-rose-600 text-white font-bold rounded-xl text-xs cursor-pointer shadow-xs transition duration-150 flex items-center justify-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Xóa toàn bộ học sinh
                    </button>
                    <button
                      onClick={resetAllScores}
                      className="py-2 bg-slate-500 hover:bg-slate-600 text-white font-bold rounded-xl text-xs cursor-pointer shadow-xs transition duration-150 flex items-center justify-center gap-1"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Xóa toàn bộ điểm số
                    </button>
                  </div>
                </div>
              </div>

              {/* Trivia Questions Configuration */}
              <div className="border-t border-slate-100 pt-5 space-y-4">
                <h2 className="font-display font-bold text-lg text-emerald-700 flex items-center gap-2">
                  <HelpCircle className="w-5 h-5 text-emerald-600" />
                  Ngân hàng câu hỏi bài học
                </h2>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600 block">Nội dung / Chủ đề bài học (cho AI tự tạo):</label>
                  <input
                    type="text"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    onBlur={() => saveSession(currentSessionId, names, inputText, topic, questionBankText, removeAfterWin, studentScores, historyData)}
                    placeholder="Ví dụ: Ôn tập phép nhân chia lớp 3, Lịch sử nhà Trần..."
                    className="w-full p-2.5 bg-slate-50 border-2 border-slate-200 rounded-xl focus:border-emerald-500 focus:outline-hidden text-sm font-semibold text-slate-800"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600 block">
                    Danh sách câu hỏi (Định dạng: Câu hỏi | Đáp án):
                  </label>
                  <textarea
                    rows={6}
                    value={questionBankText}
                    onChange={(e) => setQuestionBankText(e.target.value)}
                    onBlur={() => saveSession(currentSessionId, names, inputText, topic, questionBankText, removeAfterWin, studentScores, historyData)}
                    placeholder="Mẫu: Thủ đô Việt Nam là gì? | Hà Nội"
                    className="w-full p-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:border-emerald-500 focus:outline-hidden text-xs font-mono text-slate-700"
                  />
                </div>

                <button
                  onClick={generateQuestionsWithAI}
                  disabled={isGeneratingAI || !topic.trim()}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm cursor-pointer shadow-md transition duration-150 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isGeneratingAI ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  {isGeneratingAI ? "AI đang xây dựng câu hỏi..." : "✨ AI Tự Tạo 10 Câu Hỏi & Đáp Án"}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Right Side: Wheel, Presentation Area & Scoreboards */}
        <div className={`transition-all duration-300 ${
          isAdminLoggedIn && !isSettingsHidden ? "lg:col-span-7" : "lg:col-span-12 max-w-4xl mx-auto w-full"
        } flex flex-col items-center space-y-6`}>
          
          {/* Answer Results Display Card */}
          <AnimatePresence>
            {showResultBox && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8, y: -50 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.8, y: -50 }}
                className="w-full bg-linear-to-r from-emerald-500 to-teal-600 text-white rounded-2xl p-6 shadow-xl text-center space-y-4 border border-emerald-400 relative overflow-hidden"
              >
                {/* Decorative particles */}
                <div className="absolute -top-12 -left-12 w-24 h-24 bg-white/10 rounded-full blur-xl pointer-events-none" />
                <div className="absolute -bottom-12 -right-12 w-24 h-24 bg-white/10 rounded-full blur-xl pointer-events-none" />

                <h3 className="font-display font-black text-3xl sm:text-4xl uppercase tracking-wider text-amber-200 drop-shadow-md">
                  🎉 {winnerName} 🎉
                </h3>

                <div className="bg-white/15 backdrop-blur-xs rounded-xl p-4 border border-white/10 space-y-2">
                  <p className="text-xs uppercase tracking-widest font-bold text-amber-200">Câu Hỏi Bài Học</p>
                  <p className="text-lg sm:text-xl font-bold font-sans">
                    {currentQuestion?.question}
                  </p>
                </div>

                {isAnswering ? (
                  <div className="space-y-4 pt-2">
                    <p className="text-xs uppercase tracking-widest font-bold text-slate-100">Đánh giá câu trả lời của học sinh</p>
                    <div className="flex flex-wrap gap-4 justify-center">
                      <button
                        onClick={() => handleScoring(true)}
                        className="px-6 py-3 bg-white text-emerald-700 hover:bg-emerald-50 font-bold rounded-xl shadow-lg transition duration-150 flex items-center gap-1.5 cursor-pointer"
                      >
                        <Check className="w-5 h-5" />
                        ĐÚNG (+10 điểm)
                      </button>
                      <button
                        onClick={() => handleScoring(false)}
                        className="px-6 py-3 bg-rose-500 text-white hover:bg-rose-600 font-bold border border-rose-400 rounded-xl shadow-lg transition duration-150 flex items-center gap-1.5 cursor-pointer"
                      >
                        <X className="w-5 h-5" />
                        SAI (0 điểm)
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 pt-2">
                    {!showAnswer ? (
                      <button
                        onClick={() => setShowAnswer(true)}
                        className="px-6 py-3 bg-amber-400 hover:bg-amber-500 text-slate-900 font-bold rounded-xl shadow-md transition duration-150 flex items-center gap-2 mx-auto cursor-pointer"
                      >
                        <Eye className="w-5 h-5" />
                        Hiển thị đáp án chính xác
                      </button>
                    ) : (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-slate-900/40 rounded-xl p-4 border border-white/5 space-y-1"
                      >
                        <p className="text-xs uppercase tracking-widest font-bold text-emerald-200">Đáp án chính xác</p>
                        <p className="text-xl font-bold text-amber-300 font-sans">{currentQuestion?.answer}</p>
                      </motion.div>
                    )}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Quick remove checkbox */}
          <div className="flex items-center gap-3 bg-white/70 backdrop-blur-xs px-5 py-2.5 rounded-full border border-slate-200/60 shadow-sm">
            <input
              type="checkbox"
              id="remove-after-win"
              checked={removeAfterWin}
              onChange={(e) => {
                const val = e.target.checked;
                setRemoveAfterWin(val);
                saveSession(currentSessionId, names, inputText, topic, questionBankText, val, studentScores, historyData);
              }}
              className="w-5 h-5 text-indigo-600 rounded-md focus:ring-indigo-500 cursor-pointer"
            />
            <label htmlFor="remove-after-win" className="text-sm font-bold text-slate-700 cursor-pointer select-none">
              Loại học sinh khỏi vòng quay sau khi trúng (tránh trùng lặp)
            </label>
          </div>

          {/* Lucky Wheel Canvas Area */}
          <div className="relative flex items-center justify-center p-6 bg-white/50 backdrop-blur-xs rounded-3xl border border-white/60 shadow-lg w-full max-w-[620px] aspect-square">
            {/* Top Indicator Triangle Pin */}
            <div className="absolute top-1 left-1/2 -translate-x-1/2 z-30 drop-shadow-[0_4px_6px_rgba(0,0,0,0.3)]">
              <svg width="46" height="42" viewBox="0 0 46 42" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M23 42L0.483341 0.75L45.5167 0.75L23 42Z" fill="#F43F5E" />
                <path d="M23 35L4.82532 2.25L41.1747 2.25L23 35Z" fill="#E11D48" />
              </svg>
            </div>

            {/* Canvas Wheel element */}
            <canvas
              ref={canvasRef}
              width={560}
              height={560}
              className="max-w-full h-auto rounded-full shadow-[0_15px_30px_rgba(0,0,0,0.15)] bg-white"
            />

            {/* Absolute Center Spin Button Over Wheel */}
            <button
              onClick={spin}
              disabled={isSpinning || names.length === 0}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 rounded-full border-4 border-white text-xl font-black uppercase text-rose-600 cursor-pointer shadow-xl z-20 flex flex-col items-center justify-center transition duration-200 hover:scale-105 active:scale-95 disabled:bg-slate-300 disabled:text-slate-500 disabled:border-slate-200 disabled:scale-100 disabled:cursor-not-allowed"
              style={{
                background: "radial-gradient(circle, #ffeb3b, #fbc02d)"
              }}
            >
              <span className="drop-shadow-sm tracking-wider">QUAY!</span>
            </button>
          </div>

          {/* Admin Export/Undo Actions Buttons */}
          {isAdminLoggedIn && (
            <div className="flex flex-wrap gap-2 justify-center w-full max-w-[620px]">
              <button
                onClick={handleUndo}
                disabled={historyData.length === 0 || isSpinning}
                className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                title="Trả học sinh vừa trúng lại vòng quay và hoàn tác điểm cộng"
              >
                <RotateCcw className="w-4 h-4" />
                Hoàn tác lượt quay
              </button>
              
              <div className="h-9 w-px bg-slate-300/60 mx-1 self-center" />

              <button
                onClick={exportDataTXT}
                className="px-4 py-2.5 bg-slate-600 hover:bg-slate-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition duration-150 cursor-pointer"
              >
                <FileText className="w-4 h-4" />
                Xuất TXT
              </button>

              <button
                onClick={exportDataPDF}
                className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition duration-150 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                Báo cáo PDF
              </button>

              <button
                onClick={exportDataWord}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition duration-150 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                Báo cáo Word
              </button>
            </div>
          )}

          {/* Tab lists (History & Leaderboard) */}
          <div className="w-full bg-white/70 backdrop-blur-md rounded-2xl p-5 border border-white/50 shadow-md">
            <div className="flex border-b border-slate-200/80 mb-4">
              <button
                onClick={() => setActiveTab("history")}
                className={`py-3 px-6 font-display font-bold text-sm tracking-wide transition duration-150 flex items-center gap-2 cursor-pointer border-b-2 -mb-[2px] ${
                  activeTab === "history"
                    ? "border-indigo-600 text-indigo-600"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                <History className="w-4 h-4" />
                ⏱ Lịch sử lượt quay
              </button>
              <button
                onClick={() => setActiveTab("leaderboard")}
                className={`py-3 px-6 font-display font-bold text-sm tracking-wide transition duration-150 flex items-center gap-2 cursor-pointer border-b-2 -mb-[2px] ${
                  activeTab === "leaderboard"
                    ? "border-indigo-600 text-indigo-600"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                <Trophy className="w-4 h-4" />
                🏆 Bảng điểm học sinh
              </button>
            </div>

            {/* History Tab */}
            {activeTab === "history" && (
              <div className="max-h-[300px] overflow-y-auto space-y-2 pr-1">
                {historyData.length === 0 ? (
                  <p className="text-center py-8 text-slate-400 font-medium text-sm">
                    Chưa có lượt quay nào được ghi nhận. Hãy nhấn QUAY!
                  </p>
                ) : (
                  <AnimatePresence>
                    {historyData.map((item, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-slate-50/90 rounded-xl p-3.5 border border-slate-200/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 relative group overflow-hidden"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-slate-400 font-mono bg-slate-200/60 px-2 py-0.5 rounded-full">
                              {item.time}
                            </span>
                            <span className="font-bold text-indigo-700 text-base">{item.name}</span>
                          </div>
                          <p className="text-xs text-slate-600 font-medium leading-relaxed">
                            <span className="font-bold text-slate-500">Hỏi:</span> {item.question}
                          </p>
                          <p className="text-xs text-emerald-600 font-bold leading-relaxed">
                            <span className="font-bold text-slate-400 font-normal">Đáp án:</span> {item.answer}
                          </p>
                        </div>
                        <span className={`self-start sm:self-center px-3 py-1 text-xs font-black rounded-full shadow-xs tracking-wider shrink-0 ${
                          item.score.includes("+10") 
                            ? "bg-emerald-100 text-emerald-700 border border-emerald-200" 
                            : "bg-slate-100 text-slate-500 border border-slate-200"
                        }`}>
                          {item.score}
                        </span>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                )}
              </div>
            )}

            {/* Leaderboard Tab */}
            {activeTab === "leaderboard" && (
              <div className="max-h-[300px] overflow-y-auto pr-1">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs font-bold text-slate-500 uppercase">
                      <th className="py-2 pb-3">Thứ hạng</th>
                      <th className="py-2 pb-3">Học sinh</th>
                      <th className="py-2 pb-3 text-center">Tổng điểm số</th>
                      <th className="py-2 pb-3 text-center">Số câu tham gia</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.keys(studentScores).length === 0 ? (
                      <tr>
                        <td colSpan={4} className="text-center py-8 text-slate-400 font-medium text-sm">
                          Chưa có điểm số nào được ghi nhận.
                        </td>
                      </tr>
                    ) : (
                      (Object.entries(studentScores) as [string, StudentScore][])
                        .sort((a, b) => b[1].score - a[1].score)
                        .map(([name, data], idx) => {
                          let rankIcon = null;
                          if (idx === 0) rankIcon = "🥇";
                          else if (idx === 1) rankIcon = "🥈";
                          else if (idx === 2) rankIcon = "🥉";

                          return (
                            <tr key={name} className="border-b border-slate-100/70 hover:bg-slate-50/50 transition text-sm">
                              <td className="py-3 font-semibold text-slate-600 pl-2">
                                {rankIcon ? <span className="text-base mr-1">{rankIcon}</span> : null}
                                <span className="font-mono text-xs">#{idx + 1}</span>
                              </td>
                              <td className="py-3 font-bold text-slate-800">{name}</td>
                              <td className="py-3 text-center font-black text-emerald-600 font-display text-base">
                                {data.score} đ
                              </td>
                              <td className="py-3 text-center font-semibold text-slate-500 font-mono text-xs">
                                {data.count}
                              </td>
                            </tr>
                          );
                        })
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer Branding Credit */}
      <footer className="mt-16 text-center max-w-lg mx-auto px-4 border-t border-slate-300/40 pt-6">
        <p className="text-slate-600 text-sm font-semibold tracking-wide">
          Thiết kế bởi: <strong className="text-indigo-600">Thầy Nghiêm Hồng Quân - Giáo viên Trường THCS Hòa Phú</strong>
        </p>
        <p className="text-slate-400 text-xs mt-1">
          Ứng dụng tương tác lớp học Vòng Quay May Mắn kết hợp AI tự động ra đề câu hỏi.
        </p>
      </footer>

      {/* Admin Password Login Modal */}
      <AnimatePresence>
        {showLoginModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white rounded-2xl p-6 w-full max-w-md border border-slate-100 shadow-2xl relative"
            >
              <button
                onClick={() => setShowLoginModal(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="text-center space-y-2 mb-6">
                <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto shadow-xs">
                  <Lock className="w-6 h-6" />
                </div>
                <h3 className="font-display font-bold text-xl text-slate-800">Cổng Quản Trị Viên</h3>
                <p className="text-xs text-slate-400 font-medium">Nhập mật khẩu quản trị để truy cập cấu hình lớp học</p>
              </div>

              <div className="space-y-4">
                <div>
                  <input
                    type="password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleAdminLogin();
                    }}
                    placeholder="Mật khẩu (mặc định: admin)"
                    className="w-full p-3 border-2 border-slate-200 rounded-xl focus:border-indigo-500 focus:outline-hidden text-center text-sm font-semibold"
                    autoFocus
                  />
                  {loginError && (
                    <p className="text-xs font-bold text-rose-500 text-center mt-2 flex items-center justify-center gap-1">
                      <X className="w-3.5 h-3.5" /> Mật khẩu không đúng! Thử lại.
                    </p>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleAdminLogin}
                    className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm shadow-md transition cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Check className="w-4 h-4" />
                    Đăng nhập
                  </button>
                  <button
                    onClick={() => setShowLoginModal(false)}
                    className="py-3 px-5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl text-sm transition cursor-pointer"
                  >
                    Hủy
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
