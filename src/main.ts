import "./styles.css";

type GradeBand = { letter: string; minimum: number; points: number };
type Assessment = {
  id: string;
  name: string;
  details?: string;
  weight: number;
  earned: number | null;
  outOf: number;
  target: number;
};
type Course = {
  id: string;
  name: string;
  credits: number;
  assessments: Assessment[];
  gradeScale: GradeBand[];
};
type AppTheme = "dark" | "light" | "mono";
type GpaCourseEntry = {
  id: string;
  name: string;
  credits: number;
  grade: string;
};
type AppState = {
  courses: Course[];
  gpaEntries: GpaCourseEntry[];
  historyCredits: number;
  historyCgpa: number;
  gpaScaleMax: number;
  theme: AppTheme;
};
type CourseResult = {
  current: number | null;
  projection: number | null;
  grade: GradeBand | null;
  gradedWeight: number;
  totalWeight: number;
};

const STORAGE_KEY = "gradepath-planner-v1";
const DEFAULT_THEME: AppTheme = "dark";
const DEFAULT_SCALE: GradeBand[] = [
  { letter: "A", minimum: 90, points: 4.0 },
  { letter: "A-", minimum: 85, points: 3.7 },
  { letter: "B+", minimum: 80, points: 3.3 },
  { letter: "B", minimum: 75, points: 3.0 },
  { letter: "B-", minimum: 70, points: 2.7 },
  { letter: "C+", minimum: 65, points: 2.3 },
  { letter: "C", minimum: 60, points: 2.0 },
  { letter: "C-", minimum: 55, points: 1.7 },
  { letter: "D+", minimum: 50, points: 1.3 },
  { letter: "D", minimum: 45, points: 1.0 },
  { letter: "F", minimum: 0, points: 0 },
];
const app = document.querySelector<HTMLDivElement>("#app");

if (!app) throw new Error("The app root element could not be found.");

let page: "planner" | "calculator" | "settings" = "planner";
let selectedCourseId: string | null = null;
let notice = "";
let errorNotice = "";
let demoDismissed = false;
let state = loadState();

function uid(): string {
  return crypto.randomUUID();
}

function defaultAssessments(): Assessment[] {
  return [
    { id: uid(), name: "Class Tests", details: "Continuous assessment · CLO2 (PLO-c) · Analyze", weight: 5, earned: null, outOf: 100, target: 80 },
    { id: uid(), name: "Mid Test - 1", details: "Continuous assessment · CLO2 (PLO-c) · Analyze", weight: 10, earned: null, outOf: 100, target: 80 },
    { id: uid(), name: "Mid Test - 2", details: "Continuous assessment · CLO2 (PLO-c) · Analyze", weight: 10, earned: null, outOf: 100, target: 80 },
    { id: uid(), name: "Lab Assessment", details: "Progressive project · CLO3 (PLO-d) · Determine, apply, develop", weight: 15, earned: null, outOf: 100, target: 80 },
    { id: uid(), name: "Project", details: "Mini project · CLO4 (PLO-e) · Determine, apply, develop", weight: 15, earned: null, outOf: 100, target: 80 },
    { id: uid(), name: "Mid Term Examination", details: "Summative assessment · CLO1 (PLO-a) · Analyze, determine, apply, develop", weight: 20, earned: null, outOf: 100, target: 80 },
    { id: uid(), name: "Final Term Examination", details: "Summative assessment · CLO1 (PLO-a) · Analyze, determine, apply, develop", weight: 25, earned: null, outOf: 100, target: 80 },
  ];
}

function starterState(): AppState {
  return {
    historyCredits: 0,
    historyCgpa: 0,
    gpaScaleMax: 4,
    theme: DEFAULT_THEME,
    gpaEntries: [],
    courses: [
      {
        id: uid(),
        name: "Faculty template course",
        credits: 3,
        gradeScale: structuredClone(DEFAULT_SCALE),
        assessments: defaultAssessments(),
      },
    ],
  };
}

function isValidState(value: unknown): value is AppState {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<AppState>;
  return (
    Array.isArray(candidate.courses) &&
    (candidate.gpaEntries === undefined ||
      (Array.isArray(candidate.gpaEntries) &&
        candidate.gpaEntries.every((entry) =>
          entry &&
          typeof entry.id === "string" &&
          typeof entry.name === "string" &&
          typeof entry.credits === "number" &&
          typeof entry.grade === "string",
        ))) &&
    typeof candidate.historyCredits === "number" &&
    typeof candidate.historyCgpa === "number" &&
    typeof candidate.gpaScaleMax === "number" &&
    (candidate.theme === undefined ||
      candidate.theme === "dark" ||
      candidate.theme === "light" ||
      candidate.theme === "mono")
  );
}

function loadState(): AppState {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return starterState();
  try {
    const parsed: unknown = JSON.parse(saved);
    if (!isValidState(parsed)) throw new Error("The saved planner data has an invalid format.");
    return {
      ...parsed,
      theme: parsed.theme ?? DEFAULT_THEME,
      gpaEntries: parsed.gpaEntries ?? [],
    };
  } catch (error) {
    errorNotice = `Saved planner data could not be loaded: ${error instanceof Error ? error.message : "unknown error"}. An empty workspace is shown; the saved data has not been changed.`;
    return { courses: [], gpaEntries: [], historyCredits: 0, historyCgpa: 0, gpaScaleMax: 4, theme: DEFAULT_THEME };
  }
}

function saveState(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    errorNotice = "";
  } catch (error) {
    errorNotice = `Your changes are only in this tab because browser storage failed: ${error instanceof Error ? error.message : "unknown error"}.`;
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[char] ?? char;
  });
}

function formatNumber(value: number | null, digits = 1): string {
  return value === null || !Number.isFinite(value) ? "—" : value.toFixed(digits);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function assessmentPercent(assessment: Assessment): number | null {
  if (assessment.earned === null || assessment.outOf <= 0) return null;
  return clamp((assessment.earned / assessment.outOf) * 100, 0, 100);
}

function getCourseResult(course: Course): CourseResult {
  const totalWeight = course.assessments.reduce(
    (total, assessment) => total + Math.max(0, assessment.weight),
    0,
  );
  const graded = course.assessments.filter((assessment) => assessmentPercent(assessment) !== null);
  const gradedWeight = graded.reduce((total, assessment) => total + Math.max(0, assessment.weight), 0);
  const current =
    gradedWeight > 0
      ? graded.reduce((total, assessment) => total + (assessmentPercent(assessment) ?? 0) * assessment.weight, 0) /
        gradedWeight
      : null;
  const projection =
    totalWeight > 0
      ? course.assessments.reduce(
          (total, assessment) =>
            total + (assessmentPercent(assessment) ?? clamp(assessment.target, 0, 100)) * assessment.weight,
          0,
        ) / totalWeight
      : null;
  return {
    current,
    projection,
    grade: projection === null ? null : gradeFor(projection, course.gradeScale),
    gradedWeight,
    totalWeight,
  };
}

function gradeFor(mark: number, scale: GradeBand[]): GradeBand | null {
  return (
    [...scale]
      .sort((a, b) => b.minimum - a.minimum)
      .find((band) => mark >= band.minimum) ?? null
  );
}

function weightedCourseGpa(courses: Course[]): { gpa: number | null; credits: number; qualityPoints: number } {
  let credits = 0;
  let qualityPoints = 0;
  for (const course of courses) {
    const result = getCourseResult(course);
    if (result.grade && course.credits > 0) {
      credits += course.credits;
      qualityPoints += result.grade.points * course.credits;
    }
  }
  return { gpa: credits > 0 ? qualityPoints / credits : null, credits, qualityPoints };
}

function projectedCgpa(): number | null {
  const term = weightedCourseGpa(state.courses);
  const credits = state.historyCredits + term.credits;
  if (!credits) return null;
  return (state.historyCgpa * state.historyCredits + term.qualityPoints) / credits;
}

function getGpaEntryResult(): { gpa: number | null; credits: number; qualityPoints: number } {
  let credits = 0;
  let qualityPoints = 0;
  for (const entry of state.gpaEntries) {
    const grade = DEFAULT_SCALE.find((band) => band.letter === entry.grade);
    if (!grade || entry.credits <= 0) continue;
    credits += entry.credits;
    qualityPoints += (grade.points * state.gpaScaleMax / 4) * entry.credits;
  }
  return { gpa: credits > 0 ? qualityPoints / credits : null, credits, qualityPoints };
}

function getEntryProjectedCgpa(): number | null {
  const entries = getGpaEntryResult();
  const credits = state.historyCredits + entries.credits;
  if (!credits) return null;
  return (state.historyCgpa * state.historyCredits + entries.qualityPoints) / credits;
}

function renderGpaEntries(): string {
  if (!state.gpaEntries.length) {
    return `<div class="calculator-empty"><span class="empty-icon">◈</span><strong>No course grades yet</strong><span>Add a course below, then choose its grade and credit hours.</span></div>`;
  }
  return state.gpaEntries.map((entry, index) => `
    <div class="gpa-entry-row">
      <span class="gpa-entry-index">${String(index + 1).padStart(2, "0")}</span>
      <label class="gpa-entry-name">
        <span class="sr-only">Course name</span>
        <input data-key="gpa-name-${entry.id}" data-field="gpa-name" data-entry="${entry.id}" value="${escapeHtml(entry.name)}" aria-label="Course name" placeholder="Course name" />
      </label>
      <label class="gpa-entry-credits">
        <span class="gpa-field-label">CREDITS</span>
        <input data-key="gpa-credits-${entry.id}" data-field="gpa-credits" data-entry="${entry.id}" type="number" min="0" step="0.5" value="${entry.credits}" aria-label="Course credit hours" />
      </label>
      <label class="gpa-entry-grade">
        <span class="gpa-field-label">GRADE</span>
        <select data-key="gpa-grade-${entry.id}" data-field="gpa-grade" data-entry="${entry.id}" aria-label="Course letter grade">
          <option value="" ${entry.grade ? "" : "selected"}>Select</option>
          ${DEFAULT_SCALE.map((band) => `<option value="${band.letter}" ${entry.grade === band.letter ? "selected" : ""}>${band.letter}</option>`).join("")}
        </select>
      </label>
      <span class="gpa-entry-points">${entry.grade ? formatNumber((DEFAULT_SCALE.find((band) => band.letter === entry.grade)?.points ?? 0) * state.gpaScaleMax / 4, 2) : "—"}<small> pts</small></span>
      <button class="icon-button" type="button" data-action="remove-gpa-entry" data-entry="${entry.id}" aria-label="Remove ${escapeHtml(entry.name || "course")}">×</button>
    </div>`).join("");
}

function renderGpaCalculator(): string {
  const term = getGpaEntryResult();
  const cgpa = getEntryProjectedCgpa();
  const gradesFilled = state.gpaEntries.filter((entry) => entry.grade && entry.credits > 0).length;
  return `
    <div class="page-heading">
      <div>
        <div class="eyebrow">QUICK GPA CALCULATOR</div>
        <h1 title="Calculate GPA directly from course letter grades and credit hours.">Grade-to-GPA calculator</h1>
        <p>Enter your course grades and credits to calculate GPA without assessment details.</p>
      </div>
    </div>
    <div class="gpa-results-grid">
      <article class="gpa-result-card"><span class="gpa-result-icon">◈</span><div><span>Calculated GPA</span><strong>${formatNumber(term.gpa, 2)}<small> / ${state.gpaScaleMax.toFixed(2)}</small></strong><small>${formatNumber(term.credits, 1)} graded credits</small></div></article>
      <article class="gpa-result-card gpa-result-highlight"><span class="gpa-result-icon">◎</span><div><span>Projected CGPA</span><strong>${formatNumber(cgpa, 2)}<small> / ${state.gpaScaleMax.toFixed(2)}</small></strong><small>${formatNumber(state.historyCredits + term.credits, 1)} total credits, including academic history</small></div></article>
    </div>
    <section class="gpa-calculator-card">
      <div class="gpa-calculator-heading">
        <div><h2 title="Add one row for each course. GPA updates automatically as you edit grades and credit hours.">Course grades</h2><p>GPA is weighted by credit hours and updates as you enter grades.</p></div>
        <span class="gpa-course-count">${gradesFilled} graded</span>
      </div>
      <div class="gpa-entry-table">
        <div class="gpa-entry-header"><span>#</span><span>COURSE</span><span>CREDITS</span><span>LETTER GRADE</span><span>POINTS</span><span></span></div>
        ${renderGpaEntries()}
      </div>
      <button class="button button-add" type="button" data-action="add-gpa-entry" title="Add a course and enter its credit hours and letter grade.">＋ Add course grade</button>
      <div class="gpa-calculator-note"><span>✦</span><p>Grade points use the standard faculty mapping (A = 4.0, A- = 3.7, and so on), scaled to your GPA maximum. Previous CGPA and completed credits from <button type="button" class="inline-link" data-action="go-settings">Academic settings</button> are included in projected CGPA.</p></div>
    </section>`;
}

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join("") || "C";
}

function renderCourseList(): string {
  if (!state.courses.length) {
    return `<div class="empty-state"><span class="empty-icon">＋</span><strong>No courses yet</strong><span>Add a course to start your grade projection.</span></div>`;
  }
  return state.courses
    .map((course, index) => {
      const result = getCourseResult(course);
      const active = course.id === selectedCourseId;
      return `
        <button class="course-card ${active ? "is-selected" : ""}" type="button" data-action="select-course" data-course="${course.id}">
          <span class="course-avatar avatar-${index % 4}">${escapeHtml(initials(course.name))}</span>
          <span class="course-card-copy">
            <span class="course-name">${escapeHtml(course.name || "Untitled course")}</span>
            <span class="course-meta">${course.credits} credits · ${course.assessments.length} assessments</span>
          </span>
          <span class="course-card-grade">
            <strong>${formatNumber(result.projection, 1)}%</strong>
            <span>${escapeHtml(result.grade?.letter ?? "—")}</span>
          </span>
        </button>`;
    })
    .join("");
}

function renderAssessments(course: Course): string {
  if (!course.assessments.length) {
    return `<div class="assessment-empty">Add an assessment to start estimating this course.</div>`;
  }
  return course.assessments
    .map((assessment) => {
      const score = assessmentPercent(assessment);
      return `
        <div class="assessment-row">
          <label class="assessment-name">
            <span class="sr-only">Assessment name</span>
            <input data-key="assessment-name-${assessment.id}" data-field="assessment-name" data-assessment="${assessment.id}" data-course="${course.id}" value="${escapeHtml(assessment.name)}" aria-label="Assessment name" />
            <input class="assessment-details-input" data-key="assessment-details-${assessment.id}" data-field="assessment-details" data-assessment="${assessment.id}" data-course="${course.id}" value="${escapeHtml(assessment.details ?? "")}" placeholder="CLO / notes" aria-label="Assessment outcomes or notes" />
          </label>
          <label class="number-cell weight-cell">
            <span class="sr-only">Weight percent</span>
            <input data-key="weight-${assessment.id}" data-field="weight" data-assessment="${assessment.id}" data-course="${course.id}" type="number" min="0" max="100" step="1" value="${assessment.weight}" aria-label="Weight percentage" />
            <span>%</span>
          </label>
          <label class="number-cell score-cell">
            <span class="sr-only">Mark earned</span>
            <input data-key="earned-${assessment.id}" data-field="earned" data-assessment="${assessment.id}" data-course="${course.id}" type="number" min="0" step="any" value="${assessment.earned ?? ""}" placeholder="—" aria-label="Mark earned" />
            <span>/</span>
            <input data-key="outof-${assessment.id}" data-field="outOf" data-assessment="${assessment.id}" data-course="${course.id}" type="number" min="0.01" step="any" value="${assessment.outOf}" aria-label="Marks possible" />
          </label>
          <label class="number-cell target-cell">
            <span class="sr-only">Expected score percent</span>
            <input data-key="target-${assessment.id}" data-field="target" data-assessment="${assessment.id}" data-course="${course.id}" type="number" min="0" max="100" step="1" value="${assessment.target}" aria-label="Expected score percentage" />
            <span>%</span>
          </label>
          <span class="score-pill ${score === null ? "score-pending" : ""}">${score === null ? "Pending" : `${formatNumber(score, 0)}%`}</span>
          <button class="icon-button remove-assessment" type="button" data-action="remove-assessment" data-course="${course.id}" data-assessment="${assessment.id}" aria-label="Remove ${escapeHtml(assessment.name)}">×</button>
        </div>`;
    })
    .join("");
}

function renderGradeScale(course: Course): string {
  if (!course.gradeScale.length) {
    return `<div class="assessment-empty">Add grade bands to calculate a letter grade and GPA points.</div>`;
  }
  return course.gradeScale
    .map(
      (band, index) => `
        <div class="scale-row">
          <label><span class="sr-only">Letter grade</span><input data-key="letter-${course.id}-${index}" data-field="letter" data-course="${course.id}" data-band="${index}" value="${escapeHtml(band.letter)}" aria-label="Letter grade" /></label>
          <label class="number-cell"><span class="sr-only">Minimum percentage</span><input data-key="minimum-${course.id}-${index}" data-field="minimum" data-course="${course.id}" data-band="${index}" type="number" min="0" max="100" step="1" value="${band.minimum}" aria-label="Minimum percentage" /><span>% min</span></label>
          <label class="number-cell"><span class="sr-only">GPA points</span><input data-key="points-${course.id}-${index}" data-field="points" data-course="${course.id}" data-band="${index}" type="number" min="0" max="${state.gpaScaleMax}" step="0.1" value="${band.points}" aria-label="GPA points" /><span>pts</span></label>
          <button class="icon-button" type="button" data-action="remove-band" data-course="${course.id}" data-band="${index}" aria-label="Remove ${escapeHtml(band.letter)} grade band">×</button>
        </div>`,
    )
    .join("");
}

function renderEditor(): string {
  const course = state.courses.find((item) => item.id === selectedCourseId) ?? state.courses[0];
  if (!course) {
    return `<section class="editor-panel empty-editor"><span class="empty-icon">◫</span><h2>Your course planner is ready</h2><p>Add a course to enter your assessment weights, marks, and grade scale.</p><button class="button button-primary" type="button" data-action="add-course">＋ Add a course</button></section>`;
  }
  const result = getCourseResult(course);
  const weightOff = Math.abs(result.totalWeight - 100) > 0.01;
  const completedPercent = result.totalWeight > 0 ? clamp((result.gradedWeight / result.totalWeight) * 100, 0, 100) : 0;
  return `
    <section class="editor-panel">
      <div class="editor-heading">
        <div>
          <div class="eyebrow">COURSE WORKSPACE</div>
          <label class="course-title-input">
            <span class="sr-only">Course name</span>
            <input data-key="course-name-${course.id}" data-field="course-name" data-course="${course.id}" value="${escapeHtml(course.name)}" placeholder="Course name" aria-label="Course name" />
          </label>
        </div>
        <button class="button button-quiet delete-course" type="button" data-action="remove-course" data-course="${course.id}">Remove course</button>
      </div>

      <div class="course-overview">
        <div class="overview-item"><span>Current standing</span><strong>${formatNumber(result.current, 1)}${result.current === null ? "" : "%"}</strong><small>${formatNumber(result.gradedWeight, 0)}% of course graded</small></div>
        <div class="overview-item overview-highlight"><span>Projected final</span><strong>${formatNumber(result.projection, 1)}${result.projection === null ? "" : "%"}</strong><small>${escapeHtml(result.grade?.letter ?? "Add a grade scale")} · ${formatNumber(result.grade?.points ?? null, 2)} GPA</small></div>
        <div class="overview-item">
          <label for="course-credits-${course.id}">Credit hours</label>
          <strong class="credit-input-wrap"><input id="course-credits-${course.id}" data-key="credits-${course.id}" data-field="credits" data-course="${course.id}" type="number" min="0" step="0.5" value="${course.credits}" aria-label="Course credit hours" /></strong>
          <small>Counts toward GPA</small>
        </div>
      </div>

      <div class="section-heading assessments-heading">
        <div>        <h2 title="Each assessment contributes its weight to your projected course mark. Enter a target for ungraded work.">Assessment breakdown</h2><p>Set each component's course weight, enter returned marks, and adjust your target.</p></div>
        <span class="weight-total ${weightOff ? "weight-warning" : "weight-valid"}">${formatNumber(result.totalWeight, 0)}% <span>of 100%</span></span>
      </div>
      <div class="assessment-actions">
        <button class="button button-preset" type="button" data-action="apply-faculty-defaults" data-course="${course.id}">✦ Load faculty assessment defaults</button>
      </div>
      ${weightOff ? `<div class="inline-notice">Assessment weights add up to ${formatNumber(result.totalWeight, 1)}%. The projection is normalized across the weights entered; adjust them to match your course outline.</div>` : ""}
      <div class="assessment-table">
        <div class="assessment-header"><span>COMPONENT</span><span>WEIGHT</span><span>MARK EARNED</span><span>EXPECTED</span><span>ACTUAL</span><span></span></div>
        ${renderAssessments(course)}
      </div>
      <button class="button button-add" type="button" data-action="add-assessment" data-course="${course.id}">＋ Add assessment</button>

      <div class="progress-label"><span>Grading progress</span><strong>${formatNumber(completedPercent, 0)}%</strong></div>
      <div class="progress-track"><span style="width:${completedPercent}%"></span></div>

      <details class="grade-scale-details">
        <summary><span><strong>Grade scale for this course</strong><small>Customize percentage cutoffs and GPA points for this faculty or course.</small></span><span class="details-chevron">⌄</span></summary>
        <div class="scale-editor">
          <div class="scale-header"><span>LETTER GRADE</span><span>MINIMUM MARK</span><span>GPA POINTS</span><span></span></div>
          ${renderGradeScale(course)}
          <button class="button button-add" type="button" data-action="add-band" data-course="${course.id}">＋ Add grade band</button>
        </div>
      </details>
    </section>`;
}

function renderPlanner(): string {
  const term = weightedCourseGpa(state.courses);
  const cgpa = projectedCgpa();
  const currentMark =
    state.courses.reduce((total, course) => {
      const result = getCourseResult(course);
      return total + (result.projection ?? 0) * course.credits;
    }, 0) / (state.courses.reduce((total, course) => total + (course.credits > 0 ? course.credits : 0), 0) || 1);
  return `
    <div class="page-heading">
      <div><div class="eyebrow">YOUR ACADEMIC SNAPSHOT</div><h1 title="Your semester overview: projected GPA, CGPA, average marks, and course grades.">Course planner</h1><p>Build your grading rules, track marks, and see where your semester is headed.</p></div>
      <div class="heading-actions"><button class="button button-secondary" type="button" data-action="export">↗ Export data</button><button class="button button-primary" type="button" data-action="add-course">＋ Add course</button></div>
    </div>
    <div class="stats-grid">
      <article class="stat-card"><span class="stat-icon icon-violet">◈</span><div><span class="stat-label">Projected term GPA</span><strong>${formatNumber(term.gpa, 2)}<small> / ${state.gpaScaleMax.toFixed(2)}</small></strong><span class="stat-foot">${formatNumber(term.credits, 0)} active credits</span></div><span class="stat-spark spark-violet">↗</span></article>
      <article class="stat-card"><span class="stat-icon icon-blue">◎</span><div><span class="stat-label">Projected CGPA</span><strong>${formatNumber(cgpa, 2)}<small> / ${state.gpaScaleMax.toFixed(2)}</small></strong><span class="stat-foot">${formatNumber(state.historyCredits + term.credits, 0)} cumulative credits</span></div><span class="stat-spark spark-blue">◌</span></article>
      <article class="stat-card"><span class="stat-icon icon-green">▤</span><div><span class="stat-label">Weighted course average</span><strong>${formatNumber(currentMark, 1)}<small>%</small></strong><span class="stat-foot">Based on projected final marks</span></div><span class="stat-spark spark-green">⌁</span></article>
    </div>
    <div class="workspace-grid">
      <aside class="course-list-panel">
        <div class="list-heading"><div><h2 title="Select a course to edit its marks, assessment weights, and grade scale.">Your courses</h2><span>${state.courses.length} in this semester</span></div><button class="icon-button add-small" type="button" data-action="add-course" aria-label="Add course">＋</button></div>
        <div class="course-list">${renderCourseList()}</div>
        ${state.courses.length ? `<button class="clear-courses" type="button" data-action="clear-courses">Clear all courses</button>` : ""}
        <div class="list-tip"><span>✦</span><p><strong>Tip</strong>Set the expected score for ungraded components to explore different outcomes.</p></div>
      </aside>
      ${renderEditor()}
    </div>`;
}

function renderSettings(): string {
  const term = weightedCourseGpa(state.courses);
  const cgpa = projectedCgpa();
  return `
    <div class="page-heading">
      <div><div class="eyebrow">MAKE IT YOURS</div><h1 title="Choose your display colors, then set the academic details used in your projections.">Academic settings</h1><p>Choose your game colors and set up your academic record.</p></div>
      <button class="button button-secondary" type="button" data-action="go-planner" title="Return to your courses and grade projections.">← Back to planner</button>
    </div>
    <section class="settings-card theme-settings-card">
      <span class="settings-icon" aria-hidden="true">◐</span>
      <div class="settings-copy"><h2 title="Change the app's color palette. Your selected theme is saved on this device.">Pick your theme</h2><p>Choose your favorite arcade colors. This only changes how the app looks.</p></div>
      <div class="theme-options" role="group" aria-label="Color theme">
        <button class="theme-option ${state.theme === "dark" ? "theme-selected" : ""}" type="button" data-action="theme-dark" aria-pressed="${state.theme === "dark"}" title="Use the original dark arcade palette."><span class="theme-swatch swatch-dark">Aa</span><span>Dark arcade</span></button>
        <button class="theme-option ${state.theme === "light" ? "theme-selected" : ""}" type="button" data-action="theme-light" aria-pressed="${state.theme === "light"}" title="Use the light arcade palette with bright backgrounds and pixel-style accents."><span class="theme-swatch swatch-light">Aa</span><span>Light arcade</span></button>
        <button class="theme-option ${state.theme === "mono" ? "theme-selected" : ""}" type="button" data-action="theme-mono" aria-pressed="${state.theme === "mono"}" title="Use a simple black-and-white palette with the same pixel style."><span class="theme-swatch swatch-mono">Aa</span><span>Black &amp; white</span></button>
      </div>
    </section>
    <section class="settings-card">
      <span class="settings-icon">◷</span>
      <div class="settings-copy"><h2>Previous academic record</h2><p>Enter your current CGPA and completed credit hours. Your projection combines this history with the courses in your planner.</p></div>
      <div class="history-fields">
        <label><span>Current CGPA</span><div class="settings-input-wrap"><input data-key="history-cgpa" data-field="historyCgpa" type="number" min="0" max="${state.gpaScaleMax}" step="0.01" value="${state.historyCgpa}" /><span>/ ${state.gpaScaleMax.toFixed(2)}</span></div></label>
        <label><span>Completed credits</span><div class="settings-input-wrap"><input data-key="history-credits" data-field="historyCredits" type="number" min="0" step="0.5" value="${state.historyCredits}" /><span>credits</span></div></label>
        <label><span>GPA point scale</span><div class="settings-input-wrap"><input data-key="gpa-scale-max" data-field="gpaScaleMax" type="number" min="1" max="10" step="0.1" value="${state.gpaScaleMax}" /><span>max</span></div></label>
      </div>
      <div class="cgpa-preview"><span>Projected CGPA</span><strong>${formatNumber(cgpa, 2)}</strong><small>Includes ${formatNumber(term.credits, 0)} planned course credits</small></div>
    </section>
    <section class="settings-card info-card">
      <span class="settings-icon">▤</span>
      <div class="settings-copy"><h2>Grade rules are per course</h2><p>Open any course in the planner to edit its assessment weights and letter-grade thresholds. This lets you use different faculty or course policies in the same semester.</p><button class="button button-primary" type="button" data-action="go-planner">Open course planner</button></div>
    </section>
    <div class="privacy-note"><span>⌑</span><p><strong>Your data stays in this browser.</strong> Course details and settings are saved locally on this device. Use Export data to keep a backup.</p></div>`;
}

function render(): void {
  const activePage =
    page === "planner"
      ? renderPlanner()
      : page === "calculator"
        ? renderGpaCalculator()
        : renderSettings();
  app!.innerHTML = `
    <div class="app-shell" data-theme="${state.theme}">
      <aside class="sidebar">
        <a href="#" class="brand" data-action="go-planner"><span class="brand-mark">g<span>.</span></span><span>gradepath<small>STUDENT WORKSPACE</small></span></a>
        <div class="sidebar-label">WORKSPACE</div>
        <nav class="sidebar-nav" aria-label="Main navigation">
          <button class="nav-link ${page === "planner" ? "nav-active" : ""}" data-action="go-planner"><span>▦</span>Course planner</button>
          <button class="nav-link ${page === "calculator" ? "nav-active" : ""}" data-action="go-calculator"><span>◈</span>GPA calculator</button>
          <button class="nav-link ${page === "settings" ? "nav-active" : ""}" data-action="go-settings"><span>⚙</span>Academic settings</button>
        </nav>
        <div class="sidebar-bottom"><span class="online-dot"></span><span>Saved on this device</span><span class="sidebar-version">v0.1</span></div>
      </aside>
      <main class="main-content">
        <header class="topbar"><span class="topbar-label"><span class="online-dot"></span>Student workspace</span><span class="topbar-period">MARKS &amp; GPA PROJECTION</span></header>
        <div class="content-area">
          ${errorNotice ? `<div class="notice notice-error" role="alert">${escapeHtml(errorNotice)}</div>` : ""}
          ${notice ? `<div class="notice notice-success" role="status">${escapeHtml(notice)}</div>` : ""}
          ${state.courses.length > 0 && !demoDismissed && !localStorage.getItem(STORAGE_KEY) ? `<div class="demo-banner"><span>✦</span><span><strong>Faculty defaults loaded</strong> — assessment weights and grade cutoffs are ready to customize. Enter your marks or add another course.</span><button type="button" data-action="dismiss-demo" aria-label="Dismiss defaults notice">×</button></div>` : ""}
          ${activePage}
          <footer class="app-footer"><span>Gradepath · A clearer view of your semester</span><span>Projections are estimates, not official grades.</span></footer>
        </div>
      </main>
      <div class="toast-region" aria-live="polite"></div>
    </div>`;
  bindEvents();
}

function getCourse(id: string | undefined): Course | undefined {
  return state.courses.find((course) => course.id === id);
}

function setNumericField(input: HTMLInputElement, setter: (value: number | null) => void): void {
  if (input.value.trim() === "") {
    setter(null);
    return;
  }
  const value = Number(input.value);
  if (Number.isFinite(value)) setter(value);
}

function updateInput(input: HTMLInputElement): void {
  const field = input.dataset.field;
  const course = getCourse(input.dataset.course);
  const assessment = course?.assessments.find((item) => item.id === input.dataset.assessment);
  const gpaEntry = state.gpaEntries.find((item) => item.id === input.dataset.entry);
  if (field === "course-name" && course) course.name = input.value;
  if (field === "credits" && course) setNumericField(input, (value) => (course.credits = Math.max(0, value ?? 0)));
  if (field === "assessment-name" && assessment) assessment.name = input.value;
  if (field === "assessment-details" && assessment) assessment.details = input.value;
  if (field === "gpa-name" && gpaEntry) gpaEntry.name = input.value;
  if (field === "gpa-credits" && gpaEntry) setNumericField(input, (value) => (gpaEntry.credits = Math.max(0, value ?? 0)));
  if (field === "weight" && assessment) setNumericField(input, (value) => (assessment.weight = Math.max(0, value ?? 0)));
  if (field === "earned" && assessment) setNumericField(input, (value) => (assessment.earned = value === null ? null : Math.max(0, value)));
  if (field === "outOf" && assessment) setNumericField(input, (value) => (assessment.outOf = Math.max(0.01, value ?? 100)));
  if (field === "target" && assessment) setNumericField(input, (value) => (assessment.target = clamp(value ?? 0, 0, 100)));
  if (field === "letter" && course) {
    const band = course.gradeScale[Number(input.dataset.band)];
    if (band) band.letter = input.value;
  }
  if (field === "minimum" && course) {
    const band = course.gradeScale[Number(input.dataset.band)];
    if (band) setNumericField(input, (value) => (band.minimum = clamp(value ?? 0, 0, 100)));
  }
  if (field === "points" && course) {
    const band = course.gradeScale[Number(input.dataset.band)];
    if (band) setNumericField(input, (value) => (band.points = clamp(value ?? 0, 0, state.gpaScaleMax)));
  }
  if (field === "historyCredits") setNumericField(input, (value) => (state.historyCredits = Math.max(0, value ?? 0)));
  if (field === "historyCgpa") setNumericField(input, (value) => (state.historyCgpa = clamp(value ?? 0, 0, state.gpaScaleMax)));
  if (field === "gpaScaleMax") {
    const previousMax = state.gpaScaleMax;
    setNumericField(input, (value) => {
      state.gpaScaleMax = clamp(value ?? previousMax, 1, 10);
      const factor = state.gpaScaleMax / previousMax;
      state.historyCgpa = clamp(state.historyCgpa * factor, 0, state.gpaScaleMax);
      for (const item of state.courses) {
        for (const band of item.gradeScale) band.points = clamp(band.points * factor, 0, state.gpaScaleMax);
      }
    });
  }
}

function rerenderKeepingFocus(element: HTMLInputElement | HTMLSelectElement): void {
  const key = element.dataset.key;
  const start = element instanceof HTMLInputElement ? element.selectionStart : null;
  const end = element instanceof HTMLInputElement ? element.selectionEnd : null;
  render();
  if (!key) return;
  const replacement = app!.querySelector<HTMLElement>(`[data-key="${CSS.escape(key)}"]`);
  if (replacement) {
    replacement.focus();
    if (replacement instanceof HTMLInputElement && start !== null && end !== null) {
      replacement.setSelectionRange(start, end);
    }
  }
}

function removeCourse(courseId: string): void {
  const course = getCourse(courseId);
  if (!course) return;
  if (!window.confirm(`Remove "${course.name}" from this semester?`)) return;
  state.courses = state.courses.filter((item) => item.id !== courseId);
  selectedCourseId = state.courses[0]?.id ?? null;
}

function addCourse(): void {
  const course: Course = {
    id: uid(),
    name: "New course",
    credits: 3,
    gradeScale: defaultGradeScale(),
    assessments: defaultAssessments(),
  };
  state.courses.push(course);
  selectedCourseId = course.id;
  page = "planner";
}

function defaultGradeScale(): GradeBand[] {
  return DEFAULT_SCALE.map((band) => ({
    ...band,
    points: Math.round((band.points * state.gpaScaleMax / 4) * 100) / 100,
  }));
}

function downloadData(): void {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "gradepath-backup.json";
  anchor.click();
  URL.revokeObjectURL(url);
  notice = "Planner data exported as gradepath-backup.json.";
}

function runAction(button: HTMLButtonElement | HTMLAnchorElement): void {
  const action = button.dataset.action;
  const course = getCourse(button.dataset.course);
  switch (action) {
    case "go-planner":
      page = "planner";
      break;
    case "go-settings":
      page = "settings";
      break;
    case "go-calculator":
      page = "calculator";
      break;
    case "theme-dark":
      state.theme = "dark";
      break;
    case "theme-light":
      state.theme = "light";
      break;
    case "theme-mono":
      state.theme = "mono";
      break;
    case "select-course":
      selectedCourseId = button.dataset.course ?? null;
      break;
    case "add-course":
      addCourse();
      break;
    case "remove-course":
      if (course) removeCourse(course.id);
      break;
    case "add-assessment":
      if (course) {
        course.assessments.push({ id: uid(), name: "New assessment", details: "", weight: 0, earned: null, outOf: 100, target: 80 });
      }
      break;
    case "add-gpa-entry":
      state.gpaEntries.push({
        id: uid(),
        name: `Course ${state.gpaEntries.length + 1}`,
        credits: 3,
        grade: "",
      });
      break;
    case "remove-gpa-entry":
      state.gpaEntries = state.gpaEntries.filter((entry) => entry.id !== button.dataset.entry);
      break;
    case "apply-faculty-defaults":
      if (course && window.confirm("Replace this course's assessment breakdown and grade scale with the faculty defaults? Existing marks and custom grade rules for this course will be removed.")) {
        course.assessments = defaultAssessments();
        course.gradeScale = defaultGradeScale();
      }
      break;
    case "remove-assessment":
      if (course) course.assessments = course.assessments.filter((item) => item.id !== button.dataset.assessment);
      break;
    case "add-band":
      if (course) {
        const lowest = Math.min(100, ...course.gradeScale.map((band) => band.minimum));
        course.gradeScale.push({ letter: "New", minimum: Math.max(0, lowest - 5), points: 0 });
      }
      break;
    case "remove-band":
      if (course) course.gradeScale.splice(Number(button.dataset.band), 1);
      break;
    case "clear-courses":
      if (window.confirm("Remove all courses from this semester? This will not change your previous academic record.")) {
        state.courses = [];
        selectedCourseId = null;
      }
      break;
    case "dismiss-demo":
      demoDismissed = true;
      break;
    case "export":
      downloadData();
      break;
  }
  saveState();
  render();
}

function bindEvents(): void {
  app!.querySelectorAll<HTMLButtonElement | HTMLAnchorElement>("[data-action]").forEach((element) => {
    if (!element.title) {
      const action = element.dataset.action;
      const descriptions: Record<string, string> = {
        "go-planner": "Open the course planner.",
        "go-settings": "Open academic settings, including appearance and GPA options.",
        "go-calculator": "Calculate GPA from course letter grades and credits.",
        "add-course": "Add a course using the faculty assessment and grade defaults.",
        "remove-course": "Remove this course and all its assessment marks.",
        "add-assessment": "Add a custom assessment row to this course.",
        "remove-assessment": "Remove this assessment and its mark.",
        "apply-faculty-defaults": "Replace this course's assessments and grade scale with the faculty defaults.",
        "add-band": "Add a custom letter-grade cutoff.",
        "remove-band": "Remove this grade cutoff.",
        "clear-courses": "Remove every course in this semester.",
        "dismiss-demo": "Dismiss this introductory note.",
        export: "Download a JSON backup of your planner data.",
        "select-course": "Show this course's marks and settings.",
      };
      element.title = descriptions[action ?? ""] ?? element.getAttribute("aria-label") ?? element.textContent?.trim() ?? "";
    }
    element.addEventListener("click", (event) => {
      event.preventDefault();
      runAction(element);
    });
  });
  app!.querySelectorAll<HTMLInputElement>("input[data-field]").forEach((input) => {
    if (!input.title) input.title = input.getAttribute("aria-label") ?? "";
    input.addEventListener("input", () => {
      updateInput(input);
      saveState();
      rerenderKeepingFocus(input);
    });
  });
  app!.querySelectorAll<HTMLSelectElement>('select[data-field="gpa-grade"]').forEach((select) => {
    select.addEventListener("change", () => {
      const entry = state.gpaEntries.find((item) => item.id === select.dataset.entry);
      if (!entry) return;
      entry.grade = select.value;
      saveState();
      rerenderKeepingFocus(select);
    });
  });
}

if (state.courses.length) selectedCourseId = state.courses[0].id;
render();
