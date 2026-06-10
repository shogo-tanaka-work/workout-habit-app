import type { ReactNode } from 'react';

// ダッシュボードの1区画。ヘアライン罫線で区切るフラットな見た目（モバイルUIと同方針）。

type SectionProps = {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
};

export const Section = ({ title, subtitle, actions, children }: SectionProps) => (
  <section className="section">
    <header className="section-header">
      <div>
        <h2 className="section-title">{title}</h2>
        {subtitle ? <p className="section-subtitle">{subtitle}</p> : null}
      </div>
      {actions ? <div className="section-actions">{actions}</div> : null}
    </header>
    {children}
  </section>
);
