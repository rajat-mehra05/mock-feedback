import { http, HttpResponse } from 'msw';
import { expect, test } from 'vitest';
import { server } from '@/test/msw/server';
import { computeUpdateInfo, fetchLatestRelease, isAllowedReleaseUrl } from './updater';

const RELEASES_URL = 'https://api.github.com/repos/rajat-mehra05/voice-round/releases/latest';

test('a newer GitHub tag surfaces as an UpdateInfo with leading v stripped from the version', () => {
  const info = computeUpdateInfo('0.1.0', {
    tag_name: 'v0.2.0',
    html_url: 'https://github.com/example/repo/releases/tag/v0.2.0',
  });
  expect(info).toEqual({
    latestVersion: '0.2.0',
    htmlUrl: 'https://github.com/example/repo/releases/tag/v0.2.0',
  });
});

test('a tag equal to the running version returns null so the toast never fires on the current release', () => {
  expect(
    computeUpdateInfo('0.1.0', {
      tag_name: 'v0.1.0',
      html_url: 'https://github.com/example/repo/releases/tag/v0.1.0',
    }),
  ).toBeNull();
});

test('an older tag returns null so a downgrade notification is impossible', () => {
  // Defence against a dev-environment weirdness (e.g. running a local
  // unreleased version) where the latest GitHub release is actually older.
  expect(
    computeUpdateInfo('0.3.0', {
      tag_name: 'v0.2.0',
      html_url: 'https://github.com/example/repo/releases/tag/v0.2.0',
    }),
  ).toBeNull();
});

test('null latestRelease (GitHub unreachable, parse failure) returns null instead of erroring', () => {
  expect(computeUpdateInfo('0.1.0', null)).toBeNull();
});

test('fetchLatestRelease returns tag_name + html_url on a 200 response', async () => {
  server.use(
    http.get(RELEASES_URL, () =>
      HttpResponse.json({
        tag_name: 'v0.2.0',
        html_url: 'https://github.com/example/repo/releases/tag/v0.2.0',
        // Extra fields GitHub includes (draft, prerelease, body, etc.)
        // must not trip the field-existence guard.
        draft: false,
        prerelease: false,
        body: 'release notes',
      }),
    ),
  );
  await expect(fetchLatestRelease()).resolves.toEqual({
    tag_name: 'v0.2.0',
    html_url: 'https://github.com/example/repo/releases/tag/v0.2.0',
  });
});

test('fetchLatestRelease returns null on a 403 (rate limit) so the launch path stays silent', async () => {
  server.use(
    http.get(RELEASES_URL, () =>
      HttpResponse.json({ message: 'rate limit exceeded' }, { status: 403 }),
    ),
  );
  await expect(fetchLatestRelease()).resolves.toBeNull();
});

test('fetchLatestRelease returns null on a network error instead of throwing', async () => {
  // MSW's `HttpResponse.error()` simulates a network-level failure (the
  // fetch promise rejects). The adapter must swallow it — an unhandled
  // rejection here would surface as a toast no-show AND a console error.
  server.use(http.get(RELEASES_URL, () => HttpResponse.error()));
  await expect(fetchLatestRelease()).resolves.toBeNull();
});

test('fetchLatestRelease returns null when the response body is missing tag_name or html_url', async () => {
  // Defence against an unexpected API shape (e.g. GitHub changes the
  // endpoint semantics). Unguarded, a missing field would propagate as
  // `undefined` into `semverGreaterThan` and the toast logic.
  server.use(
    http.get(RELEASES_URL, () => HttpResponse.json({ tag_name: 'v0.2.0' /* no html_url */ })),
  );
  await expect(fetchLatestRelease()).resolves.toBeNull();
});

test('fetchLatestRelease returns null on invalid JSON instead of throwing', async () => {
  server.use(
    http.get(RELEASES_URL, () =>
      HttpResponse.text('not json at all', { headers: { 'Content-Type': 'application/json' } }),
    ),
  );
  await expect(fetchLatestRelease()).resolves.toBeNull();
});

test('isAllowedReleaseUrl accepts the canonical release-tag URL GitHub returns', () => {
  expect(
    isAllowedReleaseUrl('https://github.com/rajat-mehra05/voice-round/releases/tag/v0.2.0'),
  ).toBe(true);
});

test('isAllowedReleaseUrl rejects a look-alike host using the userinfo trick', () => {
  // Classic URL-parser gotcha: a naive `startsWith('https://github.com/…')`
  // check passes this, but the real host is `evil.tld`. `URL` parses it
  // correctly and the host check rejects it.
  expect(
    isAllowedReleaseUrl('https://github.com@evil.tld/rajat-mehra05/voice-round/releases/tag/v1'),
  ).toBe(false);
});

test('isAllowedReleaseUrl rejects a subdomain attack (github.com.evil.tld)', () => {
  expect(
    isAllowedReleaseUrl('https://github.com.evil.tld/rajat-mehra05/voice-round/releases/tag/v1'),
  ).toBe(false);
});

test('isAllowedReleaseUrl rejects a different repo under github.com', () => {
  // GitHub compromise / API bug returning a URL for a different repo must
  // not trigger a shell-open call. The user asked to update THIS app.
  expect(isAllowedReleaseUrl('https://github.com/evil/repo/releases/tag/v1')).toBe(false);
});

test('isAllowedReleaseUrl rejects non-https schemes', () => {
  expect(isAllowedReleaseUrl('http://github.com/rajat-mehra05/voice-round/releases/tag/v1')).toBe(
    false,
  );
  expect(isAllowedReleaseUrl('file:///github.com/rajat-mehra05/voice-round/releases/tag/v1')).toBe(
    false,
  );
});

test('isAllowedReleaseUrl rejects malformed input instead of throwing', () => {
  expect(isAllowedReleaseUrl('not a url')).toBe(false);
  expect(isAllowedReleaseUrl('')).toBe(false);
});
