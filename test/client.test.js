'use strict'

import test from 'ava';
import wrap from '../lib/client.js'
import sinon from 'sinon'
import { Tracer, ExplicitContext, createNoopTracer } from 'zipkin'

test.before(t => {
  process.env['__OW_ACTIVATION_ID'] = 'abcdefg'
})

test('should monkey-patch client library to capture requests', t => {
  const record = sinon.spy()
  const recorder = { record }
  const ctxImpl = new ExplicitContext()
  const tracer = new Tracer({ recorder, ctxImpl })

  t.plan(1)

  class BaseClass {
    request () {
    } 
  }

  class Operation extends BaseClass {}

  const instances = {
    actions: new Operation()
  }

  const fnRef = instances.actions.request

  const wrappedClient = wrap(instances, {tracer})

  t.not(fnRef, instances.actions.request)
})

test('should record trace info for action invoke operations', t => {
  const record = sinon.spy()
  const recorder = { record }
  const ctxImpl = new ExplicitContext()
  const tracer = new Tracer({ recorder, ctxImpl })

  t.plan(33)
  const params = { foo: 'bar' }

  class BaseClass {
    request (options) {
      t.deepEqual(options.body, {a: 1, b: true, c: 'hello', _zipkin: {
        traceId: tracer.id.traceId, spanId: tracer.id.spanId, parentId: tracer.id._parentId.value
      }})
      t.true(options.resolveWithFullResponse)
      return Promise.resolve({statusCode: 200, body: 'testing'})
    } 
  }

  class Operation extends BaseClass {}

  const instances = {
    actions: new Operation()
  }

  const fnRef = instances.actions.request

  const reqOptions = {
    method: 'POST',
    url: 'https://openwhisk.host.com/api/v1/namespaces/_/actions/package/blah',
    body: {a: 1, b: true, c: 'hello'}
  }

  return new Promise((resolve, reject) => {
    tracer.scoped(() => {
      const rootId = tracer.createRootId();
      tracer.setId(rootId);

      wrap(instances, { tracer, serviceName: 'service-a' }).actions.request(reqOptions).then(result => {
        t.is(result, 'testing')
        const annotations = record.args.map(args => args[0]);

        annotations.forEach(ann => t.is(ann.traceId.traceId, rootId.traceId));
        annotations.forEach(ann => t.not(ann.traceId.spanId, rootId.spanId));
        annotations.forEach(ann => t.is(ann.traceId._parentId.value, rootId.spanId));

        t.is(annotations[0].annotation.annotationType, 'ServiceName');
        t.is(annotations[0].annotation.serviceName, 'service-a');

        t.is(annotations[1].annotation.annotationType, 'Rpc');
        t.is(annotations[1].annotation.name, reqOptions.method);

        t.is(annotations[2].annotation.annotationType, 'BinaryAnnotation');
        t.is(annotations[2].annotation.key, 'http.url');
        t.is(annotations[2].annotation.value, 'https://openwhisk.host.com/api/v1/namespaces/_/actions/package/blah');

        t.is(annotations[3].annotation.annotationType, 'ClientSend');

        t.is(annotations[4].annotation.annotationType, 'BinaryAnnotation');
        t.is(annotations[4].annotation.key, 'http.status_code');
        t.is(annotations[4].annotation.value, '200');

        t.is(annotations[5].annotation.annotationType, 'ClientRecv');

        resolve()
      }).catch(reject)
    })
  })
})


test('should record trace info for non-action invoke operations', t => {
  const record = sinon.spy()
  const recorder = { record }
  const ctxImpl = new ExplicitContext()
  const tracer = new Tracer({ recorder, ctxImpl })

  t.plan(33)
  const params = { foo: 'bar' }

  class BaseClass {
    request (options) {
      t.deepEqual(options.body, {})
      t.true(options.resolveWithFullResponse)
      return Promise.resolve({statusCode: 200, body: 'testing'})
    } 
  }

  class Operation extends BaseClass {}

  const instances = {
    actions: new Operation()
  }

  const fnRef = instances.actions.request

  const reqOptions = {
    method: 'METHOD',
    url: 'some_url',
    body: {}
  }

  return new Promise((resolve, reject) => {
    tracer.scoped(() => {
      const rootId = tracer.createRootId();
      tracer.setId(rootId);

      wrap(instances, { tracer, serviceName: 'service-a' }).actions.request(reqOptions).then(result => {
        t.is(result, 'testing')
        const annotations = record.args.map(args => args[0]);

        annotations.forEach(ann => t.is(ann.traceId.traceId, rootId.traceId));
        annotations.forEach(ann => t.not(ann.traceId.spanId, rootId.spanId));
        annotations.forEach(ann => t.is(ann.traceId._parentId.value, rootId.spanId));

        t.is(annotations[0].annotation.annotationType, 'ServiceName');
        t.is(annotations[0].annotation.serviceName, 'service-a');

        t.is(annotations[1].annotation.annotationType, 'Rpc');
        t.is(annotations[1].annotation.name, reqOptions.method);

        t.is(annotations[2].annotation.annotationType, 'BinaryAnnotation');
        t.is(annotations[2].annotation.key, 'http.url');
        t.is(annotations[2].annotation.value, 'some_url');

        t.is(annotations[3].annotation.annotationType, 'ClientSend');

        t.is(annotations[4].annotation.annotationType, 'BinaryAnnotation');
        t.is(annotations[4].annotation.key, 'http.status_code');
        t.is(annotations[4].annotation.value, '200');

        t.is(annotations[5].annotation.annotationType, 'ClientRecv');

        resolve()
      }).catch(reject)
    })
  })
})

test('should throw errors for invalid client library instance', t => {
  t.throws(() => {
    wrap({}, {})
  }, /incorrect client library instance/)
})
