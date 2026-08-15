import assert from 'node:assert/strict'
import test from 'node:test'

import { apply } from '../index.js'

function isConstructor(callback) {
  try {
    Reflect.construct(Function, [], callback)
    return true
  } catch {
    return false
  }
}

function createHarness(initialServices = {}) {
  const services = new Map(Object.entries(initialServices))
  const waiters = []
  const pending = []
  const warnings = []

  const root = {
    logger: { warn: (...args) => warnings.push(args) },
    inject(dependencies, callback) {
      const waiter = { dependencies, callback, active: false }
      waiters.push(waiter)
      activate(waiter)
    },
  }

  function activate(waiter) {
    if (waiter.active || !waiter.dependencies.every((name) => services.has(name))) return
    waiter.active = true
    const scoped = Object.assign(Object.create(root), Object.fromEntries(services))
    const task = Promise.resolve().then(() => {
      if (!isConstructor(waiter.callback)) return waiter.callback(scoped)
      Reflect.construct(waiter.callback, [scoped])
    }).then((disposer) => {
      if (disposer !== undefined && typeof disposer !== 'function') throw new TypeError('invalid disposer')
      waiter.disposer = disposer
    })
    pending.push(task)
  }

  return {
    root,
    warnings,
    provide(name, service) {
      services.set(name, service)
      waiters.forEach(activate)
    },
    withdraw(name) {
      services.delete(name)
      for (const waiter of waiters) {
        if (!waiter.active || !waiter.dependencies.includes(name)) continue
        waiter.active = false
        if (waiter.disposer) pending.push(Promise.resolve().then(waiter.disposer))
        waiter.disposer = undefined
      }
    },
    async settle() {
      for (let index = 0; index < pending.length; index += 1) await pending[index]
    },
  }
}

test('waits for services and follows their lifecycle', async () => {
  const routes = new Map()
  const skills = new Map()
  const harness = createHarness()
  const webServer = {
    register(route) {
      assert.equal(routes.has(route.path), false)
      routes.set(route.path, route)
      return () => { routes.delete(route.path) }
    },
  }
  const skillRegistry = {
    register(skill) {
      assert.equal(skills.has(skill.name), false)
      skills.set(skill.name, skill)
      return () => { skills.delete(skill.name) }
    },
  }

  apply(harness.root)
  await harness.settle()
  assert.equal(routes.size, 0)
  assert.equal(skills.size, 0)

  harness.provide('webServer', webServer)
  harness.provide('skills', skillRegistry)
  await harness.settle()

  assert.equal(routes.get('/qwen-vision/paste').kind, 'exact')
  assert.match(skills.get('qwen-image-vision').content, /qwen-mm-plugins-api/)
  assert.equal(skills.get('qwen-image-vision').source, 'bundled')
  assert.deepEqual(harness.warnings, [])

  harness.withdraw('webServer')
  harness.withdraw('skills')
  await harness.settle()
  assert.equal(routes.size, 0)
  assert.equal(skills.size, 0)

  harness.provide('webServer', webServer)
  harness.provide('skills', skillRegistry)
  await harness.settle()
  assert.equal(routes.size, 1)
  assert.equal(skills.size, 1)
})

test('contains paste route registration failures instead of rejecting plugin startup', async () => {
  const harness = createHarness({
    webServer: { register: () => { throw new Error('route unavailable') } },
  })

  apply(harness.root)
  await harness.settle()

  assert.equal(harness.warnings.length, 1)
  assert.equal(harness.warnings[0][0], 'dsh-qwen-vision: failed to register paste route')
  assert.match(harness.warnings[0][1].message, /route unavailable/)
})

test('contains skill registration failures instead of rejecting plugin startup', async () => {
  const harness = createHarness({
    skills: { register: () => { throw new Error('registry unavailable') } },
  })

  apply(harness.root)
  await harness.settle()

  assert.equal(harness.warnings.length, 1)
  assert.equal(harness.warnings[0][0], 'dsh-qwen-vision: failed to register image skill')
  assert.match(harness.warnings[0][1].message, /registry unavailable/)
})
