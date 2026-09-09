function normalizeExpression(expression: string): string {
  return expression
    .replace(/\s/g, '')
    .replace(/,/g, '.')
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/−/g, '-');
}

export function evaluateExpression(expression: string): number | null {
  const source = normalizeExpression(expression);
  let position = 0;

  const parsePrimary = (): number => {
    if (source[position] === '(') {
      position += 1;
      const value = parseExpression();
      if (source[position] !== ')') throw new Error('Parênteses inválidos');
      position += 1;
      return value;
    }

    const start = position;
    while (/[0-9.]/.test(source[position] ?? '')) position += 1;
    if (start === position) throw new Error('Número inválido');

    const value = Number(source.slice(start, position));
    if (!Number.isFinite(value)) throw new Error('Número inválido');
    return value;
  };

  const parseUnary = (): number => {
    if (source[position] === '+') {
      position += 1;
      return parseUnary();
    }
    if (source[position] === '-') {
      position += 1;
      return -parseUnary();
    }
    return parsePrimary();
  };

  const parseTerm = (): number => {
    let value = parseUnary();
    while (source[position] === '*' || source[position] === '/') {
      const operator = source[position];
      position += 1;
      const nextValue = parseUnary();
      if (operator === '/') {
        if (nextValue === 0) throw new Error('Não é possível dividir por zero');
        value /= nextValue;
      } else {
        value *= nextValue;
      }
    }
    return value;
  };

  const parseExpression = (): number => {
    let value = parseTerm();
    while (source[position] === '+' || source[position] === '-') {
      const operator = source[position];
      position += 1;
      const nextValue = parseTerm();
      value = operator === '+' ? value + nextValue : value - nextValue;
    }
    return value;
  };

  if (!source) return null;

  try {
    const value = parseExpression();
    if (position !== source.length || !Number.isFinite(value)) return null;
    return value;
  } catch {
    return null;
  }
}

export function formatCalculatorValue(value: number): string {
  const rounded = Math.round((value + Number.EPSILON) * 1_000_000) / 1_000_000;
  return String(rounded).replace('.', ',');
}