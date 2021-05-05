#!/usr/bin/env node
const { exec } = require("child_process");

const [, , argRootDir = "~/code", argAuthor = "cekrem"] = process.argv;
const LINES_PADDING = 3;

const execPromise = (ps, dir = "./") =>
    new Promise((resolve) => {
        exec(ps, { cwd: dir }, (error, stdout) => {
            error && console.error(`${ps} in ${dir} did not work: ${error}`);
            resolve(stdout);
        });
    });

const formatRepo = (repo, rootDir, padding = 40) =>
    repo.replace(rootDir, "").replace(/\/\.git.*/g, "").padEnd(padding);

const gitStatsInDir = (dir, author) =>
    execPromise(
        `git log --all --since="midnight" --author="${author}" --numstat --pretty=""`,
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
        .catch(console.error);

const gitDirsInDir = (rootDir) =>
    execPromise(`find ${rootDir} -maxdepth 2 -name .git`).then((output) =>
        output
            .split("\n")
            .filter((gitDir) => !!gitDir)
    );

const addDividers = (text) => {
    const [headline, ...rest] = text.split("\n");
    const lastLine = rest.slice(-1)[0];
    const divider = lastLine.replace(/[^\t]/g, "-").replace(/\t/g, "--------");
    return [headline, divider, ...rest.slice(0, -1), divider, lastLine].join(
        "\n"
    );
};

const gitStats = (rootDir, author) =>
    gitDirsInDir(rootDir)
        .then((gitDirs) => gitDirs.map((gitDir) => gitStatsInDir(gitDir, author)))
        .then((promises) => Promise.all(promises))
        .then((entries) =>
            entries.reduce(
                ({ totalAdded, totalDeleted, entries }, [repo, added, deleted]) => ({
                    entries: [
                        ...entries,
                        `${formatRepo(repo, rootDir)}\t${added
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
gitStats(argRootDir, argAuthor).then(console.log);
