import assert from 'node:assert/strict'
import test from 'node:test'
import { isAtRisk } from '../src/risk.js'

test('flags students below the attendance threshold', () => {
  assert.equal(isAtRisk({ attendance: 74.9, marks: 40 }), true)
})

test('flags students below the internal marks benchmark', () => {
  assert.equal(isAtRisk({ attendance: 90, marks: 23 }), true)
})

test('does not flag students meeting both fixed thresholds', () => {
  assert.equal(isAtRisk({ attendance: 75, marks: 24 }), false)
})
