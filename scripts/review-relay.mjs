// Mechanical relay between the review drafts queue and the live review panel.
// Pure plumbing, no tagging judgment: takes the oldest un-shown/changed draft
// from review-drafts.json, POSTs it to review-server.mjs, blocks on /wait,
// and on allGood writes straight to data/fin/fin_relations.json. Feedback that
// needs actual judgment gets queued to review-responses.json instead of
// looping here — a separate (agent) process reads that, revises the draft in
// review-drafts.json, and this relay picks the revised version up next pass.
//
// Usage: node scripts/review-relay.mjs
//
// Doesn't re-show a card whose draft content hasn't changed since the last
// time it was shown and got feedback (avoids spamming the same rejected
// proposal at the user before it's been revised).

import { readFile, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import http from 'node:http';

const execFileAsync = promisify(execFile);
const SERVER = 'http://localhost:8787';

// Plain node:http instead of global fetch (undici): this relay makes a fresh
// request per call but undici's default Agent pools/reuses keep-alive sockets
// across calls, and under WSL2 those pooled sockets go stale (the far side —
// or something in the WSL network layer — closes them without either side
// noticing), so a later reused socket fails instantly with a generic "fetch
// failed" with no useful cause. node:http with `agent: false` opens a brand
// new, non-pooled connection every time, sidestepping the whole bug class.
function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const payload = body != null ? JSON.stringify(body) : undefined;
    const req = http.request(
      `${SERVER}${path}`,
      {
        method,
        agent: false,
        headers: payload
          ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
          : {},
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'));
          } catch (err) {
            reject(err);
          }
        });
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}
const DRAFTS = new URL('./review-drafts.json', import.meta.url);
const RESPONSES = new URL('./review-responses.json', import.meta.url);
const RELATIONS = new URL('../data/fin/fin_relations.json', import.meta.url);

async function readJson(url, fallback) {
  try {
    return JSON.parse(await readFile(url, 'utf8'));
  } catch {
    return fallback;
  }
}

async function writeJson(url, data) {
  await writeFile(url, JSON.stringify(data, null, 2) + '\n');
}

// Tracks, per card name, the JSON string of the relationsToAdd we last showed
// — so a feedback response doesn't cause an immediate re-show of the exact
// same (rejected) proposal before it's been revised.
const lastShown = new Map();

async function main() {
  console.log('review-relay: starting');
  for (;;) {
    const drafts = await readJson(DRAFTS, []);
    if (drafts.length === 0) {
      console.log('review-relay: no drafts, waiting 5s');
      await new Promise((r) => setTimeout(r, 5000));
      continue;
    }

    const draftKey = (d) => JSON.stringify([d.relationsToAdd, d.relationsToRemove ?? [], d.note ?? '']);
    const next = drafts.find((d) => lastShown.get(d.name) !== draftKey(d));
    if (!next) {
      console.log('review-relay: all queued drafts already shown and awaiting revision, waiting 5s');
      await new Promise((r) => setTimeout(r, 5000));
      continue;
    }

    console.log(`review-relay: showing "${next.name}"`);
    lastShown.set(next.name, draftKey(next));
    await request('POST', '/show', {
      card: next.name,
      relationsToAdd: next.relationsToAdd,
      relationsToRemove: next.relationsToRemove ?? [],
      note: next.note ?? '',
      confidence: next.confidence,
    });

    // A stale/dropped connection (or the server-side 1hr safety-net timeout)
    // shouldn't kill the relay — just retry; the server still resolves
    // whichever /wait call is live when /respond actually comes in.
    let body;
    for (;;) {
      try {
        body = await request('GET', '/wait');
        if (body.type === 'timeout') {
          console.log('review-relay: /wait hit the 1hr safety net, retrying');
          continue;
        }
        break;
      } catch (err) {
        console.log(`review-relay: /wait connection dropped (${err.message}), retrying in 2s`);
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
    console.log(`review-relay: response for "${next.name}":`, JSON.stringify(body));

    if (body.type === 'allGood') {
      const relations = await readJson(RELATIONS, []);
      const idx = relations.findIndex((r) => r.name === next.name);
      // Merge onto whatever's already there (e.g. a mechanical prefill) rather
      // than replacing wholesale — the agent's relationsToAdd is meant to be
      // additive/corrective on top of the current state shown in the panel,
      // not a guaranteed-complete restatement of it.
      const existingThemes = idx === -1 ? {} : relations[idx].themes ?? {};
      const mergedThemes = JSON.parse(JSON.stringify(existingThemes));
      for (const { theme, role } of next.relationsToRemove ?? []) {
        delete mergedThemes[role]?.[theme];
        if (mergedThemes[role] && Object.keys(mergedThemes[role]).length === 0) delete mergedThemes[role];
      }
      for (const { theme, role, weight } of next.relationsToAdd) {
        mergedThemes[role] ??= {};
        mergedThemes[role][theme] = weight ?? 3;
      }
      const entry = { name: next.name, themes: mergedThemes, reviewed: true };
      if (idx === -1) relations.push(entry);
      else relations[idx] = entry;
      await writeJson(RELATIONS, relations);

      const freshDrafts = (await readJson(DRAFTS, [])).filter((d) => d.name !== next.name);
      await writeJson(DRAFTS, freshDrafts);
      lastShown.delete(next.name);

      try {
        await execFileAsync('npm', ['run', 'test'], { cwd: new URL('..', import.meta.url) });
        console.log(`review-relay: confirmed "${next.name}", tests pass`);
      } catch (err) {
        console.error(`review-relay: confirmed "${next.name}" but tests FAILED:`, err.stdout || err.message);
      }
    } else if (body.type === 'feedback') {
      const responses = await readJson(RESPONSES, []);
      responses.push({ name: next.name, type: 'feedback', text: body.text });
      await writeJson(RESPONSES, responses);
      console.log(`review-relay: queued feedback for "${next.name}"`);
    } else if (body.type === 'stop') {
      console.log('review-relay: stop received, exiting');
      process.exit(0);
    }
  }
}

main().catch((err) => {
  console.error('review-relay: fatal error', err);
  process.exit(1);
});
