// Generates the Obsidian notes for exercises and workout programs from database/.
// Run: npm run vault   (safe to re-run; anything under "## My notes" is kept)
// The vault is private and git-ignored. It is never served or copied into dist/.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EXERCISES, MUSCLES, byId } from '../database/exercises.js';
import { PLANS } from '../database/plans.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const VAULT = join(ROOT, 'Obsidian-Vault');
const EX_DIR = join(VAULT, '03-Exercise-Library');
const PLAN_DIR = join(VAULT, '04-Workout-Programs');
const MY_NOTES = '## My notes';

const fileName = name => name.replace(/[\\/:*?"<>|#^[\]]/g, '-').replace(/\s+-\s+/g, ' - ').replace(/\s+/g, ' ').trim();
const link = name => (fileName(name) === name ? `[[${name}]]` : `[[${fileName(name)}|${name}]]`);
const cellLink = name => link(name).replace('|', '\\|'); // a bare | would split a table cell
const levelTag = level => `#level/${level.toLowerCase()}`;
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const muscle = m => MUSCLES[m] || m;
const yamlList = xs => `[${xs.join(', ')}]`;
const banner = src => `> [!info] Generated from \`${src}\` by \`npm run vault\`.\n> Change the data file to change the app. Write your own notes under **My notes**; they survive regeneration.`;

function write(dir, name, body) {
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `${fileName(name)}.md`);
  let mine = '\n';
  if (existsSync(path)) {
    const old = readFileSync(path, 'utf8');
    const i = old.indexOf(`\n${MY_NOTES}\n`);
    if (i >= 0) mine = old.slice(i + MY_NOTES.length + 2);
  }
  writeFileSync(path, `${body.trimEnd()}\n\n${MY_NOTES}\n${mine}`);
}

// Where each exercise is programmed: exId -> [{ plan, day, sets, reps }]
const usage = new Map();
for (const plan of PLANS) {
  const seen = new Set();
  for (const week of plan.weeks) for (const day of week.days) for (const e of day.exercises) {
    const key = `${plan.id}|${day.name}|${e.exId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (!usage.has(e.exId)) usage.set(e.exId, []);
    usage.get(e.exId).push({ plan, day: day.name, sets: e.sets, reps: e.reps });
  }
}

// ── Exercises ──
for (const x of EXERCISES) {
  const used = usage.get(x.id) || [];
  const tags = ['exercise', `equipment/${x.equipment}`, ...x.primary.map(m => `muscle/${m}`)];
  write(EX_DIR, x.name, `---
id: ${x.id}
equipment: ${x.equipment}
metric: ${x.metric}
bodyweight: ${x.bodyweight}
primary: ${yamlList(x.primary)}
secondary: ${yamlList(x.secondary)}
tags: ${yamlList(tags)}
cssclasses: [lift-exercises]
source: database/exercises.js
---
# ${x.name}

${banner('database/exercises.js')}

**Equipment:** ${cap(x.equipment)} · **Measured in:** ${x.metric} · **Bodyweight load:** ${x.bodyweight ? 'yes (weight = added load)' : 'no'}

## Muscles
- **Primary:** ${x.primary.map(muscle).join(', ')}
- **Secondary:** ${x.secondary.length ? x.secondary.map(muscle).join(', ') : '—'}

## Form cues
${x.cues.map((c, i) => `${i + 1}. ${c}`).join('\n')}

## Used in programs
${used.length ? used.map(u => `- ${link(u.plan.name)} · ${u.day}: ${u.sets} × ${u.reps}`).join('\n') : '- Not in any built-in program yet.'}

Related: [[Progression Algorithms]]`);
}

// Library index, grouped by primary muscle and by equipment
const byMuscle = Object.keys(MUSCLES).map(m => [m, EXERCISES.filter(x => x.primary.includes(m))]).filter(([, xs]) => xs.length);
const byEquip = [...new Set(EXERCISES.map(x => x.equipment))].map(eq => [eq, EXERCISES.filter(x => x.equipment === eq)]);
write(EX_DIR, 'Exercise Library', `---
tags: [index]
cssclasses: [lift-exercises]
---
# Exercise Library

${banner('database/exercises.js')}

${EXERCISES.length} exercises. Each note lists muscles, form cues and the programs that use it.

## By primary muscle
${byMuscle.map(([m, xs]) => `### ${muscle(m)}\n${xs.map(x => `- ${link(x.name)}`).join('\n')}`).join('\n\n')}

## By equipment
${byEquip.map(([eq, xs]) => `### ${cap(eq)}\n${xs.map(x => `- ${link(x.name)}`).join('\n')}`).join('\n\n')}`);

// ── Programs ──
function dayTable(day) {
  const rows = day.exercises.map(e => `| ${cellLink(byId(e.exId)?.name || e.exId)} | ${e.sets} | ${e.reps} |`);
  return `#### ${day.name}\n| Exercise | Sets | Reps |\n|---|---|---|\n${rows.join('\n')}`;
}

for (const plan of PLANS) {
  // Group weeks that share the same layout (e.g. 5×5 alternates two patterns).
  const patterns = new Map();
  plan.weeks.forEach((w, i) => {
    const key = JSON.stringify(w);
    if (!patterns.has(key)) patterns.set(key, { week: w, nums: [] });
    patterns.get(key).nums.push(i + 1);
  });
  const sections = [...patterns.values()].map(({ week, nums }) => {
    const label = patterns.size === 1 ? `Every week (weeks 1–${plan.weeks.length})` : `Weeks ${nums.join(', ')}`;
    return `### ${label}\n${week.days.map(dayTable).join('\n\n')}`;
  });
  const exNames = [...new Set(plan.weeks.flatMap(w => w.days.flatMap(d => d.exercises.map(e => byId(e.exId)?.name || e.exId))))];
  write(PLAN_DIR, plan.name, `---
id: ${plan.id}
level: ${plan.level}
days_per_week: ${plan.daysPerWeek}
weeks: ${plan.weeks.length}
${plan.gym ? `gym: ${plan.gym}\n` : ''}tags: [program, level/${plan.level.toLowerCase()}]
cssclasses: [lift-programs]
source: database/plans.js
---
# ${plan.name}

${banner('database/plans.js')}

**Level:** ${levelTag(plan.level)} · **Days per week:** ${plan.daysPerWeek} · **Length:** ${plan.weeks.length} weeks${plan.gym ? ` · **Built for:** ${plan.gym}-style equipment` : ''}

${plan.summary}

## Schedule
${sections.join('\n\n')}

## Exercises in this program
${exNames.map(n => `- ${link(n)}`).join('\n')}

Related: [[Progression Algorithms]] · [[Workout Programs]]`);
}

write(PLAN_DIR, 'Workout Programs', `---
tags: [index]
cssclasses: [lift-programs]
---
# Workout Programs

${banner('database/plans.js')}

| Program | Level | Days/week | Weeks |
|---|---|---|---|
${PLANS.map(p => `| ${cellLink(p.name)}${p.gym ? ' (gym)' : ''} | ${levelTag(p.level)} | ${p.daysPerWeek} | ${p.weeks.length} |`).join('\n')}

Custom plans you build in the app live on your phone, not here.`);

console.log(`Vault notes: ${EXERCISES.length} exercises, ${PLANS.length} programs → ${VAULT}`);
