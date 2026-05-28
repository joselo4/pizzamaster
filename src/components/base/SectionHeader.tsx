import React from 'react';

type SectionHeaderProps = {
  title: string;
  description?: string;
  action?: React.ReactNode;
};

export default function SectionHeader({ title, description, action }: SectionHeaderProps) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-3xl font-black tracking-tight text-white">{title}</h1>
        {description ? <p className="mt-2 max-w-3xl text-sm text-white/65">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}
