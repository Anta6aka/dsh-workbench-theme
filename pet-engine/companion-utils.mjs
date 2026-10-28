export function isToolResultError(data = {}) {
  return data?.message?.isError === true
    || data?.isError === true
    || (typeof data?.error === 'string' && data.error.trim() !== '')
    || data?.ok === false
}
