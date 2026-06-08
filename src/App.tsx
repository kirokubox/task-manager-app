import { ChangeEvent, FormEvent, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

const STORAGE_KEY = "yuki-task-manager-data";
const ACTIVE_VIEW_KEY = "yuki-task-manager-active-view";

type TaskType = "やるべきこと" | "やりたいこと" | "思いつき";
type TaskStatus = "今日やる" | "近いうち" | "いつかやる" | "連絡待ち" | "保留" | "完了";
type ActiveTaskCategory = "生活" | "仕事" | "お金" | "人・連絡" | "趣味" | "開発" | "SNS" | "その他";
type TaskCategory = ActiveTaskCategory | string;
type TaskPlace = "PC" | "スマホ" | "家" | "外" | "Codexに頼む" | "未設定";
type TimeSlot = string;
type RecurringKind = "楽しみ" | "習慣" | "確認" | "振り返り";
type RepeatType = "weekly" | "monthly";
type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

type Task = {
  id: string;
  title: string;
  type: TaskType;
  status: TaskStatus;
  category: TaskCategory;
  memo: string;
  place: TaskPlace;
  timeSlot: TimeSlot;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  completedLifeDate?: string | null;
  durationMinutes?: number | null;
};

type AppData = {
  version: number;
  exportedAt?: string;
  tasks: Task[];
  frequentTasks: FrequentTask[];
  recurringTasks: RecurringTask[];
  recurringCompletions: RecurringCompletion[];
  routineItems: RoutineItem[];
  settings: {
    categories: TaskCategory[];
    types: TaskType[];
    statuses: TaskStatus[];
    places: TaskPlace[];
    dayBoundaryTime: string;
  };
};

type Tab = "今日" | "ストック" | "完了" | "設定";
type StoredView = "today" | "stock" | "done" | "settings";
type FilterValue = "すべて" | string;

type TaskDraft = {
  title: string;
  type: TaskType;
  status: TaskStatus;
  category: TaskCategory;
  place: TaskPlace;
  timeSlot: TimeSlot;
  dueDate: string;
  memo: string;
};

type FrequentTask = {
  id: string;
  title: string;
  memo: string;
  type: TaskType;
  category: TaskCategory;
  place: TaskPlace;
  createdAt: string;
  updatedAt: string;
};

type FrequentTaskDraft = {
  title: string;
  memo: string;
  type: TaskType;
  category: TaskCategory;
  place: TaskPlace;
};

type RoutineItem = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

type RecurringTask = {
  id: string;
  title: string;
  memo: string;
  category: ActiveTaskCategory;
  kind: RecurringKind;
  repeatType: RepeatType;
  weekday: Weekday | null;
  monthDay: number | null;
  isActive: boolean;
  inventoryStartDate?: string;
  createdAt: string;
  updatedAt: string;
};

type RecurringCompletion = {
  id: string;
  recurringTaskId: string;
  targetDate: string;
  completedAt: string;
  titleSnapshot: string;
  categorySnapshot: ActiveTaskCategory;
  kindSnapshot: RecurringKind;
};

type RecurringDraft = {
  title: string;
  memo: string;
  category: ActiveTaskCategory;
  kind: RecurringKind;
  repeatType: RepeatType;
  weekday: string;
  monthDay: string;
  isActive: boolean;
};

type VisibleRecurringTask = {
  task: RecurringTask;
  targetDate: string;
};

type EnjoymentInventoryItem = {
  task: RecurringTask;
  title: string;
  dates: string[];
};

type EnjoymentInventory = {
  total: number;
  items: EnjoymentInventoryItem[];
};

type DoneDisplayItem =
  | { kind: "task"; id: string; completedDate: string; completedAt: string; task: Task }
  | { kind: "recurring"; id: string; completedDate: string; completedAt: string; completion: RecurringCompletion };

type DoneGroup = {
  date: string;
  items: DoneDisplayItem[];
};

type ImportCount = {
  label: string;
  loaded: number;
  added: number;
  skipped: number;
};

type AppendImportPreview = {
  data: AppData;
  counts: ImportCount[];
};

type CompletionRecordDraft = {
  completedTime: string;
  durationMinutes: number | null;
};

type WeeklyDurationSummary = {
  title: string;
  totalMinutes: number;
  count: number;
};

const TASK_TYPES: TaskType[] = ["やるべきこと", "やりたいこと", "思いつき"];
const TASK_STATUSES: TaskStatus[] = ["今日やる", "近いうち", "いつかやる", "連絡待ち", "保留", "完了"];
const ACTIVE_TASK_CATEGORIES: ActiveTaskCategory[] = ["生活", "仕事", "お金", "人・連絡", "趣味", "開発", "SNS", "その他"];
const TASK_PLACES: TaskPlace[] = ["PC", "スマホ", "家", "外", "Codexに頼む", "未設定"];
const PRIORITY_OPTIONS: TimeSlot[] = ["", "高"];
const DAY_BOUNDARY_OPTIONS = ["00:00", "03:00", "04:00", "05:00", "06:00"];
const DURATION_OPTIONS: { label: string; value: number | null }[] = [
  { label: "未入力", value: null },
  { label: "5分", value: 5 },
  { label: "10分", value: 10 },
  { label: "15分", value: 15 },
  { label: "30分", value: 30 },
  { label: "45分", value: 45 },
  { label: "1時間", value: 60 },
  { label: "1時間30分", value: 90 },
  { label: "2時間", value: 120 },
  { label: "3時間", value: 180 },
  { label: "4時間", value: 240 },
];
const INITIAL_ROUTINE_TITLES = [
  "朝食",
  "身支度",
  "シャワー",
  "スキンケア",
  "洗濯",
  "食器洗い",
  "自分用Webアプリ開発垢note投稿",
  "日記・日次振り返り",
  "手書き日記投稿",
  "タスク整理",
];
const RECURRING_KINDS: RecurringKind[] = ["楽しみ", "習慣", "確認", "振り返り"];
const REPEAT_TYPES: RepeatType[] = ["weekly", "monthly"];
const WEEKDAYS = ["日曜", "月曜", "火曜", "水曜", "木曜", "金曜", "土曜"] as const;
const TAB_TO_STORED_VIEW: Record<Tab, StoredView> = {
  今日: "today",
  ストック: "stock",
  完了: "done",
  設定: "settings",
};
const STORED_VIEW_TO_TAB: Record<StoredView, Tab> = {
  today: "今日",
  stock: "ストック",
  done: "完了",
  settings: "設定",
};

const emptyData = (): AppData => ({
  version: 1,
  tasks: [],
  frequentTasks: [],
  recurringTasks: [],
  recurringCompletions: [],
  routineItems: makeInitialRoutineItems(),
  settings: {
    categories: ACTIVE_TASK_CATEGORIES,
    types: TASK_TYPES,
    statuses: TASK_STATUSES,
    places: TASK_PLACES,
    dayBoundaryTime: "05:00",
  },
});

const newRecurringDraft = (): RecurringDraft => ({
  title: "",
  memo: "",
  category: "生活",
  kind: "楽しみ",
  repeatType: "weekly",
  weekday: "0",
  monthDay: "1",
  isActive: true,
});

const newDraft = (status: TaskStatus): TaskDraft => ({
  title: "",
  type: "思いつき",
  status,
  category: "生活",
  place: "未設定",
  timeSlot: "",
  dueDate: "",
  memo: "",
});

const newFrequentTaskDraft = (): FrequentTaskDraft => ({
  title: "",
  memo: "",
  type: "思いつき",
  category: "生活",
  place: "未設定",
});

function makeInitialRoutineItems(): RoutineItem[] {
  const time = nowIso();
  return INITIAL_ROUTINE_TITLES.map((title) => ({
    id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}-${title}`,
    title,
    createdAt: time,
    updatedAt: time,
  }));
}

const toDateKey = (value: string | null) => value ? value.slice(0, 10) : "";
const todayKey = () => dateKeyFromDate(new Date());
const timeKeyFromDate = (date: Date) => `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
const nowIso = () => {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");
  const milliseconds = String(now.getMilliseconds()).padStart(3, "0");
  return `${dateKeyFromDate(now)}T${hours}:${minutes}:${seconds}.${milliseconds}`;
};
const byCreatedDesc = (a: Task, b: Task) => b.createdAt.localeCompare(a.createdAt);
const byCompletedDesc = (a: Task, b: Task) => (b.completedAt ?? "").localeCompare(a.completedAt ?? "");
const byUpdatedThenCreatedDesc = (a: Task, b: Task) => b.updatedAt.localeCompare(a.updatedAt) || byCreatedDesc(a, b);
const isHighPriority = (task: Pick<Task, "timeSlot">) => task.timeSlot === "高";
const prioritySort = (a: Pick<Task, "timeSlot">, b: Pick<Task, "timeSlot">) => Number(isHighPriority(b)) - Number(isHighPriority(a));
const priorityDraftValue = (value: string | undefined) => value === "高" ? "高" : "";
const byPriorityThenCreatedDesc = (a: Task, b: Task) => prioritySort(a, b) || byCreatedDesc(a, b);
const byDueThenUpdatedDesc = (a: Task, b: Task) => {
  const priority = prioritySort(a, b);
  if (priority !== 0) return priority;
  const aHasDue = Boolean(a.dueDate);
  const bHasDue = Boolean(b.dueDate);
  if (aHasDue && bHasDue) return (a.dueDate ?? "").localeCompare(b.dueDate ?? "") || byUpdatedThenCreatedDesc(a, b);
  if (aHasDue) return -1;
  if (bHasDue) return 1;
  return byUpdatedThenCreatedDesc(a, b);
};
const indexOrAfter = <T extends string>(list: readonly T[], value: string) => {
  const index = list.indexOf(value as T);
  return index >= 0 ? index : list.length;
};
const repeatTypeLabel = (repeatType: RepeatType) => repeatType === "weekly" ? "毎週" : "毎月";
const recurringInfo = (task: RecurringTask) => task.repeatType === "weekly" ? `毎週 ${WEEKDAYS[task.weekday ?? 0]}` : `毎月 ${task.monthDay}日`;

function byRecurringManageOrder(a: RecurringTask, b: RecurringTask) {
  if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
  if (a.repeatType !== b.repeatType) return a.repeatType === "weekly" ? -1 : 1;
  if (a.repeatType === "weekly") {
    const weekdayDiff = (a.weekday ?? 7) - (b.weekday ?? 7);
    if (weekdayDiff !== 0) return weekdayDiff;
  } else {
    const monthDayDiff = (a.monthDay ?? 32) - (b.monthDay ?? 32);
    if (monthDayDiff !== 0) return monthDayDiff;
  }
  return a.title.localeCompare(b.title, "ja");
}

function byFrequentTaskManageOrder(a: FrequentTask, b: FrequentTask) {
  return indexOrAfter(ACTIVE_TASK_CATEGORIES, a.category) - indexOrAfter(ACTIVE_TASK_CATEGORIES, b.category)
    || indexOrAfter(TASK_TYPES, a.type) - indexOrAfter(TASK_TYPES, b.type)
    || a.title.localeCompare(b.title, "ja");
}

function isOneOf<T extends string>(value: unknown, list: readonly T[]): value is T {
  return typeof value === "string" && list.includes(value as T);
}

function isWeekday(value: unknown): value is Weekday {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 6;
}

function isMonthDay(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 31;
}

function isDurationMinutes(value: unknown): value is number | null {
  return value === null || (typeof value === "number" && Number.isInteger(value) && value >= 0);
}

function isTask(value: unknown): value is Task {
  if (!value || typeof value !== "object") return false;
  const task = value as Partial<Task>;
  return (
    typeof task.id === "string" &&
    typeof task.title === "string" &&
    isOneOf(task.type, TASK_TYPES) &&
    isOneOf(task.status, TASK_STATUSES) &&
    typeof task.category === "string" &&
    typeof task.memo === "string" &&
    isOneOf(task.place, TASK_PLACES) &&
    (typeof task.timeSlot === "string" || task.timeSlot === undefined) &&
    (typeof task.dueDate === "string" || task.dueDate === null) &&
    typeof task.createdAt === "string" &&
    typeof task.updatedAt === "string" &&
    (typeof task.completedAt === "string" || task.completedAt === null) &&
    (task.completedLifeDate === undefined || task.completedLifeDate === null || /^\d{4}-\d{2}-\d{2}$/.test(task.completedLifeDate)) &&
    (task.durationMinutes === undefined || isDurationMinutes(task.durationMinutes))
  );
}

function normalizeTask(task: Task): Task {
  return {
    ...task,
    timeSlot: typeof task.timeSlot === "string" ? task.timeSlot : "",
    completedLifeDate: task.completedLifeDate ?? (task.completedAt ? toDateKey(task.completedAt) : null),
    durationMinutes: task.durationMinutes ?? null,
  };
}

function isFrequentTask(value: unknown): value is FrequentTask {
  if (!value || typeof value !== "object") return false;
  const task = value as Partial<FrequentTask>;
  return (
    typeof task.id === "string" &&
    typeof task.title === "string" &&
    typeof task.memo === "string" &&
    isOneOf(task.type, TASK_TYPES) &&
    typeof task.category === "string" &&
    isOneOf(task.place, TASK_PLACES) &&
    typeof task.createdAt === "string" &&
    typeof task.updatedAt === "string"
  );
}

function isRoutineItem(value: unknown): value is RoutineItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<RoutineItem>;
  return (
    typeof item.id === "string" &&
    typeof item.title === "string" &&
    typeof item.createdAt === "string" &&
    typeof item.updatedAt === "string"
  );
}

function isRecurringTask(value: unknown): value is RecurringTask {
  if (!value || typeof value !== "object") return false;
  const task = value as Partial<RecurringTask>;
  return (
    typeof task.id === "string" &&
    typeof task.title === "string" &&
    typeof task.memo === "string" &&
    isOneOf(task.category, ACTIVE_TASK_CATEGORIES) &&
    isOneOf(task.kind, RECURRING_KINDS) &&
    isOneOf(task.repeatType, REPEAT_TYPES) &&
    (isWeekday(task.weekday) || task.weekday === null) &&
    (isMonthDay(task.monthDay) || task.monthDay === null) &&
    typeof task.isActive === "boolean" &&
    (task.inventoryStartDate === undefined || /^\d{4}-\d{2}-\d{2}$/.test(task.inventoryStartDate)) &&
    typeof task.createdAt === "string" &&
    typeof task.updatedAt === "string"
  );
}

function isRecurringCompletion(value: unknown): value is RecurringCompletion {
  if (!value || typeof value !== "object") return false;
  const completion = value as Partial<RecurringCompletion>;
  return (
    typeof completion.id === "string" &&
    typeof completion.recurringTaskId === "string" &&
    typeof completion.targetDate === "string" &&
    typeof completion.completedAt === "string" &&
    typeof completion.titleSnapshot === "string" &&
    isOneOf(completion.categorySnapshot, ACTIVE_TASK_CATEGORIES) &&
    isOneOf(completion.kindSnapshot, RECURRING_KINDS)
  );
}

function isAppData(value: unknown): value is AppData {
  if (!value || typeof value !== "object") return false;
  const data = value as Partial<AppData>;
  const frequentTasksOk = data.frequentTasks === undefined || (Array.isArray(data.frequentTasks) && data.frequentTasks.every(isFrequentTask));
  const recurringTasksOk = data.recurringTasks === undefined || (Array.isArray(data.recurringTasks) && data.recurringTasks.every(isRecurringTask));
  const recurringCompletionsOk = data.recurringCompletions === undefined || (Array.isArray(data.recurringCompletions) && data.recurringCompletions.every(isRecurringCompletion));
  const routineItemsOk = data.routineItems === undefined || (Array.isArray(data.routineItems) && data.routineItems.every(isRoutineItem));
  return typeof data.version === "number" && Array.isArray(data.tasks) && data.tasks.every(isTask) && frequentTasksOk && recurringTasksOk && recurringCompletionsOk && routineItemsOk;
}

function normalizeData(data: AppData): AppData {
  const baseSettings = emptyData().settings;
  const dayBoundaryTime = DAY_BOUNDARY_OPTIONS.includes(data.settings?.dayBoundaryTime) ? data.settings.dayBoundaryTime : baseSettings.dayBoundaryTime;
  return {
    ...emptyData(),
    ...data,
    version: 1,
    tasks: data.tasks.map(normalizeTask),
    frequentTasks: data.frequentTasks ?? [],
    recurringTasks: data.recurringTasks ?? [],
    recurringCompletions: data.recurringCompletions ?? [],
    routineItems: data.routineItems ?? makeInitialRoutineItems(),
    settings: {
      ...baseSettings,
      ...data.settings,
      dayBoundaryTime,
    },
  };
}

function loadData(): { data: AppData; error: string } {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return { data: emptyData(), error: "" };
  try {
    const parsed = JSON.parse(raw);
    if (!isAppData(parsed)) throw new Error("Invalid data");
    return { data: normalizeData(parsed), error: "" };
  } catch {
    return {
      data: emptyData(),
      error: "保存データを読み込めませんでした。必要ならJSONバックアップから復元してください。",
    };
  }
}

function loadActiveTab(): Tab {
  const stored = localStorage.getItem(ACTIVE_VIEW_KEY);
  return stored && stored in STORED_VIEW_TO_TAB ? STORED_VIEW_TO_TAB[stored as StoredView] : "今日";
}

function makeTask(draft: TaskDraft): Task {
  const time = nowIso();
  const completedAt = draft.status === "完了" ? time : null;
  return {
    id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    title: draft.title.trim(),
    type: draft.type,
    status: draft.status,
    category: draft.category,
    memo: draft.memo.trim(),
    place: draft.place,
    timeSlot: draft.timeSlot,
    dueDate: draft.dueDate || null,
    createdAt: time,
    updatedAt: time,
    completedAt,
    completedLifeDate: completedAt ? toDateKey(completedAt) : null,
    durationMinutes: null,
  };
}

function makeTaskFromFrequentTask(template: FrequentTask): Task {
  return makeTask({
    title: template.title,
    memo: template.memo,
    type: template.type,
    status: "今日やる",
    category: template.category,
    place: template.place,
    timeSlot: "",
    dueDate: "",
  });
}

function makeFrequentTask(draft: FrequentTaskDraft): FrequentTask {
  const time = nowIso();
  return {
    id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    title: draft.title.trim(),
    memo: draft.memo.trim(),
    type: draft.type,
    category: draft.category,
    place: draft.place,
    createdAt: time,
    updatedAt: time,
  };
}

function makeRoutineItem(title: string): RoutineItem {
  const time = nowIso();
  return {
    id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    title: title.trim(),
    createdAt: time,
    updatedAt: time,
  };
}

function frequentTaskMatches(task: FrequentTask, draft: FrequentTaskDraft) {
  return task.title === draft.title.trim() && task.category === draft.category && task.type === draft.type && task.place === draft.place;
}

function frequentTaskKey(task: FrequentTask) {
  return `${task.title}\u0000${task.category}\u0000${task.type}\u0000${task.place}`;
}

function recurringCompletionKey(completion: RecurringCompletion) {
  return `${completion.recurringTaskId}\u0000${completion.targetDate}`;
}

function routineItemKey(item: RoutineItem) {
  return item.id;
}

function uniqueByKey<T>(incoming: T[], existingKeys: Set<string>, keyOf: (item: T) => string) {
  const added: T[] = [];
  let skipped = 0;
  incoming.forEach((item) => {
    const key = keyOf(item);
    if (existingKeys.has(key)) {
      skipped += 1;
      return;
    }
    existingKeys.add(key);
    added.push(item);
  });
  return { added, skipped };
}

function buildAppendImportPreview(current: AppData, incoming: AppData): AppendImportPreview {
  const tasks = uniqueByKey(incoming.tasks, new Set(current.tasks.map((task) => task.id)), (task) => task.id);
  const frequentTasks = uniqueByKey(incoming.frequentTasks, new Set(current.frequentTasks.map(frequentTaskKey)), frequentTaskKey);
  const recurringTasks = uniqueByKey(incoming.recurringTasks, new Set(current.recurringTasks.map((task) => task.id)), (task) => task.id);
  const recurringCompletions = uniqueByKey(incoming.recurringCompletions, new Set(current.recurringCompletions.map(recurringCompletionKey)), recurringCompletionKey);
  const routineItems = uniqueByKey(incoming.routineItems, new Set(current.routineItems.map(routineItemKey)), routineItemKey);
  return {
    data: {
      ...current,
      tasks: [...tasks.added, ...current.tasks],
      frequentTasks: [...frequentTasks.added, ...current.frequentTasks],
      recurringTasks: [...recurringTasks.added, ...current.recurringTasks],
      recurringCompletions: [...recurringCompletions.added, ...current.recurringCompletions],
      routineItems: [...current.routineItems, ...routineItems.added],
      settings: current.settings,
    },
    counts: [
      { label: "通常タスク", loaded: incoming.tasks.length, added: tasks.added.length, skipped: tasks.skipped },
      { label: "よく使うタスク", loaded: incoming.frequentTasks.length, added: frequentTasks.added.length, skipped: frequentTasks.skipped },
      { label: "繰り返しタスク", loaded: incoming.recurringTasks.length, added: recurringTasks.added.length, skipped: recurringTasks.skipped },
      { label: "繰り返し完了履歴", loaded: incoming.recurringCompletions.length, added: recurringCompletions.added.length, skipped: recurringCompletions.skipped },
      { label: "ルーティン項目", loaded: incoming.routineItems.length, added: routineItems.added.length, skipped: routineItems.skipped },
    ],
  };
}

function draftFromTask(task: Task): TaskDraft {
  return {
    title: task.title,
    type: task.type,
    status: task.status,
    category: task.category,
    place: task.place,
    timeSlot: priorityDraftValue(task.timeSlot),
    dueDate: task.dueDate ?? "",
    memo: task.memo,
  };
}

function draftFromFrequentTask(task: FrequentTask): FrequentTaskDraft {
  return {
    title: task.title,
    memo: task.memo,
    type: task.type,
    category: task.category,
    place: task.place,
  };
}

function draftFromRecurringTask(task: RecurringTask): RecurringDraft {
  return {
    title: task.title,
    memo: task.memo,
    category: task.category,
    kind: task.kind,
    repeatType: task.repeatType,
    weekday: String(task.weekday ?? 0),
    monthDay: String(task.monthDay ?? 1),
    isActive: task.isActive,
  };
}

function dateFromKey(key: string) {
  return new Date(`${key}T00:00:00`);
}

function dateKeyFromDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getLifeDateKey(date: Date, dayBoundaryTime: string): string {
  const [hoursText, minutesText] = dayBoundaryTime.split(":");
  const boundaryMinutes = Number(hoursText) * 60 + Number(minutesText);
  const currentMinutes = date.getHours() * 60 + date.getMinutes();
  return dateKeyFromDate(currentMinutes < boundaryMinutes ? addDays(date, -1) : date);
}

function taskCompletedLifeDate(task: Task) {
  return task.completedLifeDate ?? (task.completedAt ? toDateKey(task.completedAt) : "");
}

function makeCompletedAt(lifeDate: string, completedTime: string) {
  return `${lifeDate}T${completedTime}:00`;
}

function completedTimeLabel(completedAt: string | null) {
  return completedAt ? completedAt.slice(11, 16) : "";
}

function formatDuration(minutes: number | null | undefined) {
  if (minutes === null || minutes === undefined) return "";
  if (minutes < 60) return `${minutes}分`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}時間` : `${hours}時間${rest}分`;
}

function currentWeekRange(today: string) {
  const todayDate = dateFromKey(today);
  const diffFromMonday = (todayDate.getDay() + 6) % 7;
  const start = dateKeyFromDate(addDays(todayDate, -diffFromMonday));
  const end = dateKeyFromDate(addDays(dateFromKey(start), 6));
  return { start, end };
}

function weeklyDurationSummary(tasks: Task[], currentLifeDate: string): WeeklyDurationSummary[] {
  const { start, end } = currentWeekRange(currentLifeDate);
  const summaries = new Map<string, WeeklyDurationSummary>();
  tasks.forEach((task) => {
    const lifeDate = taskCompletedLifeDate(task);
    if (task.status !== "完了" || lifeDate < start || lifeDate > end || task.durationMinutes === null || task.durationMinutes === undefined) return;
    const current = summaries.get(task.title) ?? { title: task.title, totalMinutes: 0, count: 0 };
    current.totalMinutes += task.durationMinutes;
    current.count += 1;
    summaries.set(task.title, current);
  });
  return Array.from(summaries.values()).sort((a, b) => b.totalMinutes - a.totalMinutes || a.title.localeCompare(b.title, "ja"));
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function dateTimeForDateKey(dateKey: string) {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");
  const milliseconds = String(now.getMilliseconds()).padStart(3, "0");
  return `${dateKey}T${hours}:${minutes}:${seconds}.${milliseconds}`;
}

function addMonths(date: Date, months: number) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function monthlyTargetDate(base: Date, monthOffset: number, monthDay: number) {
  const first = addMonths(new Date(base.getFullYear(), base.getMonth(), 1), monthOffset);
  const day = Math.min(monthDay, daysInMonth(first.getFullYear(), first.getMonth()));
  return new Date(first.getFullYear(), first.getMonth(), day);
}

function visibleTargetDate(task: RecurringTask, today = todayKey()) {
  if (!task.isActive) return null;
  const todayDate = dateFromKey(today);
  if (task.repeatType === "weekly") {
    if (task.weekday === null) return null;
    const diff = (todayDate.getDay() - task.weekday + 7) % 7;
    if (diff > 1) return null;
    return dateKeyFromDate(addDays(todayDate, -diff));
  }
  if (task.monthDay === null) return null;
  const candidates = [-1, 0, 1].map((offset) => monthlyTargetDate(todayDate, offset, task.monthDay as number));
  const target = candidates.find((candidate) => {
    const diff = Math.round((todayDate.getTime() - candidate.getTime()) / 86400000);
    return diff >= -2 && diff <= 2;
  });
  return target ? dateKeyFromDate(target) : null;
}

function visibleRecurringTasks(data: AppData) {
  const completedKeys = new Set(data.recurringCompletions.map((completion) => `${completion.recurringTaskId}:${completion.targetDate}`));
  return data.recurringTasks
    .map((task) => ({ task, targetDate: visibleTargetDate(task) }))
    .filter((item): item is VisibleRecurringTask => Boolean(item.targetDate) && !completedKeys.has(`${item.task.id}:${item.targetDate}`))
    .sort((a, b) => a.targetDate.localeCompare(b.targetDate) || a.task.createdAt.localeCompare(b.task.createdAt));
}

function recurringTaskMatchesDate(task: RecurringTask, date: Date) {
  if (!task.isActive) return false;
  if (task.repeatType === "weekly") return task.weekday !== null && date.getDay() === task.weekday;
  if (task.monthDay === null) return false;
  return dateKeyFromDate(monthlyTargetDate(date, 0, task.monthDay)) === dateKeyFromDate(date);
}

function enjoymentInventory(data: AppData, today = todayKey()): EnjoymentInventory {
  const todayDate = dateFromKey(today);
  const startDate = addDays(todayDate, -29);
  const completedKeys = new Set(data.recurringCompletions.map((completion) => `${completion.recurringTaskId}:${completion.targetDate}`));
  const items = data.recurringTasks
    .filter((task) => task.kind === "楽しみ" && task.isActive)
    .map((task) => {
      const dates = Array.from({ length: 30 }, (_, index) => addDays(startDate, index))
        .filter((date) => recurringTaskMatchesDate(task, date))
        .map(dateKeyFromDate)
        .filter((targetDate) => !task.inventoryStartDate || targetDate >= task.inventoryStartDate)
        .filter((targetDate) => !completedKeys.has(`${task.id}:${targetDate}`));
      return { task, title: task.title, dates };
    })
    .filter((item) => item.dates.length > 0)
    .sort((a, b) => a.title.localeCompare(b.title, "ja") || a.task.id.localeCompare(b.task.id));
  return { total: items.reduce((sum, item) => sum + item.dates.length, 0), items };
}

function completedRecurringToday(data: AppData) {
  return data.recurringCompletions.filter((completion) => toDateKey(completion.completedAt) === todayKey()).sort((a, b) => b.completedAt.localeCompare(a.completedAt));
}

function isRecentlyUpdatedStockTask(task: Task) {
  if (task.status === "今日やる" || task.status === "近いうち" || task.status === "完了") return false;
  const updatedKey = toDateKey(task.updatedAt);
  if (!updatedKey) return false;
  const todayDate = dateFromKey(todayKey());
  return updatedKey >= dateKeyFromDate(addDays(todayDate, -2)) && updatedKey <= todayKey();
}

function doneCompletionMatchesSearch(completion: RecurringCompletion, query: string) {
  if (!query) return true;
  return [completion.titleSnapshot, completion.categorySnapshot, completion.kindSnapshot, completion.targetDate].some((value) => value.toLowerCase().includes(query));
}

function groupDoneItems(items: DoneDisplayItem[]): DoneGroup[] {
  const groups = new Map<string, DoneDisplayItem[]>();
  items.forEach((item) => {
    const group = groups.get(item.completedDate) ?? [];
    group.push(item);
    groups.set(item.completedDate, group);
  });
  return Array.from(groups.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, groupItems]) => ({ date, items: groupItems.sort((a, b) => b.completedAt.localeCompare(a.completedAt)) }));
}

function defaultOpenDoneDate(groups: DoneGroup[]) {
  if (groups.length === 0) return "";
  const yesterday = dateKeyFromDate(addDays(dateFromKey(todayKey()), -1));
  const yesterdayGroup = groups.find((group) => group.date === yesterday);
  if (yesterdayGroup) return yesterdayGroup.date;
  return groups.find((group) => group.date !== todayKey())?.date ?? groups[0].date;
}

function daysFromToday(dateKey: string) {
  const today = dateFromKey(todayKey());
  const date = dateFromKey(dateKey);
  return Math.round((date.getTime() - today.getTime()) / 86400000);
}

function dueLabel(dueDate: string | null) {
  if (!dueDate) return "";
  const diff = daysFromToday(dueDate);
  if (diff < 0) return "過ぎているかも";
  if (diff === 0) return "今日まで";
  if (diff === 1) return "明日まで";
  return `あと${diff}日`;
}

function isNearDue(task: Task) {
  if (!task.dueDate || task.status === "完了" || task.status === "今日やる") return false;
  return daysFromToday(task.dueDate) <= 3;
}

function App() {
  const loaded = useMemo(loadData, []);
  const [data, setData] = useState<AppData>(loaded.data);
  const [activeTab, setActiveTab] = useState<Tab>(() => loadActiveTab());
  const [loadError, setLoadError] = useState(loaded.error);
  const [notice, setNotice] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Task | null>(null);
  const [recurringDeleteTarget, setRecurringDeleteTarget] = useState<RecurringTask | null>(null);
  const [frequentDeleteTarget, setFrequentDeleteTarget] = useState<FrequentTask | null>(null);
  const [importData, setImportData] = useState<AppData | null>(null);
  const [appendImportPreview, setAppendImportPreview] = useState<AppendImportPreview | null>(null);
  const [importError, setImportError] = useState("");
  const [filters, setFilters] = useState<Record<string, FilterValue>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [saveBlocked, setSaveBlocked] = useState(Boolean(loaded.error));
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const appendFileInputRef = useRef<HTMLInputElement | null>(null);
  const currentLifeDate = getLifeDateKey(new Date(), data.settings.dayBoundaryTime);

  useEffect(() => {
    if (saveBlocked) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data, saveBlocked]);

  useLayoutEffect(() => {
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [activeTab]);

  useEffect(() => {
    localStorage.setItem(ACTIVE_VIEW_KEY, TAB_TO_STORED_VIEW[activeTab]);
  }, [activeTab]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 2600);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const tasks = data.tasks;
  const todayTasks = tasks.filter((task) => task.status === "今日やる").sort(byPriorityThenCreatedDesc);
  const nearDueTasks = tasks.filter((task) => isNearDue(task) && task.status !== "連絡待ち").sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));
  const completedTodayTasks = tasks.filter((task) => task.status === "完了" && taskCompletedLifeDate(task) === currentLifeDate).sort(byCompletedDesc);
  const waitingContactTasks = tasks.filter((task) => task.status === "連絡待ち" && !task.completedAt).sort(byCreatedDesc);
  const stockTasks = tasks.filter((task) => task.status !== "完了" && task.status !== "今日やる").sort(byCreatedDesc);
  const doneTasks = tasks.filter((task) => task.status === "完了").sort(byCompletedDesc);
  const recurringTodayTasks = visibleRecurringTasks(data);
  const recurringCompletedToday = completedRecurringToday(data);
  const stockEnjoymentInventory = enjoymentInventory(data);
  const weeklyWorkSummary = weeklyDurationSummary(tasks, currentLifeDate);
  const matchesSearch = (task: Task) => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return true;
    return [task.title, task.memo, task.category, task.status].some((value) => value.toLowerCase().includes(query));
  };

  function updateTask(id: string, updater: (task: Task) => Task) {
    setSaveBlocked(false);
    setData((current) => ({ ...current, tasks: current.tasks.map((task) => task.id === id ? updater(task) : task) }));
  }

  function addTask(draft: TaskDraft) {
    if (!draft.title.trim()) return false;
    setSaveBlocked(false);
    setData((current) => ({ ...current, tasks: [makeTask(draft), ...current.tasks] }));
    setNotice("タスクを追加しました。");
    return true;
  }

  function addRoutineItem(title: string) {
    if (!title.trim()) return false;
    setSaveBlocked(false);
    setData((current) => ({ ...current, routineItems: [...current.routineItems, makeRoutineItem(title)] }));
    setNotice("ルーティン項目を追加しました。");
    return true;
  }

  function deleteRoutineItem(id: string) {
    setSaveBlocked(false);
    setData((current) => ({ ...current, routineItems: current.routineItems.filter((item) => item.id !== id) }));
    setNotice("ルーティン項目を削除しました。");
  }

  function moveRoutineItem(id: string, direction: -1 | 1) {
    setSaveBlocked(false);
    setData((current) => {
      const index = current.routineItems.findIndex((item) => item.id === id);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.routineItems.length) return current;
      const routineItems = [...current.routineItems];
      [routineItems[index], routineItems[nextIndex]] = [routineItems[nextIndex], routineItems[index]];
      const time = nowIso();
      routineItems[index] = { ...routineItems[index], updatedAt: time };
      routineItems[nextIndex] = { ...routineItems[nextIndex], updatedAt: time };
      return { ...current, routineItems };
    });
  }

  function registerRoutineCompletion(checkedIds: string[], targetDate: string) {
    if (checkedIds.length === 0) {
      setNotice("チェックされた項目がありません。");
      return false;
    }
    const checkedIdSet = new Set(checkedIds);
    const memo = data.routineItems.filter((item) => checkedIdSet.has(item.id)).map((item) => item.title).join("、");
    const time = dateTimeForDateKey(targetDate);
    const task: Task = {
      id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
      title: "生活行動",
      type: "やりたいこと",
      status: "完了",
      category: "生活",
      memo,
      place: "家",
      timeSlot: "",
      dueDate: null,
      createdAt: time,
      updatedAt: time,
      completedAt: time,
      completedLifeDate: targetDate,
      durationMinutes: null,
    };
    setSaveBlocked(false);
    setData((current) => ({ ...current, tasks: [task, ...current.tasks] }));
    setNotice("ルーティンを生活行動として登録しました。");
    return true;
  }

  function saveTask(task: Task, draft: TaskDraft) {
    const time = nowIso();
    const completedAt = draft.status === "完了" ? (task.completedAt ?? time) : null;
    const completedLifeDate = draft.status === "完了" ? (task.completedLifeDate ?? currentLifeDate) : null;
    updateTask(task.id, () => ({
      ...task,
      title: draft.title.trim(),
      type: draft.type,
      status: draft.status,
      category: draft.category,
      place: draft.place,
      timeSlot: draft.timeSlot,
      dueDate: draft.dueDate || null,
      memo: draft.memo.trim(),
      completedAt,
      completedLifeDate,
      durationMinutes: draft.status === "完了" ? (task.durationMinutes ?? null) : null,
      updatedAt: time,
    }));
    setNotice("タスクを更新しました。");
  }

  function moveTask(task: Task, status: TaskStatus) {
    const time = nowIso();
    updateTask(task.id, (current) => ({
      ...current,
      status,
      completedAt: status === "今日やる" && current.status === "完了" ? null : current.completedAt,
      completedLifeDate: status === "今日やる" && current.status === "完了" ? null : current.completedLifeDate,
      durationMinutes: status === "今日やる" && current.status === "完了" ? null : current.durationMinutes,
      updatedAt: time,
    }));
  }

  function completeTask(task: Task, record: CompletionRecordDraft) {
    const time = nowIso();
    updateTask(task.id, (current) => ({
      ...current,
      status: "完了",
      completedAt: makeCompletedAt(currentLifeDate, record.completedTime),
      completedLifeDate: currentLifeDate,
      durationMinutes: record.durationMinutes,
      updatedAt: time,
    }));
    setNotice("完了記録を保存しました。");
  }

  function saveCompletionRecord(task: Task, record: CompletionRecordDraft) {
    const lifeDate = taskCompletedLifeDate(task) || currentLifeDate;
    updateTask(task.id, (current) => ({
      ...current,
      completedAt: makeCompletedAt(lifeDate, record.completedTime),
      completedLifeDate: lifeDate,
      durationMinutes: record.durationMinutes,
      updatedAt: nowIso(),
    }));
    setNotice("完了記録を更新しました。");
  }

  function undoComplete(task: Task) {
    updateTask(task.id, (current) => ({ ...current, status: "今日やる", completedAt: null, completedLifeDate: null, durationMinutes: null, updatedAt: nowIso() }));
    setNotice("完了を取り消して、今日やるに戻しました。");
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    setSaveBlocked(false);
    setData((current) => ({ ...current, tasks: current.tasks.filter((task) => task.id !== deleteTarget.id) }));
    setDeleteTarget(null);
    setNotice("タスクを削除しました。");
  }

  function registerFrequentTask(task: Task) {
    const draft: FrequentTaskDraft = {
      title: task.title,
      memo: task.memo,
      type: task.type,
      category: task.category,
      place: task.place,
    };
    if (data.frequentTasks.some((item) => frequentTaskMatches(item, draft))) {
      setNotice("同じよく使うタスクがすでにあります。");
      return;
    }
    setSaveBlocked(false);
    setData((current) => ({ ...current, frequentTasks: [makeFrequentTask(draft), ...current.frequentTasks] }));
    setNotice("よく使うタスクに登録しました。");
  }

  function saveFrequentTask(task: FrequentTask, draft: FrequentTaskDraft) {
    if (!draft.title.trim()) return false;
    const updated: FrequentTask = { ...task, ...draft, title: draft.title.trim(), memo: draft.memo.trim(), updatedAt: nowIso() };
    setSaveBlocked(false);
    setData((current) => ({ ...current, frequentTasks: current.frequentTasks.map((item) => item.id === task.id ? updated : item) }));
    setNotice("よく使うタスクを更新しました。");
    return true;
  }

  function addTaskFromFrequentTask(task: FrequentTask) {
    setSaveBlocked(false);
    setData((current) => ({ ...current, tasks: [makeTaskFromFrequentTask(task), ...current.tasks] }));
    setNotice("よく使うタスクから今日やるに追加しました。");
  }

  function confirmFrequentDelete() {
    if (!frequentDeleteTarget) return;
    setSaveBlocked(false);
    setData((current) => ({ ...current, frequentTasks: current.frequentTasks.filter((task) => task.id !== frequentDeleteTarget.id) }));
    setFrequentDeleteTarget(null);
    setNotice("よく使うタスクを削除しました。");
  }

  function makeRecurringTask(draft: RecurringDraft): RecurringTask {
    const time = nowIso();
    return {
      id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
      title: draft.title.trim(),
      memo: draft.memo.trim(),
      category: draft.category,
      kind: draft.kind,
      repeatType: draft.repeatType,
      weekday: draft.repeatType === "weekly" ? Number(draft.weekday) as Weekday : null,
      monthDay: draft.repeatType === "monthly" ? Number(draft.monthDay) : null,
      isActive: draft.isActive,
      ...(draft.kind === "楽しみ" ? { inventoryStartDate: todayKey() } : {}),
      createdAt: time,
      updatedAt: time,
    };
  }

  function addRecurringTask(draft: RecurringDraft) {
    setSaveBlocked(false);
    setData((current) => ({ ...current, recurringTasks: [makeRecurringTask(draft), ...current.recurringTasks] }));
    setNotice("繰り返しタスクを追加しました。");
    return true;
  }

  function saveRecurringTask(task: RecurringTask, draft: RecurringDraft) {
    const time = nowIso();
    setSaveBlocked(false);
    setData((current) => ({
      ...current,
      recurringTasks: current.recurringTasks.map((item) => item.id === task.id ? {
        ...item,
        title: draft.title.trim(),
        memo: draft.memo.trim(),
        category: draft.category,
        kind: draft.kind,
        repeatType: draft.repeatType,
        weekday: draft.repeatType === "weekly" ? Number(draft.weekday) as Weekday : null,
        monthDay: draft.repeatType === "monthly" ? Number(draft.monthDay) : null,
        isActive: draft.isActive,
        ...(draft.kind === "楽しみ" && !item.inventoryStartDate ? { inventoryStartDate: todayKey() } : {}),
        updatedAt: time,
      } : item),
    }));
    setNotice("繰り返しタスクを更新しました。");
  }

  function setRecurringActive(task: RecurringTask, isActive: boolean) {
    setSaveBlocked(false);
    setData((current) => ({
      ...current,
      recurringTasks: current.recurringTasks.map((item) => item.id === task.id ? { ...item, isActive, updatedAt: nowIso() } : item),
    }));
    setNotice(isActive ? "繰り返しタスクを再開しました。" : "繰り返しタスクを停止しました。");
  }

  function addRecurringCompletion(task: RecurringTask, targetDate: string, noticeText: string) {
    const time = nowIso();
    const completion: RecurringCompletion = {
      id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
      recurringTaskId: task.id,
      targetDate,
      completedAt: time,
      titleSnapshot: task.title,
      categorySnapshot: task.category,
      kindSnapshot: task.kind,
    };
    setSaveBlocked(false);
    setData((current) => {
      const alreadyCompleted = current.recurringCompletions.some((item) => item.recurringTaskId === task.id && item.targetDate === targetDate);
      return alreadyCompleted ? current : { ...current, recurringCompletions: [completion, ...current.recurringCompletions] };
    });
    setNotice(noticeText);
  }

  function completeRecurringTask(item: VisibleRecurringTask) {
    addRecurringCompletion(item.task, item.targetDate, "今回分を完了しました。");
  }

  function enjoyInventoryItem(task: RecurringTask, targetDate: string) {
    addRecurringCompletion(task, targetDate, "楽しみ在庫を1回分楽しみました。");
  }

  function confirmRecurringDelete() {
    if (!recurringDeleteTarget) return;
    setSaveBlocked(false);
    setData((current) => ({ ...current, recurringTasks: current.recurringTasks.filter((task) => task.id !== recurringDeleteTarget.id) }));
    setRecurringDeleteTarget(null);
    setNotice("繰り返しタスクを削除しました。");
  }

  function keepText() {
    const lines = [
      `# タスク整理メモ ${currentLifeDate}`,
      "",
      "## 今日やる",
      ...formatCheckList(todayTasks, false),
      "",
      "## 期限が近い",
      ...formatCheckList(nearDueTasks, false, true),
      "",
      "## 今日完了したこと",
      ...formatCheckList(completedTodayTasks, true),
      "",
      "## 近いうち",
      ...formatCheckList(tasks.filter((task) => task.status === "近いうち").sort(byCreatedDesc), false),
      "",
      "## いつかやる",
      ...formatCheckList(tasks.filter((task) => task.status === "いつかやる").sort(byCreatedDesc), false),
      "",
      "## 連絡待ち",
      ...formatCheckList(tasks.filter((task) => task.status === "連絡待ち").sort(byCreatedDesc), false),
      "",
      "## 保留",
      ...formatCheckList(tasks.filter((task) => task.status === "保留").sort(byCreatedDesc), false),
      "",
      "## 夜のメモ",
      "-",
    ];
    return lines.join("\n");
  }

  function formatCheckList(list: Task[], checked: boolean, withDue = false) {
    if (list.length === 0) return ["- なし"];
    return list.map((task) => `- [${checked ? "x" : " "}] ${task.title}${withDue && task.dueDate ? `（期限：${task.dueDate}）` : ""}`);
  }

  async function copyKeepText() {
    await navigator.clipboard.writeText(keepText());
    setNotice("整理メモをコピーしました。");
  }

  function exportJson() {
    const exported: AppData = { ...data, exportedAt: nowIso() };
    const blob = new Blob([JSON.stringify(exported, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `task-manager-backup-${todayKey()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setNotice("JSONをエクスポートしました。");
  }

  function parseImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setImportError("");
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (!isAppData(parsed)) throw new Error("Invalid JSON");
        setImportData(normalizeData(parsed));
      } catch {
        setImportError("JSONの形式が不正です。バックアップファイルを確認してください。");
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  }

  function parseAppendImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setImportError("");
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (!isAppData(parsed)) throw new Error("Invalid JSON");
        setAppendImportPreview(buildAppendImportPreview(data, normalizeData(parsed)));
      } catch {
        setImportError("JSONを読み込めませんでした。ファイル形式を確認してください。");
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  }

  function doImport() {
    if (!importData) return;
    setSaveBlocked(false);
    setData(importData);
    setImportData(null);
    setNotice("JSONから復元しました。");
  }

  function doAppendImport() {
    if (!appendImportPreview) return;
    setSaveBlocked(false);
    setData(appendImportPreview.data);
    setAppendImportPreview(null);
    setNotice("JSONを追加インポートしました。");
  }

  function updateDayBoundaryTime(dayBoundaryTime: string) {
    setSaveBlocked(false);
    setData((current) => ({ ...current, settings: { ...current.settings, dayBoundaryTime } }));
    setNotice("生活日付設定を保存しました。");
  }

  function matches(task: Task, pairs: [string, string][]) {
    return pairs.every(([key, value]) => value === "すべて" || task[key as keyof Task] === value);
  }

  function switchTab(tab: Tab) {
    if (tab === activeTab) return;
    setActiveTab(tab);
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">思いついたことをその場で置けるタスク台帳</p>
          <h1>ゆるたすく</h1>
        </div>
      </header>
      <nav className="bottom-nav" aria-label="画面切り替え">
        {(["今日", "ストック", "完了", "設定"] as Tab[]).map((tab) => (
          <button key={tab} className={activeTab === tab ? "active" : ""} onClick={() => switchTab(tab)}>{tab}</button>
        ))}
      </nav>

      {loadError && <div className="message error">{loadError}<button onClick={() => setLoadError("")}>閉じる</button></div>}
      {notice && <div className="message success">{notice}</div>}

      <main>
        {activeTab === "今日" && <TodayView todayTasks={todayTasks} nearDueTasks={nearDueTasks} recurringTodayTasks={recurringTodayTasks} completedTodayTasks={completedTodayTasks} recurringCompletedToday={recurringCompletedToday} waitingContactTasks={waitingContactTasks} routineItems={data.routineItems} frequentTasks={data.frequentTasks} addTask={addTask} copyTask={addTask} saveTask={saveTask} moveTask={moveTask} completeTask={completeTask} saveCompletionRecord={saveCompletionRecord} undoComplete={undoComplete} completeRecurringTask={completeRecurringTask} addRoutineItem={addRoutineItem} deleteRoutineItem={deleteRoutineItem} moveRoutineItem={moveRoutineItem} registerRoutineCompletion={registerRoutineCompletion} registerFrequentTask={registerFrequentTask} requestDelete={setDeleteTarget} />}
        {activeTab === "ストック" && <StockView tasks={stockTasks} enjoymentInventory={stockEnjoymentInventory} enjoyInventoryItem={enjoyInventoryItem} filters={filters} setFilters={setFilters} searchQuery={searchQuery} setSearchQuery={setSearchQuery} copyTask={addTask} saveTask={saveTask} moveTask={moveTask} completeTask={completeTask} saveCompletionRecord={saveCompletionRecord} registerFrequentTask={registerFrequentTask} requestDelete={setDeleteTarget} matches={matches} matchesSearch={matchesSearch} />}
        {activeTab === "完了" && <DoneView tasks={doneTasks} recurringCompletions={data.recurringCompletions} weeklyWorkSummary={weeklyWorkSummary} filters={filters} setFilters={setFilters} searchQuery={searchQuery} setSearchQuery={setSearchQuery} copyTask={addTask} saveTask={saveTask} saveCompletionRecord={saveCompletionRecord} undoComplete={undoComplete} registerFrequentTask={registerFrequentTask} requestDelete={setDeleteTarget} matches={matches} matchesSearch={matchesSearch} />}
        {activeTab === "設定" && <SettingsView data={data} updateDayBoundaryTime={updateDayBoundaryTime} exportJson={exportJson} parseImport={parseImport} parseAppendImport={parseAppendImport} fileInputRef={fileInputRef} appendFileInputRef={appendFileInputRef} importError={importError} addTaskFromFrequentTask={addTaskFromFrequentTask} saveFrequentTask={saveFrequentTask} requestFrequentDelete={setFrequentDeleteTarget} addRecurringTask={addRecurringTask} saveRecurringTask={saveRecurringTask} setRecurringActive={setRecurringActive} requestRecurringDelete={setRecurringDeleteTarget} />}
      </main>

      {deleteTarget && (
        <ConfirmDialog title="このタスクを削除しますか？" body="削除すると元に戻せません。" confirmLabel="削除する" onConfirm={confirmDelete} onCancel={() => setDeleteTarget(null)} />
      )}
      {recurringDeleteTarget && (
        <ConfirmDialog title="この繰り返しタスクを削除しますか？" body="登録内容は削除され、今日画面にも表示されなくなります。過去の完了履歴は残ります。" confirmLabel="削除する" onConfirm={confirmRecurringDelete} onCancel={() => setRecurringDeleteTarget(null)} />
      )}
      {frequentDeleteTarget && (
        <ConfirmDialog title="このよく使うタスクを削除しますか？" body="作成済みの通常タスクは削除されません。" confirmLabel="削除する" onConfirm={confirmFrequentDelete} onCancel={() => setFrequentDeleteTarget(null)} />
      )}
      {importData && (
        <ConfirmDialog title="JSONで全上書き" body="現在のデータは、選択したJSONの内容で全て置き換わります。復元用の操作です。実行前に必ずJSONエクスポートでバックアップしてください。" confirmLabel="全上書きする" onConfirm={doImport} onCancel={() => setImportData(null)} />
      )}
      {appendImportPreview && (
        <AppendImportDialog preview={appendImportPreview} onConfirm={doAppendImport} onCancel={() => setAppendImportPreview(null)} />
      )}
    </div>
  );
}

type SharedProps = {
  copyTask: (draft: TaskDraft) => boolean;
  saveTask: (task: Task, draft: TaskDraft) => void;
  moveTask: (task: Task, status: TaskStatus) => void;
  completeTask: (task: Task, record: CompletionRecordDraft) => void;
  saveCompletionRecord: (task: Task, record: CompletionRecordDraft) => void;
  registerFrequentTask: (task: Task) => void;
  requestDelete: (task: Task) => void;
  matches: (task: Task, pairs: [string, string][]) => boolean;
  matchesSearch: (task: Task) => boolean;
};

type SearchProps = {
  searchQuery: string;
  setSearchQuery: (value: string) => void;
};

type TaskCardActions = {
  primary: React.ReactNode;
  secondary?: React.ReactNode;
};

function compactActions(primary: React.ReactNode, secondary?: React.ReactNode): TaskCardActions {
  return { primary, secondary };
}

function isTaskCardActions(value: React.ReactNode | TaskCardActions): value is TaskCardActions {
  return value !== null && typeof value === "object" && "primary" in value;
}

function TodayView(props: {
  todayTasks: Task[];
  nearDueTasks: Task[];
  recurringTodayTasks: VisibleRecurringTask[];
  completedTodayTasks: Task[];
  recurringCompletedToday: RecurringCompletion[];
  waitingContactTasks: Task[];
  routineItems: RoutineItem[];
  frequentTasks: FrequentTask[];
  addTask: (draft: TaskDraft) => boolean;
  copyTask: (draft: TaskDraft) => boolean;
  saveTask: (task: Task, draft: TaskDraft) => void;
  moveTask: (task: Task, status: TaskStatus) => void;
  completeTask: (task: Task, record: CompletionRecordDraft) => void;
  saveCompletionRecord: (task: Task, record: CompletionRecordDraft) => void;
  requestDelete: (task: Task) => void;
  undoComplete: (task: Task) => void;
  completeRecurringTask: (item: VisibleRecurringTask) => void;
  addRoutineItem: (title: string) => boolean;
  deleteRoutineItem: (id: string) => void;
  moveRoutineItem: (id: string, direction: -1 | 1) => void;
  registerRoutineCompletion: (checkedIds: string[], targetDate: string) => boolean;
  registerFrequentTask: (task: Task) => void;
}) {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({ today: true });
  const [isAddFormOpen, setIsAddFormOpen] = useState(false);
  const [isRoutineOpen, setIsRoutineOpen] = useState(false);
  const filteredTodayTasks = props.todayTasks;
  const filteredNearDueTasks = props.nearDueTasks;
  const filteredCompletedTodayTasks = props.completedTodayTasks;
  const filteredRecurringTodayTasks = props.recurringTodayTasks;
  const filteredRecurringCompletedToday = props.recurringCompletedToday;
  const filteredWaitingContactTasks = props.waitingContactTasks;
  function toggleSection(key: string) {
    setOpenSections((current) => ({ ...current, [key]: !current[key] }));
  }
  function addTaskAndClose(draft: TaskDraft) {
    const added = props.addTask(draft);
    if (added) setIsAddFormOpen(false);
    return added;
  }
  return <div className="view-stack">
    <Section title="今日">
      <div className="today-actions">
        <button className="primary-button add-task-button" type="button" onClick={() => setIsAddFormOpen((current) => !current)} aria-expanded={isAddFormOpen}>{isAddFormOpen ? "▼ 新規タスク" : "＋ 新規タスク"}</button>
        {isAddFormOpen && <div className="today-add-panel">
          <TaskForm initial={newDraft("いつかやる")} submitLabel="タスクを追加" onSubmit={addTaskAndClose} onCancel={() => setIsAddFormOpen(false)} allowDone frequentTasks={props.frequentTasks} />
        </div>}
      </div>
    </Section>
    <CollapsibleSection title="ルーティン" count={props.routineItems.length} isOpen={isRoutineOpen} onToggle={() => setIsRoutineOpen((current) => !current)}>
      <RoutineChecklist
        items={props.routineItems}
        addRoutineItem={props.addRoutineItem}
        deleteRoutineItem={props.deleteRoutineItem}
        moveRoutineItem={props.moveRoutineItem}
        registerRoutineCompletion={props.registerRoutineCompletion}
      />
    </CollapsibleSection>
    <CollapsibleSection title="今日やる" count={filteredTodayTasks.length} description="今日動きたいものを置きます。あとから状態を変えても大丈夫です。" isOpen={Boolean(openSections.today)} onToggle={() => toggleSection("today")}>
      <TaskList empty="今日やるタスクはありません。必要なら新規タスクから追加できます。" tasks={filteredTodayTasks} actions={(task) => compactActions(<CompleteTaskAction task={task} completeTask={props.completeTask} />, <><MoveButtons task={task} moveTask={props.moveTask} hide={["今日やる"]} /><Action subtle onClick={() => props.registerFrequentTask(task)}>よく使う</Action><Action subtle onClick={() => props.requestDelete(task)}>削除</Action></>)} saveTask={props.saveTask} copyTask={props.copyTask} saveCompletionRecord={props.saveCompletionRecord} />
    </CollapsibleSection>
    <CollapsibleSection title="期限が近い" count={filteredNearDueTasks.length} description="責める場所ではなく、そろそろ見ておくものを拾う場所です。" className="due-section" isOpen={Boolean(openSections.nearDue)} onToggle={() => toggleSection("nearDue")}>
      <TaskList empty="期限が近いタスクはありません。" tasks={filteredNearDueTasks} actions={(task) => compactActions(<CompleteTaskAction task={task} completeTask={props.completeTask} />, <><MoveButtons task={task} moveTask={props.moveTask} /><Action subtle onClick={() => props.registerFrequentTask(task)}>よく使う</Action></>)} saveTask={props.saveTask} copyTask={props.copyTask} saveCompletionRecord={props.saveCompletionRecord} />
    </CollapsibleSection>
    <CollapsibleSection title="繰り返し" count={filteredRecurringTodayTasks.length} description="毎週・毎月の予定や楽しみを、必要な期間だけここに出します。" isOpen={Boolean(openSections.recurring)} onToggle={() => toggleSection("recurring")}>
      <RecurringTodayList items={filteredRecurringTodayTasks} completeRecurringTask={props.completeRecurringTask} />
    </CollapsibleSection>
    <CollapsibleSection title="今日完了したこと" count={filteredCompletedTodayTasks.length + filteredRecurringCompletedToday.length} description="今日やったことを見えるようにして、日記や振り返りに使います。" isOpen={Boolean(openSections.completedToday)} onToggle={() => toggleSection("completedToday")}>
      {filteredCompletedTodayTasks.length === 0 && filteredRecurringCompletedToday.length === 0 ? <p className="empty-text">今日完了したタスクはまだありません。終わったこともあとから追加できます。</p> : filteredCompletedTodayTasks.length > 0 && <TaskList empty="" tasks={filteredCompletedTodayTasks} actions={(task) => <><Action onClick={() => props.undoComplete(task)}>完了を取り消す</Action><Action subtle onClick={() => props.registerFrequentTask(task)}>よく使う</Action></>} saveTask={props.saveTask} copyTask={props.copyTask} saveCompletionRecord={props.saveCompletionRecord} />}
      <RecurringCompletionList completions={filteredRecurringCompletedToday} />
    </CollapsibleSection>
    <CollapsibleSection title="連絡待ち" count={filteredWaitingContactTasks.length} description="相手からの返信や回答を待っているものを、今日やることとは分けて置きます。" className="waiting-section" isOpen={Boolean(openSections.waiting)} onToggle={() => toggleSection("waiting")}>
      <TaskList empty="連絡待ちはありません。" tasks={filteredWaitingContactTasks} actions={(task) => compactActions(<CompleteTaskAction task={task} completeTask={props.completeTask} />, <><MoveButtons task={task} moveTask={props.moveTask} /><Action subtle onClick={() => props.registerFrequentTask(task)}>よく使う</Action><Action subtle onClick={() => props.requestDelete(task)}>削除</Action></>)} saveTask={props.saveTask} copyTask={props.copyTask} saveCompletionRecord={props.saveCompletionRecord} />
    </CollapsibleSection>
  </div>;
}

function RoutineChecklist({ items, addRoutineItem, deleteRoutineItem, moveRoutineItem, registerRoutineCompletion }: { items: RoutineItem[]; addRoutineItem: (title: string) => boolean; deleteRoutineItem: (id: string) => void; moveRoutineItem: (id: string, direction: -1 | 1) => void; registerRoutineCompletion: (checkedIds: string[], targetDate: string) => boolean }) {
  const [checkedIds, setCheckedIds] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const yesterday = dateKeyFromDate(addDays(dateFromKey(todayKey()), -1));
  function toggleChecked(id: string) {
    setCheckedIds((current) => current.includes(id) ? current.filter((itemId) => itemId !== id) : [...current, id]);
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    if (addRoutineItem(title)) {
      setTitle("");
      setAdding(false);
    }
  }
  function removeItem(id: string) {
    deleteRoutineItem(id);
    setCheckedIds((current) => current.filter((itemId) => itemId !== id));
  }
  function register(targetDate: string) {
    const saved = registerRoutineCompletion(checkedIds, targetDate);
    if (saved) setCheckedIds([]);
  }
  return <div className="routine-panel">
    {items.length === 0 ? <p className="empty-text">ルーティン項目はまだありません。</p> : <div className="routine-list">
      {items.map((item, index) => (
        <div className="routine-row" key={item.id}>
          <label className="routine-check"><input type="checkbox" checked={checkedIds.includes(item.id)} onChange={() => toggleChecked(item.id)} /><span>{item.title}</span></label>
          <div className="routine-row-actions">
            <button type="button" onClick={() => moveRoutineItem(item.id, -1)} disabled={index === 0} aria-label={`${item.title}を上へ移動`}>↑</button>
            <button type="button" onClick={() => moveRoutineItem(item.id, 1)} disabled={index === items.length - 1} aria-label={`${item.title}を下へ移動`}>↓</button>
            <button type="button" onClick={() => removeItem(item.id)} aria-label={`${item.title}を削除`}>×</button>
          </div>
        </div>
      ))}
    </div>}
    {adding ? <form className="routine-add-form" onSubmit={submit}>
      <label>項目名<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="追加する生活行動" /></label>
      <div className="button-row"><button className="primary-button" type="submit" disabled={!title.trim()}>追加</button><button type="button" onClick={() => { setAdding(false); setTitle(""); }}>キャンセル</button></div>
    </form> : <button className="subtle-button routine-add-button" type="button" onClick={() => setAdding(true)}>＋ 追加</button>}
    <div className="routine-register-actions">
      <button type="button" onClick={() => register(yesterday)}>昨日登録</button>
      <button className="primary-button" type="button" onClick={() => register(todayKey())}>今日登録</button>
    </div>
  </div>;
}

function StockView(props: SharedProps & SearchProps & { tasks: Task[]; enjoymentInventory: EnjoymentInventory; enjoyInventoryItem: (task: RecurringTask, targetDate: string) => void; filters: Record<string, FilterValue>; setFilters: (filters: Record<string, FilterValue>) => void }) {
  const pairs: [string, string][] = [["status", props.filters.stockStatus ?? "すべて"], ["category", props.filters.stockCategory ?? "すべて"], ["type", props.filters.stockType ?? "すべて"], ["place", props.filters.stockPlace ?? "すべて"]];
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({ soon: true });
  const visibleTasks = props.tasks.filter((task) => props.matches(task, pairs) && props.matchesSearch(task));
  const stockActions = (task: Task) => compactActions(
    <Action onClick={() => props.moveTask(task, "今日やる")}>今日やるへ</Action>,
    <><MoveButtons task={task} moveTask={props.moveTask} hide={["今日やる"]} /><CompleteTaskAction task={task} completeTask={props.completeTask} /><Action subtle onClick={() => props.registerFrequentTask(task)}>よく使う</Action><Action subtle onClick={() => props.requestDelete(task)}>削除</Action></>,
  );
  const groups = [
    { key: "soon", title: "近いうち", tasks: visibleTasks.filter((task) => task.status === "近いうち").sort(byDueThenUpdatedDesc) },
    { key: "recent", title: "最近更新", tasks: visibleTasks.filter(isRecentlyUpdatedStockTask).sort(byUpdatedThenCreatedDesc) },
    { key: "someday", title: "いつかやる", tasks: visibleTasks.filter((task) => task.status === "いつかやる").sort(byDueThenUpdatedDesc) },
    { key: "hold", title: "保留", tasks: visibleTasks.filter((task) => task.status === "保留").sort(byDueThenUpdatedDesc) },
    { key: "waiting", title: "連絡待ち", tasks: visibleTasks.filter((task) => task.status === "連絡待ち").sort(byDueThenUpdatedDesc) },
    { key: "other", title: "その他・未整理", tasks: visibleTasks.filter((task) => !["近いうち", "いつかやる", "保留", "連絡待ち"].includes(task.status)).sort(byDueThenUpdatedDesc) },
  ];
  function toggleGroup(key: string) {
    setOpenGroups((current) => ({ ...current, [key]: !current[key] }));
  }
  return <div className="view-stack">
    <Section title="ストック" description="あとで拾いたいタスクを置く場所です。" />
    <Section title="絞り込み"><StockFilterPanel searchQuery={props.searchQuery} setSearchQuery={props.setSearchQuery} filters={props.filters} setFilters={props.setFilters} /></Section>
    <div className="stock-groups">
      <EnjoymentInventoryCard inventory={props.enjoymentInventory} enjoyInventoryItem={props.enjoyInventoryItem} />
      {groups.map((group) => <CollapsibleSection key={group.key} title={group.title} count={group.tasks.length} isOpen={Boolean(openGroups[group.key])} onToggle={() => toggleGroup(group.key)}>
        <TaskList empty={`${group.title}のタスクはありません。`} tasks={group.tasks} actions={stockActions} saveTask={props.saveTask} copyTask={props.copyTask} saveCompletionRecord={props.saveCompletionRecord} />
      </CollapsibleSection>)}
    </div>
  </div>;
}

function EnjoymentInventoryCard({ inventory, enjoyInventoryItem }: { inventory: EnjoymentInventory; enjoyInventoryItem: (task: RecurringTask, targetDate: string) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const summary = inventory.items.length > 0 ? inventory.items.map((item) => `${item.title}${item.dates.length}`).join(" / ") : "今のところ、楽しみ在庫はありません。";
  const detailRows = inventory.items
    .flatMap((item) => item.dates.map((date) => ({ task: item.task, title: item.title, date })))
    .sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title, "ja"));
  return <section className="section enjoyment-inventory">
    <button className="collapse-trigger enjoyment-trigger" type="button" onClick={() => setIsOpen((current) => !current)} aria-expanded={isOpen}>
      <span className="collapse-title"><span aria-hidden="true">{isOpen ? "▼" : "▶"}</span>楽しみ在庫<span className="collapse-count">合計{inventory.total}件</span></span>
    </button>
    {isOpen && <div className="enjoyment-details">
      <p className="enjoyment-summary">{summary}</p>
      {detailRows.length === 0 ? <p className="empty-text">過去30日分で、未完了の楽しみ系繰り返しタスクはありません。</p> : <div className="enjoyment-detail">
        <h3>対象日一覧</h3>
        <div className="enjoyment-date-list">
          {detailRows.map((row) => <div className="enjoyment-date-row" key={`${row.task.id}-${row.date}`}>
            <span>{row.date} 分：{row.title}</span>
            <button className="enjoyment-done-button" type="button" onClick={() => enjoyInventoryItem(row.task, row.date)}>楽しんだ</button>
          </div>)}
        </div>
      </div>}
    </div>}
  </section>;
}

function StockFilterPanel({ searchQuery, setSearchQuery, filters, setFilters }: SearchProps & { filters: Record<string, FilterValue>; setFilters: (filters: Record<string, FilterValue>) => void }) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filterItems = [
    { label: "状態", keyName: "stockStatus", value: filters.stockStatus ?? "すべて", options: ["近いうち", "いつかやる", "連絡待ち", "保留"] },
    { label: "カテゴリ", keyName: "stockCategory", value: filters.stockCategory ?? "すべて", options: ACTIVE_TASK_CATEGORIES },
    { label: "種類", keyName: "stockType", value: filters.stockType ?? "すべて", options: TASK_TYPES },
    { label: "作業場所", keyName: "stockPlace", value: filters.stockPlace ?? "すべて", options: TASK_PLACES },
  ];
  const detailedFilterActive = filterItems.some((filter) => filter.value !== "すべて");
  return <div className="stock-filter-panel">
    <label className="stock-search-row"><span>検索</span><input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="タスクを検索" /></label>
    <button className="stock-filter-toggle" type="button" onClick={() => setFiltersOpen((current) => !current)} aria-expanded={filtersOpen}>
      {filtersOpen ? "絞り込みを閉じる" : "絞り込みを開く"}
      {!filtersOpen && detailedFilterActive && <span>絞り込み適用中</span>}
    </button>
    {filtersOpen && <div className="stock-filter-grid">
      {filterItems.map((filter) => <Select key={filter.keyName} label={filter.label} value={filter.value} options={["すべて", ...filter.options]} onChange={(value) => setFilters({ ...filters, [filter.keyName]: value })} />)}
    </div>}
  </div>;
}

function DoneView(props: Omit<SharedProps, "moveTask" | "completeTask"> & SearchProps & { tasks: Task[]; recurringCompletions: RecurringCompletion[]; weeklyWorkSummary: WeeklyDurationSummary[]; filters: Record<string, FilterValue>; setFilters: (filters: Record<string, FilterValue>) => void; undoComplete: (task: Task) => void }) {
  const pairs: [string, string][] = [["category", props.filters.doneCategory ?? "すべて"], ["type", props.filters.doneType ?? "すべて"]];
  const query = props.searchQuery.trim().toLowerCase();
  const filteredTasks: DoneDisplayItem[] = props.tasks
    .filter((task) => props.matches(task, pairs) && props.matchesSearch(task))
    .map((task) => ({ kind: "task", id: task.id, completedDate: taskCompletedLifeDate(task), completedAt: task.completedAt ?? "", task }));
  const filteredRecurringCompletions: DoneDisplayItem[] = props.recurringCompletions
    .filter((completion) => (props.filters.doneCategory ?? "すべて") === "すべて" || completion.categorySnapshot === props.filters.doneCategory)
    .filter((completion) => (props.filters.doneType ?? "すべて") === "すべて")
    .filter((completion) => doneCompletionMatchesSearch(completion, query))
    .map((completion) => ({ kind: "recurring", id: completion.id, completedDate: toDateKey(completion.completedAt), completedAt: completion.completedAt, completion }));
  const doneGroups = groupDoneItems([...filteredTasks, ...filteredRecurringCompletions]);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const defaultDate = defaultOpenDoneDate(doneGroups);
    return defaultDate ? { [defaultDate]: true } : {};
  });
  function toggleGroup(date: string) {
    setOpenGroups((current) => ({ ...current, [date]: !current[date] }));
  }
  return <div className="view-stack">
    <Section title="完了" description="終わったことを残す場所です。日記や振り返りの材料にできます。" />
    <WeeklyDurationSummaryPanel summaries={props.weeklyWorkSummary} />
    <Section title="絞り込み"><DoneFilterPanel searchQuery={props.searchQuery} setSearchQuery={props.setSearchQuery} filters={props.filters} setFilters={props.setFilters} /></Section>
    {doneGroups.length === 0 ? <Section title="完了一覧"><p className="empty-text">完了タスクはまだありません。終わったことを残すと、日記や振り返りに使えます。</p></Section> : <div className="done-groups">
      {doneGroups.map((group) => <CollapsibleSection key={group.date} title={group.date} count={group.items.length} isOpen={Boolean(openGroups[group.date])} onToggle={() => toggleGroup(group.date)}>
        <DoneGroupList items={group.items} saveTask={props.saveTask} copyTask={props.copyTask} saveCompletionRecord={props.saveCompletionRecord} undoComplete={props.undoComplete} registerFrequentTask={props.registerFrequentTask} requestDelete={props.requestDelete} />
      </CollapsibleSection>)}
    </div>}
  </div>;
}

function WeeklyDurationSummaryPanel({ summaries }: { summaries: WeeklyDurationSummary[] }) {
  return <Section title="今週の作業時間">
    {summaries.length === 0 ? <p className="empty-text">今週の作業時間はまだありません。</p> : <div className="weekly-summary-list">
      {summaries.map((summary) => <div className="weekly-summary-item" key={summary.title}>
        <h3>{summary.title}</h3>
        <div className="task-meta"><span>合計：{formatDuration(summary.totalMinutes)}</span><span>回数：{summary.count}回</span></div>
      </div>)}
    </div>}
  </Section>;
}

function DoneFilterPanel({ searchQuery, setSearchQuery, filters, setFilters }: SearchProps & { filters: Record<string, FilterValue>; setFilters: (filters: Record<string, FilterValue>) => void }) {
  const filterItems = [
    { label: "カテゴリ", keyName: "doneCategory", value: filters.doneCategory ?? "すべて", options: ACTIVE_TASK_CATEGORIES },
    { label: "種類", keyName: "doneType", value: filters.doneType ?? "すべて", options: TASK_TYPES },
  ];
  return <div className="done-filter-panel">
    <label className="compact-search-row"><span>検索</span><input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="タスクを検索" /></label>
    <div className="done-filter-grid">
      {filterItems.map((filter) => <Select key={filter.keyName} label={filter.label} value={filter.value} options={["すべて", ...filter.options]} onChange={(value) => setFilters({ ...filters, [filter.keyName]: value })} />)}
    </div>
  </div>;
}

function DoneGroupList({ items, saveTask, copyTask, saveCompletionRecord, undoComplete, registerFrequentTask, requestDelete }: { items: DoneDisplayItem[]; saveTask: (task: Task, draft: TaskDraft) => void; copyTask: (draft: TaskDraft) => boolean; saveCompletionRecord: (task: Task, record: CompletionRecordDraft) => void; undoComplete: (task: Task) => void; registerFrequentTask: (task: Task) => void; requestDelete: (task: Task) => void }) {
  return <div className="task-grid">{items.map((item) => item.kind === "task" ? <TaskCard key={item.id} task={item.task} saveTask={saveTask} copyTask={copyTask} saveCompletionRecord={saveCompletionRecord} actions={<><Action onClick={() => undoComplete(item.task)}>完了を取り消す</Action><Action subtle onClick={() => registerFrequentTask(item.task)}>よく使う</Action><Action subtle onClick={() => requestDelete(item.task)}>削除</Action></>} /> : <RecurringCompletionCard key={item.id} completion={item.completion} />)}</div>;
}

function RecurringCompletionCard({ completion }: { completion: RecurringCompletion }) {
  return <article className="task-card recurring-card">
    <div className="chips"><span>繰り返し</span><span>{completion.categorySnapshot}</span><span>{completion.kindSnapshot}</span></div>
    <h3>{completion.titleSnapshot}</h3>
    <div className="task-meta"><span>対象日：{completion.targetDate}</span><span>完了：{completion.completedAt.slice(0, 10)}</span></div>
  </article>;
}

function RecurringTodayList({ items, completeRecurringTask }: { items: VisibleRecurringTask[]; completeRecurringTask: (item: VisibleRecurringTask) => void }) {
  if (items.length === 0) return <p className="empty-text">表示期間内の繰り返しタスクはありません。</p>;
  return <div className="task-grid">{items.map((item) => <article className="task-card recurring-card" key={`${item.task.id}-${item.targetDate}`}>
    <div className="chips"><span>繰り返し</span><span>{item.task.category}</span><span>{item.task.kind}</span></div>
    <h3>{item.task.title}</h3>
    <div className="task-meta"><span>{recurringInfo(item.task)}</span><span>対象日：{item.targetDate}</span></div>
    {item.task.memo && <p className="task-memo">{item.task.memo}</p>}
    <div className="button-row"><button className="primary-button" type="button" onClick={() => completeRecurringTask(item)}>今回分を完了</button></div>
  </article>)}</div>;
}

function RecurringCompletionList({ completions }: { completions: RecurringCompletion[] }) {
  if (completions.length === 0) return null;
  return <div className="task-grid">{completions.map((completion) => <article className="task-card recurring-card" key={completion.id}>
    <div className="chips"><span>繰り返し</span><span>{completion.categorySnapshot}</span><span>{completion.kindSnapshot}</span></div>
    <h3>{completion.titleSnapshot}</h3>
    <div className="task-meta"><span>対象日：{completion.targetDate}</span><span>完了：{completion.completedAt.slice(0, 10)}</span></div>
  </article>)}</div>;
}

function RecurringTaskManager({ tasks, addRecurringTask, saveRecurringTask, setRecurringActive, requestRecurringDelete }: { tasks: RecurringTask[]; addRecurringTask: (draft: RecurringDraft) => boolean; saveRecurringTask: (task: RecurringTask, draft: RecurringDraft) => void; setRecurringActive: (task: RecurringTask, isActive: boolean) => void; requestRecurringDelete: (task: RecurringTask) => void }) {
  const sortedTasks = [...tasks].sort(byRecurringManageOrder);
  return <div className="recurring-manager">
    <div className="manager-block">
      <h3>繰り返しを追加</h3>
      <RecurringTaskForm initial={newRecurringDraft()} submitLabel="追加する" onSubmit={addRecurringTask} />
    </div>
    <div className="task-grid">
      {sortedTasks.length === 0 ? <p className="empty-text">繰り返しタスクはまだありません。</p> : sortedTasks.map((task) => <RecurringManageCard key={task.id} task={task} saveRecurringTask={saveRecurringTask} setRecurringActive={setRecurringActive} requestRecurringDelete={requestRecurringDelete} />)}
    </div>
  </div>;
}

function RecurringManageCard({ task, saveRecurringTask, setRecurringActive, requestRecurringDelete }: { task: RecurringTask; saveRecurringTask: (task: RecurringTask, draft: RecurringDraft) => void; setRecurringActive: (task: RecurringTask, isActive: boolean) => void; requestRecurringDelete: (task: RecurringTask) => void }) {
  const [editing, setEditing] = useState(false);
  return <article className="task-card recurring-card">
    <div className="chips"><span>{task.isActive ? "有効" : "停止中"}</span><span>{task.category}</span><span>{task.kind}</span></div>
    <h3>{task.title}</h3>
    <div className="task-meta"><span>{recurringInfo(task)}</span><span>{repeatTypeLabel(task.repeatType)}</span></div>
    {task.memo && <p className="task-memo">{task.memo}</p>}
    <div className="button-row">
      {task.isActive ? <Action onClick={() => setRecurringActive(task, false)}>停止</Action> : <Action onClick={() => setRecurringActive(task, true)}>再開</Action>}
      <Action onClick={() => setEditing((current) => !current)}>編集</Action>
      <Action subtle onClick={() => requestRecurringDelete(task)}>削除</Action>
    </div>
    {editing && <RecurringTaskForm initial={draftFromRecurringTask(task)} submitLabel="保存する" onSubmit={(draft) => { saveRecurringTask(task, draft); setEditing(false); return true; }} onCancel={() => setEditing(false)} />}
  </article>;
}

function RecurringTaskForm({ initial, submitLabel, onSubmit, onCancel }: { initial: RecurringDraft; submitLabel: string; onSubmit: (draft: RecurringDraft) => boolean; onCancel?: () => void }) {
  const [draft, setDraft] = useState<RecurringDraft>(initial);
  const [error, setError] = useState("");
  function setField<K extends keyof RecurringDraft>(key: K, value: RecurringDraft[K]) { setDraft((current) => ({ ...current, [key]: value })); }
  function validate() {
    if (!draft.title.trim()) return "タイトルを入力してください。";
    if (!draft.category) return "カテゴリを選んでください。";
    if (!draft.kind) return "種類を選んでください。";
    if (!draft.repeatType) return "繰り返し種別を選んでください。";
    if (draft.repeatType === "weekly" && draft.weekday === "") return "曜日を選んでください。";
    if (draft.repeatType === "monthly" && draft.monthDay === "") return "日付を選んでください。";
    return "";
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    const message = validate();
    if (message) { setError(message); return; }
    if (onSubmit(draft)) {
      setDraft(newRecurringDraft());
      setError("");
    }
  }
  return <form className="task-form recurring-form" onSubmit={submit}>
    <label>タイトル<input value={draft.title} onChange={(event) => setField("title", event.target.value)} placeholder="毎週のアニメ、月次振り返りなど" /></label>
    <div className="recurring-detail-grid">
      <Select label="カテゴリ" value={draft.category} options={ACTIVE_TASK_CATEGORIES} onChange={(value) => setField("category", value as ActiveTaskCategory)} />
      <Select label="種類" value={draft.kind} options={RECURRING_KINDS} onChange={(value) => setField("kind", value as RecurringKind)} />
      <label>繰り返し種別<select value={draft.repeatType} onChange={(event) => setField("repeatType", event.target.value as RepeatType)}>
        <option value="weekly">毎週</option>
        <option value="monthly">毎月</option>
      </select></label>
      {draft.repeatType === "weekly" ? <label>曜日<select value={draft.weekday} onChange={(event) => setField("weekday", event.target.value)}>
        {WEEKDAYS.map((weekday, index) => <option key={weekday} value={index}>{weekday}</option>)}
      </select></label> : <label>日付<select value={draft.monthDay} onChange={(event) => setField("monthDay", event.target.value)}>
        {Array.from({ length: 31 }, (_, index) => String(index + 1)).map((day) => <option key={day} value={day}>{day}日</option>)}
      </select></label>}
      <label className="check-label recurring-active-field"><input type="checkbox" checked={draft.isActive} onChange={(event) => setField("isActive", event.target.checked)} />有効</label>
    </div>
    <label>メモ<textarea value={draft.memo} onChange={(event) => setField("memo", event.target.value)} rows={3} /></label>
    {error && <p className="form-error">{error}</p>}
    <div className="button-row"><button className="primary-button" type="submit">{submitLabel}</button>{onCancel && <button type="button" onClick={onCancel}>キャンセル</button>}</div>
  </form>;
}

function FrequentTaskManager({ tasks, addTaskFromFrequentTask, saveFrequentTask, requestFrequentDelete }: { tasks: FrequentTask[]; addTaskFromFrequentTask: (task: FrequentTask) => void; saveFrequentTask: (task: FrequentTask, draft: FrequentTaskDraft) => boolean; requestFrequentDelete: (task: FrequentTask) => void }) {
  const sortedTasks = [...tasks].sort(byFrequentTaskManageOrder);
  return <div className="recurring-manager">
    <div className="task-grid">
      {sortedTasks.length === 0 ? <p className="empty-text">よく使うタスクはまだありません。通常タスクの「よく使う」から登録できます。</p> : sortedTasks.map((task) => <FrequentTaskCard key={task.id} task={task} addTaskFromFrequentTask={addTaskFromFrequentTask} saveFrequentTask={saveFrequentTask} requestFrequentDelete={requestFrequentDelete} />)}
    </div>
  </div>;
}

function FrequentTaskCard({ task, addTaskFromFrequentTask, saveFrequentTask, requestFrequentDelete }: { task: FrequentTask; addTaskFromFrequentTask: (task: FrequentTask) => void; saveFrequentTask: (task: FrequentTask, draft: FrequentTaskDraft) => boolean; requestFrequentDelete: (task: FrequentTask) => void }) {
  const [editing, setEditing] = useState(false);
  return <article className="task-card frequent-card">
    {editing ? <FrequentTaskForm initial={draftFromFrequentTask(task)} submitLabel="保存する" onSubmit={(draft) => { const saved = saveFrequentTask(task, draft); if (saved) setEditing(false); return saved; }} onCancel={() => setEditing(false)} /> : <>
      <div className="chips"><span>{task.type}</span><span>{task.category}</span><span>{task.place}</span></div>
      <h3>{task.title}</h3>
      {task.memo && <p className="task-memo">{task.memo}</p>}
      <div className="button-row">
        <button className="primary-button" type="button" onClick={() => addTaskFromFrequentTask(task)}>今日やるに追加</button>
        <Action onClick={() => setEditing(true)}>編集</Action>
        <Action subtle onClick={() => requestFrequentDelete(task)}>削除</Action>
      </div>
    </>}
  </article>;
}

function FrequentTaskForm({ initial, submitLabel, onSubmit, onCancel }: { initial: FrequentTaskDraft; submitLabel: string; onSubmit: (draft: FrequentTaskDraft) => boolean; onCancel?: () => void }) {
  const [draft, setDraft] = useState<FrequentTaskDraft>(initial);
  const [error, setError] = useState("");
  function setField<K extends keyof FrequentTaskDraft>(key: K, value: FrequentTaskDraft[K]) { setDraft((current) => ({ ...current, [key]: value })); }
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!draft.title.trim()) { setError("タイトルを入力してください。"); return; }
    if (onSubmit(draft)) setError("");
  }
  return <form className="task-form frequent-form" onSubmit={submit}>
    <label>タイトル<input value={draft.title} onChange={(event) => setField("title", event.target.value)} placeholder="よく使うタスク名" /></label>
    <div className="form-grid">
      <Select label="種類" value={draft.type} options={TASK_TYPES} onChange={(value) => setField("type", value as TaskType)} />
      <CategorySelect value={draft.category} onChange={(value) => setField("category", value)} />
      <Select label="作業場所" value={draft.place} options={TASK_PLACES} onChange={(value) => setField("place", value as TaskPlace)} />
    </div>
    <label>メモ<textarea value={draft.memo} onChange={(event) => setField("memo", event.target.value)} rows={3} /></label>
    {error && <p className="form-error">{error}</p>}
    <div className="button-row"><button className="primary-button" type="submit">{submitLabel}</button>{onCancel && <button type="button" onClick={onCancel}>キャンセル</button>}</div>
  </form>;
}

function SettingsView({ data, updateDayBoundaryTime, exportJson, parseImport, parseAppendImport, fileInputRef, appendFileInputRef, importError, addTaskFromFrequentTask, saveFrequentTask, requestFrequentDelete, addRecurringTask, saveRecurringTask, setRecurringActive, requestRecurringDelete }: { data: AppData; updateDayBoundaryTime: (dayBoundaryTime: string) => void; exportJson: () => void; parseImport: (event: ChangeEvent<HTMLInputElement>) => void; parseAppendImport: (event: ChangeEvent<HTMLInputElement>) => void; fileInputRef: React.MutableRefObject<HTMLInputElement | null>; appendFileInputRef: React.MutableRefObject<HTMLInputElement | null>; importError: string; addTaskFromFrequentTask: (task: FrequentTask) => void; saveFrequentTask: (task: FrequentTask, draft: FrequentTaskDraft) => boolean; requestFrequentDelete: (task: FrequentTask) => void; addRecurringTask: (draft: RecurringDraft) => boolean; saveRecurringTask: (task: RecurringTask, draft: RecurringDraft) => void; setRecurringActive: (task: RecurringTask, isActive: boolean) => void; requestRecurringDelete: (task: RecurringTask) => void }) {
  const [recurringOpen, setRecurringOpen] = useState(false);
  const [frequentOpen, setFrequentOpen] = useState(false);
  return <div className="view-stack">
    <Section title="生活日付設定" description="夜型でも、寝るまでを同じ日として完了ログに残すための設定です。">
      <div className="settings-field">
        <Select label="日付切り替え時刻" value={data.settings.dayBoundaryTime} options={DAY_BOUNDARY_OPTIONS} onChange={updateDayBoundaryTime} />
      </div>
    </Section>
    <CollapsibleSection title="よく使うタスク管理" count={data.frequentTasks.length} description="必要なときに今日やるへ呼び出せる、通常タスク作成用のテンプレートです。" isOpen={frequentOpen} onToggle={() => setFrequentOpen((current) => !current)}>
      <FrequentTaskManager tasks={data.frequentTasks} addTaskFromFrequentTask={addTaskFromFrequentTask} saveFrequentTask={saveFrequentTask} requestFrequentDelete={requestFrequentDelete} />
    </CollapsibleSection>
    <CollapsibleSection title="繰り返しタスク管理" count={data.recurringTasks.length} description="毎週・毎月の予定や楽しみを、必要な期間だけ今日画面に出すための固定メニューです。" isOpen={recurringOpen} onToggle={() => setRecurringOpen((current) => !current)}>
      <RecurringTaskManager tasks={data.recurringTasks} addRecurringTask={addRecurringTask} saveRecurringTask={saveRecurringTask} setRecurringActive={setRecurringActive} requestRecurringDelete={requestRecurringDelete} />
    </CollapsibleSection>
    <Section title="固定リスト" description="現在の新規作成・編集で使うカテゴリです。既存タスクに過去のカテゴリが残っていても、表示は維持されます。"><div className="fixed-grid"><FixedList title="種類" items={TASK_TYPES} /><FixedList title="状態" items={TASK_STATUSES} /><FixedList title="カテゴリ" items={ACTIVE_TASK_CATEGORIES} /><FixedList title="作業場所" items={TASK_PLACES} /></div></Section>
    <Section title="データ管理" description="バックアップ、別端末への移動、不具合時の復元に使います。">
      <p className="small-note">実運用前や大きく整理する前は、JSONエクスポートでバックアップを残しておくと安心です。</p>
      <div className="data-actions">
        <div className="data-action-block">
          <button className="primary-button" onClick={exportJson}>JSONエクスポート</button>
          <p className="small-note">現在のデータ全体をバックアップします。</p>
        </div>
        <div className="data-action-block">
          <button onClick={() => appendFileInputRef.current?.click()}>JSONを追加インポート</button>
          <p className="small-note">既存データを残して、JSON内の新しいデータだけ追加します。普段はこちらを使います。</p>
        </div>
        <div className="data-action-block danger-import-block">
          <button className="danger-button" onClick={() => fileInputRef.current?.click()}>JSONで全上書き</button>
          <p className="small-note">現在のデータを選択したJSONの内容で置き換えます。復元用です。実行前に必ずJSONエクスポートでバックアップしてください。</p>
        </div>
      </div>
      <input ref={appendFileInputRef} type="file" accept="application/json,.json" hidden onChange={parseAppendImport} />
      <input ref={fileInputRef} type="file" accept="application/json,.json" hidden onChange={parseImport} />
      {importError && <p className="form-error">{importError}</p>}
    </Section>
  </div>;
}

function Section({ title, description, children, className = "" }: { title: string; description?: string; children?: React.ReactNode; className?: string }) {
  return <section className={`section ${className}`.trim()}><div className="section-head"><h2>{title}</h2>{description && <p>{description}</p>}</div>{children}</section>;
}

function CollapsibleSection({ title, count, description, children, className = "", isOpen, onToggle }: { title: string; count: number; description?: string; children: React.ReactNode; className?: string; isOpen: boolean; onToggle: () => void }) {
  return <section className={`section collapsible-section ${className}`.trim()}>
    <button className="collapse-trigger" type="button" onClick={onToggle} aria-expanded={isOpen}>
      <span className="collapse-title"><span aria-hidden="true">{isOpen ? "▼" : "▶"}</span>{title}<span className="collapse-count">{count}件</span></span>
    </button>
    {isOpen && <div className="collapsible-body">{description && <p className="collapse-description">{description}</p>}{children}</div>}
  </section>;
}

function SearchBox({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <label className="search-box">検索<input value={value} onChange={(event) => onChange(event.target.value)} placeholder="タスクを検索" /></label>;
}

function TaskList({ tasks, empty, actions, saveTask, copyTask, saveCompletionRecord }: { tasks: Task[]; empty: string; actions: (task: Task) => React.ReactNode | TaskCardActions; saveTask: (task: Task, draft: TaskDraft) => void; copyTask: (draft: TaskDraft) => boolean; saveCompletionRecord: (task: Task, record: CompletionRecordDraft) => void }) {
  if (tasks.length === 0) return <p className="empty-text">{empty}</p>;
  return <div className="task-grid">{tasks.map((task) => <TaskCard key={task.id} task={task} saveTask={saveTask} copyTask={copyTask} saveCompletionRecord={saveCompletionRecord} actions={actions(task)} />)}</div>;
}

function TaskCard({ task, actions, saveTask, copyTask, saveCompletionRecord }: { task: Task; actions: React.ReactNode | TaskCardActions; saveTask: (task: Task, draft: TaskDraft) => void; copyTask: (draft: TaskDraft) => boolean; saveCompletionRecord: (task: Task, record: CompletionRecordDraft) => void }) {
  const [editing, setEditing] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [editingCompletion, setEditingCompletion] = useState(false);
  const actionConfig = isTaskCardActions(actions) ? actions : null;
  return <article className={`task-card ${isHighPriority(task) ? "priority-high-card" : ""}`.trim()}>
    {editing ? <TaskForm initial={draftFromTask(task)} submitLabel="保存" onSubmit={(draft) => { if (!draft.title.trim()) return false; saveTask(task, draft); setEditing(false); return true; }} onCopyDraft={copyTask} onCancel={() => setEditing(false)} allowDone completedAt={task.completedAt} collapseDetails /> : <>
      <div className="chips"><span>{task.type}</span><span>{task.category}</span><span>{task.status}</span>{isHighPriority(task) && <span className="priority-chip">優先度：高</span>}</div>
      <h3>{task.title}</h3>
      <div className="task-meta">{task.dueDate && <span>期限：{task.dueDate}（{dueLabel(task.dueDate)}）</span>}<span>場所：{task.place}</span></div>
      {task.memo && <p className="task-memo">{task.memo}</p>}
      {task.completedAt && <CompletionMeta task={task} />}
      {editingCompletion && <CompletionRecordForm
        initialTime={completedTimeLabel(task.completedAt) || timeKeyFromDate(new Date())}
        initialDuration={task.durationMinutes ?? null}
        submitLabel="完了記録を保存"
        onSubmit={(record) => { saveCompletionRecord(task, record); setEditingCompletion(false); }}
        onCancel={() => setEditingCompletion(false)}
      />}
      {actionConfig ? <div className="task-card-actions">
        <div className="button-row primary-actions">{actionConfig.primary}<Action onClick={() => setEditing(true)}>編集</Action>{task.completedAt && <Action onClick={() => setEditingCompletion((current) => !current)}>完了記録を編集</Action>}</div>
        {actionConfig.secondary && <button className="more-actions-toggle" type="button" onClick={() => setMoreOpen((current) => !current)} aria-expanded={moreOpen}>{moreOpen ? "その他を閉じる" : "その他を開く"}</button>}
        {moreOpen && actionConfig.secondary && <div className="button-row secondary-actions">{actionConfig.secondary}</div>}
      </div> : <div className="button-row">{actions as React.ReactNode}<Action onClick={() => setEditing(true)}>編集</Action>{task.completedAt && <Action onClick={() => setEditingCompletion((current) => !current)}>完了記録を編集</Action>}</div>}
    </>}
  </article>;
}

function CompletionMeta({ task }: { task: Task }) {
  const duration = formatDuration(task.durationMinutes);
  return <div className="completion-meta">
    <span>完了時刻：{completedTimeLabel(task.completedAt)}</span>
    {duration && <span>作業時間：{duration}</span>}
  </div>;
}

function CompleteTaskAction({ task, completeTask }: { task: Task; completeTask: (task: Task, record: CompletionRecordDraft) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  return <div className="completion-action">
    {!isOpen ? <Action onClick={() => setIsOpen(true)}>完了</Action> : <CompletionRecordForm
      initialTime={timeKeyFromDate(new Date())}
      initialDuration={null}
      submitLabel="この内容で完了"
      onSubmit={(record) => { completeTask(task, record); setIsOpen(false); }}
      onCancel={() => setIsOpen(false)}
    />}
  </div>;
}

function CompletionRecordForm({ initialTime, initialDuration, submitLabel, onSubmit, onCancel }: { initialTime: string; initialDuration: number | null; submitLabel: string; onSubmit: (record: CompletionRecordDraft) => void; onCancel: () => void }) {
  const [completedTime, setCompletedTime] = useState(initialTime);
  const [durationValue, setDurationValue] = useState(initialDuration === null ? "" : String(initialDuration));
  function submit(event: FormEvent) {
    event.preventDefault();
    onSubmit({ completedTime, durationMinutes: durationValue === "" ? null : Number(durationValue) });
  }
  return <form className="completion-form" onSubmit={submit}>
    <h3>完了記録</h3>
    <div className="completion-form-grid">
      <label>完了時刻<input type="time" value={completedTime} onChange={(event) => setCompletedTime(event.target.value)} required /></label>
      <label>作業時間<select value={durationValue} onChange={(event) => setDurationValue(event.target.value)}>
        {DURATION_OPTIONS.map((option) => <option key={option.label} value={option.value ?? ""}>{option.label}</option>)}
      </select></label>
    </div>
    <div className="button-row"><button className="primary-button" type="submit">{submitLabel}</button><button type="button" onClick={onCancel}>キャンセル</button></div>
  </form>;
}

function TaskForm({ initial, submitLabel, onSubmit, onCopyDraft, onCancel, allowDone = false, completedAt, collapseDetails = false, frequentTasks }: { initial: TaskDraft; submitLabel: string; onSubmit: (draft: TaskDraft) => boolean; onCopyDraft?: (draft: TaskDraft) => boolean; onCancel?: () => void; allowDone?: boolean; completedAt?: string | null; collapseDetails?: boolean; frequentTasks?: FrequentTask[] }) {
  const [draft, setDraft] = useState<TaskDraft>(initial);
  const [error, setError] = useState("");
  const [detailsOpen, setDetailsOpen] = useState(!collapseDetails);
  const [frequentCopyOpen, setFrequentCopyOpen] = useState(false);
  const showFrequentCopyUi = false;
  function setField<K extends keyof TaskDraft>(key: K, value: TaskDraft[K]) { setDraft((current) => ({ ...current, [key]: value })); }
  function copyFromFrequentTask(task: FrequentTask) {
    setDraft((current) => ({
      ...current,
      title: task.title,
      memo: task.memo,
      type: task.type,
      status: "今日やる",
      category: task.category,
      place: task.place,
      timeSlot: "",
      dueDate: "",
    }));
    setError("");
    setFrequentCopyOpen(false);
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!draft.title.trim()) { setError("タイトルを入力してください。"); return; }
    if (onSubmit(draft)) setDraft({ ...initial, title: "", memo: "", dueDate: "", timeSlot: "" });
  }
  function copyDraft() {
    if (!draft.title.trim()) { setError("タイトルを入力してください。"); return; }
    if (onCopyDraft?.(draft)) setError("");
  }
  return <form className="task-form" onSubmit={submit}>
    {showFrequentCopyUi && frequentTasks && <div className="frequent-copy-panel">
      <button className="form-details-toggle" type="button" onClick={() => setFrequentCopyOpen((current) => !current)} aria-expanded={frequentCopyOpen}>{frequentCopyOpen ? "▼ よく使うを閉じる" : "▶ よく使うからコピー"}</button>
      {frequentCopyOpen && (frequentTasks.length === 0 ? <p className="empty-text">よく使うタスクはまだありません。</p> : <div className="frequent-copy-list">
        {[...frequentTasks].sort(byFrequentTaskManageOrder).map((task) => <button className="frequent-copy-item" key={task.id} type="button" onClick={() => copyFromFrequentTask(task)}>
          <span className="frequent-copy-title">{task.title}</span>
          <span className="frequent-copy-meta">{task.category} / {task.type} / {task.place}</span>
        </button>)}
      </div>)}
    </div>}
    <label>タイトル<input value={draft.title} onChange={(event) => setField("title", event.target.value)} placeholder="タイトルだけでも追加できます" /></label>
    {collapseDetails && <button className="form-details-toggle" type="button" onClick={() => setDetailsOpen((current) => !current)} aria-expanded={detailsOpen}>{detailsOpen ? "▼ 項目を閉じる" : "▶ 項目を開く"}</button>}
    {detailsOpen && <div className="task-create-detail-grid"><Select label="種類" value={draft.type} options={TASK_TYPES} onChange={(value) => setField("type", value as TaskType)} /><Select label="状態" value={draft.status} options={allowDone ? TASK_STATUSES : TASK_STATUSES.filter((status) => status !== "完了")} onChange={(value) => setField("status", value as TaskStatus)} /><CategorySelect value={draft.category} onChange={(value) => setField("category", value)} /><Select label="作業場所" value={draft.place} options={TASK_PLACES} onChange={(value) => setField("place", value as TaskPlace)} /><Select label="優先度" value={priorityDraftValue(draft.timeSlot)} options={PRIORITY_OPTIONS} emptyLabel="未入力" onChange={(value) => setField("timeSlot", value as TimeSlot)} /><label>期限<input type="date" value={draft.dueDate} onChange={(event) => setField("dueDate", event.target.value)} /></label></div>}
    {collapseDetails && detailsOpen && onCopyDraft && <button className="subtle-button" type="button" onClick={copyDraft}>コピーして新規登録</button>}
    <label>メモ<textarea value={draft.memo} onChange={(event) => setField("memo", event.target.value)} rows={3} /></label>
    {completedAt && <p className="small-note">完了日は自動設定です：{completedAt.slice(0, 10)}</p>}
    {error && <p className="form-error">{error}</p>}
    <div className="button-row"><button className="primary-button" type="submit">{submitLabel}</button>{onCancel && <button type="button" onClick={onCancel}>キャンセル</button>}</div>
  </form>;
}

function Select({ label, value, options, onChange, emptyLabel = "未設定" }: { label: string; value: string; options: readonly string[]; onChange: (value: string) => void; emptyLabel?: string }) {
  return <label>{label}<select value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option} value={option}>{option === "" ? emptyLabel : option}</option>)}</select></label>;
}

function CategorySelect({ value, onChange }: { value: TaskCategory; onChange: (value: TaskCategory) => void }) {
  const isActive = (ACTIVE_TASK_CATEGORIES as readonly TaskCategory[]).includes(value);
  return <label>カテゴリ<select value={isActive ? value : ""} onChange={(event) => onChange(event.target.value as TaskCategory)}>
    {!isActive && <option value="" disabled>過去カテゴリを維持</option>}
    {ACTIVE_TASK_CATEGORIES.map((option) => <option key={option} value={option}>{option}</option>)}
  </select>{!isActive && <span className="legacy-note">現在の保存カテゴリ：{value}</span>}</label>;
}

function FilterBar({ filters, current, setFilters }: { filters: { label: string; keyName: string; value: FilterValue; options: readonly string[] }[]; current: Record<string, FilterValue>; setFilters: (filters: Record<string, FilterValue>) => void }) {
  return <div className="filter-bar">{filters.map((filter) => <Select key={filter.keyName} label={filter.label} value={filter.value} options={["すべて", ...filter.options]} onChange={(value) => setFilters({ ...current, [filter.keyName]: value })} />)}</div>;
}

function MoveButtons({ task, moveTask, hide = [] }: { task: Task; moveTask: (task: Task, status: TaskStatus) => void; hide?: TaskStatus[] }) {
  return <>{(["今日やる", "近いうち", "いつかやる", "連絡待ち", "保留"] as TaskStatus[]).filter((status) => status !== task.status && !hide.includes(status)).map((status) => <Action key={status} onClick={() => moveTask(task, status)}>{status === "いつかやる" ? "いつかへ" : `${status}へ`}</Action>)}</>;
}

function Action({ children, onClick, subtle = false }: { children: React.ReactNode; onClick: () => void; subtle?: boolean }) {
  return <button className={subtle ? "subtle-button" : ""} type="button" onClick={onClick}>{children}</button>;
}

function FixedList({ title, items }: { title: string; items: readonly string[] }) {
  return <div><h3>{title}</h3><div className="chips">{items.map((item) => <span key={item}>{item}</span>)}</div></div>;
}

function ConfirmDialog({ title, body, confirmLabel, onConfirm, onCancel }: { title: string; body: string; confirmLabel: string; onConfirm: () => void; onCancel: () => void }) {
  return <div className="dialog-backdrop" role="presentation"><div className="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><h2 id="dialog-title">{title}</h2><p>{body}</p><div className="button-row"><button className="danger-button" onClick={onConfirm}>{confirmLabel}</button><button onClick={onCancel}>キャンセル</button></div></div></div>;
}

function AppendImportDialog({ preview, onConfirm, onCancel }: { preview: AppendImportPreview; onConfirm: () => void; onCancel: () => void }) {
  return <div className="dialog-backdrop" role="presentation"><div className="dialog append-import-dialog" role="dialog" aria-modal="true" aria-labelledby="append-import-title">
    <h2 id="append-import-title">JSONを追加インポート</h2>
    <p>既存データを残して、新しいデータだけ追加します。設定は現在のものを維持します。</p>
    <div className="import-preview-list">
      {preview.counts.map((count) => <div className="import-preview-item" key={count.label}>
        <h3>{count.label}</h3>
        <dl>
          <div><dt>読み込み</dt><dd>{count.loaded}件</dd></div>
          <div><dt>新規追加</dt><dd>{count.added}件</dd></div>
          <div><dt>重複スキップ</dt><dd>{count.skipped}件</dd></div>
        </dl>
      </div>)}
    </div>
    <div className="button-row"><button className="primary-button" onClick={onConfirm}>追加インポートする</button><button onClick={onCancel}>キャンセル</button></div>
  </div></div>;
}

export default App;

