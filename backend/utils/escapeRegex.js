// Escape user-supplied text before using it in a RegExp, preventing both
// regex-injection and ReDoS (catastrophic backtracking) from search inputs.
module.exports = (str) => String(str == null ? '' : str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
