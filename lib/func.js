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
          const traceId = new Some(params._zipkin.traceId);
          const spanId = new Some(params._zipkin.spanId);
          const parentId = new Some(params._zipkin.parentId);
          tracer.setId(new TraceId({
            traceId, spanId: spanId.value, parentId
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

        const cb = resolver => {
          return result => {
            tracer.scoped(() => {
              tracer.setId(traceId);
              tracer.recordAnnotation(new Annotation.ServerSend());

              // Timer loop in zipkin transporter does not stop process exiting.
              // We need to wait until all spans are recorded before returning.
              if (tracer.recorder.logger.queue) {
                const queueMonitor = setInterval(() => {
                  if (!tracer.recorder.logger.queue.length) {
                    clearInterval(queueMonitor);
                    resolver(result);
                  }
                }, 100)
              } else {
                resolver(result)
              }
            })
          }
        }

        try {
          const promiseOrResult = to_wrap(params)
          Promise.resolve(promiseOrResult)
            .then(cb(resolve))
            .catch(cb(reject))
        } catch (err) {
          cb(reject)(err)
        }
      })
    })
  }
}
