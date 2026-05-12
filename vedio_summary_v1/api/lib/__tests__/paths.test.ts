import assert from 'node:assert/strict'
import { test } from 'node:test'
import path from 'node:path'
import { resolveDataDir } from '../paths.js'

test('resolveDataDir uses Electron/user configured data dir when provided', () => {
  const previous = process.env.VIDEO_SUMMARY_DATA_DIR
  process.env.VIDEO_SUMMARY_DATA_DIR = './tmp-electron-data'

  try {
    assert.equal(resolveDataDir(), path.resolve('./tmp-electron-data'))
  } finally {
    if (previous === undefined) delete process.env.VIDEO_SUMMARY_DATA_DIR
    else process.env.VIDEO_SUMMARY_DATA_DIR = previous
  }
})
