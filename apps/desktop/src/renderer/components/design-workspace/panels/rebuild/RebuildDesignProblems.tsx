export function RebuildDesignProblems({ problems }: { readonly problems: readonly string[] }) {
  return (
    <div>
      <p className="font-medium">The design itself cannot be built:</p>
      <ul className="list-disc pl-5 text-muted-foreground">
        {problems.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ul>
    </div>
  );
}
