export async function importNodeLlamaCpp(): Promise<typeof import("node-llama-cpp")> {
  const runtimeImport = new Function("specifier", "return import(specifier)") as (
    specifier: string,
  ) => Promise<typeof import("node-llama-cpp")>;
  return await runtimeImport("node-llama-cpp");
}
