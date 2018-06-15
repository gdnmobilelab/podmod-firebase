export function JSONifyError(error: Error) {
  let representation: any = {};

  Object.getOwnPropertyNames(error).forEach(function(key) {
    representation[key] = (error as any)[key];
  }, error);

  return representation;
}
