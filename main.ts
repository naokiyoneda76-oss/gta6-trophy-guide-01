// Package the finished static guide exactly as it sits beside this entrypoint.
// Keeping app/ intact means its local data file and browser assets travel together to the reviewer.
import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-frontend.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
// MAKEFUN_OUTPUT_DIR makes this same handoff easy to inspect locally; the grader uses /output by default.
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(outputDir, { recursive: true });
cpSync(join(here, 'app'), join(outputDir, 'app'), { recursive: true });

// Keep a screenshots directory in the handoff even when this project intentionally has no screenshots.
const sourceScreenshots = join(here, 'screenshots');
const outputScreenshots = join(outputDir, 'screenshots');
mkdirSync(outputScreenshots, { recursive: true });
if (existsSync(sourceScreenshots)) {
  cpSync(sourceScreenshots, outputScreenshots, { recursive: true });
}

// These caps match the evaluator's supported dossier envelope and summarize the submitted app and text.
const dossier = buildDossier(outputDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
});
writeFileSync(join(outputDir, 'dossier.json'), dossier);
