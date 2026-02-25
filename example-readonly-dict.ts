interface ReadOnlyDict<T> {
  readonly [key: string]: T | undefined;
}

const dict: ReadOnlyDict<number> = { a: 1 };

// lecture — OK
const v = dict['a'];

// écriture — provoque une erreur TypeScript
// (décommentez pour voir l'erreur)
// dict['b'] = 2;

console.log('example loaded, read value:', v);
