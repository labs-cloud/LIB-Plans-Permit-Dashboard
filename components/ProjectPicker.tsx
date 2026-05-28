'use client';

interface Props {
  projectId: string | undefined;
  projectNames: string[];
  onPortfolio: () => void;
  onProject: (name: string) => void;
  isEmbed?: boolean;
}

export function ProjectPicker({
  projectId,
  projectNames,
  onPortfolio,
  onProject,
  isEmbed,
}: Props) {
  if (isEmbed && projectId) {
    return (
      <span
        style={{
          height: 32,
          padding: '0 10px',
          border: '0.5px solid var(--color-border-secondary)',
          borderRadius: 'var(--border-radius-md)',
          background: 'var(--color-background-secondary)',
          color: 'var(--color-text-primary)',
          fontFamily: 'inherit',
          fontSize: 13,
          minWidth: 200,
          fontWeight: 500,
          display: 'inline-flex',
          alignItems: 'center',
        }}
      >
        {projectId}
      </span>
    );
  }
  return (
    <select
      className="budget-project-select"
      value={projectId ?? ''}
      onChange={(e) => {
        if (!e.target.value) onPortfolio();
        else onProject(e.target.value);
      }}
      style={{
        height: 32,
        padding: '0 10px',
        border: '0.5px solid var(--color-border-secondary)',
        borderRadius: 'var(--border-radius-md)',
        background: 'var(--color-background-primary)',
        color: 'var(--color-text-primary)',
        fontFamily: 'inherit',
        fontSize: 13,
        minWidth: 200,
        fontWeight: 500,
      }}
    >
      <option value="">★ All projects</option>
      {projectNames.map((name) => (
        <option key={name} value={name}>
          {name}
        </option>
      ))}
    </select>
  );
}
