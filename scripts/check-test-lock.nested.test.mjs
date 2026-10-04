// @vitest-environment node
// Planted-violation tests for scripts/check-test-lock.mjs: nested repositories
// and global ignore files. Split from check-test-lock.test.mjs along its
// nested `describe` groups so no one file sets vitest's wall time.
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanTemps, tempDir, testLockFixture } from '../src/test/guard-helpers.mjs';

afterEach(cleanTemps);

const { repo, lockRun } = testLockFixture;

describe('check-test-lock', () => {
  // docs/specs/tooling-gaps.md, criterion 1: `git ls-files -co` lists an
  // untracked nested repository as one `dir/` entry and never walks into it,
  // so files inside one (a `conftest.py` pytest would still collect) were
  // invisible to the lock. A nested repository is locked as a whole: a new
  // one is `added: <dir>/`, and an existing one is compared by its own
  // listing plus file contents.
  describe('nested repositories (tooling-gaps criterion 1)', () => {
    const NESTED = 'src/dsa/code/vendor';

    function nestedRepo(root) {
      const dir = join(root, NESTED);
      mkdirSync(dir, { recursive: true });
      execFileSync('git', ['init', '-q'], { cwd: dir });
      writeFileSync(join(dir, 'helper.py'), 'def g():\n    return 2\n');
      writeFileSync(join(dir, 'staged.py'), 'def h():\n    return 3\n');
      // Staged in the nested repo, so it is listed as tracked there.
      execFileSync('git', ['add', 'staged.py'], { cwd: dir });
      return dir;
    }

    it('fails on a new nested repo holding a conftest.py, naming the folder', () => {
      const { root } = repo();
      expect(lockRun(root, '--snapshot').status).toBe(0);
      const dir = join(root, 'src/sneaky');
      mkdirSync(dir, { recursive: true });
      execFileSync('git', ['init', '-q'], { cwd: dir });
      writeFileSync(join(dir, 'conftest.py'), 'collect_ignore = ["*"]\n');
      const result = lockRun(root, '--verify');
      expect(result.status).toBe(1);
      expect(result.stderr).toMatch(/added:\s+src\/sneaky\/?(\s|$)/m);
    });

    // Review round 1, finding 2: a nested repository with a commit, staged in
    // the outer repository, becomes a gitlink. `git ls-files` then lists it as
    // `src/dsa/code/sneaky` with no trailing slash, so it is not a `dir/`
    // entry, yet pytest still collects the conftest.py inside it.
    it('fails on a nested repo staged as a submodule gitlink, naming the folder', () => {
      const { root } = repo();
      expect(lockRun(root, '--snapshot').status).toBe(0);
      const dir = join(root, 'src/dsa/code/sneaky');
      mkdirSync(dir, { recursive: true });
      execFileSync('git', ['init', '-q'], { cwd: dir });
      writeFileSync(join(dir, 'conftest.py'), 'collect_ignore = ["*"]\n');
      execFileSync('git', ['add', 'conftest.py'], { cwd: dir });
      execFileSync(
        'git',
        ['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '-m', 'x'],
        { cwd: dir },
      );
      execFileSync('git', ['add', 'src/dsa/code/sneaky'], { cwd: root, stdio: 'pipe' });
      const listed = execFileSync('git', ['ls-files', '-co', '--exclude-standard'], {
        cwd: root,
        encoding: 'utf8',
      });
      // The fixture really is a gitlink: listed with no trailing slash.
      expect(listed.split('\n')).toContain('src/dsa/code/sneaky');
      const result = lockRun(root, '--verify');
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('src/dsa/code/sneaky');
    });

    it('passes an existing nested repo that did not change', () => {
      const { root } = repo();
      nestedRepo(root);
      expect(lockRun(root, '--snapshot').status).toBe(0);
      const result = lockRun(root, '--verify');
      expect(result.status, result.stderr).toBe(0);
    });

    it.each([
      [
        'an edited untracked file',
        (dir) => writeFileSync(join(dir, 'helper.py'), 'def g():\n    return 0\n'),
      ],
      [
        'an edited staged file',
        (dir) => writeFileSync(join(dir, 'staged.py'), 'def h():\n    return 0\n'),
      ],
      [
        'an added conftest.py',
        (dir) => writeFileSync(join(dir, 'conftest.py'), 'collect_ignore = ["*"]\n'),
      ],
      ['a deleted file', (dir) => rmSync(join(dir, 'helper.py'))],
      ['the whole repo deleted', (dir) => rmSync(dir, { recursive: true, force: true })],
    ])('fails on %s in an existing nested repo', (_label, plant) => {
      const { root } = repo();
      const dir = nestedRepo(root);
      expect(lockRun(root, '--snapshot').status).toBe(0);
      plant(dir);
      const result = lockRun(root, '--verify');
      expect(result.status).toBe(1);
      expect(result.stderr).toContain(NESTED);
    });

    // Review round 2, finding 3: a nested repo git can no longer read (an
    // agent worktree whose gitdir was pruned) fails closed with a readable
    // message naming it, not a stack trace.
    it('fails readably on a nested repo whose gitdir is gone', () => {
      const { root } = repo();
      const dir = nestedRepo(root);
      expect(lockRun(root, '--snapshot').status).toBe(0);
      rmSync(join(dir, '.git'), { recursive: true, force: true });
      writeFileSync(join(dir, '.git'), `gitdir: ${join(tempDir(), 'pruned')}\n`);
      const result = lockRun(root, '--verify');
      expect(result.status).toBe(1);
      expect(result.stderr).toMatch(new RegExp(`unreadable:\\s+${NESTED}/`));
      expect(result.stderr).not.toMatch(/^\s+at /m);
    });

    it('is unaffected by an ordinary untracked folder that is not a repo', () => {
      const { root } = repo();
      expect(lockRun(root, '--snapshot').status).toBe(0);
      mkdirSync(join(root, 'src/notes'), { recursive: true });
      writeFileSync(join(root, 'src/notes/todo.md'), '# todo\n');
      const result = lockRun(root, '--verify');
      expect(result.status, result.stderr).toBe(0);
    });
  });

  // docs/specs/tooling-gaps.md, criterion 4: a `core.excludesFile` outside the
  // repository, and git's default global ignore file when that is unset, can
  // hide files from the lock, so their contents are hashed wherever they live
  // (null when missing). Every case points git's global and system config,
  // HOME and XDG_CONFIG_HOME at temp dirs, so the real machine's files are
  // never read or touched.
  describe('global ignore files (tooling-gaps criterion 4)', () => {
    function globalRepo() {
      const made = repo();
      const home = tempDir();
      const xdg = tempDir();
      const globalConfig = join(home, '.gitconfig');
      writeFileSync(globalConfig, '');
      const env = {
        HOME: home,
        USERPROFILE: home,
        // Unset, so the real machine's home is never a candidate.
        HOMEDRIVE: undefined,
        HOMEPATH: undefined,
        XDG_CONFIG_HOME: xdg,
        GIT_CONFIG_GLOBAL: globalConfig,
        GIT_CONFIG_NOSYSTEM: '1',
      };
      const lock = (mode, extra = {}) => lockRun(made.root, mode, { ...env, ...extra });
      return { ...made, home, xdg, env, lock };
    }

    const gitConfig = (root, ...args) =>
      execFileSync('git', ['config', ...args], { cwd: root });

    it('fails on an edit to a core.excludesFile outside the repository', () => {
      const { root, lock } = globalRepo();
      const outside = join(tempDir(), 'global-ignore');
      writeFileSync(outside, 'conftest.py\n');
      gitConfig(root, 'core.excludesFile', outside);
      expect(lock('--snapshot').status).toBe(0);
      expect(lock('--verify').status).toBe(0);
      writeFileSync(outside, 'conftest.py\nvitest.config.ts\n');
      expect(lock('--verify').status).toBe(1);
    });

    it('fails on an edit to $XDG_CONFIG_HOME/git/ignore when core.excludesFile is unset', () => {
      const { xdg, lock } = globalRepo();
      const ignore = join(xdg, 'git/ignore');
      mkdirSync(dirname(ignore), { recursive: true });
      writeFileSync(ignore, 'conftest.py\n');
      expect(lock('--snapshot').status).toBe(0);
      expect(lock('--verify').status).toBe(0);
      writeFileSync(ignore, 'conftest.py\nvitest.config.ts\n');
      expect(lock('--verify').status).toBe(1);
    });

    it('falls back to ~/.config/git/ignore when XDG_CONFIG_HOME is unset', () => {
      const { home, lock } = globalRepo();
      const ignore = join(home, '.config/git/ignore');
      mkdirSync(dirname(ignore), { recursive: true });
      writeFileSync(ignore, 'conftest.py\n');
      const noXdg = { XDG_CONFIG_HOME: undefined };
      expect(lock('--snapshot', noXdg).status).toBe(0);
      expect(lock('--verify', noXdg).status).toBe(0);
      writeFileSync(ignore, 'conftest.py\nvitest.config.ts\n');
      expect(lock('--verify', noXdg).status).toBe(1);
    });

    it('is stable while a configured core.excludesFile outside the repository is absent, and fails once it appears', () => {
      const { root, lock } = globalRepo();
      const outside = join(tempDir(), 'missing-ignore');
      gitConfig(root, 'core.excludesFile', outside);
      expect(lock('--snapshot').status).toBe(0);
      const result = lock('--verify');
      expect(result.status, result.stderr).toBe(0);
      writeFileSync(outside, 'vitest.config.ts\n');
      expect(lock('--verify').status).toBe(1);
    });

    // Review round 1, finding 5: with HOME unset, Git for Windows can find the
    // home directory from HOMEDRIVE+HOMEPATH, so the lock hashes the default
    // global ignore file under every candidate home (HOME, USERPROFILE and
    // HOMEDRIVE+HOMEPATH). On Linux the variables are just paths.
    it('fails on an edit to .config/git/ignore under HOMEDRIVE+HOMEPATH', () => {
      const { lock } = globalRepo();
      const driveHome = tempDir();
      const [HOMEDRIVE, HOMEPATH] =
        process.platform === 'win32'
          ? [driveHome.slice(0, 2), driveHome.slice(2)]
          : [dirname(driveHome), `/${basename(driveHome)}`];
      expect(HOMEDRIVE + HOMEPATH).toBe(driveHome);
      const ignore = join(driveHome, '.config/git/ignore');
      mkdirSync(dirname(ignore), { recursive: true });
      writeFileSync(ignore, 'conftest.py\n');
      const env = {
        HOME: undefined,
        XDG_CONFIG_HOME: undefined,
        USERPROFILE: tempDir(),
        HOMEDRIVE,
        HOMEPATH,
      };
      expect(lock('--snapshot', env).status).toBe(0);
      const clean = lock('--verify', env);
      expect(clean.status, clean.stderr).toBe(0);
      writeFileSync(ignore, 'conftest.py\nvitest.config.ts\n');
      expect(lock('--verify', env).status).toBe(1);
    });

    // Review round 2, finding 2: the same files under a different environment
    // (HOME set in one shell and not the other) must not fail --verify, so a
    // candidate location that doesn't exist is left out of the hash.
    it('passes when a missing candidate home is present at --snapshot only', () => {
      const { home, xdg, lock } = globalRepo();
      const ignore = join(xdg, 'git/ignore');
      mkdirSync(dirname(ignore), { recursive: true });
      writeFileSync(ignore, 'conftest.py\n');
      expect(lock('--snapshot', { HOME: join(tempDir(), 'no-such-home') }).status).toBe(
        0,
      );
      const result = lock('--verify', { HOME: home });
      expect(result.status, result.stderr).toBe(0);
      writeFileSync(ignore, 'conftest.py\nvitest.config.ts\n');
      expect(lock('--verify', { HOME: home }).status).toBe(1);
    });

    it('is stable while the default global ignore file is absent, and fails once it appears', () => {
      const { xdg, lock } = globalRepo();
      expect(lock('--snapshot').status).toBe(0);
      const result = lock('--verify');
      expect(result.status, result.stderr).toBe(0);
      mkdirSync(join(xdg, 'git'), { recursive: true });
      writeFileSync(join(xdg, 'git/ignore'), 'vitest.config.ts\n');
      expect(lock('--verify').status).toBe(1);
    });
  });
});
