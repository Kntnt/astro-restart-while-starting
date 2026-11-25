// Starts `astro dev` in a project that has never been synced (no .astro folder) and, while it
// starts, gives astro.config.mjs a new modification time every 20 ms until the dev server says
// it restarts. Then asks for the start page, which says how many posts the collection has.
// Whether the restart comes before the content is first loaded is a race, so it tries up to
// five times and stops at the first try that shows the fault.
//
//   node repro.mjs          touch the configuration while the dev server starts
//   node repro.mjs --calm   leave it alone, once, for comparison

import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { rmSync, utimesSync } from 'node:fs';

const calm = process.argv.includes('--calm');
const port = 4599;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const posts = async () => {
  try {
    return /posts: (\d+)/.exec(await (await fetch(`http://127.0.0.1:${port}/`)).text())?.[1] ?? 'no count';
  } catch {
    return null;
  }
};

async function attempt() {
  // Without this, a data store left by an earlier run hides the fault: the page then lists what
  // that run stored, and only later changes of the content go missing.
  rmSync('.astro', { recursive: true, force: true });

  const server = spawn(process.execPath, ['node_modules/astro/bin/astro.mjs', 'dev', '--host', '127.0.0.1', '--port', String(port), '--ignore-lock'], { stdio: ['ignore', 'pipe', 'pipe'] });
  let log = '';
  let touching = calm ? null : setInterval(() => utimesSync('astro.config.mjs', new Date(), new Date()), 20);
  for (const stream of [server.stdout, server.stderr]) {
    stream.on('data', (chunk) => {
      log += chunk;
      process.stdout.write(chunk);
      if (touching && /Restarting/.test(log)) {
        clearInterval(touching);
        touching = null;
      }
    });
  }

  let first = null;
  for (let waited = 0; waited < 30_000 && first === null; waited += 250) {
    first = await posts();
    if (first === null) await sleep(250);
  }
  // Ten seconds more, to come right by itself.
  await sleep(10_000);
  const later = await posts();
  clearInterval(touching);
  server.kill('SIGKILL');
  await once(server, 'exit');
  return { first, later, notLoaded: log.includes('Content config not loaded') };
}

const tries = calm ? 1 : 5;
for (let number = 1; number <= tries; number += 1) {
  const { first, later, notLoaded } = await attempt();
  console.log(`\ntry ${number}: posts on the start page at first: ${first ?? 'no answer'}; ten seconds later: ${later ?? 'no answer'}; expected: 1${notLoaded ? '; the log says "Content config not loaded"' : ''}\n`);
  if (later !== '1') process.exit(1);
}
process.exit(0);
