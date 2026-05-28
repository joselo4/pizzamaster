import React from 'react';

type EmptyStateProps = {
  title: string;
  description: string;
};

export default function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.03] p-6 text-center text-white/70">
      <div className="text-lg font-semibold text-white">{title}</div>
      <p className="mt-2 text-sm leading-6">{description}</p>
    </div>
  );
}
