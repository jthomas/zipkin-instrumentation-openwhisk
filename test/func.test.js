'use strict'

import test from 'ava';
import wrap from '../lib/index.js'
import sinon from 'sinon'
import { Tracer, ExplicitContext, createNoopTracer } from 'zipkin'

test.before(t => {
  process.env['__OW_ACTION_NAME'] = '/namespace/action_name'
  process.env['__OW_ACTIVATION_ID'] = 'abcdefg'
})

test('should wait until tracing logger has finished before exiting', t => {
  const record = sinon.spy()
  const logger = { queue: [{trace: 'trace'}] }
  const recorder = { record, logger }
  const ctxImpl = new ExplicitContext()
  const tracer = new Tracer({ recorder, ctxImpl })

  t.plan(1)
  const action = () => {
    return Promise.resolve({message: 'hello world'})
  }

  setTimeout(() => {
    logger.queue.length = 0
  }, 100)

  return wrap(action, { tracer, serviceName: 'service-a' })({}).then(result => {
    t.is(logger.queue.length, 0)
  })
})

test('should record trace info for asynchronous action handler without parent parameters', t => {
  const record = sinon.spy()
  const recorder = { record, logger: {queue: []} }
  const ctxImpl = new ExplicitContext()
  const tracer = new Tracer({ recorder, ctxImpl })

  t.plan(14)
  const params = { foo: 'bar' }
  const action = (_params) => {
    t.deepEqual(_params, params)
    return Promise.resolve({message: 'hello world'})
  }

  return wrap(action, { tracer, serviceName: 'service-a' })(params).then(result => {
    const annotations = record.args.map(args => args[0]);

    t.deepEqual(result, {message: 'hello world'})
    t.is(annotations[0].annotation.annotationType, 'ServiceName');
    t.is(annotations[0].annotation.serviceName, 'service-a');

    t.is(annotations[1].annotation.annotationType, 'Rpc');
    t.is(annotations[1].annotation.name, 'POST');

    t.is(annotations[2].annotation.annotationType, 'BinaryAnnotation');
    t.is(annotations[2].annotation.key, 'openwhisk.id');
    t.is(annotations[2].annotation.value, '/namespace/action_name');

    t.is(annotations[3].annotation.annotationType, 'BinaryAnnotation');
    t.is(annotations[3].annotation.key, 'openwhisk.activation');
    t.is(annotations[3].annotation.value, 'abcdefg');

    t.is(annotations[4].annotation.annotationType, 'ServerRecv');

    t.is(annotations[5].annotation.annotationType, 'ServerSend');
  })
})

test('should record trace info for handler with parent parameters', t => {
  const record = sinon.spy()
  const recorder = { record, logger: {queue: []}}
  const ctxImpl = new ExplicitContext()
  const tracer = new Tracer({ recorder, ctxImpl })

  t.plan(18)
  const _zipkin = { traceId: '_parent_trace_id_', spanId: '_span_id_', parentId: '_parent_span_id_' }
  const params = { foo: 'bar', _zipkin }
  const action = () => {
    return Promise.resolve({message: 'hello world'})
  }

  return wrap(action, { tracer, serviceName: 'service-a' })(params).then(result => {
    const annotations = record.args.map(args => args[0]);

    annotations.forEach(ann => t.is(ann.traceId.traceId, '_parent_trace_id_'));
    annotations.forEach(ann => t.is(ann.traceId.spanId, '_span_id_'));
    annotations.forEach(ann => t.is(ann.traceId._parentId.value, '_parent_span_id_'));
  })
})

test('should record trace info for asynchronous action handler which rejects without parent parameters', t => {
  const record = sinon.spy()
  const recorder = { record, logger: {queue: []} }
  const ctxImpl = new ExplicitContext()
  const tracer = new Tracer({ recorder, ctxImpl })

  t.plan(14)
  const params = { foo: 'bar' }
  const action = (_params) => {
    t.deepEqual(_params, params)
    return Promise.reject({message: 'hello world'})
  }

  return wrap(action, { tracer, serviceName: 'service-a' })(params).catch(result => {
    const annotations = record.args.map(args => args[0]);

    t.deepEqual(result, {message: 'hello world'})
    t.is(annotations[0].annotation.annotationType, 'ServiceName');
    t.is(annotations[0].annotation.serviceName, 'service-a');

    t.is(annotations[1].annotation.annotationType, 'Rpc');
    t.is(annotations[1].annotation.name, 'POST');

    t.is(annotations[2].annotation.annotationType, 'BinaryAnnotation');
    t.is(annotations[2].annotation.key, 'openwhisk.id');
    t.is(annotations[2].annotation.value, '/namespace/action_name');

    t.is(annotations[3].annotation.annotationType, 'BinaryAnnotation');
    t.is(annotations[3].annotation.key, 'openwhisk.activation');
    t.is(annotations[3].annotation.value, 'abcdefg');

    t.is(annotations[4].annotation.annotationType, 'ServerRecv');

    t.is(annotations[5].annotation.annotationType, 'ServerSend');
  })
})

test('should record trace info for synchronous action handler without parent parameters', t => {
  const record = sinon.spy()
  const recorder = { record, logger: {queue: []} }
  const ctxImpl = new ExplicitContext()
  const tracer = new Tracer({ recorder, ctxImpl })

  t.plan(14)
  const params = { foo: 'bar' }
  const action = (_params) => {
    t.deepEqual(_params, params)
    return {message: 'hello world'}
  }

  return wrap(action, { tracer, serviceName: 'service-a' })(params).then(result => {
    const annotations = record.args.map(args => args[0]);

    t.deepEqual(result, {message: 'hello world'})
    t.is(annotations[0].annotation.annotationType, 'ServiceName');
    t.is(annotations[0].annotation.serviceName, 'service-a');

    t.is(annotations[1].annotation.annotationType, 'Rpc');
    t.is(annotations[1].annotation.name, 'POST');

    t.is(annotations[2].annotation.annotationType, 'BinaryAnnotation');
    t.is(annotations[2].annotation.key, 'openwhisk.id');
    t.is(annotations[2].annotation.value, '/namespace/action_name');

    t.is(annotations[3].annotation.annotationType, 'BinaryAnnotation');
    t.is(annotations[3].annotation.key, 'openwhisk.activation');
    t.is(annotations[3].annotation.value, 'abcdefg');

    t.is(annotations[4].annotation.annotationType, 'ServerRecv');

    t.is(annotations[5].annotation.annotationType, 'ServerSend');
  })
})

test('should record trace info for synchronous action handler throwing error', t => {
  const record = sinon.spy()
  const recorder = { record, logger: {queue: []} }
  const ctxImpl = new ExplicitContext()
  const tracer = new Tracer({ recorder, ctxImpl })

  t.plan(14)
  const params = { foo: 'bar' }
  const action = (_params) => {
    t.deepEqual(_params, params)
    throw new Error('broken')
  }

  return wrap(action, { tracer, serviceName: 'service-a' })(params).catch(result => {
    const annotations = record.args.map(args => args[0]);

    t.deepEqual(result.message, 'broken')
    t.is(annotations[0].annotation.annotationType, 'ServiceName');
    t.is(annotations[0].annotation.serviceName, 'service-a');

    t.is(annotations[1].annotation.annotationType, 'Rpc');
    t.is(annotations[1].annotation.name, 'POST');

    t.is(annotations[2].annotation.annotationType, 'BinaryAnnotation');
    t.is(annotations[2].annotation.key, 'openwhisk.id');
    t.is(annotations[2].annotation.value, '/namespace/action_name');

    t.is(annotations[3].annotation.annotationType, 'BinaryAnnotation');
    t.is(annotations[3].annotation.key, 'openwhisk.activation');
    t.is(annotations[3].annotation.value, 'abcdefg');

    t.is(annotations[4].annotation.annotationType, 'ServerRecv');

    t.is(annotations[5].annotation.annotationType, 'ServerSend');
  })
})


test('should record trace info for synchronous action handler returning error', t => {
  const record = sinon.spy()
  const recorder = { record, logger: {queue: []} }
  const ctxImpl = new ExplicitContext()
  const tracer = new Tracer({ recorder, ctxImpl })

  t.plan(14)
  const params = { foo: 'bar' }
  const action = (_params) => {
    t.deepEqual(_params, params)
    return Promise.reject({error: 'hello world'})
  }

  return wrap(action, { tracer, serviceName: 'service-a' })(params).catch(result => {
    const annotations = record.args.map(args => args[0]);

    t.deepEqual(result, {error: 'hello world'})
    t.is(annotations[0].annotation.annotationType, 'ServiceName');
    t.is(annotations[0].annotation.serviceName, 'service-a');

    t.is(annotations[1].annotation.annotationType, 'Rpc');
    t.is(annotations[1].annotation.name, 'POST');

    t.is(annotations[2].annotation.annotationType, 'BinaryAnnotation');
    t.is(annotations[2].annotation.key, 'openwhisk.id');
    t.is(annotations[2].annotation.value, '/namespace/action_name');

    t.is(annotations[3].annotation.annotationType, 'BinaryAnnotation');
    t.is(annotations[3].annotation.key, 'openwhisk.activation');
    t.is(annotations[3].annotation.value, 'abcdefg');

    t.is(annotations[4].annotation.annotationType, 'ServerRecv');

    t.is(annotations[5].annotation.annotationType, 'ServerSend');
  })
})


test('should record trace info for asynchronous action handler throwing errors without parent parameters', t => {
  const record = sinon.spy()
  const recorder = { record, logger: {queue: []} }
  const ctxImpl = new ExplicitContext()
  const tracer = new Tracer({ recorder, ctxImpl })

  t.plan(14)
  const params = { foo: 'bar' }
  const action = (_params) => {
    t.deepEqual(_params, params)
    throw new Error('hello world')
  }

  return wrap(action, { tracer, serviceName: 'service-a' })(params).catch(result => {
    const annotations = record.args.map(args => args[0]);

    t.deepEqual(result.message, 'hello world')
    t.is(annotations[0].annotation.annotationType, 'ServiceName');
    t.is(annotations[0].annotation.serviceName, 'service-a');

    t.is(annotations[1].annotation.annotationType, 'Rpc');
    t.is(annotations[1].annotation.name, 'POST');

    t.is(annotations[2].annotation.annotationType, 'BinaryAnnotation');
    t.is(annotations[2].annotation.key, 'openwhisk.id');
    t.is(annotations[2].annotation.value, '/namespace/action_name');

    t.is(annotations[3].annotation.annotationType, 'BinaryAnnotation');
    t.is(annotations[3].annotation.key, 'openwhisk.activation');
    t.is(annotations[3].annotation.value, 'abcdefg');

    t.is(annotations[4].annotation.annotationType, 'ServerRecv');

    t.is(annotations[5].annotation.annotationType, 'ServerSend');
  })
})
