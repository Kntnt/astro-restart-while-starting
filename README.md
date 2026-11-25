# `astro dev`: a config restart while the dev server is starting leaves it without a content layer

A project with one content collection (`glob` loader, one Markdown file) and a start page that
prints how many posts the collection has.

```sh
npm install
node repro.mjs          # touches astro.config.mjs while the dev server starts
node repro.mjs --calm   # leaves it alone, for comparison
```

`repro.mjs` removes `.astro`, starts `astro dev`, and gives `astro.config.mjs` a new modification
time every 20 ms until the log says `Restarting`. It then asks for the start page, waits ten
seconds, asks again, and prints both counts. Whether the restart comes before the content is
first loaded is a race, so it tries up to five times, stops at the first try that shows the
fault, and exits 1 then.

Seen with Astro 7.4.13 on macOS (arm64), Node 26.13.1, default file watcher:

| | posts at first | ten seconds later |
|---|---|---|
| `node repro.mjs`, a try that shows the fault | 0 | 0 |
| `node repro.mjs --calm` | 1 | 1 |

A single try showed the fault in 23 of 27 runs here. The four misses came while the machine was
busy with other work.

The log of a run that shows the fault:

```
Configuration file updated. Restarting...
[content] transport was disconnected, cannot call "fetchModule"
[content] Content config not loaded
server restarted.
[content] The collection "posts" does not exist or is empty. Please check your content config file for errors.
```

`repro.mjs` removes `.astro` first because a data store left by an earlier run hides the empty
collection: the page then lists what that run stored, and it is later changes of the content
that go missing.
