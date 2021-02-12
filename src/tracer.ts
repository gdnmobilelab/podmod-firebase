import tracer from 'dd-trace';

// initialized in a different file to avoid hoisting.
tracer.init({
  version: process.env.K_REVISION,
  service: "pushkin",
});

export default tracer;
