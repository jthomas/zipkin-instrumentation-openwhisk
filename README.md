# zipkin-instrumentation-openwhisk

This library enables [Zipkin tracing support](http://zipkin.io/) for serverless
functions running on the [OpenWhisk](http://openwhisk.org/) platform.

It supports instrumenting both the [function handlers](https://github.com/openwhisk/openwhisk/blob/master/docs/actions.md) and the [openwhisk
client library](https://github.com/openwhisk/openwhisk-client-js).

## install

```
npm install zipkin-instrumentation-openwhisk 
```

Using NPM modules on OpenWhisk requires the user to install them locally and
include this `node_modules` directory in the deployment archive.

See [here](http://jamesthom.as/blog/2016/11/28/npm-modules-in-openwhisk/) for more details.

Both the base `zipkin` module and a transport module (e.g. `zipkin-transport-http`
) must be included within this package.

## usage - serverless functions 

The instrumentation wraps the handler functions to record zipkin trace events
for each invocation. Parent trace identifiers should be passed in using the
`_zipkin` invocation property. These values are automatically added if you are
wrapping the client library, see below.

```
const {Tracer, ExplicitContext, BatchRecorder} = require('zipkin');
const {HttpLogger} = require('zipkin-transport-http');
const wrap = require('zipkin-instrumentation-openwhisk');

const ctxImpl = new ExplicitContext()

const recorder = new BatchRecorder({
  logger: new HttpLogger({
    endpoint: 'http://your_trace_server_ip:9411/api/v1/spans'
  })
});

const tracer = new Tracer({ctxImpl, recorder});
const serviceName = 'greeting-service';

const handler = function (params) {
  const name = params.name || 'stranger';

  return {message: `Hello, ${name}!`};
}

exports.handler = wrap(handler, {tracer, serviceName});
```

## usage - client library

The library will also wrap the OpenWhisk client library, allowing you to trace
HTTP calls to the platform.

When the library is used to invoke other serverless functions, the parent trace
identifiers are automatically added to the request.

```
const {Tracer, ExplicitContext, BatchRecorder} = require('zipkin');
const {HttpLogger} = require('zipkin-transport-http');
const wrap = require('zipkin-instrumentation-openwhisk');

const ctxImpl = new ExplicitContext()

const recorder = new BatchRecorder({
  logger: new HttpLogger({
    endpoint: 'http://your_trace_server_ip:9411/api/v1/spans'
  })
});

const tracer = new Tracer({ctxImpl, recorder});
const serviceName = 'greeting-service';

const openwhisk = require('openwhisk')
const ow = wrap(openwhisk(), { tracer, serviceName });

ow.actions.invoke({actionName: 'myServerlessFn'}).then(result => ...)
```

## testing 

Using the `ConsoleRecorder` module will log traces to the console, rather than
the Zipkin server. This can help to understand what is being sent to the server.

```
const {Tracer, ExplicitContext, BatchRecorder, ConsoleRecorder} = require('zipkin')

const ctxImpl = new ExplicitContext()
const recorder = new ConsoleRecorder()

const tracer = new Tracer({ctxImpl, recorder})
```
