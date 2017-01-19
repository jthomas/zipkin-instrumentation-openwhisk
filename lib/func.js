const {
  Annotation,
  option: {Some, None},
  TraceId
} = require('zipkin')

module.exports = (to_wrap, options) => {
  return (params) => {
    const { tracer, serviceName } = options
    return new Promise((resolve, reject) => {
      tracer.scoped(() => {
        if (params.hasOwnProperty('_zipkin')) {
          const traceId = new Some(params._zipkin.traceId)
          const spanId = new Some(params._zipkin.spanId)
          tracer.setId(new TraceId({
            traceId, spanId, parentId: spanId
          }))
        } else {
          tracer.setId(tracer.createRootId());
        }
        const traceId = tracer.id;

        tracer.recordServiceName(serviceName);
        tracer.recordRpc('POST');
        tracer.recordBinary('openwhisk.id', process.env['__OW_ACTION_NAME']);
        tracer.recordBinary('openwhisk.activation', process.env['__OW_ACTIVATION_ID']);
        tracer.recordAnnotation(new Annotation.ServerRecv());

        try {
          const promiseOrResult = to_wrap(params)
          Promise.resolve(promiseOrResult).then(result => {
            tracer.scoped(() => {
              tracer.setId(traceId);
              tracer.recordAnnotation(new Annotation.ServerSend());
            });
            
            if (result && result.hasOwnProperty('error')) {
              reject(result)
            } else {
              resolve(result)
            }
          })
        } catch (err) {
          reject(err)
        }
      })
    })
  }
}
