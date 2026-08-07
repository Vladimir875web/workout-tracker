import React, { useState, useEffect, useMemo, useCallback } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import {
  Dumbbell, Activity, Plus, ChevronDown, ChevronUp, Save, TrendingUp, Ruler, Scale,
  Calendar, Check, Trash2, X, Download, Upload, StickyNote,
} from "lucide-react";

const PROGRAM_VERSION = 2;

const DEFAULT_PROGRAM = {
  "Пн": {
    title: "Свежие плечи + База",
    exercises: [
      { name: "Махи гантелями в стороны", target: "4×12–15" },
      { name: "Жим ногами в тренажере", target: "3×10–12" },
      { name: "Жим гантелей лежа (гориз.)", target: "3×8–10" },
      { name: "Тяга верхнего блока к груди", target: "3×10–12" },
      { name: "Разгибания на блоке (канат)", target: "3×10–12" },
      { name: "Французский жим гантелей лёжа", target: "3×10–12" },
    ],
  },
  "Ср": {
    title: "3D-плечи + Брахиалис + Спина",
    exercises: [
      { name: "Жим гантелей на накл. (30°)", target: "3×8–10" },
      { name: "Махи в наклоне / Бабочка", target: "3×12–15" },
      { name: "Тяга блока к поясу (сидя)", target: "3×10–12" },
      { name: "«Хаммеры» с гантелями", target: "3×10–12" },
      { name: "Сгибания ног в тренажере", target: "3×10–12" },
      { name: "Сгибания на бицепс (гантели попеременно)", target: "3×10–12" },
    ],
  },
  "Пт": {
    title: "Плечи + Суперобъём на руки",
    exercises: [
      { name: "Приседания (Смит / Гоблет)", target: "3×10–12" },
      { name: "Жим гантелей сидя (плечи)", target: "3×10–12" },
      { name: "Махи в стороны на блоке/тросе", target: "3×12–15" },
      { name: "Тяга гантели 1 рукой в упоре", target: "3×10–12" },
      { name: "Кроссовер / Бабочка (грудь)", target: "3×12–15" },
      { name: "Тяга резинки к лицу (face pull)", target: "3×12–15" },
      { name: "Сгибания на бицепс", target: "4×10–12" },
      { name: "Фр. жим из-за головы (триц)", target: "4×10–12" },
    ],
  },
};

const todayISO = () => new Date().toISOString().slice(0, 10);
const fmtDate = (iso) => {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "2-digit" });
};

const setVolume = (sets) =>
  sets.reduce((sum, s) => {
    const w = parseFloat(s.weight);
    const r = parseFloat(s.reps);
    return sum + (isNaN(w) || isNaN(r) ? 0 : w * r);
  }, 0);

const fmtVol = (v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}т` : `${Math.round(v)}кг`);

function parseSetCount(target) {
  const m = String(target).match(/^(\d+)/);
  return m ? parseInt(m[1], 10) : 3;
}

function emptySets(count) {
  return Array.from({ length: count }, () => ({ weight: "", reps: "" }));
}

function useStorage(key, fallback) {
  const [data, setData] = useState(fallback);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(key);
      if (stored) setData(JSON.parse(stored));
    } catch (e) {
      // key doesn't exist yet or invalid JSON
    }
    setLoaded(true);
  }, [key]);

  const persist = (next) => {
    setData(next);
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch (e) {
      console.error("localStorage set failed", e);
    }
  };

  return [data, persist, loaded];
}

function exportData() {
  const payload = {
    exportedAt: new Date().toISOString(),
    workoutLogs: JSON.parse(localStorage.getItem("workout-logs") || "{}"),
    bodyMetrics: JSON.parse(localStorage.getItem("body-metrics") || "{}"),
    profile: JSON.parse(localStorage.getItem("user-profile") || "{}"),
    workoutProgram: JSON.parse(localStorage.getItem("workout-program") || "null"),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `zhurnal-${todayISO()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importData(onDone) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "application/json,.json";
  input.onchange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (data.workoutLogs) localStorage.setItem("workout-logs", JSON.stringify(data.workoutLogs));
      if (data.bodyMetrics) localStorage.setItem("body-metrics", JSON.stringify(data.bodyMetrics));
      if (data.profile) localStorage.setItem("user-profile", JSON.stringify(data.profile));
      if (data.workoutProgram) localStorage.setItem("workout-program", JSON.stringify(data.workoutProgram));
      onDone?.();
    } catch {
      alert("Не удалось прочитать файл. Проверь формат JSON.");
    }
  };
  input.click();
}

function useProgram() {
  const [program, persist, loaded] = useStorage("workout-program", null);

  useEffect(() => {
    if (loaded && (!program || program.version !== PROGRAM_VERSION)) {
      persist({ version: PROGRAM_VERSION, days: DEFAULT_PROGRAM });
    }
  }, [loaded, program, persist]);

  const resolved = useMemo(() => {
    if (program && program.version === PROGRAM_VERSION) return program.days;
    return DEFAULT_PROGRAM;
  }, [program]);

  const saveProgram = (days) => {
    persist({ version: PROGRAM_VERSION, days });
  };

  return [resolved, saveProgram, loaded];
}

function getLastExerciseResult(logs, exerciseName, excludeKey) {
  const candidates = Object.entries(logs)
    .filter(([key]) => key !== excludeKey)
    .map(([, entry]) => entry)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  for (const entry of candidates) {
    const ex = entry.exercises?.find((e) => e.name === exerciseName);
    const done = ex?.sets?.filter((s) => s.weight !== "" && s.reps !== "");
    if (done?.length) return { date: entry.date, sets: done, comment: ex.comment ?? "" };
  }
  return null;
}

function buildExerciseSets(ex, existingEx, logs, entryKey) {
  const numSets = parseSetCount(ex.target);

  if (existingEx?.sets?.length) {
    return {
      name: ex.name,
      target: ex.target,
      sets: existingEx.sets,
      comment: existingEx.comment ?? "",
      showComment: Boolean(existingEx.comment),
    };
  }

  const last = getLastExerciseResult(logs, ex.name, entryKey);
  if (last) {
    const sets = last.sets.map((s) => ({ weight: String(s.weight), reps: String(s.reps) }));
    while (sets.length < numSets) sets.push({ weight: "", reps: "" });
    return {
      name: ex.name,
      target: ex.target,
      sets: sets.slice(0, Math.max(numSets, sets.length)),
      comment: "",
      showComment: false,
      prefilledFrom: last.date,
    };
  }

  return {
    name: ex.name,
    target: ex.target,
    sets: emptySets(numSets),
    comment: "",
    showComment: false,
  };
}

function initSets(day, program, existingEntry, logs, entryKey) {
  return program[day].exercises.map((ex) => {
    const existingEx = existingEntry?.exercises?.find((e) => e.name === ex.name);
    return buildExerciseSets(ex, existingEx, logs, entryKey);
  });
}

function applyTelegramSafeArea(tg) {
  const root = document.documentElement;
  const safe = tg.safeAreaInset;
  const content = tg.contentSafeAreaInset;

  if (safe) {
    root.style.setProperty("--tg-safe-area-inset-top", `${safe.top}px`);
    root.style.setProperty("--tg-safe-area-inset-bottom", `${safe.bottom}px`);
    root.style.setProperty("--tg-safe-area-inset-left", `${safe.left}px`);
    root.style.setProperty("--tg-safe-area-inset-right", `${safe.right}px`);
  }
  if (content) {
    root.style.setProperty("--tg-content-safe-area-inset-top", `${content.top}px`);
    root.style.setProperty("--tg-content-safe-area-inset-bottom", `${content.bottom}px`);
    root.style.setProperty("--tg-content-safe-area-inset-left", `${content.left}px`);
    root.style.setProperty("--tg-content-safe-area-inset-right", `${content.right}px`);
  }
}

function initTelegramWebApp() {
  const tg = window.Telegram?.WebApp;
  if (!tg) return;
  tg.ready();
  applyTelegramSafeArea(tg);
  tg.expand();
  if (typeof tg.requestFullscreen === "function") {
    tg.requestFullscreen();
  }
  tg.onEvent?.("viewportChanged", () => applyTelegramSafeArea(tg));
  tg.onEvent?.("safeAreaChanged", () => applyTelegramSafeArea(tg));
  tg.onEvent?.("contentSafeAreaChanged", () => applyTelegramSafeArea(tg));
}

export default function App() {
  const [tab, setTab] = useState("workout");
  const [reloadKey, setReloadKey] = useState(0);
  const reload = () => setReloadKey((k) => k + 1);

  useEffect(() => {
    initTelegramWebApp();
  }, []);

  return (
    <div className="app-root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;500;600;700;800&display=swap');
        .app-root {
          min-height: 100vh;
          min-height: 100dvh;
          width: 100%;
          max-width: 100vw;
          overflow-x: hidden;
          background: #15130f;
          color: #ece6d9;
          font-family: 'Inter', system-ui, sans-serif;
          padding-left: var(--tg-safe-area-inset-left, env(safe-area-inset-left, 0px));
          padding-right: var(--tg-safe-area-inset-right, env(safe-area-inset-right, 0px));
        }
        .app-header {
          border-bottom: 1px solid #2a2620;
          position: sticky;
          top: 0;
          background: #15130f;
          z-index: 10;
          padding-top: calc(
            var(--tg-content-safe-area-inset-top, 0px) +
            var(--tg-safe-area-inset-top, env(safe-area-inset-top, 20px))
          );
        }
        .app-header-inner {
          max-width: 640px;
          margin: 0 auto;
          padding: 20px 16px 0;
          width: 100%;
        }
        .display { font-family: 'Bebas Neue', 'Inter', sans-serif; letter-spacing: 0.02em; }
        input[type="number"], input[type="date"], input[type="text"], textarea {
          background: #1e1b15; border: 1px solid #3a3527; color: #ece6d9;
          border-radius: 6px; padding: 8px 10px; font-size: 15px; width: 100%;
          font-family: 'Inter', sans-serif;
        }
        input:focus, textarea:focus { outline: none; border-color: #c98f2f; }
        input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(0.8); }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-thumb { background: #3a3527; border-radius: 3px; }
        button { font-family: 'Inter', sans-serif; cursor: pointer; }
        .main-content {
          max-width: 640px;
          margin: 0 auto;
          padding: 0 16px 96px;
          width: 100%;
          overflow-x: hidden;
        }
        .sticky-save-bar {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          z-index: 20;
          background: linear-gradient(transparent, #15130f 28%);
          padding: 12px 16px calc(
            12px +
            var(--tg-content-safe-area-inset-bottom, 0px) +
            var(--tg-safe-area-inset-bottom, env(safe-area-inset-bottom, 0px))
          );
          pointer-events: none;
        }
        .sticky-save-bar button {
          pointer-events: auto;
        }
        .sticky-save-inner {
          max-width: 640px;
          margin: 0 auto;
          width: 100%;
        }
      `}</style>

      <Header tab={tab} setTab={setTab} onExport={exportData} onImport={() => importData(reload)} />
      <div className="main-content">
        {tab === "workout" ? <WorkoutTab key={reloadKey} /> : tab === "metrics" ? <MetricsTab key={reloadKey} /> : <ProfileTab key={reloadKey} />}
      </div>
    </div>
  );
}

function Header({ tab, setTab, onExport, onImport }) {
  return (
    <div className="app-header">
      <div className="app-header-inner">
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <span className="display" style={{ fontSize: 34, color: "#e0a940", lineHeight: 1 }}>ЖУРНАЛ</span>
            <span style={{ fontSize: 13, color: "#7a7362", fontWeight: 500 }}>тренировок</span>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <IconBtn onClick={onExport} title="Скачать резервную копию"><Download size={16} /></IconBtn>
            <IconBtn onClick={onImport} title="Загрузить резервную копию"><Upload size={16} /></IconBtn>
          </div>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          <TabButton active={tab === "workout"} onClick={() => setTab("workout")} icon={<Dumbbell size={16} />} label="Тренировки" />
          <TabButton active={tab === "metrics"} onClick={() => setTab("metrics")} icon={<Activity size={16} />} label="Показатели" />
          <TabButton active={tab === "profile"} onClick={() => setTab("profile")} icon={<Scale size={16} />} label="Профиль" />
        </div>
      </div>
    </div>
  );
}

function IconBtn({ onClick, title, children }) {
  return (
    <button type="button" onClick={onClick} title={title} style={{
      background: "#211e17", border: "1px solid #3a3527", borderRadius: 6,
      color: "#a89f88", padding: "6px 8px", display: "flex", alignItems: "center",
    }}>{children}</button>
  );
}

function TabButton({ active, onClick, icon, label }) {
  return (
    <button onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: 7, padding: "10px 16px",
      background: "transparent", border: "none", borderBottom: active ? "2px solid #e0a940" : "2px solid transparent",
      color: active ? "#e0a940" : "#7a7362", fontWeight: 600, fontSize: 14.5, transition: "color .15s",
    }}>
      {icon}{label}
    </button>
  );
}

/* ---------------- WORKOUT TAB ---------------- */

function WorkoutTab() {
  const [logs, persistLogs, logsLoaded] = useStorage("workout-logs", {});
  const [program, saveProgram, programLoaded] = useProgram();
  const [day, setDay] = useState("Пн");
  const [date, setDate] = useState(todayISO());
  const [showHistory, setShowHistory] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEx, setNewEx] = useState({ name: "", target: "3×10–12" });
  const [saved, setSaved] = useState(false);

  const loaded = logsLoaded && programLoaded;
  const entryKey = `${date}_${day}`;
  const existing = logs[entryKey];

  const [sets, setSets] = useState([]);
  const [notes, setNotes] = useState("");

  const reloadSets = useCallback(() => {
    if (!loaded) return;
    const entry = logs[entryKey];
    setSets(initSets(day, program, entry, logs, entryKey));
    setNotes(entry?.notes ?? "");
  }, [day, date, loaded, program, logs, entryKey]);

  useEffect(() => {
    reloadSets();
  }, [reloadSets]);

  const updateSet = (exIdx, setIdx, field, value) => {
    setSets((prev) => {
      const next = [...prev];
      next[exIdx] = { ...next[exIdx], sets: [...next[exIdx].sets] };
      next[exIdx].sets[setIdx] = { ...next[exIdx].sets[setIdx], [field]: value };
      return next;
    });
  };

  const addSet = (exIdx) => {
    setSets((prev) => {
      const next = [...prev];
      next[exIdx] = { ...next[exIdx], sets: [...next[exIdx].sets, { weight: "", reps: "" }] };
      return next;
    });
  };

  const updateComment = (exIdx, value) => {
    setSets((prev) => {
      const next = [...prev];
      next[exIdx] = { ...next[exIdx], comment: value };
      return next;
    });
  };

  const toggleComment = (exIdx) => {
    setSets((prev) => {
      const next = [...prev];
      next[exIdx] = { ...next[exIdx], showComment: !next[exIdx].showComment };
      return next;
    });
  };

  const handleSave = () => {
    const next = { ...logs, [entryKey]: { date, day, exercises: sets, notes } };
    persistLogs(next);
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  const totalVolume = sets.reduce((sum, ex) => sum + setVolume(ex.sets), 0);

  const removeExercise = (exIdx) => {
    const exName = sets[exIdx].name;
    const nextProgram = {
      ...program,
      [day]: {
        ...program[day],
        exercises: program[day].exercises.filter((e) => e.name !== exName),
      },
    };
    saveProgram(nextProgram);
    setSets((prev) => prev.filter((_, i) => i !== exIdx));
  };

  const addExercise = () => {
    const name = newEx.name.trim();
    const target = newEx.target.trim() || "3×10–12";
    if (!name) return;

    const nextProgram = {
      ...program,
      [day]: {
        ...program[day],
        exercises: [...program[day].exercises, { name, target }],
      },
    };
    saveProgram(nextProgram);

    const built = buildExerciseSets({ name, target }, null, logs, entryKey);
    setSets((prev) => [...prev, built]);
    setNewEx({ name: "", target: "3×10–12" });
    setShowAddForm(false);
  };

  return (
    <div style={{ width: "100%", overflowX: "hidden" }}>
      <div style={{ display: "flex", gap: 8, margin: "18px 0 14px" }}>
        {Object.keys(program).map((d) => (
          <button key={d} onClick={() => setDay(d)} style={{
            flex: 1, padding: "10px 0", borderRadius: 8, fontWeight: 700, fontSize: 14,
            background: day === d ? "#e0a940" : "#211e17",
            color: day === d ? "#15130f" : "#a89f88",
            border: "1px solid " + (day === d ? "#e0a940" : "#3a3527"),
          }}>{d}</button>
        ))}
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <div className="display" style={{ fontSize: 22, color: "#ece6d9" }}>{program[day].title}</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
        <Calendar size={15} color="#7a7362" />
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ width: 150 }} />
      </div>

      {sets.map((ex, exIdx) => (
        <ExerciseCard
          key={`${day}-${ex.name}-${exIdx}`}
          ex={ex}
          exIdx={exIdx}
          onUpdateSet={updateSet}
          onAddSet={addSet}
          onRemove={() => removeExercise(exIdx)}
          onToggleComment={() => toggleComment(exIdx)}
          onUpdateComment={(v) => updateComment(exIdx, v)}
        />
      ))}

      {showAddForm ? (
        <div style={{ background: "#1c1a14", border: "1px solid #3a3527", borderRadius: 10, padding: 14, marginBottom: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: "#a89f88" }}>Новое упражнение</div>
          <input
            type="text"
            placeholder="Название"
            value={newEx.name}
            onChange={(e) => setNewEx({ ...newEx, name: e.target.value })}
            style={{ marginBottom: 8 }}
          />
          <input
            type="text"
            placeholder="Цель, напр. 3×10–12"
            value={newEx.target}
            onChange={(e) => setNewEx({ ...newEx, target: e.target.value })}
            style={{ marginBottom: 10 }}
          />
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={addExercise} style={{
              flex: 1, padding: "10px 0", borderRadius: 8, border: "none",
              background: "#e0a940", color: "#15130f", fontWeight: 700, fontSize: 14,
            }}>Добавить</button>
            <button onClick={() => { setShowAddForm(false); setNewEx({ name: "", target: "3×10–12" }); }} style={{
              padding: "10px 14px", borderRadius: 8, border: "1px solid #3a3527",
              background: "transparent", color: "#7a7362", fontWeight: 600, fontSize: 14,
            }}><X size={16} /></button>
          </div>
        </div>
      ) : (
        <button onClick={() => setShowAddForm(true)} style={{
          width: "100%", padding: "12px 0", borderRadius: 10, marginBottom: 10,
          background: "#211e17", border: "1px dashed #3a3527", color: "#c98f2f",
          fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
        }}>
          <Plus size={16} /> Упражнение
        </button>
      )}

      {totalVolume > 0 && (
        <div style={{
          background: "#211e17", border: "1px solid #3a3527", borderRadius: 8,
          padding: "10px 14px", marginBottom: 10, fontSize: 13, color: "#a89f88",
          display: "flex", justifyContent: "space-between",
        }}>
          <span>Общий тоннаж тренировки</span>
          <span style={{ color: "#e0a940", fontWeight: 700 }}>{fmtVol(totalVolume)}</span>
        </div>
      )}

      <div style={{ background: "#1c1a14", border: "1px solid #2a2620", borderRadius: 10, padding: 14, marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, fontSize: 12.5, color: "#a89f88", fontWeight: 600 }}>
          <StickyNote size={15} color="#e0a940" /> Заметки к тренировке
        </div>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Самочувствие, боль, что улучшить..."
          rows={2} style={{ minHeight: 56, resize: "vertical", fontSize: 14 }} />
      </div>

      <button onClick={() => setShowHistory((v) => !v)} style={{
        width: "100%", background: "none", border: "none", color: "#7a7362", fontSize: 13,
        padding: "8px 0 6px", display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
      }}>
        <TrendingUp size={14} /> Прогресс по упражнению {showHistory ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      {showHistory && <ExerciseProgress logs={logs} program={program} />}

      <div className="sticky-save-bar">
        <div className="sticky-save-inner">
          <button onClick={handleSave} style={{
            width: "100%", padding: "14px 0", borderRadius: 10, border: "none",
            background: saved ? "#4a7a5a" : "#e0a940", color: "#15130f", fontWeight: 800, fontSize: 15,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "background .2s",
            boxShadow: "0 -4px 24px rgba(0,0,0,0.35)",
          }}>
            {saved ? <><Check size={17} /> Сохранено</> : <><Save size={17} /> Сохранить тренировку</>}
          </button>
        </div>
      </div>
    </div>
  );
}

function ExerciseCard({ ex, exIdx, onUpdateSet, onAddSet, onRemove, onToggleComment, onUpdateComment }) {
  const vol = setVolume(ex.sets);
  return (
    <div style={{ background: "#1c1a14", border: "1px solid #2a2620", borderRadius: 10, padding: 14, marginBottom: 10, width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8, gap: 8 }}>
        <div style={{ fontWeight: 700, fontSize: 15, flex: 1, minWidth: 0, wordBreak: "break-word" }}>{ex.name}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          {vol > 0 && <div style={{ fontSize: 12, color: "#c98f2f", fontWeight: 600 }}>{fmtVol(vol)}</div>}
          <div style={{ fontSize: 12, color: "#7a7362" }}>{ex.target}</div>
          <button
            onClick={onRemove}
            title="Удалить упражнение"
            style={{
              background: "none", border: "none", color: "#7a7362", padding: 4,
              display: "flex", alignItems: "center",
            }}
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      {ex.prefilledFrom && (
        <div style={{ fontSize: 11.5, color: "#6a7a6a", marginBottom: 8 }}>
          Подставлено из {fmtDate(ex.prefilledFrom)}
        </div>
      )}

      {ex.sets.map((s, setIdx) => (
        <div key={setIdx} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
          <span style={{ fontSize: 12, color: "#7a7362", width: 18, flexShrink: 0 }}>{setIdx + 1}</span>
          <input type="number" placeholder="кг" value={s.weight}
            onChange={(e) => onUpdateSet(exIdx, setIdx, "weight", e.target.value)} />
          <span style={{ color: "#5a5545", flexShrink: 0 }}>×</span>
          <input type="number" placeholder="повт" value={s.reps}
            onChange={(e) => onUpdateSet(exIdx, setIdx, "reps", e.target.value)} />
        </div>
      ))}

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 4 }}>
        <button type="button" onClick={() => onAddSet(exIdx)} style={{
          display: "flex", alignItems: "center", gap: 4, background: "none", border: "none",
          color: "#c98f2f", fontSize: 12.5, fontWeight: 600, padding: "4px 0",
        }}>
          <Plus size={13} /> подход
        </button>
        <button type="button" onClick={onToggleComment} title="Комментарий к упражнению" aria-label="Комментарий к упражнению" style={{
          display: "flex", alignItems: "center", gap: 4, background: "none", border: "none",
          color: ex.comment || ex.showComment ? "#8a9e8a" : "#7a7362",
          fontSize: 12.5, fontWeight: 600, padding: "4px 0",
        }}>
          <Plus size={13} /> заметка
        </button>
      </div>

      {(ex.showComment || ex.comment) && (
        <textarea
          placeholder="Заметка: было тяжело, тянуло плечо..."
          value={ex.comment}
          onChange={(e) => onUpdateComment(e.target.value)}
          rows={2}
          style={{ marginTop: 8, resize: "vertical", minHeight: 56, fontSize: 13.5 }}
        />
      )}
    </div>
  );
}

function ExerciseProgress({ logs, program }) {
  const allExercises = useMemo(() => {
    const set = new Set();
    Object.values(program).forEach((d) => d.exercises.forEach((e) => set.add(e.name)));
    Object.values(logs).forEach((l) => l.exercises?.forEach((e) => set.add(e.name)));
    return Array.from(set);
  }, [program, logs]);
  const [selected, setSelected] = useState(allExercises[0] ?? "");

  useEffect(() => {
    if (!allExercises.includes(selected) && allExercises.length) {
      setSelected(allExercises[0]);
    }
  }, [allExercises, selected]);

  const data = useMemo(() => {
    return Object.values(logs)
      .filter((l) => l.exercises?.some((e) => e.name === selected))
      .map((l) => {
        const ex = l.exercises.find((e) => e.name === selected);
        const weights = ex.sets.map((s) => parseFloat(s.weight)).filter((w) => !isNaN(w));
        const maxW = weights.length ? Math.max(...weights) : null;
        return { date: l.date, label: fmtDate(l.date), maxW };
      })
      .filter((d) => d.maxW !== null)
      .sort((a, b) => (a.date > b.date ? 1 : -1));
  }, [logs, selected]);

  if (!allExercises.length) return null;

  return (
    <div style={{ background: "#1c1a14", border: "1px solid #2a2620", borderRadius: 10, padding: 14, marginTop: 8, marginBottom: 16 }}>
      <select value={selected} onChange={(e) => setSelected(e.target.value)} style={{
        width: "100%", background: "#1e1b15", border: "1px solid #3a3527", color: "#ece6d9",
        borderRadius: 6, padding: "8px 10px", fontSize: 13.5, marginBottom: 12,
      }}>
        {allExercises.map((e) => <option key={e} value={e}>{e}</option>)}
      </select>
      {data.length < 2 ? (
        <div style={{ fontSize: 13, color: "#7a7362", padding: "20px 0", textAlign: "center" }}>
          Недостаточно данных — записывай тренировки, чтобы видеть прогресс
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={data}>
            <CartesianGrid stroke="#2a2620" strokeDasharray="3 3" />
            <XAxis dataKey="label" tick={{ fill: "#7a7362", fontSize: 11 }} axisLine={{ stroke: "#3a3527" }} />
            <YAxis tick={{ fill: "#7a7362", fontSize: 11 }} axisLine={{ stroke: "#3a3527" }} unit="кг" width={44} />
            <Tooltip contentStyle={{ background: "#211e17", border: "1px solid #3a3527", borderRadius: 8, fontSize: 12 }} />
            <Line type="monotone" dataKey="maxW" stroke="#e0a940" strokeWidth={2.5} dot={{ fill: "#e0a940", r: 3.5 }} name="Макс. вес, кг" />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

/* ---------------- METRICS TAB ---------------- */

function MetricsTab() {
  const [metrics, persist, loaded] = useStorage("body-metrics", {});
  const [date, setDate] = useState(todayISO());
  const [form, setForm] = useState({ weight: "", waist: "", chest: "", pulse: "" });

  useEffect(() => {
    const e = metrics[date];
    setForm({
      weight: e?.weight ?? "", waist: e?.waist ?? "",
      chest: e?.chest ?? "", pulse: e?.pulse ?? "",
    });
  }, [date, loaded]); // eslint-disable-line

  const [saved, setSaved] = useState(false);
  const handleSave = () => {
    const next = { ...metrics, [date]: { date, ...form } };
    persist(next);
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  const sorted = useMemo(() =>
    Object.values(metrics).sort((a, b) => (a.date > b.date ? 1 : -1)),
  [metrics]);

  const chartData = sorted.map((m) => ({
    label: fmtDate(m.date),
    weight: m.weight ? parseFloat(m.weight) : null,
    waist: m.waist ? parseFloat(m.waist) : null,
    chest: m.chest ? parseFloat(m.chest) : null,
    pulse: m.pulse ? parseFloat(m.pulse) : null,
  }));

  return (
    <div style={{ width: "100%", overflowX: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "18px 0 16px" }}>
        <Calendar size={15} color="#7a7362" />
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ width: 150 }} />
      </div>

      <div style={{ background: "#1c1a14", border: "1px solid #2a2620", borderRadius: 10, padding: 16, marginBottom: 14 }}>
        <FieldRow icon={<Scale size={15} color="#e0a940" />} label="Вес, кг">
          <input type="number" step="0.1" value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} />
        </FieldRow>
        <FieldRow icon={<Ruler size={15} color="#e0a940" />} label="Талия, см">
          <input type="number" step="0.5" value={form.waist} onChange={(e) => setForm({ ...form, waist: e.target.value })} />
        </FieldRow>
        <FieldRow icon={<Ruler size={15} color="#c98f2f" />} label="Грудь, см">
          <input type="number" step="0.5" value={form.chest} onChange={(e) => setForm({ ...form, chest: e.target.value })} />
        </FieldRow>
        <FieldRow icon={<Activity size={15} color="#e0a940" />} label="Пульс утро, уд/мин">
          <input type="number" value={form.pulse} onChange={(e) => setForm({ ...form, pulse: e.target.value })} />
        </FieldRow>
      </div>

      <button onClick={handleSave} style={{
        width: "100%", padding: "14px 0", borderRadius: 10, border: "none",
        background: saved ? "#4a7a5a" : "#e0a940", color: "#15130f", fontWeight: 800, fontSize: 15,
        display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "background .2s",
      }}>
        {saved ? <><Check size={17} /> Сохранено</> : <><Save size={17} /> Сохранить показатели</>}
      </button>

      {chartData.length >= 2 && (
        <>
          <ChartBlock title="Вес, кг" data={chartData} dataKey="weight" color="#e0a940" />
          <ChartBlock title="Талия, см" data={chartData} dataKey="waist" color="#7fb3c9" />
          <ChartBlock title="Грудь, см" data={chartData} dataKey="chest" color="#c98f2f" />
          <ChartBlock title="Пульс, уд/мин" data={chartData} dataKey="pulse" color="#8a9e8a" refLine={90} />
        </>
      )}

      {sorted.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <div style={{ fontSize: 12.5, color: "#7a7362", marginBottom: 8, fontWeight: 600 }}>ИСТОРИЯ</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {sorted.slice().reverse().slice(0, 10).map((m) => (
              <div key={m.date} style={{
                display: "flex", justifyContent: "space-between", fontSize: 12.5,
                background: "#1c1a14", border: "1px solid #2a2620", borderRadius: 6, padding: "8px 10px", color: "#a89f88",
              }}>
                <span style={{ color: "#ece6d9", fontWeight: 600 }}>{fmtDate(m.date)}</span>
                <span>{m.weight ? `${m.weight}кг` : "—"}</span>
                <span>{m.waist ? `${m.waist}см` : "—"}</span>
                <span>{m.chest ? `${m.chest}см` : "—"}</span>
                <span>{m.pulse ? `${m.pulse}уд` : "—"}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function FieldRow({ icon, label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6, fontSize: 12.5, color: "#a89f88", fontWeight: 600 }}>
        {icon}{label}
      </div>
      {children}
    </div>
  );
}

function ChartBlock({ title, data, dataKey, secondKey, color, secondColor, refLine, refLine2 }) {
  return (
    <div style={{ background: "#1c1a14", border: "1px solid #2a2620", borderRadius: 10, padding: 14, marginTop: 10 }}>
      <div style={{ fontSize: 12.5, color: "#a89f88", fontWeight: 600, marginBottom: 8 }}>{title}</div>
      <ResponsiveContainer width="100%" height={150}>
        <LineChart data={data}>
          <CartesianGrid stroke="#2a2620" strokeDasharray="3 3" />
          <XAxis dataKey="label" tick={{ fill: "#7a7362", fontSize: 10.5 }} axisLine={{ stroke: "#3a3527" }} />
          <YAxis tick={{ fill: "#7a7362", fontSize: 10.5 }} axisLine={{ stroke: "#3a3527" }} width={38} domain={["auto", "auto"]} />
          <Tooltip contentStyle={{ background: "#211e17", border: "1px solid #3a3527", borderRadius: 8, fontSize: 12 }} />
          {refLine && <ReferenceLine y={refLine} stroke="#5a4a3a" strokeDasharray="4 4" />}
          {refLine2 && <ReferenceLine y={refLine2} stroke="#5a4a3a" strokeDasharray="4 4" />}
          <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
          {secondKey && <Line type="monotone" dataKey={secondKey} stroke={secondColor} strokeWidth={2.5} dot={{ r: 3 }} connectNulls />}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ---------------- PROFILE TAB ---------------- */

function ProfileTab() {
  const [profile, persist, loaded] = useStorage("user-profile", {
    name: "", height: "", birthYear: "", goal: "", targetWeight: "", notes: "",
  });
  const [program] = useProgram();
  const [form, setForm] = useState(profile);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (loaded) setForm(profile);
  }, [loaded, profile]);

  const handleSave = () => {
    persist(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  const latestWeight = useMemo(() => {
    try {
      const metrics = JSON.parse(localStorage.getItem("body-metrics") || "{}");
      const sorted = Object.values(metrics).sort((a, b) => (a.date > b.date ? 1 : -1));
      const last = sorted.filter((m) => m.weight).pop();
      return last ? parseFloat(last.weight) : null;
    } catch { return null; }
  }, [saved, loaded]);

  const computedBmi = latestWeight && form.height
    ? (latestWeight / Math.pow(parseFloat(form.height) / 100, 2)).toFixed(1)
    : null;

  const workoutCount = useMemo(() => {
    try {
      const logs = JSON.parse(localStorage.getItem("workout-logs") || "{}");
      return Object.keys(logs).length;
    } catch { return 0; }
  }, [saved, loaded]);

  return (
    <div style={{ width: "100%", overflowX: "hidden" }}>
      <div style={{ margin: "18px 0 14px", fontSize: 13, color: "#7a7362" }}>
        Базовые параметры — заполни один раз, обновляй по необходимости.
      </div>

      <div style={{ background: "#1c1a14", border: "1px solid #2a2620", borderRadius: 10, padding: 16, marginBottom: 14 }}>
        <FieldRow icon={<Scale size={15} color="#e0a940" />} label="Имя (опц.)">
          <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Как к тебе обращаться" />
        </FieldRow>
        <FieldRow icon={<Ruler size={15} color="#e0a940" />} label="Рост, см">
          <input type="number" value={form.height} onChange={(e) => setForm({ ...form, height: e.target.value })} />
        </FieldRow>
        <FieldRow icon={<Calendar size={15} color="#e0a940" />} label="Год рождения (опц.)">
          <input type="number" value={form.birthYear} onChange={(e) => setForm({ ...form, birthYear: e.target.value })} />
        </FieldRow>
        <FieldRow icon={<TrendingUp size={15} color="#e0a940" />} label="Цель">
          <input type="text" value={form.goal} onChange={(e) => setForm({ ...form, goal: e.target.value })}
            placeholder="Набрать массу / сбросить жир / сила..." />
        </FieldRow>
        <FieldRow icon={<Scale size={15} color="#7fb3c9" />} label="Целевой вес, кг">
          <input type="number" step="0.1" value={form.targetWeight} onChange={(e) => setForm({ ...form, targetWeight: e.target.value })} />
        </FieldRow>
        <FieldRow icon={<StickyNote size={15} color="#8a9e8a" />} label="Заметки">
          <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder="Травмы, ограничения, добавки..." rows={2} style={{ minHeight: 56, resize: "vertical" }} />
        </FieldRow>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
        <StatCard label="Тренировок" value={workoutCount || "—"} />
        <StatCard label="BMI" value={computedBmi || "—"} hint={computedBmi ? bmiLabel(computedBmi) : "нужен рост + вес"} />
        <StatCard label="Цель" value={form.targetWeight ? `${form.targetWeight}кг` : "—"} />
      </div>

      <button onClick={handleSave} style={{
        width: "100%", padding: "14px 0", borderRadius: 10, border: "none",
        background: saved ? "#4a7a5a" : "#e0a940", color: "#15130f", fontWeight: 800, fontSize: 15,
        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
      }}>
        {saved ? <><Check size={17} /> Сохранено</> : <><Save size={17} /> Сохранить профиль</>}
      </button>

      <ProgramCard program={program} />
    </div>
  );
}

function StatCard({ label, value, hint }) {
  return (
    <div style={{ background: "#1c1a14", border: "1px solid #2a2620", borderRadius: 8, padding: "12px 10px", textAlign: "center" }}>
      <div style={{ fontSize: 11, color: "#7a7362", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: "#e0a940" }}>{value}</div>
      {hint && <div style={{ fontSize: 10, color: "#5a5545", marginTop: 2 }}>{hint}</div>}
    </div>
  );
}

function bmiLabel(bmi) {
  const v = parseFloat(bmi);
  if (v < 18.5) return "недовес";
  if (v < 25) return "норма";
  if (v < 30) return "избыток";
  return "ожирение";
}

function ProgramCard({ program }) {
  return (
    <div style={{ marginTop: 20, marginBottom: 24 }}>
      <div style={{ fontSize: 12.5, color: "#7a7362", marginBottom: 10, fontWeight: 600 }}>ТВОЯ ПРОГРАММА</div>
      {Object.entries(program).map(([day, info]) => (
        <div key={day} style={{ background: "#1c1a14", border: "1px solid #2a2620", borderRadius: 8, padding: 12, marginBottom: 8 }}>
          <div className="display" style={{ fontSize: 18, color: "#e0a940", marginBottom: 4 }}>{day} — {info.title}</div>
          {info.exercises.map((ex, i) => (
            <div key={i} style={{ fontSize: 12.5, color: "#a89f88", padding: "2px 0", display: "flex", justifyContent: "space-between", gap: 8 }}>
              <span style={{ minWidth: 0, wordBreak: "break-word" }}>{i + 1}. {ex.name}</span>
              <span style={{ color: "#7a7362", flexShrink: 0 }}>{ex.target}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
