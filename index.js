#!/usr/bin/env node
const { exec } = require("child_process");

const [, , argRootDir, argAuthor] = process.argv;
const REPO_PADDING = 80;
const LINES_PADDING = 3;

const execPromise = (ps, dir = "./") =>
    new Promise((resolve, reject) => {
        exec(ps, { cwd: dir }, (error, stdout) => {
            error && console.error(`${ps} in ${dir} did not work: ${error}`);
            resolve(stdout);
        });
    });

const gitStatsInDir = (dir, author) =>
    execPromise(
        `git log --all --since="yesterday" --author="${author}" --numstat --pretty=""`,
        dir
    )
        .then((output) =>
            output
                .split("\n")
                .filter((line) => line.length > 1)
                .map(([added, removed]) => [Number(added), Number(removed)])
                .reduce(
                    ([, totalAdded, totalDeleted], [added, deleted]) => [
                        dir,
                        added + (totalAdded || 0),
                        deleted + (totalDeleted || 0),
                    ],
                    []
                )
        )
        .then((entries) => (entries.length ? entries : [dir, 0, 0]))
        .catch((err) => console.error(err, "\n\n"));

const gitDirsInDir = (rootDir) =>
    execPromise(`find ${rootDir} -maxdepth 2 -name .git`).then((output) =>
        output
            .split("\n")
            .filter((gitDir) => !!gitDir)
            .map((gitDir) => gitDir.replace(".git", ""))
    );

const gitStats = (rootDir, author) =>
    gitDirsInDir(rootDir)
        .then((gitDirs) => gitDirs.map((gitDir) => gitStatsInDir(gitDir, author)))
        .then((promises) => Promise.all(promises))
        .then((entries) =>
            entries.reduce(
                ({ totalAdded, totalDeleted, entries }, [repo, added, deleted]) => ({
                    entries: [
                        ...entries,
                        `${repo.padEnd(REPO_PADDING)}\t${added.toString().padStart(LINES_PADDING)}\t${deleted.toString().padStart(LINES_PADDING)}`,
                    ],
                    totalAdded: totalAdded + added,
                    totalDeleted: totalDeleted + deleted,
                }),
                { totalAdded: 0, totalDeleted: 0, entries: [] }
            )
        )
        .then(
            ({ entries, totalAdded, totalDeleted }) =>
                `\n\n${"Repo".padEnd(REPO_PADDING)}\t  +\t  -\n` +
                entries.join("\n") +
                `\n${"Total".padEnd(REPO_PADDING)}\t${totalAdded.toString().padStart(LINES_PADDING)}\t${totalDeleted.toString().padStart(LINES_PADDING)}`
        );

gitStats(argRootDir, argAuthor).then(console.log);
