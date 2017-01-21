const {
  Annotation,
  option: {Some, None},
  TraceId
} = require('zipkin')

const getBaseOperationObj = (instance) => {
  if (!instance.hasOwnProperty('actions')) {
    throw new Error('incorrect client library instance')
  }

  const Actions = Object.getPrototypeOf(instance.actions)
  const BaseOperation = Object.getPrototypeOf(Actions)

  if (!BaseOperation.hasOwnProperty('request')) {
    throw new Error('incorrect client library instance')
  }

  return BaseOperation
}

module.exports = (to_wrap, options) => {
  const { tracer, serviceName } = options
  const BaseOperation = getBaseOperationObj(to_wrap)

  const fnRef = BaseOperation.request

  BaseOperation.request = function (options) {

    return new Promise((resolve, reject) => {
      tracer.scoped(() => {

        tracer.setId(tracer.createChildId());
        const traceId = tracer.id;

        options.resolveWithFullResponse = true;

        // When we are invoking another action, pass zipkin
        // trace parameters in the request body.
        if (options.url.includes('/actions/') && options.method == 'POST') {
          options.body._zipkin = {
            traceId: traceId.traceId,
            spanId: traceId.spanId,
            parentId: traceId.parentId
          }
        }

        tracer.recordServiceName(serviceName);
        tracer.recordRpc(options.method);
        tracer.recordBinary('http.url', options.url);
        tracer.recordAnnotation(new Annotation.ClientSend());

        fnRef.apply(BaseOperation, arguments).then(result => {
          tracer.scoped(() => {
            tracer.setId(traceId);
            tracer.recordBinary('http.status_code', result.statusCode.toString());
            tracer.recordAnnotation(new Annotation.ClientRecv());
          });
          resolve(result.body)
        }).catch(err => {
          tracer.scoped(() => {
            tracer.setId(traceId);
            tracer.recordBinary('request.error', err.toString());
            tracer.recordAnnotation(new Annotation.ClientRecv());
          });
          reject(err);
        })
      })
    })
  }

  return to_wrap
}
