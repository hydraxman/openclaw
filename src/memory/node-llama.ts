export async function importNodeLlamaCpp() {
  const runtimeImport = new Function("specifier", "return import(specifier)") as (
    specifier: string,
  ) => Promise<unknown>;
  return runtimeImport("node-llama-cpp");
}
