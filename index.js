#!/usr/bin/env node
const { exec } = require("child_process");
const {
  compose,
  replace,
  map,
  dropLast,
  complement,
  isEmpty,
  filter,
  reduce,
} = require("ramda");

const [, , argRootDir = "~/code", argAuthor = "cekrem"] = process.argv;
const LINES_PADDING = 3;

const padEnd = (str) => str.padEnd(40);
const formatRepoWithRootDir = (rootDir) =>
  compose(padEnd, replace(/\/\.git.*/g, ""), replace(rootDir, ""));

const mapOutputToLines = compose(filter(complement(isEmpty)), (raw) =>
  raw.split("\n")
);

const countLine = reduce(
  ([, totalAdded, totalDeleted], [added, deleted]) => [
    dir,
    added + (totalAdded || 0),
    deleted + (totalDeleted || 0),
  ],
  []
);

const mapLine = compose(
  map((str) => Number(str)),
  dropLast(1),
  (str) => str.split("\t")
);

const mapLines = (lines) => lines.map(mapLine);

const reduceLines = (dir) =>
  reduce(
    ([, totalAdded, totalDeleted], [added, deleted]) => [
      dir,
      added + (totalAdded || 0),
      deleted + (totalDeleted || 0),
    ],
    []
  );

const execPromise = (ps, dir = "./") =>
  new Promise((resolve) => {
    exec(ps, { cwd: dir }, (error, stdout) => {
      error && console.error(`${ps} in ${dir} did not work: ${error}`);
      resolve(stdout);
    });
  });

const gitStatsInDir = (dir, author) =>
  execPromise(
    `git log --all --since="midnight" --author="${author}" --numstat --pretty=""`,
    dir
  )
    .then(mapOutputToLines)
    .then(mapLines)
    .then(reduceLines(dir))
    .then((entries) => (entries.length ? entries : [dir, 0, 0]))
    .catch(console.error);

const gitDirsInDir = (rootDir) =>
  execPromise(`find ${rootDir} -maxdepth 2 -name .git`).then((output) =>
    output.split("\n").filter((gitDir) => !!gitDir)
  );

const addDividers = (text) => {
  const [headline, ...rest] = text.split("\n");
  const lastLine = rest.slice(-1)[0];
  const divider = lastLine.replace(/[^\t]/g, "-").replace(/\t/g, "--------");
  return [headline, divider, ...rest.slice(0, -1), divider, lastLine].join(
    "\n"
  );
};

const gitStats = (rootDir, author) => {
  const formatRepo = formatRepoWithRootDir(rootDir);

  return gitDirsInDir(rootDir)
    .then((gitDirs) => gitDirs.map((gitDir) => gitStatsInDir(gitDir, author)))
    .then((promises) => Promise.all(promises))
    .then((entries) =>
      entries.reduce(
        ({ totalAdded, totalDeleted, entries }, [repo, added, deleted]) => ({
          entries: [
            ...entries,
            `${formatRepo(repo)}\t${added
              .toString()
              .padStart(LINES_PADDING)}\t${deleted
              .toString()
              .padStart(LINES_PADDING)}`,
          ],
          totalAdded: totalAdded + added,
          totalDeleted: totalDeleted + deleted,
        }),
        { totalAdded: 0, totalDeleted: 0, entries: [] }
      )
    )
    .then(
      ({ entries, totalAdded, totalDeleted }) =>
        `${formatRepo("Repo")}\t  +\t  -\n` +
        entries.join("\n") +
        `\n${formatRepo("Total")}\t${totalAdded
          .toString()
          .padStart(LINES_PADDING)}\t${totalDeleted
          .toString()
          .padStart(LINES_PADDING)}`
    )
    .then(addDividers);
};

gitStats(argRootDir, argAuthor).then(console.log);
