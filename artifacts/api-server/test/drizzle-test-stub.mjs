export const and = (...conditions) => ({ kind: "and", conditions });
export const asc = (column) => ({ kind: "asc", column });
export const eq = (column, value) => ({ kind: "eq", column, value });
export const ne = (column, value) => ({ kind: "ne", column, value });