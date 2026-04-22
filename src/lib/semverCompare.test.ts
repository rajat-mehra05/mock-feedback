import { expect, test } from 'vitest';
import { semverGreaterThan } from './semverCompare';

test('semverGreaterThan returns true only for strictly-newer three-part versions', () => {
  // Major / minor / patch each take precedence in order.
  expect(semverGreaterThan('1.0.0', '0.9.9')).toBe(true);
  expect(semverGreaterThan('0.2.0', '0.1.9')).toBe(true);
  expect(semverGreaterThan('0.1.2', '0.1.1')).toBe(true);

  // Equal version is not "greater than" — the toast must not fire for the
  // running release.
  expect(semverGreaterThan('1.0.0', '1.0.0')).toBe(false);

  // Older versions.
  expect(semverGreaterThan('0.9.9', '1.0.0')).toBe(false);
  expect(semverGreaterThan('0.1.0', '0.2.0')).toBe(false);
});

test('semverGreaterThan strips the leading `v` that GitHub tag names carry', () => {
  expect(semverGreaterThan('v1.0.0', '0.9.0')).toBe(true);
  expect(semverGreaterThan('v0.1.0', 'v0.1.0')).toBe(false);
  expect(semverGreaterThan('1.0.0', 'v0.9.0')).toBe(true);
});

test('semverGreaterThan ignores pre-release identifiers so an `-rc` tag compares by its core', () => {
  // Ship strategy is stable-only per plan.md, but a pre-release tag
  // slipping through shouldn't crash the comparator.
  expect(semverGreaterThan('1.0.0-rc.1', '1.0.0')).toBe(false);
  expect(semverGreaterThan('1.0.0', '1.0.0-rc.1')).toBe(false);
  expect(semverGreaterThan('1.1.0-beta', '1.0.0')).toBe(true);
});

test('semverGreaterThan returns false for malformed input so junk tags cannot trigger the toast', () => {
  expect(semverGreaterThan('1.0', '0.9.0')).toBe(false);
  expect(semverGreaterThan('1.0.0.0', '0.9.0')).toBe(false);
  expect(semverGreaterThan('abc', '1.0.0')).toBe(false);
  expect(semverGreaterThan('1.0.0', '')).toBe(false);
  expect(semverGreaterThan('-1.0.0', '0.0.0')).toBe(false);
});
