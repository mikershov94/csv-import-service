export function assertNever(value: never): never {
    throw new Error(`Unexpected exhaustive value: ${JSON.stringify(value)}`);
}
